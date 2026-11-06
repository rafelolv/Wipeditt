# Maintenance and architecture

Read [AGENTS.md](../AGENTS.md) before editing. English is required for code/docs/UI. Current license is proprietary; development by others requires permission. User-authorized maintenance can proceed within its scope.

## Sources

- `src/index.js`: same-document runtime claim and Shadow DOM mount.
- `src/ui/`: DOM creation, safe link allowlist, rendering, confirmation and styling. No Reddit networking.
- `src/filters.js`: canonical option validation, matching and eligibility.
- `src/engine.js`: account verification, discovery, selection, preview validity and operation state machine.
- `src/scheduler.js`: serialized calls, pacing, pause/resume, cooldowns and bounded retries.
- `src/auth.js`: installed-app authorization, callback validation and memory-only credentials.
- `src/network.js`, `src/extension/background.js`: restricted direct Reddit transport and packaged extension broker.
- `src/adapters/reddit.js`: official OAuth account/history/content adapter with scheduled write preflights.
- `src/adapters/simulation.js`: explicitly selected synthetic fixtures with guarded edit/delete behavior.
- `src/checkpoint.js`, `src/report.js`: minimized local recovery state and report schema.
- `images/icon.svg`: canonical icon; packaging generates PNGs. Banner is independent local SVG artwork.
- `build/`: bundle, package, deterministic ZIP, static checks and artifact validation.

No runtime libraries, backend or framework. esbuild and Playwright are development tools only. Python's standard library writes ZIP files with sorted paths/fixed timestamps. The generated root userscript is tracked; `dist/` and browser artifacts are ignored.

## Checks

Node 24+, Python 3 and Chromium are required. Run `npm ci`, `npm run check` and `npm run test:ui`. Browser executable overrides are documented in README. Source checking validates syntax and rejects prohibited DOM/network APIs; it is a guardrail, not a complete security audit. Artifact checks verify package/lock versions, userscript metadata, embedded license, identical extension runtimes, ZIP contents and SHA256SUMS.

Unit tests use synthetic adapters and virtual time; browser tests use isolated profiles and intercepted HTTP responses through the real OAuth/API paths. Do not claim live Reddit, Firefox or userscript-manager verification from Chromium results. Browser artifacts are actual screenshots of synthetic data. CI uses Ubuntu 24.04 with the locked Playwright browser dependencies and runs static/unit/build/artifact and browser checks, then rejects committed userscript drift.

Live integration must satisfy [integration release gates](REDDIT-INTEGRATION.md). Review guard behavior after cooldown/retry, server rejection vs uncertain dispatch, partial completion and cancel semantics. Never loosen a guard to pass a test.

## Version and workflow

Maintain `main`. `package.json` is the version source; align the lockfile, regenerate the userscript and both extensions, update changelog and release notes. Original release is 0.1.0. Do not reuse published versions or silently replace assets. See [release process](RELEASING.md).

Preserve unrelated working-tree changes. Commit/push/tag/publish only when authorized. Repository-local commit identity: Rafael <82127878+rafelolv@users.noreply.github.com>; never alter global settings, rewrite history or add co-authors automatically.

## Known remaining work

Registered installed-app Client ID and applicable approval; current-server/redirect acceptance; live anonymization validation; subsequent live deletion validation; official export importer; Firefox and userscript-manager runtime testing; signed store distribution; broader browser accessibility audit. Recovery deliberately warns and requires a fresh scan rather than offering automatic replay. Live UI is restricted to www.reddit.com and requires a non-queued origin Web Lock. Preserve that restriction until any cross-origin locking design is validated.
