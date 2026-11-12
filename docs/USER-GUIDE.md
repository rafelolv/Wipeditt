# User guide

## Connect and discover

Connect Reddit and sign in on its own page. Verification is automatic with a manual fallback. Session memory is opt-in; Disconnect clears only Wipeditt's own sessions. macOS/ARM are unsupported; official packages are Linux x64 and Windows x64.

Choose an operation before searching: Anonymize, Delete, or Anonymize & Delete. Anonymize is the default. All three modes are available in production. Review the operation and selected items before confirming; deletion is irreversible. Simulation is used only by development tests.

Choose comments, posts or both and optional filters. Live listings can omit old history even after every available page is followed. Import comments.csv from Reddit's own export to include comments in that snapshot. Score/edited filters require metadata actually present in the source. No search starts editing or deletion.

## Review and confirm

Review body/title previews, original links, ownership/capability reasons, eligible count and selection. Select individual items or communities. Changing operation recalculates eligibility and invalidates confirmation; newly eligible items are not silently selected. Changed filters require a new search. Previews expire after five minutes.

Anonymize replaces editable bodies with your message and freshly verifies the saved text. Titles and non-editable media/link posts are not editable. Delete does not require a replacement: it uses the native delete button and confirmation, then independently verifies the original. This checks a deleted placeholder or, for a leaf comment, the completed native action and two focused reads showing Reddit's explicit empty thread under the matching parent post. The combined mode independently verifies the edit before rechecking account/author and deleting. It never deletes a non-editable item as a fallback.

The final confirmation shows mode, account, selected/eligible/ineligible counts, the replacement when relevant, and the irreversible deletion warning. More than 100 items require ANONYMIZE or DELETE. Canceling never authorizes a write.

## Progress, interruption and reports

Pause waits at action boundaries. Stop prevents new actions; already submitted changes may finish. Combined delay is active only while the app stays open. A stopped combined operation can leave verified anonymization without deletion: this is partial completion, not complete deletion.

Reports and checkpoints preserve each requested stage's status separately. A failed or uncertain delete after a verified edit remains distinguishable from complete success. Ambiguous submissions are never replayed. Checkpoints contain IDs and stage statuses, not text, names or replacement messages; restart requires fresh review. If verification fails, inspect the original instead of repeating the write automatically.

Neither mode removes external archives, backups, screenshots, quotes or caches.

## Settings

Black-first appearance and optional light mode, privacy masking, reports and checkpoints live in the sidebar. License & source shows GPLv3, copyright, the warranty disclaimer and the source link. New-release checks use fixed public GitHub metadata without Reddit data, can be disabled, and never install updates on ordinary app quit. On Windows and AppImage, use Download update followed by Install and restart after Reddit work is finished; Debian packages use View release. Install the first updater-enabled version manually once.

Results use green for verified success, red for failures, amber for uncertain/partial/stopped outcomes and violet for actions in progress. Labels and stage counts remain visible alongside the colors. App updates has a visible sidebar button; automatic release checks remain optional in Settings. The default replacement credits Wipeditt with a Reddit Markdown link; you can edit it before confirmation.

Previews expire after five minutes. Use Refresh results to run a new read and review before confirming again. An imported preview offers Re-import export so it keeps the same source. Expiry cancels an open confirmation and never authorizes writes. Save last report remains available after refreshing. If verification is uncertain, Inspect original opens the reviewed item; do not repeat an uncertain action without checking it.

Result cards use the same aligned icon, heading, actions and separate stage counters. A deletion-only run labels anonymization Not requested. Native dropdowns and their options follow the selected dark/light theme.

Isolated uncertain items remain in the report while the confirmed batch continues. Inspect their originals before considering another attempt. Account/permission changes, pending native requests and prolonged connection failures stop the batch. Short connection outages retry safe reads with bounded backoff; writes with unknown outcomes are never replayed. Routine short request countdowns are hidden.

History is read from Reddit profile pages, following the next-page links Reddit actually supplies. Classic Reddit keeps separate native orderings for top, newest, controversial and hot profiles. Wipeditt reads the all-time top view and the newest view first; when either reaches its per-ordering boundary, it also reads controversial and hot instead of stopping at that first 1,000-entry view. A repeated forward cursor moves to the next ordering rather than ending the scan. There is still no complete-account archive guarantee. If Reddit ends the listing early or older entries remain hidden, use Import older comments below the results or request your official export. Extract comments.csv from Reddit's ZIP; author-less exports and relative Reddit permalinks are accepted. Importing is local and does not establish ownership: the live Reddit account and author are checked again before writes.

Repeated reads of the same loaded original now inspect the live DOM without spending another network interval. Navigation, expansion, fresh write preflights and mutation verification remain scheduled, with Reddit cooldowns preserved. No item text is cached by this optimization.
