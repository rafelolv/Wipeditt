# User guide

## Connect

Install a desktop package from the official release. Choose Connect Reddit; sign in directly on Reddit's page in the embedded browser. Wipeditt never asks for a pasted password, cookie or token. Choose Verify account after login. The sidebar shows the verified username; privacy mode masks it.

Session memory is off by default. Enable Remember session before connecting only if you want Chromium to retain this app's Reddit session on this device. Disconnect clears Wipeditt's own session storage and invalidates the review. It does not sign out your normal browser.

Opening the browser or switching accounts invalidates the previous preview. Verify again and scan from the new account. Reddit may require its own verification or deny website access; Wipeditt does not bypass those checks.

## Scan and review

Start with Maximum items set to 5. Select comments, text posts or both, optional date/subreddit/text/score filters, then Scan history. This stage reads only. A scan is a bounded listing, not an export or guarantee that all historical content was found. Duplicate entries count toward inspected rows but not unique discoveries.

Inspect snippets, dates, subreddit and eligibility. Open original links when needed. Only your own editable body text is eligible. Select individual items or a subreddit group. Changing filters requires a fresh scan; changing selection, replacement or timing invalidates confirmation. Review shows the exact replacement as text, including markup characters.

## Anonymize

Live desktop mode replaces comment or text-post bodies only. It does not change titles. Deletion and edit-then-delete are available in simulation only.

Choose a replacement and review the confirmation. Above 100 items, type ANONYMIZE exactly. Confirmation expires after five minutes. Canceling or closing it does nothing. Each live edit rechecks the account and author, submits the website's save form, then navigates again to verify the saved text.

Pause takes effect at a request boundary; Resume continues the current reviewed operation. Stop prevents new work. A submitted edit may still finish. A missing response or changed account after submission is uncertain; inspect the original and obtain a fresh preview before acting again. Never assume a failed save means nothing changed.

Reports contain statuses and IDs, not original text or names. Checkpoints support conservative status recovery, not automatic write replay. Clearing local checkpoints does not undo Reddit changes.

## Simulation and troubleshooting

Demo data is local and explicitly labeled; it never proves that your real account supports writes. Switching between simulation and Reddit invalidates the preview.

If login fails, use Open Reddit in app and complete Reddit's own sign-in flow, then Verify account. If history stops loading or controls cannot be found, stop and report the app version and error code without sharing credentials, cookies, original private text or tokens. The classic website connector may need maintenance after Reddit changes.
