# Local-only iPhone edition — 0.3.0

Open SchoolScreenLocal.xcodeproj or sign/install SchoolScreen-Local-0.3.0-unsigned.ipa. This replaces the previous local app using the same bundle identifier (`com.yah84h.schoolpodcast.local`). Minimum iOS: 17. No cloud connection settings are included in this IPA.

## New controls

- Exact 31 web color palettes, custom background/text/accent/card/border/meter/artwork colors, and 8 existing element layouts. Palette changes preserve images, positions and unknown settings.
- Static wallpaper in daily and lesson-loop modes; background, center and full-screen slide playlists with multi-photo selection, ordering, duplication, fit, focal point, zoom, brightness, per-photo timing, transitions, overlay, blur and saturation.
- School identity, per-screen logo, paired logos, calendar, font, text/image/identity positions and sizes. PNG transparency is retained for logos/student photos.
- Summer/winter/custom lesson timetable, clock/card sizing, animation, dismissal text, recognition students/photos/layout/group size and paging.
- Real byte-based photo/video/GIF upload percentage, sent/total size, batch file count and cancellation. Reading/compression/video preparation are displayed separately without an invented percentage. A transmitted file waits for server confirmation before being applied. Animated GIFs remain animated in full-media mode.
- Saved topics, scheduling, history, optional announcement elements, QR image, secondary photo, video controls/sound/repetition, school notice timing/year/opacity/Q&A settings.
- Native screen and account management, role editing, own password, general school identity, TV unlinking, and preview-before-delete unused-media cleanup. Server permissions remain authoritative.

The iPhone preview is a simplified content/color preview. It does not recreate the TV's full renderer or provide a touch-drag canvas; native sliders control all saved positions. The accompanying server contains the existing TV/web renderer and the new local endpoints. Online publisher feeds/translation remain disabled in the local-only package.

## Upgrade without losing data

1. Stop the old Mac server with Control+C. Keep its folder intact.
2. Extract SchoolScreen-Local-Server-0.3.0.zip **next to** the old SchoolScreen-Local-Server folder.
3. Run Upgrade-Mac.command inside the new folder. It copies the old accounts/content/media data directory, retains the original, and refuses to overwrite an existing destination data directory. With multiple old folders it asks which to copy. If automatic discovery finds nothing, copy the old `data` folder into the new server folder manually while the server is stopped.
4. Run Start-Mac.command in the new folder. Reload the TV page once for the updated renderer.
5. Sign/install the new IPA using the same app identity as before. Keep iPhone, Mac and TV on the same network and allow Local Network access. The saved Mac address can stay the same. You may need to sign in again because restarting the local server ends its in-memory sessions.

Use your existing local password after copying data. Only a fresh installation without existing data uses Archo / Arc@2027. No Supabase migration or Netlify setup is needed. The old app can continue using the new server.

## New installation

Run Start-Mac.command (requires Node.js 22+), enter the printed Mac address in the phone app, sign in, then open `/tv?pair=1` on a TV and enter its six-digit code in the app. Keep the Mac awake and server running. localhost on the phone refers to the phone, not the Mac.

## Validation

- Xcode physical-device Release archive; IPA ZIP integrity, executable permissions, expected bundle/version, no cloud Backend.json, and bundled 31-palette/8-layout resources verified.
- 21 Swift contract checks, 38 Node tests, production build/lint and offline server build.
- Real Swift URLSession integration: cookie login/restore, actual upload-progress byte totals, images, pairing, wallpaper/colors, slides/recognition, scheduling retry, presets, accounts/teacher permission rejection, notices, publication retry and logout.
- Chromium TV renderer checked with external requests blocked: saved colors, wallpaper and recognition appear without browser errors.
- Upgrade helper tested with synthetic accounts/content/media; source retained and existing destination protected. No real school data was modified during these tests.
- New iPhone interface/device interactions still need your on-device review. The IPA is unsigned, so sign it as before.

## Rebuild

From the complete repository root:

```sh
python3 ios/generate-project.py --local-only
swift run --package-path ios ContractChecks
node --test tests/native-publish.test.mjs tests/media-cleanup.test.mjs tests/upgrade-data.test.mjs tests/accounts.test.mjs tests/news.test.mjs tests/loop.test.mjs tests/slideshow.test.mjs
npm run build:local -- --offline-only
xcodebuild -project ios/SchoolScreenLocal.xcodeproj -scheme SchoolScreenLocal -configuration Release -destination 'generic/platform=iOS' -archivePath /tmp/SchoolScreen-local.xcarchive CODE_SIGNING_ALLOWED=NO archive
```

Template edits use nested patches so unknown sibling fields and separately saved news survive. New local writes use an atomic state-file replacement. Cleanup rechecks saved references at deletion time, ignores active `.part-` uploads and never traverses symlinked files/directories.
