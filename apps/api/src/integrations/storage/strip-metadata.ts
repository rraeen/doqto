/**
 * Removes metadata from public photos before they are stored (INT-06 review):
 * a doctor's phone photo can carry GPS coordinates, device serials and
 * timestamps in EXIF/XMP. Pure byte surgery, no re-encoding and no image
 * library. The JPEG orientation tag is kept (rebuilt as a minimal EXIF block)
 * so portrait phone photos still display upright.
 */
export function stripImageMetadata(body: Buffer, contentType: string): Buffer {
  switch (contentType) {
    case 'image/jpeg':
      return stripJpeg(body);
    case 'image/png':
      return stripPng(body);
    case 'image/webp':
      return stripWebp(body);
    default:
      return body;
  }
}

// --- JPEG -------------------------------------------------------------------

/** APP1 (EXIF, XMP), APP12, APP13 (IPTC/Photoshop), APP14 is kept (colour transform), COM. */
const DROP_JPEG = new Set([0xe1, 0xec, 0xed, 0xfe]);

function stripJpeg(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let orientation: number | undefined;
  let pos = 2;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) return buf; // not a marker: leave the file untouched
    const marker = buf[pos + 1] as number;
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: the rest is image data.
      out.push(buf.subarray(pos));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    const len = buf.readUInt16BE(pos + 2);
    if (len < 2 || pos + 2 + len > buf.length) return buf;
    const segment = buf.subarray(pos, pos + 2 + len);
    if (marker === 0xe1 && orientation === undefined)
      orientation = readExifOrientation(segment.subarray(4));
    if (!DROP_JPEG.has(marker)) out.push(segment);
    pos += 2 + len;
  }
  if (orientation && orientation !== 1) out.splice(1, 0, minimalExif(orientation));
  return Buffer.concat(out);
}

function readExifOrientation(app1: Buffer): number | undefined {
  if (app1.subarray(0, 6).toString('latin1') !== 'Exif\0\0') return undefined;
  const tiff = app1.subarray(6);
  if (tiff.length < 8) return undefined;
  const le = tiff.toString('latin1', 0, 2) === 'II';
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return undefined;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return undefined;
    if (u16(entry) === 0x0112) {
      const v = u16(entry + 8);
      return v >= 1 && v <= 8 ? v : undefined;
    }
  }
  return undefined;
}

/** APP1 with a one-entry IFD0: Orientation only. */
function minimalExif(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 offset
  tiff.writeUInt16LE(1, 8); // one entry
  tiff.writeUInt16LE(0x0112, 10); // Orientation
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // count
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22); // no next IFD
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xffe1, 0);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

// --- PNG --------------------------------------------------------------------

const DROP_PNG = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const end = pos + 12 + len;
    if (end > buf.length) return buf;
    if (!DROP_PNG.has(type)) out.push(buf.subarray(pos, end));
    pos = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

// --- WebP -------------------------------------------------------------------

function stripWebp(buf: Buffer): Buffer {
  if (buf.length < 12) return buf;
  const out: Buffer[] = [];
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const type = buf.toString('latin1', pos, pos + 4);
    const len = buf.readUInt32LE(pos + 4);
    const end = pos + 8 + len + (len % 2);
    if (pos + 8 + len > buf.length) return buf;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Buffer.from(buf.subarray(pos, Math.min(end, buf.length)));
      // VP8X flags: clear EXIF (0x08) and XMP (0x04) presence bits.
      if (type === 'VP8X' && chunk.length > 8) chunk[8] = (chunk[8] as number) & ~0x0c;
      out.push(chunk);
    }
    pos = end;
  }
  const body = Buffer.concat(out);
  const header = Buffer.from(buf.subarray(0, 12));
  header.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([header, body]);
}
