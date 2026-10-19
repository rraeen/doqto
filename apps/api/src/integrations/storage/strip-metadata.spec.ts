import { stripImageMetadata } from './strip-metadata';
import { sniffContentType } from './upload-limits';

const seg = (marker: number, payload: Buffer) => {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xff00 | marker, 0);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
};

/** EXIF APP1 (big-endian TIFF) with Orientation and a fake GPS marker string. */
function exifApp1(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0112, 10);
  tiff.writeUInt16BE(3, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt32BE(0, 22);
  return seg(
    0xe1,
    Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, Buffer.from('GPSLatitude 28.3670N')]),
  );
}

const SCAN = Buffer.concat([
  seg(0xda, Buffer.from([1, 2, 3])),
  Buffer.from('entropy-coded-data'),
  Buffer.from([0xff, 0xd9]),
]);

function jpeg(orientation: number): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0rest', 'latin1')),
    exifApp1(orientation),
    seg(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>GPS</x:xmpmeta>', 'latin1')),
    seg(0xed, Buffer.from('Photoshop 3.0\0IPTC city=Bareilly', 'latin1')),
    seg(0xfe, Buffer.from('camera serial 12345')),
    seg(0xdb, Buffer.from('quant-table')),
    SCAN,
  ]);
}

const pngChunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.from([0, 0, 0, 0])]);
};

const riffChunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length);
  return Buffer.concat([
    Buffer.from(type, 'latin1'),
    len,
    data,
    data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0),
  ]);
};

describe('stripImageMetadata', () => {
  it('drops EXIF, XMP, IPTC and comments from JPEG and keeps the image data', () => {
    const out = stripImageMetadata(jpeg(1), 'image/jpeg');
    const text = out.toString('latin1');
    expect(text).not.toMatch(/GPS|IPTC|serial|xmpmeta/);
    expect(text).toContain('JFIF');
    expect(text).toContain('quant-table');
    expect(out.subarray(out.length - SCAN.length)).toEqual(SCAN);
    expect(sniffContentType(out)).toBe('image/jpeg');
    expect(text).not.toContain('Exif'); // orientation 1 needs no EXIF at all
  });

  it('keeps the JPEG orientation as a minimal EXIF block', () => {
    const out = stripImageMetadata(jpeg(6), 'image/jpeg');
    expect(out.toString('latin1')).not.toMatch(/GPS/);
    const app1 = out.indexOf(Buffer.from('Exif\0\0', 'latin1'));
    expect(app1).toBe(6); // right after SOI + APP1 header
    const tiff = out.subarray(app1 + 6);
    expect(tiff.toString('latin1', 0, 2)).toBe('II');
    expect(tiff.readUInt16LE(10)).toBe(0x0112);
    expect(tiff.readUInt16LE(18)).toBe(6);
  });

  it('leaves malformed JPEGs unchanged rather than corrupting them', () => {
    const broken = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2]);
    expect(stripImageMetadata(broken, 'image/jpeg')).toEqual(broken);
  });

  it('drops text and EXIF chunks from PNG', () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', Buffer.alloc(13)),
      pngChunk('tEXt', Buffer.from('Comment\0GPS 28.36')),
      pngChunk('eXIf', Buffer.from('MM\0*GPS')),
      pngChunk('iTXt', Buffer.from('XML:com.adobe.xmp\0GPS')),
      pngChunk('IDAT', Buffer.from('pixels')),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
    const out = stripImageMetadata(png, 'image/png');
    const text = out.toString('latin1');
    expect(text).not.toMatch(/GPS|tEXt|eXIf|iTXt/);
    expect(text).toContain('IHDR');
    expect(text).toContain('pixels');
    expect(text.endsWith('IEND\0\0\0\0')).toBe(true);
  });

  it('drops EXIF and XMP chunks from WebP and fixes the header', () => {
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x0c | 0x10; // EXIF + XMP + alpha flags
    const chunks = Buffer.concat([
      riffChunk('VP8X', vp8x),
      riffChunk('VP8 ', Buffer.from('frame')),
      riffChunk('EXIF', Buffer.from('GPS 28.36')),
      riffChunk('XMP ', Buffer.from('<x:xmpmeta>GPS</x:xmpmeta>')),
    ]);
    const head = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
    head.writeUInt32LE(chunks.length + 4, 4);
    const out = stripImageMetadata(Buffer.concat([head, chunks]), 'image/webp');
    expect(out.toString('latin1')).not.toMatch(/GPS|EXIF|XMP/);
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    expect(out[20]).toBe(0x10); // only the alpha flag left
    expect(out.toString('latin1')).toContain('frame');
    expect(sniffContentType(out)).toBe('image/webp');
  });

  it('never touches PDFs', () => {
    const pdf = Buffer.from('%PDF-1.7 /Author (Dr A)');
    expect(stripImageMetadata(pdf, 'application/pdf')).toBe(pdf);
  });
});
