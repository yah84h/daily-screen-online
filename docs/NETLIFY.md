# Netlify

- Runtime: Node 24 (`.nvmrc` and `build.environment.NODE_VERSION`). Dependencies require Node 22 or newer. Node is needed on the build server, not on the phone or TV.
- Build: `npm run build`; output: `dist`. TypeScript always checks from source; generated build metadata is not committed.
- SPA rewrite: `/admin`, `/login`, `/tv`, `/display` all return `index.html`. `/display` redirects inside the app to `/tv`.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for **builds**, including **Deploy Previews** when testing a PR. Use the public anon/publishable key, never a service-role key. Variables are substituted during build; rebuild after changing them.
- Authentication and pairing use the existing Supabase project, independent of Netlify's hostname. Setup links use the current page origin, including preview/custom domains. A deploy preview has its own browser storage, so an existing production TV token is not automatically shared with the preview domain.
- Pairing currently uses a six-digit screen code. The QR option is an uploaded QR image displayed in the daily layout, not an automatic pairing QR generator.
- Use the existing Supabase database migrations/RLS/storage policies. No new schema migration is needed for the recognition board.

Validation: `npm ci`, `npm run build`, `npm run lint`, `npm run test:loop`. Against the mock-backed production preview described in `LOOP-AND-RECOGNITION.md`, run `npm run test:pairing` and `npm run test:browser-loop`.

A failed Netlify deploy cannot be diagnosed from its bot notification alone. Inspect the linked private deploy log for the first actual build/dependency/permissions error. The pinned runtime and clean-build checks do not establish the cause of an earlier failed deployment.
