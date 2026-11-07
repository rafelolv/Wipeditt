# Validation record — 0.4.0

## Automated

`npm run check` checks source syntax/restricted APIs, 45 deterministic unit tests, the bundled desktop artifact, version alignment and CSP. Engine tests cover ownership, preview confirmation/expiry, replacement verification, interrupted/uncertain writes, cancellation, throttling, pagination, filters, reports and checkpoint minimization. Import tests cover RFC 4180 quoting, Reddit export mapping, account filtering, stale/invalid rows and the same confirmation path as a live scan.

`npm run test:ui` launches the actual Electron runtime with a fresh temporary profile. A session-local HTTPS protocol handler serves synthetic Reddit pages; no real Reddit network/account is used. Coverage includes isolated native login, automatic account verification without clicking **Verify account**, bridge absence in remote content, sandbox preferences, comment discovery across every available fixture page without an item cap, author metadata with only a profile link or only `data-author`, review pagination, row and checkbox selection, select-all/clear, no writes during scan/cancel, exact replacement text, light/dark/privacy UI, pause/resume, native form save and fresh reread, duplicate pagination, foreign authors, explicit server rejection, text posts, account changes before writes and disconnect.

Screenshots in README show synthetic fixtures. They do not expose a real account or prove live write success. Native CI executes checks and GUI tests for each distribution target before packaging.

## Maintainer-confirmed real session

On November 6, 2026 the maintainer confirmed signing in through the 0.3.1 desktop app, seeing their account after Verify account, and seeing their own comments after a five-item test scan. These observations validate real authentication and history reading for the native connector. They are manual reports, not automated assertions, and do not validate the redesigned 0.4.0 interface, uncapped scan or import path against a real account.

After the 0.4.0 release, the maintainer reported that login still required a manual Verify account click and that many own comments showed “Ownership could not be verified”. Automatic post-login verification and the author-link/`data-author` fallback are covered by the Electron fixture suite above. These fixes have not yet been revalidated against a real account, and every write still independently rechecks the signed-in account and author.

No real-account edit or deletion was performed as part of automated validation. Live editing remains a preview feature. Native deletion stays disabled until separately validated. Package generation alone does not prove installation, OS trust/signing or every account/layout variation.

## Installer builds

Native branch CI successfully generated Linux x64 AppImage/deb, Windows x64 installer and macOS arm64/x64 disk images for the 0.3.x series. The initial v0.3.0 tagged run failed during macOS Intel packaging and published nothing; the same target passed on the subsequent diagnostic CI run. This does not establish the cause of that initial failure. Installer checks run before tagging as well as in release CI.
