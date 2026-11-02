/**
 * Electron hardening.
 *
 * The app is offline and `contextIsolation` is on, but it still renders
 * user-supplied content: dish images chosen from disk, and item names that
 * end up inside receipt HTML. Two things needed fixing:
 *
 *  1. The `local://` protocol handler forwarded *any* path straight to
 *     `file://`, so one crafted URL in the renderer could read any file the
 *     user account can read. It is now confined to the image directory.
 *  2. There was no Content-Security-Policy and no navigation guard, so a
 *     stray link or injected markup could pull in remote code.
 */

import { app, net, protocol, session, shell, type BrowserWindow } from 'electron';
import * as path from 'path';

/** The one directory `local://` is allowed to serve. */
export function imagesDirectory(): string {
  return path.join(app.getPath('userData'), 'images');
}

/**
 * True when `candidate` really sits inside `root`.
 *
 * `startsWith` alone is not enough: `/data/images-secret` starts with
 * `/data/images`. Comparing against `root + sep` closes that, and `relative`
 * catches `..` traversal after normalisation.
 */
export function isInside(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (resolved === resolvedRoot) { return true; }
  const rel = path.relative(resolvedRoot, resolved);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Resolve a `local://` URL to a real path, or null if it escapes the
 * image directory.
 *
 * Exported for unit testing — the traversal rules are the security boundary,
 * so they are asserted directly rather than only through Electron.
 */
export function resolveLocalAsset(url: string, root: string): string | null {
  const prefix = 'local://';
  if (!url.startsWith(prefix)) { return null; }

  let raw = url.slice(prefix.length);

  // Strip a query or fragment a cache-buster may have appended.
  raw = raw.split('?')[0].split('#')[0];

  // `local://C:/path` and `local:///C:/path` both reach here; the renderer
  // builds these by string replacement, so both spellings occur.
  while (raw.startsWith('/') && /^\/[A-Za-z]:/.test(raw)) {
    raw = raw.slice(1);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A malformed escape sequence is not a path we should guess at.
    return null;
  }

  // A NUL byte truncates the path in some native APIs.
  if (decoded.includes('\0')) { return null; }

  const resolved = path.resolve(decoded);
  return isInside(root, resolved) ? resolved : null;
}

/**
 * Register the confined `local://` handler.
 *
 * Must run after `app.whenReady()`.
 */
export function registerLocalProtocol(): void {
  const root = imagesDirectory();

  protocol.handle('local', (request) => {
    const resolved = resolveLocalAsset(request.url, root);
    if (!resolved) {
      // Deliberately uninformative: do not confirm whether a path exists.
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(`file://${resolved.split(path.sep).join('/')}`);
  });
}

/**
 * Apply a Content-Security-Policy to the renderer.
 *
 * `'unsafe-inline'` is required for styles because Tailwind's runtime and the
 * popover polyfills inject style attributes. Scripts are restricted to the
 * bundle itself, and `connect-src` is closed entirely — the app is offline,
 * so nothing should ever reach the network.
 */
export function applyContentSecurityPolicy(isDev: boolean): void {
  const policy = [
    "default-src 'self'",
    // Vite's dev server needs eval for HMR; the packaged build does not.
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: local: file:",
    "font-src 'self' data:",
    // Dev needs the Vite websocket; production talks to nothing.
    isDev ? "connect-src 'self' ws: http://localhost:5205" : "connect-src 'self'",
    "media-src 'self' data:",
    "object-src 'none'",
    "frame-src 'self' data:",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

/**
 * Stop the window from navigating away from the app, and send any external
 * link to the user's browser instead of opening an unrestricted Electron
 * window.
 */
export function applyNavigationGuards(win: BrowserWindow, isDev: boolean): void {
  const allowedOrigins = new Set(isDev ? ['http://localhost:5205'] : []);

  const isInternal = (url: string): boolean => {
    if (url.startsWith('file://') || url.startsWith('local://')) { return true; }
    try {
      return allowedOrigins.has(new URL(url).origin);
    } catch {
      return false;
    }
  };

  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url)) { event.preventDefault(); }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) { return { action: 'allow' }; }
    // http(s) goes to the default browser; anything else is refused outright,
    // so a `file:` or custom-scheme URL cannot launch a handler.
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // A renderer crash must not leave a blank window with no way back.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details.reason);
  });
}
