import { describe, expect, it } from 'vitest';
import {
  IMAGE_EXTENSIONS,
  MAX_LOGO_BYTES,
  checkLogo,
  extensionFor,
  sniffImageType,
} from '../image';

const bytes = (...values: number[]) => new Uint8Array(values);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const GIF87 = bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x10, 0x00);
const GIF89 = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00);
const BMP = bytes(0x42, 0x4d, 0x36, 0x00, 0x00, 0x00);
const WEBP = bytes(
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x24, 0x00, 0x00, 0x00, // size
  0x57, 0x45, 0x42, 0x50, // "WEBP"
  0x56, 0x50, 0x38, 0x20,
);

describe('sniffImageType', () => {
  it('recognises each accepted format', () => {
    expect(sniffImageType(PNG)).toBe('png');
    expect(sniffImageType(JPEG)).toBe('jpeg');
    expect(sniffImageType(GIF87)).toBe('gif');
    expect(sniffImageType(GIF89)).toBe('gif');
    expect(sniffImageType(WEBP)).toBe('webp');
    expect(sniffImageType(BMP)).toBe('bmp');
  });

  it('rejects a PDF, whatever it is called', () => {
    // The case this exists for: a `.png` that is really a PDF reaches the
    // receipt template and prints nothing, at the till, during service.
    expect(sniffImageType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBeNull();
  });

  it('rejects an executable and a zip', () => {
    expect(sniffImageType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    expect(sniffImageType(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
  });

  it('rejects SVG, which is text and would need parsing to be trusted', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(sniffImageType(svg)).toBeNull();
  });

  it('rejects a RIFF container that is not WebP', () => {
    // A WAV file also starts with "RIFF"; the format tag sits at offset 8,
    // so a prefix check alone would accept it.
    const wav = bytes(
      0x52, 0x49, 0x46, 0x46,
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // "WAVE"
    );
    expect(sniffImageType(wav)).toBeNull();
  });

  it('rejects a truncated signature rather than reading past the end', () => {
    expect(sniffImageType(bytes(0x89, 0x50))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
    // "GIF8" alone is not enough to tell the version.
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull();
  });
});

describe('extensionFor', () => {
  it('stores JPEG as .jpg, and everything else under its own name', () => {
    expect(extensionFor('jpeg')).toBe('jpg');
    expect(extensionFor('png')).toBe('png');
    expect(extensionFor('webp')).toBe('webp');
  });

  it('produces an extension the picker offers, for every type it can sniff', () => {
    // Otherwise a file could be accepted on upload and then be unreachable
    // through the picker when the outlet goes to replace it.
    for (const type of ['png', 'jpeg', 'gif', 'webp', 'bmp'] as const) {
      expect(IMAGE_EXTENSIONS).toContain(extensionFor(type));
    }
  });
});

describe('checkLogo', () => {
  it('accepts a real image and reports its type', () => {
    expect(checkLogo(PNG)).toEqual({ ok: true, type: 'png' });
  });

  it('rejects an empty file', () => {
    expect(checkLogo(bytes(), 0)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a file over the cap, using the real size not the prefix', () => {
    // The caller passes a short prefix for sniffing, so the size has to come
    // from the file itself or the cap would never trigger.
    const check = checkLogo(PNG, MAX_LOGO_BYTES + 1);
    expect(check).toEqual({ ok: false, reason: 'too-large' });
  });

  it('accepts a file exactly at the cap', () => {
    expect(checkLogo(PNG, MAX_LOGO_BYTES).ok).toBe(true);
  });

  it('gives a distinct reason for each rule, so the UI can say what to fix', () => {
    const reasonOf = (check: ReturnType<typeof checkLogo>) =>
      check.ok ? null : check.reason;

    const reasons = [
      reasonOf(checkLogo(bytes(), 0)),
      reasonOf(checkLogo(PNG, MAX_LOGO_BYTES + 1)),
      reasonOf(checkLogo(bytes(0x25, 0x50, 0x44, 0x46))),
    ];
    expect(new Set(reasons).size).toBe(3);
    expect(reasons).toEqual(['empty', 'too-large', 'not-an-image']);
  });
});
