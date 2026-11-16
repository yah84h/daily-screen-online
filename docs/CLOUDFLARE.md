# Cloudflare hosting

Google Drive playback needs a server route. A static HTML upload alone cannot replace Netlify Functions: `/api/drive-video` otherwise returns a 404 or the SPA HTML instead of video bytes.

## Pages

Use the repository root, build command `npm run build` and output directory `dist`. Deploy through Git integration or Wrangler so the root `functions/` directory is compiled. `functions/api/drive-video.js` handles video/audio byte ranges using the same bounded Google-only proxy as the local and Netlify servers. No Drive API credentials are needed for public downloadable files.

## Workers with Static Assets

An optional entry point is included for Workers deployments:

```sh
npx wrangler deploy --config wrangler.worker.jsonc
```

The config builds `dist`, serves SPA routes through `ASSETS`, and sends `/api/drive-video` to the Worker before static asset handling. Use the existing project's Worker name when configuring your deployment. This command deploys; do not run it just to build locally.

This migration covers the Drive proxy. Other pre-existing Netlify-only APIs (for example tech-news and leaderboard source administration) still need their own Cloudflare adapters if used. Existing Supabase data/authentication remains separate.

## Checks

An invalid request to `/api/drive-video?id=bad` should return HTTP 400 with JSON `INVALID_DRIVE_LINK`, not HTML. A public shared Drive video with a valid ID should return a video content type and bounded HTTP 206 ranges. A private file or a Google quota error is returned as a JSON error; sharing must allow downloads.

Manual display-mode selection now disables automatic rotation while retaining its timing settings. The media preloader only prepares assets used by the selected mode, so an unused broken fullscreen video cannot freeze the daily broadcast or class background. Download pause does not block layouts that need no prepared media.
