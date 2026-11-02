import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { isInside, resolveLocalAsset } from '../security';

// Use a POSIX-ish root on both platforms; `path.resolve` normalises it.
const ROOT = path.resolve('/app/userData/images');

describe('isInside', () => {
  it('accepts a direct child', () => {
    expect(isInside(ROOT, path.join(ROOT, 'dish_1.png'))).toBe(true);
  });

  it('accepts a nested child', () => {
    expect(isInside(ROOT, path.join(ROOT, 'thumbs', 'dish_1.png'))).toBe(true);
  });

  it('accepts the root itself', () => {
    expect(isInside(ROOT, ROOT)).toBe(true);
  });

  it('rejects a parent directory', () => {
    expect(isInside(ROOT, path.resolve('/app/userData'))).toBe(false);
  });

  it('rejects a sibling whose name merely starts with the root', () => {
    // The trap a `startsWith` check falls into.
    expect(isInside(ROOT, path.resolve('/app/userData/images-secret/x.png'))).toBe(false);
  });

  it('rejects traversal out of the root', () => {
    expect(isInside(ROOT, path.join(ROOT, '..', '..', 'pos.db'))).toBe(false);
  });

  it('rejects an unrelated absolute path', () => {
    expect(isInside(ROOT, path.resolve('/etc/passwd'))).toBe(false);
  });
});

describe('resolveLocalAsset', () => {
  it('resolves an image inside the root', () => {
    const url = `local://${ROOT.split(path.sep).join('/')}/dish_1.png`;
    expect(resolveLocalAsset(url, ROOT)).toBe(path.join(ROOT, 'dish_1.png'));
  });

  it('rejects a URL that is not the local scheme', () => {
    expect(resolveLocalAsset(`file://${ROOT}/dish_1.png`, ROOT)).toBeNull();
    expect(resolveLocalAsset('https://example.com/x.png', ROOT)).toBeNull();
  });

  it('rejects traversal to a file outside the root', () => {
    // The original handler would have happily served this.
    const url = `local://${ROOT.split(path.sep).join('/')}/../../pos.db`;
    expect(resolveLocalAsset(url, ROOT)).toBeNull();
  });

  it('rejects percent-encoded traversal', () => {
    const url = `local://${ROOT.split(path.sep).join('/')}/%2e%2e/%2e%2e/pos.db`;
    expect(resolveLocalAsset(url, ROOT)).toBeNull();
  });

  it('rejects an absolute path to somewhere else entirely', () => {
    expect(resolveLocalAsset('local:///etc/passwd', ROOT)).toBeNull();
  });

  it('rejects a malformed percent escape rather than guessing', () => {
    expect(resolveLocalAsset('local://%E0%A4%A', ROOT)).toBeNull();
  });

  it('rejects a path containing a NUL byte', () => {
    const url = `local://${ROOT.split(path.sep).join('/')}/a%00.png`;
    expect(resolveLocalAsset(url, ROOT)).toBeNull();
  });

  it('ignores a cache-busting query string', () => {
    const url = `local://${ROOT.split(path.sep).join('/')}/dish_1.png?v=2`;
    expect(resolveLocalAsset(url, ROOT)).toBe(path.join(ROOT, 'dish_1.png'));
  });

  it('ignores a fragment', () => {
    const url = `local://${ROOT.split(path.sep).join('/')}/dish_1.png#x`;
    expect(resolveLocalAsset(url, ROOT)).toBe(path.join(ROOT, 'dish_1.png'));
  });

  it('decodes spaces in a filename', () => {
    const url = `local://${ROOT.split(path.sep).join('/')}/my%20dish.png`;
    expect(resolveLocalAsset(url, ROOT)).toBe(path.join(ROOT, 'my dish.png'));
  });

  it('handles a Windows drive path with a leading slash', () => {
    // The renderer builds these by replacing `file://` with `local://`, which
    // yields both `local://C:/…` and `local:///C:/…`.
    const winRoot = 'C:\\app\\images';
    expect(resolveLocalAsset('local:///C:/app/images/a.png', winRoot))
      .toBe(path.resolve('C:/app/images/a.png'));
  });
});
