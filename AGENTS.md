# Wipeditt

Created by Rafael (rafaelolv). Repository: https://github.com/rafelolv/Wipeditt.

- Use English for code, comments, UI, metadata and documentation. Follow the user's language in conversation.
- Source: `src/`; packaging: `build/`; tests: `test/`; canonical icon: `images/icon.svg`.
- Regenerate `wipeditt.user.js` and `dist/`; never edit outputs manually. Commit the root userscript with source changes. `dist/` is ignored.
- Keep focused changes and preserve unrelated work. Never stage, commit, push, tag or publish without authorization. User-requested commits and releases authorize those steps. Use repository-local Rafael <82127878+rafelolv@users.noreply.github.com>. Never rewrite history or add co-authors automatically.
- Preserve the proprietary license and original attribution. Do not describe this as open source. Third-party dependencies keep their own licenses.
- No backend, telemetry, tracking, remote configuration, runtime CDN, external fonts or executable remote dependencies. Never read Reddit cookies or ask for passwords. Never expose or persist tokens.
- Ship a real installed-app OAuth flow and adapter. Reddit controls registration/approval and may deny access; do not invent a shared Client ID, represent a token as proof of policy approval, or bypass denials. Ask for no password, client secret or pasted website token. Keep setup actionable and distinguish implemented networking from verified real-account success.
- All API calls belong in adapters and pass through the centralized serial scheduler. UI must not make platform requests. No undocumented endpoint bypasses.
- Use DOM creation and text APIs. No innerHTML, outerHTML, insertAdjacentHTML or runtime HTML parsing. Validate external links before assigning them.
- Own content only. Recheck account and item ownership immediately before each write. Stop on authentication/account/permission failure. No moderator or administrator scope.
- Scan then review then explicitly confirm. Filter, mode, replacement, account, selection or schedule changes invalidate confirmation. Preview expires after five minutes. Type ANONYMIZE or DELETE above 100 items. Closing a dialog never authorizes writes.
- Do not auto-delete after failed or uncertain edits. Verify replacement before combined-mode deletion. Non-editable content has no implicit delete fallback.
- Stop prevents new requests; submitted writes may finish. Pause waits at request boundaries. No automatic replay of ambiguous writes. Retry reads and explicit throttling with bounded backoff; honor stricter server cooldowns.
- Listings are not complete archives. Track raw inspected, unique discovered, matched, eligible and selected separately. Guard duplicate IDs, pagination loops, malformed filters and cancellation.
- Checkpoints retain only IDs/statuses with expiry; no original content or account identifiers. Interrupted writes become uncertain and require fresh state verification and preview. Reports omit original text, names and sensitive filter values.
- Run `npm run check` and `npm run test:ui` after runtime changes. Tests use deterministic simulated adapters and isolated browser profiles. Never modify real Reddit content in automated tests; report simulated and live validation separately. Chromium checks do not prove Firefox behavior.
- Live mutations require a non-queued origin Web Lock. Enable live UI only on www.reddit.com so old/www cannot run concurrently under different origin locks. Keep deletion disabled until independently live-validated.
- Keep package, lockfile, metadata, manifests and release notes at the same version. Prepare checksummed packages before release; inspect existing tags/releases before publishing. No store submissions or automatic publication without authorization.
