# User guide — 0.2.0

## Connect

Open www.reddit.com, then Wipeditt. Choose **Connect Reddit**. First-time instructions open inside the connection dialog: create a Reddit **installed app**, set its redirect URI to `https://www.reddit.com/`, then paste its public Client ID. Reddit may require approval before registering/enabling that app. Use the linked official guidance if registration is denied; signing into an account does not create API approval.

Click **Sign in with Reddit**, complete Reddit's sign-in and permission screen, and return to Wipeditt. The connected username appears only after API identity verification. No password/client secret/pasted token is needed. Tokens stay in memory, expire after at most one hour and clear on disconnect, panel close or reload. The public Client ID may be remembered. **Cancel sign-in** stops a pending connection; blocked popups need browser permission.

On old.reddit.com, choose **Open Reddit** to continue on www. Live mutations share a non-queued origin lock, so multiple tabs cannot run together.

## Choose content

Comments are the default. Choose text posts or both if needed, plus a maximum matching item count. Zero means all available, up to a 1000-page safety cap; no listing is guaranteed to include complete historical content. The item cap includes ineligible matches.

**Add filters** contains subreddit include/exclude (comma/space lists, optional r/ prefix, exclusion wins), case-insensitive contains/JavaScript regex (no slash delimiters), inclusive local date/time bounds, min/max score and edited status. Unknown metadata does not satisfy a filter requiring it. Invalid expressions, dates and ranges fail before network access.

Choose **Scan history**. No content changes during scanning. The summary distinguishes found/eligible/selected; **Settings & help → Scan details & activity** includes inspected/unique/matching counts. Read the stopping reason and partial-history limitation.

## Review and replace

The content list shows original text previews, subreddit/type/date/score, original links and ineligible reasons. Select all/none, individual items, or expand **Select by subreddit**. Only eligible own content can be selected.

Enter the exact replacement under **Replace selected text with**. The default is `This content has been removed for privacy reasons.` Any nonblank 1–10000-character replacement is accepted. Changing replacement updates the existing scan without a new request; it cancels any previous confirmation and does not extend preview lifetime. Filter changes require a new scan.

Choose **Review N selected**. The dialog repeats account/count/action and exact replacement. Above 100 items, type ANONYMIZE. Accept explicitly. Cancel/Escape/Close does not authorize any write. A preview expires after five minutes; confirmation after one minute.

The API rechecks account and ownership before writes/retries, interprets responses, then reads current content to verify exact replacement. A request being sent is not success. Ambiguous outcomes become uncertain and are not auto-replayed. Titles/media cannot be anonymized; external archives/caches/moderation copies may remain.

## Progress and settings

Pause/Resume work at request boundaries. Stop aborts waits and prevents new dispatch; submitted writes may finish. Closing the panel stops work and clears real-account authorization. Use **Settings & help** for visual privacy masking, theme, activity, report export and checkpoint clearing. Reports exclude original/replacement text, usernames/subreddits and sensitive filter values, but issue IDs may be sensitive.

**Operation settings** contains minimum request interval; stricter server limits always win. Live mode supports anonymization only. Delete, combined mode and deletion delay are demo-only pending separate real-account validation.

**Try demo data** is under Settings & help. It disconnects real authorization and loads synthetic content; the demo notice remains visible. Use Disconnect, then Connect Reddit to return to an account. Demo content resets on reload. An interrupted checkpoint never auto-resumes writes; fresh scan/review are required.
