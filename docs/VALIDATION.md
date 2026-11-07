# Validation record — 1.0.0 release candidate

## Automated checks

Local Linux x64 validation passed: 69 unit tests, source/build/license checks, the baseline Electron suite and the separate native deletion Electron suite. RC2 Linux x64 and Windows x64 CI both passed; RC3 must repeat those checks before publication.

Run `npm run check` for source restrictions, unit tests, desktop build, license/version alignment and sandbox/CSP checks. Run `npm run test:ui` for the existing Electron fixture suite plus the native deletion suite. Both use isolated temporary profiles and local intercepted HTTPS pages, never real Reddit mutations.

The added cases exercise native comment/text/link-post deletion, native confirmation/cancel, fresh-original placeholder verification, combined edit-then-delete order, rejected edits without deletion, rejected deletion after a verified edit, Stop during the combined delay and uncertain outcomes when the original disappears. Unit tests additionally cover the packaged/development gate, replacement-free deletion, mode-specific capabilities, separate stage reports, no replay, bounded explicit throttling and interrupted checkpoint stages.

Existing coverage preserves filters, author detection, pagination/deduplication, account changes, confirmation invalidation, pause/resume/stop, network failures, private reports, local CSV import, HTML injection and update-notification privacy controls.

Official CI now runs only Linux x64 and Windows x64. Packaging validates GPLv3/NOTICE distribution and matching source availability. macOS and ARM are intentionally unsupported.

## Real-account evidence

The maintainer previously confirmed real login, history reading and working anonymization. No independent live deletion or combined-operation validation has been recorded for this candidate. The validation record in DELETION-VALIDATION.md is **incomplete**. Production deletion therefore remains gated; only the explicit unpackaged testing command enables it.

Synthetic successes are not substituted for real observations. A stable v1 tag is blocked automatically until the manual record is completed and the capability flag is reviewed. Do not describe this candidate as a fully live-validated three-mode stable release.

## First independent deletion attempt

On November 7, 2026 the maintainer reported successful-looking native deletion and combined behavior, but the candidate correctly reported uncertain verification: one anonymization was verified while deletion was not. This is not counted as a validation pass. Investigation of Reddit's classic templates identified anonymous deleted roots without data-fullname/ID, `<em>` deleted-author labels and optimistic native button updates before request completion. RC2 waits for the owned browser's POST completion metadata and verifies a unique server-deleted root at the exact focused original (context=0). It never reads upload data or response bodies. Missing/ambiguous original pages remain uncertain. The revised connector still requires live revalidation.

## RC2 empty leaf-comment observation

On November 7, 2026 the maintainer reported that Reddit removed the disposable comment during a combined operation and its original showed no comments, while RC2 returned `DELETE_PLACEHOLDER_AMBIGUOUS`. One edit was verified and deletion remained uncertain. This does not complete the live checklist. RC3 distinguishes a bare missing original from an explicit empty focused thread: the latter requires the completed native action, matching available parent post, explicit empty marker and two consecutive fresh reads. Fixture tests cover direct/combined leaf deletion and reject missing receipts, markers, parent posts and wrong targets. UI uncertainty now says verification is incomplete instead of displaying a success checkmark. Revised live validation is still required.
