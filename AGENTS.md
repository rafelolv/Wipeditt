# Wipeditt

Created by Rafael (rafaelolv). Repository: https://github.com/rafelolv/Wipeditt.

- English code, comments, UI and documentation; user's language in conversation.
- Source: `src/`; desktop: `src/desktop/`; packaging: `build/`; tests: `test/`; canonical artwork: `images/icon.svg`. Generate ignored `app/` and `dist/`; never edit generated outputs.
- Preserve unrelated work. Commit/push/tag/release only when authorized; the user's requested commits and release authorize those steps. Use repository-local Rafael <82127878+rafelolv@users.noreply.github.com>. No history rewriting or automatic co-authors.
- Current Wipeditt original code, documentation and artwork are GPL-3.0-only. Preserve LICENSE, NOTICE and Rafael attribution. Older tags retain their historical license. Dependencies keep independent licenses/notices; distribute corresponding source with official binaries.
- Desktop shell has no backend, app telemetry, remote configuration, runtime CDN or external fonts. Embedded Reddit runs the website's own resources under its own terms.
- Remote Reddit content: separate owned Electron session, sandbox, context isolation, no Node, no privileged preload/IPC. Main process validates exact shell sender and frame. Never extract cookies, passwords, website tokens or system-browser profiles. Remember-session is opt-in; disconnect clears only app-owned sessions.
- Release checks may read only the fixed public GitHub releases endpoint in the main process. No Reddit credentials/content/identifiers, remote configuration, notes HTML or executable downloads. Preserve the automatic-check opt-out, cache, timeout, payload bound and official-link validation. Never auto-install updates.
- Native connector uses the website's visible forms and DOM. No private endpoint replay, access-control evasion, CAPTCHA automation or invented OAuth approval. Stop on authentication, permission or account changes. Classic layout changes may require connector maintenance.
- Main process owns Engine, confirmation, scheduler, reports and checkpoints. Renderer cannot issue platform requests. Native navigation and writes use the centralized serial scheduler and stricter server cooldowns.
- Use safe DOM creation/text APIs. No innerHTML, outerHTML, insertAdjacentHTML, runtime HTML parsing or eval. Validate external links.
- Own content only; bind verified account and recheck author/account immediately before each write. Scan, review, explicitly confirm. Changes invalidate confirmation; previews expire after five minutes. Type ANONYMIZE or DELETE above 100 items. Dialog dismissal never authorizes writes.
- Native modes use the same engine: anonymize, delete, combined. Production deletion stays gated until independently live-validated; unvalidated testing requires the explicit unpackaged-development gate. Never delete after failed/uncertain edits. Simulation is explicitly separate.
- Pause waits at request boundaries. Stop prevents new requests; submitted writes can finish. No automatic replay of ambiguous writes. Retry safe reads and explicit throttling with bounded backoff.
- Listings are partial, not archives. Track inspected, discovered, matched, eligible and selected independently. Guard duplicates, pagination loops, malformed filters and cancellation.
- Checkpoints contain expiring IDs/statuses, no text/account identifiers. Interrupted writes become uncertain. Reports omit original text, names and sensitive filter values.
- Run `npm run check` and `npm run test:ui` after runtime changes. Electron UI tests use an isolated temporary profile and synthetic HTTPS protocol fixture; never change real Reddit content automatically. Distinguish fixtures, maintainer-confirmed live reads and live writes.
- Support official Linux x64 and Windows x64 only. Do not ship macOS or ARM artifacts. Keep package/lock/build metadata/release notes aligned. Validate native packages and checksums before release. Inspect tags/releases first. No store submissions or automatic updates without authorization.
