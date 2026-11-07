# Validation record — 0.3.1

## Automated

`npm run check` checks source syntax/restricted APIs, 39 deterministic unit tests, the bundled desktop artifact, version alignment and CSP. Engine tests cover ownership, preview confirmation/expiry, replacement verification, interrupted/uncertain writes, cancellation, throttling, pagination, filters, reports and checkpoint minimization.

`npm run test:ui` launches the actual Electron runtime with a fresh temporary profile. A session-local HTTPS protocol handler serves synthetic Reddit pages; no real Reddit network/account is used. Coverage includes isolated native login, bridge absence in remote content, sandbox preferences, comment discovery, no writes during scan/cancel, exact replacement text, pause/resume, native form save and fresh reread, duplicate pagination, foreign authors, light/dark/privacy UI, explicit server rejection, text posts, account changes before writes and disconnect.

Screenshots in README show synthetic fixtures. They do not expose a real account or prove live write success. Native CI executes checks and GUI tests for each distribution target before packaging.

## Maintainer-confirmed real session

On November 6, 2026 the maintainer confirmed signing in through the desktop app, seeing their account after Verify account, and seeing their own comments after Scan history with a five-item limit. These observations validate real authentication and history reading in that environment. They are manual reports, not automated assertions.

No real-account edit or deletion was performed as part of automated validation. Live editing remains a preview feature. Native deletion stays disabled until separately validated. Package generation alone does not prove installation, OS trust/signing or every account/layout variation.

## Installer builds

Native branch CI successfully generated Linux x64 AppImage/deb, Windows x64 installer and macOS arm64/x64 disk images. The initial v0.3.0 tagged run failed during macOS Intel packaging and published nothing; the same target passed on the subsequent diagnostic CI run. This does not establish the cause of that initial failure. Installer checks now run before tagging as well as in release CI.
