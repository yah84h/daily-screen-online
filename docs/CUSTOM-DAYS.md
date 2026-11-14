# Custom HTML days

In **التصميم → الخلفية والساعة**, open **تصاميم المناسبات** below the normal display settings. Use **إضافة نبض** for the supplied starter, or upload a standalone `.html`/`.htm` file (up to 120,000 bytes). The bundled Nabd HTML can also be uploaded unchanged; an isolated display adapter selects its occasion mode and supplies the occasion title, subtitle, description, school identity and live clock. Its internal editing/fullscreen toolbar is hidden. With the leaderboard enabled, the original QR area is hidden to leave room for the board.

Pick a Gregorian date, enable the design, and save. Activation is for that exact date in `Asia/Riyadh`, midnight to midnight, only in background/clock (`loop`) mode. Daily content, media, slideshows and presentations remain unchanged. It overrides the background visual layout; the normal template is retained and resumes the next day. It is not an annual recurring rule. A disabled design can still be previewed. The feature uses the existing screen template JSON, so no new database table or local-only service is required. It works with the hosted screen API as well as the local server.

Clock visibility and the leaderboard overlay can be toggled per occasion. The board reuses the current manual/Qudrat Pro source and refresh settings. Percentage controls place and resize it. Separate 50–200% controls resize occasion text, clock and school identity. Nabd text automatically shrinks as needed to stay within its content area, including after resizing or font loading; custom HTML uses the documented slots for these controls. Each screen stores at most six designs with a combined JSON size of 300,000 bytes; inline images should be small, or use HTTPS images. Dates should have only one enabled design; the custom save button rejects duplicates. Adding Nabd or uploading a file does not activate or save it automatically.

## Standalone HTML contract

Include CSS and JavaScript inline. External JavaScript libraries, sibling local assets, remote frames, form submissions and fetch/XHR connections are blocked. HTTPS images, fonts and stylesheets are allowed and require connectivity unless already browser-cached. The HTML is run with `sandbox="allow-scripts"` and no same-origin permission; it cannot read the admin page or its credentials. Parent-to-frame data contains only public display content. The frame is display-only; editing takes place in the admin panel.

For dynamic text, add `data-school-field` attributes:

```html
<h1 data-school-field="title"></h1>
<p data-school-field="subtitle"></p>
<p data-school-field="body"></p>
<span data-school-field="schoolName"></span>
<b data-school-field="clock"></b>
<span data-school-field="date"></span>
```

These slots use text content rather than HTML injection. Clock/date slots update live in Riyadh time; a clock overlay is supplied when the HTML has no clock slot. Other HTML content is retained as uploaded. The supplied Nabd design has a dedicated adapter for its existing element IDs. Arbitrary static text in other uploaded HTML does not automatically become editable.

## Verification

`node --test tests/custom-days.test.mjs` checks Riyadh date boundaries and fallback. After `npm run build:local`, `node tests/custom-days-browser.mjs` checks the real authenticated save endpoint, Nabd occasion mode, text fields, manual board, clock toggles, private iframe isolation, exact-date TV activation and next-day fallback, persistence, mobile overflow, standalone HTML slots and file size rejection. It uses a disposable data directory and no paid AI calls.
