# User guide

## Connect

Install a desktop package from the official release. Choose **Connect Reddit**; sign in directly on Reddit's page in the embedded browser. Wipeditt never asks for a pasted password, cookie or token. Wipeditt verifies the account automatically after login; **Verify account** remains a manual fallback. The sidebar shows the verified username; privacy mode masks it.

Session memory is off by default. Enable **Keep me signed in on this device** before connecting only if you want Chromium to retain this app's Reddit session on this device. Disconnect clears Wipeditt's own session storage and invalidates the review. It does not sign out your normal browser.

Opening the browser or switching accounts invalidates the previous preview. Verify again and scan from the new account. Reddit may require its own verification or deny website access; Wipeditt does not bypass those checks.

## Scan and review

Choose **Comments**, **Text posts** or **Comments & text posts**, add optional community, date, text, score or edited-status filters, then choose **Find my comments**. This stage reads only.

The live scan follows every history page Reddit's classic listing makes available. Wipeditt no longer applies its own item cap. Reddit can still stop a listing early or omit inaccessible and very old content, so a finished scan is not proof of complete account coverage. Duplicate entries count toward inspected rows but not unique discoveries.

Inspect snippets, dates, community and eligibility. **Open ↗** opens the original in the embedded Reddit browser. Only your own editable body text is eligible.

The review view shows 10 items per page. Select or deselect a row by clicking it, or use its checkbox. **Select all ready** selects every eligible match across all pages; **Clear** removes the selection. The community menu selects or clears every eligible match in one community. Selection is kept while you change pages.

Changing a filter after a scan requires a fresh scan. Changing selection, replacement or timing invalidates the pending confirmation.

## Older history: import the official export

Reddit's live pages may stop before your oldest comments. For broader coverage, request your data from [Reddit's data request page](https://www.reddit.com/settings/data-request). Wipeditt also links there from **How to get it**.

When Reddit sends the archive, download and open it, then use **Import comments.csv** in Wipeditt and choose the `comments.csv` file. The main process reads the file locally (up to 64 MB); it is never uploaded.

Import applies the same filters as a live scan. Rows from another author, `[deleted]` or `[removed]` bodies, duplicates and malformed rows are skipped. Import covers comments, not text posts. The export is a snapshot: if a comment changed or disappeared on Reddit since then, Wipeditt skips it during the pre-write ownership and text check. Never assume an old export still matches the live site.

## Replace text

Live desktop mode replaces comment or text-post bodies only. It does not change titles, links or media. Deletion and replace-then-delete are available in simulation only.

Choose a replacement message or one of the quick messages. **Review changes** shows the exact replacement as text, including markup characters. Above 100 selected items, type `ANONYMIZE` exactly. Confirmation expires after five minutes. Canceling or closing it does nothing.

Each live edit rechecks the account and author, reloads the original, submits Reddit's own save form, then navigates again to verify the saved text. Saved replacement is compared as text; markup is not rendered.

Pause takes effect at a request boundary; Resume continues the current reviewed operation. Stop prevents new work. A submitted edit may still finish. A missing response or changed account after submission is uncertain; inspect the original and obtain a fresh preview before acting again. Never assume a failed save means nothing changed.

Theme and privacy preferences are saved locally. **Hide private text** blurs sensitive text in the app; it does not change Reddit data or protect the operating-system account.

## Finished state and reports

When a run finishes or stops, Wipeditt shows a summary with operation counts and elapsed time. **Save report** writes a local JSON file through the native save dialog.

Reports contain the app version, timestamp, source (`live` or `import`), operation, filter presence flags, counts and per-item IDs/statuses. They omit original text, usernames and sensitive filter values. Treat reports as private because IDs can still be identifying.

Checkpoints contain expiring IDs and statuses only. They support conservative status recovery, not automatic write replay. Clearing local checkpoints does not undo Reddit changes.

## Simulation and troubleshooting

Sample data is local and explicitly labeled; it never proves that your real account supports writes. Switching between simulation and Reddit invalidates the preview.

If login fails, use **Open Reddit browser** and complete Reddit's own sign-in flow. Verification normally runs automatically; use **Verify account** if it does not finish. If history stops loading or controls cannot be found, stop and report the app version and error code without sharing credentials, cookies, original private text or tokens. The classic website connector may need maintenance after Reddit changes.

If an import is rejected, choose the `comments.csv` from Reddit's official archive and check that it is under 64 MB. If live history is incomplete, import the export; there is no hidden archive in Reddit's live listing.
