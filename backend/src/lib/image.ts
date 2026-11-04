/**
 * Identifying an uploaded image by its contents.
 *
 * An outlet uploads its logo from their own machine, and the file extension
 * is whatever the file happens to be called. Trusting it means a `.png` that
 * is really a PDF reaches the receipt template and prints nothing — on a
 * customer's invoice, at the till, during service. Sniffing the magic bytes
 * costs one read and fails at the point of upload instead.
 *
 * Raster only, deliberately. SVG would have to be parsed to be trusted, and
 * a thermal printer rasterises everything anyway, so accepting it would add
 * a parser to the trusted path for no gain at the printer.
 */

export type ImageType = 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp';

/** Extensions offered in the file picker, matching the sniffable types. */
export const IMAGE_EXTENSIONS: readonly string[] = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
];

/**
 * A logo is a logo, not a photograph.
 *
 * The cap is generous for artwork and small enough that a 40 MB camera JPEG
 * dropped in by mistake is rejected rather than embedded in every receipt.
 */
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;

function startsWith(buffer: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) { return false; }
  return bytes.every((b, i) => buffer[offset + i] === b);
}

/**
 * The image type `buffer` actually holds, or null if it is not one.
 *
 * Only the leading bytes are inspected, so the caller may pass a short prefix
 * of the file rather than the whole thing.
 */
export function sniffImageType(buffer: Uint8Array): ImageType | null {
  // PNG: \x89 P N G \r \n \x1a \n
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) { return 'png'; }

  // JPEG: FF D8 FF — every variant (JFIF, Exif, raw) shares this.
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) { return 'jpeg'; }

  // GIF: "GIF87a" or "GIF89a"
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38]) &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
    return 'gif';
  }

  // WebP: "RIFF" .... "WEBP" — the size field sits between the two, so the
  // second tag has to be checked at its own offset rather than by prefix.
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }

  // BMP: "BM"
  if (startsWith(buffer, [0x42, 0x4d])) { return 'bmp'; }

  return null;
}

/** The extension to store a sniffed image under, so the type stays obvious. */
export function extensionFor(type: ImageType): string {
  return type === 'jpeg' ? 'jpg' : type;
}

export type LogoRejection = 'too-large' | 'empty' | 'not-an-image';

/**
 * Discriminated on `ok`, so a caller that has checked it is handed the type
 * without asserting — the shape makes the invalid state unrepresentable
 * rather than relying on the call site to remember.
 */
export type LogoCheck =
  | { ok: true; type: ImageType }
  | { ok: false; reason: LogoRejection };

/**
 * Decide whether an uploaded file may become the outlet's logo.
 *
 * Returns a reason rather than throwing, so the UI can say which rule the
 * file broke — "that file is not an image" and "that image is too large" need
 * different corrections from whoever is standing at the till.
 */
export function checkLogo(buffer: Uint8Array, size: number = buffer.length): LogoCheck {
  if (size === 0) { return { ok: false, reason: 'empty' }; }
  if (size > MAX_LOGO_BYTES) { return { ok: false, reason: 'too-large' }; }

  const type = sniffImageType(buffer);
  if (!type) { return { ok: false, reason: 'not-an-image' }; }

  return { ok: true, type };
}
