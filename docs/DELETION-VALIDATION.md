# Independent live deletion validation

Status: **production enabled after maintainer review on November 8, 2026; detailed live matrix incomplete**. The maintainer independently confirmed a real combined-comment operation with both stages verified on November 7, then confirmed anonymization/deletion were working and explicitly approved production release on November 8 without completing the fine-grained matrix. This review is the basis for `DELETION_VALIDATED = true`; it is not a claim that every case below passed live. Automated tests remain separate evidence.

## Open the controlled testing app

On Linux x64 or Windows x64 run `npm run validate:deletion`. This builds an unpackaged app, explicitly enables deletion testing and uses a separate temporary app profile (`wipeditt-manual-deletion-validation-VERSION` under the OS temporary directory). It does not read your normal browser/app profile and does not execute any write on launch. Sign in directly on Reddit. Do not send credentials, cookies or tokens to anyone.

Create disposable content you own in a place where testing is allowed. Use distinct short labels so filters isolate each item. Before confirming, select exactly one intended item and check the account, mode and original link. Changes are irreversible.

## Remaining detailed live regression checklist

1. **Direct comment deletion.** Delete one disposable comment. Confirm the app records deletion as verified, then independently reload its original and inspect Reddit's deleted placeholder or its explicit empty focused thread when a leaf comment disappears completely. Disappearance from history alone is not proof.
2. **Direct text-post deletion.** Repeat on a disposable text post. Record whether its original supplies a reliable deleted marker. An inaccessible or missing page must stay uncertain.
3. **Direct non-editable post deletion.** Use a disposable link post. It must be eligible for Delete and ineligible for the combined operation. Verify its original separately.
4. **Combined comment.** Use a new comment and Anonymize & Delete, with a delay long enough to inspect the intermediate saved replacement. Verify the replacement and final deletion separately.
5. **Combined text post.** Repeat the two-stage operation on a new text post.
6. **Stop after the edit.** Use another disposable comment, combined mode and a 60-second delay. After anonymization is verified, press Stop. Its replacement must remain, no deletion may be submitted and the report must show partial completion with the deletion stage skipped. Restart must not replay it.
7. **Rejection and identity guards.** Verify that foreign items and non-editable combined targets cannot be selected; switching accounts invalidates the preview. Record any real explicit rejection observed without forcing access restrictions. Deterministic network, permission, account-change and failed-write cases are also covered by fixtures.

Do not intentionally repeat an uncertain write. If a post cannot be verified, record its error category and stop. Do not count a navigation error, a submitted request, a hidden row or a moderator-removed body as confirmed deletion.

## Record and review

Record the date, OS/architecture, app version/commit and pass/fail for each case, plus error categories and stage outcomes. Do not publish account names, original text, cookies, tokens or disposable-content IDs. Independent manual observation should be identified as maintainer-reported evidence.

Record each additional live result here without promoting untested cases to passes. Production promotion follows the explicit maintainer review described above, the confirmed real combined-comment operation and repeated automated/native packaging checks. The release guard still rejects stable v1 if the reviewed capability flag is false.

## RC2 follow-up

On November 7, 2026 the maintainer reported that a combined operation removed its disposable comment on Reddit, but the app returned `DELETE_PLACEHOLDER_AMBIGUOUS`; the original showed an empty comment listing. The edit was verified and deletion remained uncertain. This is evidence of a missing leaf-comment verification case, not a full validation pass. RC3 adds the receipt-bound, twice-reloaded focused empty-thread check described in REDDIT-INTEGRATION.md. The complete live checklist remains pending. Do not repeat writes on these previously uncertain items.

## RC3 live result

On November 7, 2026, the maintainer confirmed Anonymize & Delete on one new disposable comment in the Linux x64 `1.0.0-rc.3` validation app (runtime source commit `2caa579`): one anonymization verified, one deletion verified and final deleted status. This is maintainer-reported live evidence, separate from automated fixtures. Direct comment/text/link-post deletion, combined text-post deletion and Stop after verified editing still require confirmation. No private identifiers or original text are recorded.

## Production review — November 8, 2026

The maintainer stated that anonymization and deletion were already working and authorized releasing them without the remaining fine-grained tests. The existing independently confirmed RC3 combined-comment pass verifies both native stages on Linux x64. Production modes are enabled following that explicit review. Direct comment/text/link-post cases, combined text-post and the interruption matrix remain unconfirmed live; fixtures cover these cases on Linux x64 and Windows x64. No live Windows mutation is claimed. No private content or credentials were used by automated tests.
