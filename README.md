<p align="center"><img src="images/banner.svg" alt="Wipeditt — Your Reddit history. Your control." width="960"></p>

<p align="center">
<img src="https://img.shields.io/badge/version-0.1.0-a0dcb4?labelColor=171e1a" alt="Version 0.1.0">
<img src="https://img.shields.io/badge/license-proprietary-a0dcb4?labelColor=171e1a" alt="Proprietary license">
<img src="https://img.shields.io/badge/runtime-local_only-a0dcb4?labelColor=171e1a" alt="Local only">
<img src="https://img.shields.io/badge/Reddit_access-blocked-d9b885?labelColor=171e1a" alt="Reddit access blocked">
</p>

**Review your history. Choose what stays.** Wipeditt is a lightweight, local privacy utility created by **Rafael (rafaelolv)**. Its first priority is replacing the bodies of your own comments and editable text posts with text you choose. Deletion is a separate operation, with explicit review and confirmation.

> **0.1.0 is a technical preview with blocked live integration.** It cannot connect to, discover or change real Reddit content. The full review/operation flow works with explicitly selected synthetic data. Reddit approval and a verified OAuth integration are required before live use. Simulated tests are not evidence of successful live edits or deletion.

## Install

Choose **one** distribution; all three contain the same runtime. No browser-store publication is claimed.

| Distribution | Installation |
| --- | --- |
| Userscript | Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/), then open the repository's [generated userscript](https://raw.githubusercontent.com/rafelolv/Wipeditt/main/wipeditt.user.js). Manager/browser combinations have not all been tested. |
| Chromium | Build locally with the commands below, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `dist/chromium`. |
| Firefox | Build locally, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. Temporary unsigned installs disappear on restart; Firefox runtime has not been tested. |

The panel launches on `https://www.reddit.com/*` and `https://old.reddit.com/*`. Installation does not grant Reddit API access. See [extension details](docs/EXTENSION.md).

## Quick start

1. Open Reddit and press the floating **Wipeditt** button.
2. Read the connection notice. Choose **Try synthetic data** to explore this preview.
3. Choose comments, text posts or all supported content. Set filters and an item limit.
4. Press **Scan content**. Read the inspected, unique, matching, eligible and selected counts.
5. Review original/replacement text and skipped reasons. Deselect items or toggle an entire subreddit.
6. Choose **Review operation**. Confirm explicitly; above 100 selected items, type the displayed phrase.
7. Watch progress. Use **Pause**, **Resume** or **Stop**, then optionally export a local JSON report.

Scanning never automatically changes content. Changes to filters, mode, replacement, delay or selection invalidate confirmation. Previews expire after five minutes and confirmation expires after one minute. Closing confirmation cancels it.

## Implemented

- Shared userscript/extension runtime with an isolated Shadow DOM panel, dark/light themes, keyboard focus and responsive layout.
- Comment and text-post scan engine, paginated adapter contract, ID deduplication, loop guards and cancellation.
- Subreddit include/exclude, inclusive dates, contains text, case-insensitive JavaScript regex, min/max score, edited status, content type and custom item limit. Quick limits: 50, 100, 500 or all available.
- Exact custom replacement preview and optional `[Deleted for privacy]` / `[Content removed]` presets.
- Anonymize, Delete and Anonymize & Delete **in simulation only**. Combined mode verifies replacement before deletion, immediately or after an active-tab delay.
- Own-account and ownership guards, no implicit deletion fallback for uneditable content, bounded throttling/backoff and uncertain outcomes.
- Minimal session checkpoints, no automatic interrupted-write replay, and reports without original content, replacement text, usernames, subreddits or sensitive filter values.
- Explicit simulation label throughout. Production live adapter fails closed and contains no Reddit networking or credential collection.

## Interface preview

Actual Chromium capture using synthetic data. No live Reddit account is shown.

<details><summary>View the dark-mode panel</summary>

<img src="images/screenshots/panel-dark.png" alt="Wipeditt dark panel with an explicit simulation notice, replacement preview and synthetic results" width="660">

</details>

## Supported content and limits

| Content | Engine behavior; live use unavailable |
| --- | --- |
| Own comments | Replace body, or delete explicitly |
| Own editable text/self posts | Replace body, or delete explicitly |
| Post titles | Cannot be edited |
| Image, video, gallery or link bodies | Not advertised as anonymizable |
| Archived, locked, removed or restricted content | Eligibility is provisional; actual server permission must be checked by a future approved adapter |
| Other users' content | Always ineligible |
| Chats and private messages | Unsupported |

“Anonymize” means replacing visible text, **not guaranteed anonymity**. Reddit, moderators, archives, caches or external services may retain copies. Edits and deletion can be permanent. A combined operation never deletes an item after a failed/unverified edit. If verification fails after dispatch, the outcome is **uncertain** and is not automatically replayed.

Reddit listings are not a complete historical archive. Every scan explains its stopping condition and never claims full account coverage. Importing an official Reddit data export is planned, not implemented.

## How Reddit access will work

Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) requires explicit approval before API access. This release has neither an approved application registration nor a verified public-client authentication flow. It does not use browser cookies, private website endpoints, passwords or a credential proxy.

The integration decision, official endpoint/scope research, OAuth constraints and release gates are in [Reddit integration](docs/REDDIT-INTEGRATION.md). Authentication is **not implemented**; account identity currently comes only from the synthetic adapter. A real account connection and successful live anonymization remain unfinished.

## Request pacing

A centralized serial scheduler spaces adapter operations by at least 1.5 seconds, reads available rate-limit headers, honors server cooldowns and Retry-After, and handles 429 with bounded retries. Transient reads use bounded exponential backoff. Authentication/permission failures stop processing. Ambiguous writes are never replayed automatically. Custom intervals can only slow requests further.

There is no universal “unlimited edits” or guaranteed requests-per-minute claim. See [Reddit limits](docs/REDDIT-LIMITS.md). Pause works at request boundaries. Stop prevents new requests; a submitted request may finish. Delayed deletion requires the browser/tab to remain active; nothing runs after closing it.

## Privacy

No telemetry, analytics, tracking, backend, remote configuration, external fonts or runtime CDN dependencies. The current runtime makes **no network requests**. README badges are images loaded by GitHub/readers, not by the application.

Synthetic previews stay in memory. A session checkpoint contains only content IDs, operation states, a simulation flag and an expiry; no original text or credentials. Clear it using **Clear checkpoint**, or close the tab. Reports remain local and contain counts, non-sensitive filter flags, issue IDs/categories and rate statistics. IDs can still be sensitive: review reports before sharing. **Privacy mode** masks subreddit names, filter text and previews; it is a visual aid, not encryption. See [privacy details](docs/PRIVACY.md).

## Troubleshooting

- **Live integration unavailable:** expected in 0.1.0. A userscript manager, Reddit login or an access token does not remove this release gate.
- **No launcher:** verify the URL/match and enabled distribution, then reload. Avoid multiple installations. This release guards repeated injection in the same document.
- **Preview expired / settings changed:** scan again; old confirmation cannot authorize a new selection.
- **Invalid regex/date:** correct the field before scanning. Regex is case-insensitive; omit surrounding `/` delimiters. Complex expressions can be expensive; prefer simple patterns.
- **Nothing matches:** remove filters, increase the item limit or inspect skipped reasons. All available never means a guaranteed complete archive.
- **Stopped / uncertain:** inspect the report. A future live integration must re-read current server state before retrying; this version never auto-resumes.

## Develop and validate

Maintainer-authorized development requires Node.js 24+, npm, Python 3 and Chromium/Google Chrome. No runtime dependencies; build/test dependencies are locked.

```sh
npm ci
npm run build
npm run build:extensions
npm test
npm run test:ui
npm run check
```

Set `WIPEDITT_CHROME=/path/to/chrome` for icon generation and userscript UI tests. Set `WIPEDITT_EXTENSION_CHROME=/path/to/chromium` to a Chromium build supporting extension-loading flags. Install the matching test browser with `npx playwright-core install chromium`, or set the override. CI installs its own matching browser. Build outputs are reproducible with the same toolchain; unsigned ZIPs and SHA256SUMS appear in `dist/`.

Unit tests use deterministic synthetic adapters. UI tests use isolated Chromium profiles and intercepted fixture pages, not Reddit accounts. They exercise the production userscript, a real unpacked Chromium content script, injection safety, confirmation, selection, pause/resume, privacy and responsive layouts. Firefox/Tampermonkey/Violentmonkey runtime behavior and live Reddit are **not verified**. Browser screenshots are generated under ignored `artifacts/`; a captured synthetic-mode panel is preserved in `images/screenshots/`. See the [validation record](docs/VALIDATION.md) for executed commands and limits.

Architecture, maintenance and release instructions: [AGENTS.md](AGENTS.md), [maintenance](docs/MAINTENANCE.md), [user guide](docs/USER-GUIDE.md), [release process](docs/RELEASING.md), [changelog](CHANGELOG.md).

## Ownership and credits

Copyright © 2026 **Rafael (rafaelolv)**. [Wipeditt Proprietary License](LICENSE): personal, non-commercial use of official unmodified packages is permitted; modification, redistribution, commercial use and derivative software require prior written permission. **This is not open-source software.** See [licensing](docs/LICENSING.md) for scope and independent rights.

[Wipegram](https://github.com/rafelolv/Wipegram) and [Wipecord](https://github.com/rafelolv/Wipecord) informed engineering and safety conventions. [Redact](https://redact.dev/services/reddit) informed workflow research; no code or artwork was copied. Wipeditt has its own implementation and identity. Build/test tools retain their own licenses. Wipeditt is independent and is not affiliated with Reddit or Redact.
