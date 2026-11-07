# Validation record — 1.0.0 release candidate

## Automated checks

Local Linux x64 validation passed: 63 unit tests, source/build/license checks, the baseline Electron suite and the separate native deletion Electron suite. Native Windows CI is required before publication.

Run `npm run check` for source restrictions, unit tests, desktop build, license/version alignment and sandbox/CSP checks. Run `npm run test:ui` for the existing Electron fixture suite plus the native deletion suite. Both use isolated temporary profiles and local intercepted HTTPS pages, never real Reddit mutations.

The added cases exercise native comment/text/link-post deletion, native confirmation/cancel, fresh-original placeholder verification, combined edit-then-delete order, rejected edits without deletion, rejected deletion after a verified edit, Stop during the combined delay and uncertain outcomes when the original disappears. Unit tests additionally cover the packaged/development gate, replacement-free deletion, mode-specific capabilities, separate stage reports, no replay, bounded explicit throttling and interrupted checkpoint stages.

Existing coverage preserves filters, author detection, pagination/deduplication, account changes, confirmation invalidation, pause/resume/stop, network failures, private reports, local CSV import, HTML injection and update-notification privacy controls.

Official CI now runs only Linux x64 and Windows x64. Packaging validates GPLv3/NOTICE distribution and matching source availability. macOS and ARM are intentionally unsupported.

## Real-account evidence

The maintainer previously confirmed real login, history reading and working anonymization. No independent live deletion or combined-operation validation has been recorded for this candidate. The validation record in DELETION-VALIDATION.md is **incomplete**. Production deletion therefore remains gated; only the explicit unpackaged testing command enables it.

Synthetic successes are not substituted for real observations. A stable v1 tag is blocked automatically until the manual record is completed and the capability flag is reviewed. Do not describe this candidate as a fully live-validated three-mode stable release.
