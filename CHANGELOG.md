# Changelog

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
