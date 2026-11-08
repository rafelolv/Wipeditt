# Validation record — 1.0.0

## Automated checks

RC3 Linux x64 and Windows x64 checks, Electron fixtures and packaging passed. Version 1.0.0 repeats the required checks for the final source; release CI must pass on both supported platforms.

Run `npm run check` for source restrictions, unit tests, desktop build, license/version alignment and sandbox/CSP checks. Run `npm run test:ui` for the existing Electron fixture suite plus the native deletion suite. Both use isolated temporary profiles and local intercepted HTTPS pages, never real Reddit mutations.

The added cases exercise native comment/text/link-post deletion, native confirmation/cancel, fresh-original placeholder verification, combined edit-then-delete order, rejected edits without deletion, rejected deletion after a verified edit, Stop during the combined delay and uncertain outcomes when the original disappears. Unit tests additionally cover the packaged/development gate, replacement-free deletion, mode-specific capabilities, separate stage reports, no replay, bounded explicit throttling and interrupted checkpoint stages.

Existing coverage preserves filters, author detection, pagination/deduplication, account changes, confirmation invalidation, pause/resume/stop, network failures, private reports, local CSV import, HTML injection and update-notification privacy controls.

Official CI now runs only Linux x64 and Windows x64. Packaging validates GPLv3/NOTICE distribution and matching source availability. macOS and ARM are intentionally unsupported.

## Real-account evidence

The maintainer previously confirmed real login, history reading and working anonymization. The maintainer has now confirmed the RC3 combined-comment case with both stages verified; the remaining independent live cases are pending. The detailed live matrix in DELETION-VALIDATION.md remains **incomplete**. On November 8, 2026 the maintainer confirmed edit/delete use was working and explicitly approved production release without those finer tests. Production modes are enabled on that reviewed basis; remaining cases are not represented as live passes.

Synthetic successes are not substituted for real observations. A stable v1 tag requires the reviewed capability flag. Do not describe this release as fully live-tested on every content type or on Windows.

## First independent deletion attempt

On November 7, 2026 the maintainer reported successful-looking native deletion and combined behavior, but the candidate correctly reported uncertain verification: one anonymization was verified while deletion was not. This is not counted as a validation pass. Investigation of Reddit's classic templates identified anonymous deleted roots without data-fullname/ID, `<em>` deleted-author labels and optimistic native button updates before request completion. RC2 waits for the owned browser's POST completion metadata and verifies a unique server-deleted root at the exact focused original (context=0). It never reads upload data or response bodies. Missing/ambiguous original pages remain uncertain. The revised connector still requires live revalidation.

## RC2 empty leaf-comment observation

On November 7, 2026 the maintainer reported that Reddit removed the disposable comment during a combined operation and its original showed no comments, while RC2 returned `DELETE_PLACEHOLDER_AMBIGUOUS`. One edit was verified and deletion remained uncertain. This does not complete the live checklist. RC3 distinguishes a bare missing original from an explicit empty focused thread: the latter requires the completed native action, matching available parent post, explicit empty marker and two consecutive fresh reads. Fixture tests cover direct/combined leaf deletion and reject missing receipts, markers, parent posts and wrong targets. UI uncertainty now says verification is incomplete instead of displaying a success checkmark. Revised live validation is still required.

## RC3 combined-comment pass

On November 7, 2026, the maintainer confirmed both anonymization and deletion verified for one new disposable comment using the Linux x64 RC3 validation app (runtime source `2caa579`). This confirms the reported comment regression in a real-account combined operation. Direct deletion, post cases and Stop still await explicit results; production deletion remains gated.

## 1.0.3 regression coverage

The edit regression is reproduced with Markdown whose rendered link label differs from its raw textarea source. Unit cases cover completed native requests, delayed fresh reads, stale editor UI and unchanged source without replay. Electron cases use the default Markdown replacement for combined comment/text-post operations and reject non-persisted edits without deleting. UI coverage adds five-minute expiry/refresh without writes, last-report retention, account-bound inspection after preview disposal, dark/light dropdown options and result-card alignment. All automatic mutations remain confined to isolated synthetic HTTPS fixtures.

## Version 1.0.4 recovery and batch isolation

Synthetic coverage includes a 300-item confirmed combined batch with one uncertain edit, 299 verified deletions, no deletion of the uncertain item and no repeated edit. Additional cases cover fatal uncertainty stopping later writes, offline read recovery and exhaustion, failed navigation retaining its URL, completed transport failure reconciled by fresh source, and stale deletion UI followed by original verification. Native request observation allows 30 seconds; local account checks stay serial without consuming network pacing. Existing live evidence remains unchanged; no real account was accessed for this change.

## Version 1.0.4 maintainer-confirmed combined comments

On November 8, 2026, the maintainer confirmed the requested real-account test of v1.0.4: two new disposable comments processed with Anonymize & Delete and the default replacement, with both stages passing for both comments. This records maintainer-confirmed live writes, separately from the automated synthetic tests. It does not establish live passes for post types, prolonged connection recovery or continuation after an intermittent uncertain item.
