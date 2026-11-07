# Changelog

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
