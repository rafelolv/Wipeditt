# Validation record — 0.2.0

Date: 2026-11-06. **No real Reddit account was authenticated, scanned or modified.** The maintainer has not supplied a registered installed-app Client ID. OAuth and API implementation are exercised using intercepted HTTP fixtures; real-platform acceptance is unverified.

## Executed checks

- `npm test`: 50 deterministic tests pass, no failures/skips/cancellations.
- `npm run build`: bundles the real OAuth/API runtime and proprietary license.
- `npm run build:extensions`: bundles the identical runtime plus restricted transport broker, local icons, unsigned ZIPs and SHA256SUMS.
- `npm run check`: source syntax/restricted DOM/network API checks, unit tests, builds and artifact checks.
- `WIPEDITT_EXTENSION_CHROME=/home/roliveira15/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome npm run test:ui`: isolated userscript/browser and real unpacked Chromium extension/broker tests. Local browser versions: Chrome 157.0.8103.38 and Chromium 156.0.8078.4.

## Scope

Unit tests cover authentication request/scope/redirect construction, installed-app code exchange, state/source/origin validation, callback URL cleanup, missing-opener channel, duplicate redemption prevention, token expiry/abort, request origin/path/header restrictions, anonymous privileged transport and cookie-free redirect-refusing fetch. Adapter tests cover actual HTTP URL/body parsing, listings/content normalization, paced account/ownership preflights, throttled retries, permission errors, real-mode engine wiring, confirmed replacement verification and disabled live deletion.

Existing engine/filter/scheduler/privacy tests also cover pagination, deduplication, hard caps, malformed filters/calendar bounds, selection, preview/confirmation expiry, replacement updates without rescanning, no lifetime extension, cancellation, uncertain writes, reports and minimized checkpoints.

The browser suite intercepts every request while driving the real code through consent redirect, callback, token exchange, identity, listing, ownership preflights, editing and verification. It checks injection safety, cancellation, selection, pause/resume, responsive themes/privacy and local settings. The extension suite loads the unmodified production manifest/content script/broker and completes the same OAuth-to-edit path with HTTP fixtures. No fixture response is a real Reddit success.

## Remaining work

Register an installed app, obtain applicable Reddit approval, verify redirect/current server acceptance, then separately authorize a tiny own-account live anonymization check. Live deletion/combined mode, official export import, Firefox runtime, installed Tampermonkey/Violentmonkey combinations, signed store packages and a formal accessibility/security audit remain unverified or unfinished. Report a server refusal faithfully; never bypass it or infer approval solely from login/token possession.
