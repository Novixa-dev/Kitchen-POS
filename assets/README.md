# Application icons

`electron-builder` reads these when packaging. They are **not** optional: a
build referencing a missing icon either fails or silently ships the default
Electron icon.

| File | Platform | Requirement |
|---|---|---|
| `icon.ico` | Windows | Multi-resolution ICO, 256×256 included |
| `icon.icns` | macOS | ICNS, 512×512 and 1024×1024 included |
| `icon.png` | Linux / tray | 512×512 PNG |

`icon.png` is also used for the system-tray icon at runtime; the tray falls
back to an empty image if it is missing, so the tray appears blank rather than
crashing.

Generate all three from one 1024×1024 PNG:

```bash
npx electron-icon-builder --input=source-1024.png --output=.
```
