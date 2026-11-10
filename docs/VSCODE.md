# Daily Screen in VS Code

Open `Daily-Screen.code-workspace`. Use this Git checkout as the main editable source; `outputs/` contains earlier packaged testing copies.

- Press **F5** and choose **Website: start development (F5)**, or run `npm run dev:local` in the integrated terminal. Open http://localhost:5173/admin and http://localhost:5173/display. For phone testing on the same Wi-Fi, replace localhost with the Mac's LAN address and keep port 5173.
- Frontend changes refresh through Vite without a release build. Backend source changes restart Node automatically. Stop with Control+C in its terminal before starting another session.
- **Cmd+Shift+B** checks TypeScript. **Terminal → Run Test Task** runs unit tests. **Terminal → Run Task** also offers lint, production build, and local release build.
- To debug a unit test, open its `.test.mjs` file, choose **Tests: debug current unit test**, set a breakpoint, and press F5.
- Browser playback integration tests use `dist-local`, so run the local release build before those tests. Fast development is for local-backend testing; Netlify-specific functions still need their own tests/deploy preview. Swift iPhone builds remain in Xcode.

Requires Node 22 or 24 and `npm ci` after a fresh checkout or dependency changes. VS Code uses the project's installed TypeScript. No editor extension is required. Local test content is in ignored `local-test/data/`; environment values stay in ignored `.env.local`. Never commit either. The initial Mac setup copied existing test data into this checkout without changing the older testing copy; the copies are independent thereafter.

Normal editing does not need ZIP creation, dependency reinstall, or full builds. Production deployment still requires a verified build. Editor choice itself does not determine AI token usage.

## Readable code formatting

Prettier formats TypeScript, React JSX, CSS, and JavaScript consistently. The recommended VS Code Prettier extension formats on save; use Shift+Option+F on Mac to format manually. Run `npm run format` to format project code or `npm run format:check` to check without changing files. Formatter settings are in `.prettierrc.json`. Generated builds, local data, environment files, fixtures, and native iOS files are excluded.
