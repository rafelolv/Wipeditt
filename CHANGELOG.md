# Changelog

## 1.0.0-rc.2 — 2026-11-07

- Fix verification of classic Reddit deleted roots that omit identity attributes and use an em deleted-author marker.
- Bind anonymous deletion proof to a unique server-deleted root at the exact focused original, with context=0; reject unrelated or ambiguous placeholders.
- Wait for native POST completion metadata before verification navigation so an optimistic delete label cannot cancel an in-flight write or imply success.
- Retry bounded verification reads only and retain sanitized uncertainty reasons. Keep production deletion gated pending revised live validation.

## 1.0.0-rc.1 — 2026-11-07

- Implement native Delete and Anonymize & Delete through the existing scheduler, preview/confirmation and execution engine; production deletion remains gated pending independent live validation.
- Verify deletion on a fresh original with positive deleted-placeholder evidence; never infer success from a hidden row, missing page or listing absence.
- Preserve separate anonymization/deletion stage outcomes in reports and minimized checkpoints, including partial failures and interrupted operations.
- Integrate the three-mode selector, operation-specific eligibility, replacement-free Delete mode and explicit irreversible confirmations.
- Relicense current original code/documentation/artwork to GPL-3.0-only with preserved Rafael attribution, notices and corresponding source.
- Retire macOS/ARM builds and release/update paths; support Linux x64 and Windows x64 only.
- Add the controlled unpackaged live-validation procedure and a guard against premature stable v1 publication.

## 0.6.0 — 2026-11-07

- Notify about newer compatible GitHub releases with an official release-page button.
- Add automatic metadata checks in packaged apps, a persisted opt-out and manual checks under Settings & tools.
- Include published previews for preview installations; require uploaded platform packages and checksums, semantic version ordering, bounded responses and throttled requests.
- Keep all package downloads and installation manual. Send no Reddit credentials, content or identifiers.

## 0.5.0 — 2026-11-07

- Resolve own authors from profile links, data attributes, author spans and native author-only editing controls, with agreement checks between metadata sources.
- Recheck unknown listing authors on their original permalink instead of permanently rejecting incomplete listing metadata. Exclude nested context replies from profile results.
- Distinguish unknown authors from known foreign content; keep independent fresh ownership checks before each write.
- Replace the warm card-heavy interface with a black-first monochrome layout, flat review rows and neutral branding. Preserve optional light appearance.
- Add Electron regressions for 65 own comments, conflicting/deleted/external authors, nested context and original-permalink recovery.

## 0.4.1 — 2026-11-06

- Verify the Reddit account automatically after the initial login; keep **Verify account** as a manual fallback.
- Read classic Reddit author metadata when either the profile link or `data-author` is missing, so own comments remain selectable without weakening pre-write ownership checks.
- Extend the Electron fixture to log in without clicking **Verify account** and to scan items missing one author source.

Validation: 45 deterministic unit tests and the Electron fixture suite pass.

## 0.4.0 — 2026-11-06

- Redesign the desktop interface with a warm light theme, a full dark theme and a clearer connection, scan and review flow.
- Follow every history page Reddit exposes by default; remove the app-imposed item cap and add paged review with row, checkbox and community selection.
- Import local `comments.csv` files from Reddit's official data export to reach older comments, with pre-write ownership and text verification.
- Persist theme and privacy preferences locally, add a finished summary and report action, and expose Reddit's data-request page.
- Extend deterministic and Electron fixture coverage for import, uncapped pagination, selection, themes, privacy mode, rejection, text posts and account changes.

Validation: 44 deterministic unit tests and the Electron fixture suite pass. Previous manual checks confirmed real sign-in, account verification and history reading; the redesigned UI, uncapped scan and import path are fixture-tested. Real-account editing remains unvalidated and live deletion stays disabled.

## 0.3.1 — 2026-11-06

- Validate native installers in branch CI and expose actionable packaging failures.
- Publish the desktop preview after a four-target packaging run passed. The v0.3.0 release attempt failed on macOS Intel and was not published; its tag remains unchanged.

## 0.3.0 — 2026-11-06

- Replace userscript/extensions with an isolated Electron desktop app and native Reddit website sign-in.
- Add classic history discovery, native form anonymization, fresh ownership/replacement checks and local session controls.
- Rebuild connection/review/execution UI, desktop fixtures, native packaging and release CI.
- Maintainer confirmed real login and comment discovery; live edits remain unvalidated and deletion disabled.

## 0.2.0 — 2026-11-06

- Replace the permanently blocked live adapter with real installed-app OAuth and official Reddit API discovery/anonymization.
- Add guided registration/sign-in, memory-only tokens, explicit disconnect and callback recovery without window.opener.
- Add restricted anonymous userscript networking and a packaged cookie-free extension broker.
- Pace authentication and every API/ownership preflight through the centralized scheduler.
- Simplify the main interface to connection, content choice and review; move demo/advanced tools into collapsed settings.
- Update replacement previews without rescanning or extending their lifetime.
- Prevent concurrent live runs using an origin lock on www.reddit.com.

Validation: 50 deterministic tests plus full OAuth-to-edit browser/extension flows using intercepted HTTP fixtures. No real authorized account was accessed. Reddit registration/approval are external prerequisites; live deletion remains unavailable.

## 0.1.0 — 2026-11-06

- Add a local, shared userscript and extension runtime with a compact dark/light panel.
- Add filtered discovery, ownership checks, preview selection and explicit confirmation.
- Add verified anonymization, deletion and delayed combined workflows for synthetic data.
- Add serial pacing, bounded retries, pause/resume, Stop and uncertain outcomes.
- Add minimized session checkpoints and local reports without original content.
- Add proprietary licensing and original Wipeditt artwork by Rafael (rafaelolv).

Validation: deterministic unit tests and isolated Chromium userscript/content-script checks; no real Reddit modifications.

Limitation: live Reddit integration is blocked pending explicit approval and verified OAuth. Firefox and userscript-manager runtime behavior are not validated. This is a technical preview, not a working live Reddit cleaner.
