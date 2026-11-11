# Admin studio

The admin interface is a task-based Arabic workspace. Five destinations remain visible on desktop and phones: content, live control, design, library, and scheduling/history. Device management is available from the header. The account menu contains account-only actions.

## Interface ownership

- `src/admin-studio.css`: the single admin stylesheet. The previous glass and workspace stylesheets are removed. Rules are scoped to `.admin-studio`; television styling is independent.
- `src/pages/admin/Admin.tsx`: application shell, permissions, screen selector, navigation, connection status, loading/error feedback.
- `src/pages/admin/navigation.ts`: task destinations and secondary design/library/scheduling navigation.
- `src/pages/admin/HomeTab.tsx`: composer, live draft preview, draft saving, and the persistent publish action.
- `src/pages/admin/studio/`: daily content fields and image/video fields. Draft content stays in the admin store when changing tools or destinations.
- `src/pages/admin/Modals.tsx`: focus-contained dialogs with Escape dismissal and focus restoration.
- Existing design, slideshow, PowerPoint, leaderboard, library, scheduling, and remote-control editors keep their data behavior.

## Visual rules

Flat neutral surfaces, one blue action accent, a local Arabic font, a small typography scale, 8/12/16/24/32/40/48px spacing, and 8/12/16px radii. Blur is limited to navigation and the publish bar. Page transitions animate opacity and transform; reduced-motion preferences disable animation.

Design direction was informed by `elayadesign/ai-design-skills` and its companion `elayadesign/redesign-skill`. Marketing-page sections were not applied to the admin workspace. Existing Arabic type and icons are retained for language coverage and consistency without another dependency.

## Local verification

Run `npm run dev:local` and visit `/admin`. Use `/login` in a private browser window to review login independently.

Build with `npm run build`, then run `npm run lint`, `npm test`, and `npm run format:check`. `npm run build:local` packages the isolated backend used by the browser tests. Relevant browser checks are `tests/admin-glass-browser.mjs` (admin studio), `tests/saved-layouts-browser.mjs`, and `tests/remote-media-browser.mjs`.

Image generation and Gemini/ChatGPT account integration are deferred. No credentials, API requests, or extension were added for image generation.

## Live-control placement

The selected-screen status opens live monitoring. Playback and volume share a primary control area; the timeline and download preparation have separate sections. Beside them, a published-content preview and device reports provide context. This preview uses the published post and saved screen template, rather than the edit buffer, and is explicitly not a live video feed. Stale device reports show relative last-contact times without presenting old playback or download details as current.
