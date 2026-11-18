## Ezaati Player for Windows

A full-screen kiosk player for the school TV screen (`https://ezaati.com/tv`).

### Download
- **`Ezaati Player Setup <version>.exe`**: installer (recommended). Installs per user, adds a desktop shortcut, starts right away.
- **`EzaatiPlayer-portable-<version>.exe`**: portable, nothing to install. Good for testing on a new TV PC.

> The installers aren't code-signed yet, so Windows SmartScreen warns on first run: click **More info → Run anyway**.

### What it does
- Opens ezaati.com/tv full screen and **starts with Windows**.
- **Keeps the screen awake** (no sleep or screensaver).
- **Recovers by itself:** reloads after crashes or hangs. When the internet drops it shows a waiting screen and retries every 15 seconds.
- **Saves TV media to disk** (Google Drive videos, playlist media, background audio) and plays it from there: faster, no browser storage limit. Files: `%APPDATA%\Ezaati Player\media`.
- Pair the TV once with the 6-digit code; it remembers it.

### Keys
| Key | Action |
| --- | --- |
| Ctrl+Shift+S | Settings (screen URL, kiosk on/off) |
| Ctrl+Shift+R | Reload the screen |
| F11 | Toggle full screen |
| Ctrl+Shift+Q | Quit |

### Update / uninstall
- To update, run a newer Setup `.exe` over the old one.
- To uninstall: Windows Settings → Apps → *Ezaati Player* → Uninstall.
