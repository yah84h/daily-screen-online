# School admin assistant

Open `/admin` → **ChatGPT**. This is a separate connection from staff sign-in. The existing staff account and permissions remain required.

## Local testing

Run `npm run dev:local`, then open `http://localhost:5173/admin` on the server computer. Select **Continue with ChatGPT**, authorize the app and plan usage, and return to the admin tab. Available models come from the signed-in account. The sign-in callback is a temporary `127.0.0.1` listener, so initiate sign-in on the server computer. Once connected, the same staff account can use the assistant from a phone on the server's network. The server must stay running and have internet access.

This follows the official [open-source/local sign-in flow](https://developers.openai.com/siwc/token-sharing-open-source). It uses OAuth plan authorization, not an API key or scraped ChatGPT web cookies. No access to existing ChatGPT conversations is implied. Eligibility and usage limits are determined by OpenAI.

**Netlify is not connected by this implementation.** Hosted plan sharing requires the hosted-app registration described in the official documentation. The production UI reports this requirement rather than pretending local authorization is a hosted connection. No credentials are forwarded between Netlify and the local server.

## Supported actions

The assistant gets the selected screen name, text draft, display type, lesson periods, leaderboard interval, and whether the staff member can edit design. It can propose:

- Weekly **إذاعة** broadcast plans: up to seven future dates, each with a title, subtitle, message, badge and footer. When a user says جدول without qualification, this is the default interpretation. The assistant asks for missing dates and preserves supplied class/teacher details.
- Title, subtitle, message, badge and footer text.
- Administrator-only school names, daily/loop display mode, background/text/accent colours, font size, loop photo visibility and technical-quote visibility.
- Seven ordered, non-overlapping daily bell periods. This is not a subject/teacher timetable for each weekday.
- Qudrat Pro refresh intervals: 30, 60, 120 or 300 seconds.
- Clock and leaderboard text scales from 0.75 to 2.

The namespaced `school.propose_changes` tool creates a validated proposal. It never executes code or writes to the database. The review UI applies accepted changes to the existing draft setters. Content still requires **Publish**; design still requires **Save design**. A stale-draft check rejects proposals if the draft or screen changed. Staff without admin permission cannot apply design changes. Weekly schedule proposals have their own review card and **Confirm broadcast schedule** button. Confirmation saves the whole plan atomically into the existing scheduler. A single existing post on a selected date is updated; unmentioned days remain untouched. Multiple posts on the same date require manual review. Optimistic schedule version checks prevent overwriting concurrent changes. Request receipts prevent duplicate scheduling on retries. Today uses an ordinary content draft rather than immediate assistant publishing. Deletion and account management remain outside the assistant tools.

## Files and conversations

Attach at most two files totaling 6 MiB: PDF, TXT, CSV, DOCX, XLSX, PPTX, PNG, JPEG or WebP. Attached files remain selected and are resent with follow-up requests until removed or a new conversation is started. Files are sent inline with each Responses request; they are not uploaded to school storage or the Files API. Their contents are untrusted data. The recent ten text turns accompany each request. The latest 20 conversations (up to 80 messages each), draft questions and proposal metadata are saved locally in this browser, scoped to the staff account and selected screen. They survive tab navigation and page refresh. New conversation archives the previous thread; use the saved-conversation selector to return to it. File objects and sign-in tokens are never saved with conversations. Reattach files after refresh. This is browser-local history, not cross-device account sync. A visible warning reports storage failure.

## Chat interface

The workspace uses a compact connection/model toolbar and a larger conversation area on desktop and phone. Replies render CommonMark and GFM tables using `react-markdown` and `remark-gfm`: headings, bold/italic text, lists, blockquotes, code and links. Raw HTML is skipped; script/data URLs and external image loading are blocked. Markdown formatting applies to chat replies; screen content fields remain plain text. Messages can be copied, attachments removed, and a new conversation started while retaining previous threads. Desktop Enter sends; Shift+Enter adds a newline, while phone Enter remains a newline.

## Credential boundary

Each staff account has a separate encrypted record in ignored `data/chatgpt/`. A random local AES-256-GCM key and atomic credential files have owner-only permissions on Unix. This protects against accidental disclosure; a process running as the same OS user can read the local key. These files must never be committed, served as static assets or copied into a public build.

The server checks staff authorization and origin before assistant actions. OAuth uses PKCE, state, nonce and signed ID-token verification, and rotating refresh tokens. Only account labels and connection status reach the browser. The provider stream must end in `response.completed`; incomplete responses and plan-limit errors cannot become accepted proposals.

## Verification

`npm test` includes fake-provider OAuth tests (no live account or quota), isolation/encryption checks, proposal permission/shape checks and terminal stream validation. After `npm run build:local`, `node tests/admin-glass-browser.mjs` exercises the assistant with a mocked provider, reviews/applies a draft change, and checks desktop and phone layouts. It also renders Markdown/table replies, checks unsafe markup handling and attachment retention, confirms a proposed weekly broadcast through the real local endpoint, and verifies it appears in the scheduler. A real sign-in/file interpretation still requires an eligible user's account and explicit interaction with the sign-in button.

## Content date selection

In Content, turn off automatic date and select a date to load its saved/scheduled post into the fields and preview. This does not publish anything. If no post exists, the current draft is preserved and a clear notice explains that only the printed date changed. Re-enabling automatic date loads today's saved content. A new published/scheduled day also updates an untouched automatic-date editor on its regular refresh; unsaved changes and manually selected date previews are preserved.

Weekly broadcast entries are complete text records: omitted subtitle/body/badge/footer values become empty, so a new topic cannot inherit cyber-security copy from an unrelated draft. Existing saved entries are not retroactively rewritten.
