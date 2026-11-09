import { describe, expect, it } from 'vitest';
import { mediaSrc } from './media';

describe('mediaSrc', () => {
  it('loads demo-storage photos from the app itself, whatever address was saved with them', () => {
    expect(
      mediaSrc('http://192.168.1.19:4000/api/v1/demo-storage/public/units/1/photo-2.png'),
    ).toBe('/api/v1/demo-storage/public/units/1/photo-2.png');
    expect(
      mediaSrc('https://old-name.ngrok-free.app/api/v1/demo-storage/public/doctors/9/p.jpg'),
    ).toBe('/api/v1/demo-storage/public/doctors/9/p.jpg');
  });
  it('leaves links of a real storage bucket and empty values alone', () => {
    expect(mediaSrc('https://cdn.doqto.com/doctors/9/p.jpg')).toBe(
      'https://cdn.doqto.com/doctors/9/p.jpg',
    );
    expect(mediaSrc(null)).toBeUndefined();
    expect(mediaSrc('')).toBeUndefined();
  });
});
