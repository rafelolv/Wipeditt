# Independent live deletion validation

Status: **partially completed; production gate remains closed**. Packaged deletion is disabled. Automated fixtures do not satisfy this record. Stable v1 publication is blocked by build/check-release.mjs until validation is complete and the capability flag is reviewed.

## Open the controlled testing app

On Linux x64 or Windows x64 run `npm run validate:deletion`. This builds an unpackaged app, explicitly enables deletion testing and uses a separate temporary app profile (`wipeditt-manual-deletion-validation-VERSION` under the OS temporary directory). It does not read your normal browser/app profile and does not execute any write on launch. Sign in directly on Reddit. Do not send credentials, cookies or tokens to anyone.

Create disposable content you own in a place where testing is allowed. Use distinct short labels so filters isolate each item. Before confirming, select exactly one intended item and check the account, mode and original link. Changes are irreversible.

## Required cases

1. **Direct comment deletion.** Delete one disposable comment. Confirm the app records deletion as verified, then independently reload its original and inspect Reddit's deleted placeholder or its explicit empty focused thread when a leaf comment disappears completely. Disappearance from history alone is not proof.
2. **Direct text-post deletion.** Repeat on a disposable text post. Record whether its original supplies a reliable deleted marker. An inaccessible or missing page must stay uncertain.
3. **Direct non-editable post deletion.** Use a disposable link post. It must be eligible for Delete and ineligible for the combined operation. Verify its original separately.
4. **Combined comment.** Use a new comment and Anonymize & Delete, with a delay long enough to inspect the intermediate saved replacement. Verify the replacement and final deletion separately.
5. **Combined text post.** Repeat the two-stage operation on a new text post.
6. **Stop after the edit.** Use another disposable comment, combined mode and a 60-second delay. After anonymization is verified, press Stop. Its replacement must remain, no deletion may be submitted and the report must show partial completion with the deletion stage skipped. Restart must not replay it.
7. **Rejection and identity guards.** Verify that foreign items and non-editable combined targets cannot be selected; switching accounts invalidates the preview. Record any real explicit rejection observed without forcing access restrictions. Deterministic network, permission, account-change and failed-write cases are also covered by fixtures.

Do not intentionally repeat an uncertain write. If a post cannot be verified, record its error category and stop. Do not count a navigation error, a submitted request, a hidden row or a moderator-removed body as confirmed deletion.

## Record before promotion

Record the date, OS/architecture, app version/commit and pass/fail for each case, plus error categories and stage outcomes. Do not publish account names, original text, cookies, tokens or disposable-content IDs. Independent manual observation should be identified as maintainer-reported evidence.

Only after these cases pass: update this status/VALIDATION.md with the actual evidence, review `DELETION_VALIDATED` in src/desktop/capabilities.js, align version 1.0.0 and its release notes, then repeat required checks and native packaging CI. A stable tag with unvalidated deletion is rejected automatically.

## RC2 follow-up

On November 7, 2026 the maintainer reported that a combined operation removed its disposable comment on Reddit, but the app returned `DELETE_PLACEHOLDER_AMBIGUOUS`; the original showed an empty comment listing. The edit was verified and deletion remained uncertain. This is evidence of a missing leaf-comment verification case, not a full validation pass. RC3 adds the receipt-bound, twice-reloaded focused empty-thread check described in REDDIT-INTEGRATION.md. The complete live checklist remains pending. Do not repeat writes on these previously uncertain items.

## RC3 live result

On November 7, 2026, the maintainer confirmed Anonymize & Delete on one new disposable comment in the Linux x64 `1.0.0-rc.3` validation app (runtime source commit `2caa579`): one anonymization verified, one deletion verified and final deleted status. This is maintainer-reported live evidence, separate from automated fixtures. Direct comment/text/link-post deletion, combined text-post deletion and Stop after verified editing still require confirmation. No private identifiers or original text are recorded.
