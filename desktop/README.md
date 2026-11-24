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

## Download retention

Completed native downloads stay in the player's `userData/media` folder across page reloads, site updates, app restarts and offline launches. They are not expired by age or evicted by a cache size policy. A transient browser decode failure no longer deletes the native file. The index is written by atomic replacement so an interrupted write leaves the last completed index usable.

For the configured site, the player also grants persistent browser storage, used by presentation-mode files and browser caches. Those files still belong to that website origin; changing domains or deleting the app profile does not migrate/preserve them automatically. A newly received replacement file can replace the previous cache entry by design.

To intentionally remove native downloads, use the TV settings' **مسح ذاكرة قوائم الوسائط على هذا الجهاز** action and confirm. It clears the native media index/files and browser playlist cache; it does not delete the separate presentation-mode show library. Clearing refuses while a native download is in progress. Existing installed kiosk apps must be updated to this build for the native retention guard and persistent-storage permission; a website deployment alone cannot change Electron's main process.
