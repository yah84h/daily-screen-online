# Ezaati Player (Windows)

Full-screen kiosk player for `https://ezaati.com/tv`.

- **Install:** run `Ezaati Player Setup 1.0.0.exe` (or the portable `.exe`, which needs no install). Because the installer isn't signed, Windows SmartScreen warns on first run: click *More info → Run anyway*.
- Starts with Windows, stays full-screen, and keeps the screen awake.
- Reloads by itself after crashes and hangs. When offline, it shows a waiting screen and retries every 15 seconds.
- Saves TV media (Google Drive videos, playlist media, background audio) to disk once and plays it from there. There's no browser size limit and no 4 MB proxy chunks. Files live in `%APPDATA%\Ezaati Player\media`.

| Key | Action |
| --- | --- |
| Ctrl+Shift+S | Settings (screen URL, kiosk on/off) |
| Ctrl+Shift+R | Reload the screen |
| F11 | Toggle full screen |
| Ctrl+Shift+Q | Quit |

Build (from macOS or Windows): `cd desktop && npm install && npm run dist` → `desktop/release/`.
