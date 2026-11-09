# الشاشة اليومية — native iPhone controls

A first SwiftUI client for the existing school display system. iOS 17+, Arabic RTL, native navigation, Dynamic Type, system dark mode and PhotosPicker. There are no third-party iOS dependencies and no embedded admin website.

## Included

- Username/email sign-in using the existing Netlify/Supabase account flows.
- Access and refresh tokens in device-only Keychain storage; session refresh and local sign-out.
- School screen list, current mode, latest announcement and last-seen TV status.
- Six-digit TV linking for administrators; Arabic/Persian/English digits accepted.
- Daily announcement editing, photo selection, draft saving, simplified preview and publication.
- Full-screen image/video publication. Images downsample to 3840 pixels and compress below 5 MB; imported movies are prepared as MP4 and uploaded from disk.
- School news editing through the existing permission-checked save_screen_news RPC. Unknown settings, expiry and school-year fields are preserved.
- Explicit demo mode for trying screens without a real login. It never uploads/publishes to school infrastructure.
- Atomic, retry-safe publication migration with existing permission checks and JSON preservation.

Advanced templates, lesson schedules, recognition editing, account administration and full-screen slide playlists remain accessible through the existing website. Native preview presents the content, not a pixel-identical recreation of every web template.

## Open and run

1. Install Xcode 16 or newer with an iOS simulator runtime. Command Line Tools alone cannot build the iPhone UI.
2. Open `SchoolScreen.xcodeproj` (not Package.swift) and choose the **SchoolScreen** scheme.
3. Select an iPhone simulator and Run. The login screen offers an Arabic demo tour.
4. For a real iPhone, select your Apple Development Team in Signing & Capabilities; change `com.yah84h.schoolpodcast` to your registered identifier if necessary. Connect the phone, enable Developer Mode and Run.
5. Use the school's existing account. Nothing in the app creates or replaces an owner account.

The committed project is ready to open directly. `python3 generate-project.py` regenerates it after adding/removing files. The generator does not preserve hand-edited signing settings; reselect the team afterward.

## Backend configuration

`SchoolScreen/Resources/Backend.json` contains the website origin and the **public publishable** Supabase settings already present in the deployed website's JavaScript. This file intentionally contains no service-role key and no account credentials. Do not replace the public key with `service_role` or `sb_secret_…`.

Default site: https://schoolpodcast.netlify.app

Existing sign-in, staff permissions, storage and pairing use the same backend as the web app. No Netlify function changes are required for this first client. The app does not connect to the standalone local-test backend.

### Required before live publishing

Apply `../supabase/migrations/0009_iphone_publish.sql` to the existing Supabase project **after migrations 0001–0008**, using the normal database migration process. The SQL is included in this delivery but has NOT been applied to production.

Without 0009, login, screen loading, existing draft/news operations and pairing use existing endpoints; announcement publication reports that the service needs updating.

The new RPC locks the screen, checks the current user's permissions, preserves template/news fields, updates the daily/media mode, clears the draft and inserts the post in one transaction. A stable request UUID is used as post ID, so retrying the same preview after a lost response does not create another post. A daily-only teacher can publish in the screen's current matching mode; only an administrator can switch daily/media mode. TVs pick up the saved change via their existing five-second polling; the native app does not open a realtime channel.

## Checks available without Xcode

From the repository root:

```sh
swift run --package-path ios ContractChecks
swiftc -frontend -parse ios/SchoolScreen/App/*.swift ios/SchoolScreen/Core/*.swift
plutil -lint ios/SchoolScreen.xcodeproj/project.pbxproj
```

`ContractChecks` is a standalone Swift executable so it can run on Command Line Tools installations that do not include XCTest. It checks digit normalization, Riyadh midnight, unknown JSON preservation, public-key validation, content validation, device timestamps, publication/pairing request contracts, safe query encoding, session rotation and error messages.

Isolated PostgreSQL-compatible migration checks (no Supabase access):

```sh
npm install --prefix /tmp/iphone-check @electric-sql/pglite
PGLITE_MODULE=/tmp/iphone-check/node_modules/@electric-sql/pglite/dist/index.js node ios/Checks/check-publish.mjs
```

These checks use minimal tables and the actual existing preservation trigger. They verify role checks, mode restrictions, unchanged JSON fields, transactional rollback, retry idempotency, input validation and anonymous denial. They do not establish the production database's complete migration/RLS state.

## Build and device validation

The physical-device Release build and unsigned archive now pass with Xcode 27.2 / iOS 27.2 SDK. All 15 shared Swift checks pass. The exported IPA is arm64, targets iOS 17+, and has verified ZIP/bundle metadata. No simulator runtime is installed, so visual UI and real-device testing are still outstanding. A signed archive was attempted but Xcode has no account configured for the certificate team and no matching provisioning profile; the delivered IPA is unsigned and requires signing before installation.

Before wider distribution: sign/install on a device; test Arabic large-text layouts, VoiceOver, keyboard dismissal, photo permissions, HEIC/MOV conversion, long uploads/background interruption, token expiry, TV pairing and publication on a test screen. Confirm newest migration compatibility on staging. App Store/TestFlight distribution, Apple signing, store privacy details and production deployment remain separate steps.

No real school login, publication, pairing, database update or deployment was performed while developing this client.

## Version 0.1.1 — login error handling

An email sign-in failure is no longer hidden by a failed username resolver fallback. Supabase's msg/error_code fields are read, authentication failures are localized, and username-service outages get a specific message. Successful email-shaped usernames can still resolve through Netlify. Four regression checks cover these paths.

Live read-only diagnostics found Supabase Auth settings reachable (HTTP 200) and the Netlify username-login handler returning HTTP 503 even for an empty request. The server configuration/root cause has not been confirmed from deployment logs, and no production deployment was performed. No real account credentials were tested.
