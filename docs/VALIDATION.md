# Validation record — 0.1.0

Date: 2026-11-06. All account/content data was synthetic. **No live Reddit authentication, discovery, edit or deletion was performed.** This record does not establish that MVP live-integration acceptance criteria have been met.

## Executed commands

- `npm install --ignore-scripts --fetch-retries=0 --fetch-timeout=20000`: installed three build/test packages; npm audit reported zero known vulnerabilities at installation time. This is not a security audit.
- `npm test`: 32 deterministic tests passed with zero failures, skips or cancellations.
- `npm run build`: generated the userscript with proprietary metadata and full license.
- `npm run build:extensions`: generated unsigned Chromium/Firefox packages, local icons and SHA256SUMS.
- `npm run check`: source syntax/restricted API checks, the 32 tests, builds and artifact validation passed.
- `WIPEDITT_EXTENSION_CHROME=/home/roliveira15/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome npm run test:ui`: userscript UI and actual unpacked Chromium content script passed. Build/icon renderer and userscript browser: Google Chrome 157.0.8103.38. Extension browser: Chromium 156.0.8078.4.
- `git diff --check`: no whitespace errors.

Browser tests cover duplicate injection, the cross-world document claim, blocked live status, synthetic scans, invalid regex, replacement HTML injection attempts, explicit confirmation/default cancel focus/Escape, preview invalidation, individual selection, pause/resume, verified simulated editing, report availability, privacy masking, themes and mobile sizing. UI tests produce real screenshots under `artifacts/`; the README screenshot is a captured synthetic-mode panel, not a live Reddit account.

Engine tests cover pagination/deduplication/caps, filters/calendar/score bounds, account changes, ownership at dispatch, skipped capabilities, custom replacement, confirmed edit/delete/combined workflows, changed replacement before deletion, partial completion, failed/unverified edits, uncertain writes and verification failures, cancellation, expiring confirmation, checkpoints and report minimization. Scheduler tests cover serial pacing, quota headers, Retry-After, body cooldowns, bounded 429/5xx/timeouts, fatal 401/403 and pause/resume/Stop.

## Not validated or unfinished

Reddit approval, public-client OAuth and live transport are absent. Real edits/deletion, Firefox runtime, Tampermonkey/Violentmonkey managers, complete account-history coverage, official export import, unattended/background deletion, browser-store distribution and a formal accessibility/security audit are not validated. Cross-tab exclusion is required before future live writes. Automated test success must not be presented as real Reddit success.
