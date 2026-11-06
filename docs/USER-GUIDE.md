# User guide

Version 0.1.0 cannot connect to Reddit. **Try synthetic data** explicitly loads twelve made-up records; every execution in that mode changes only those records in memory. **Leave simulation** returns to the blocked live adapter. Reloading resets synthetic content.

## Review

Open Wipeditt on www.reddit.com or old.reddit.com. Choose content type and filters. Subreddit lists accept commas/spaces and optional `r/`; exclusion wins. Dates are inclusive local date/time values; start must precede end. Contains and regex are case-insensitive. Regex takes a JavaScript pattern without slash delimiters. Score bounds are inclusive. Unknown score/edited state does not satisfy a filter that needs it.

Use 50, 100, 500, All available or a custom whole-number limit (0 means no item cap, maximum 100000). The cap counts matched preview entries, including ineligible ones. All available describes the accessible listing, never the complete account archive.

Press **Scan content**. Inspected counts raw rows, unique counts valid distinct IDs, matching counts filter matches, eligible counts own supported records, and selected counts your current eligible selection. Read the partial-history notice. Deselect individual items or toggle a subreddit. Ineligible rows show why they are skipped and cannot be selected.

## Operation

**Anonymize** replaces editable bodies with the exact previewed text. The default is `This content has been removed for privacy reasons.` Choose a preset or type your own 1–10000-character nonblank replacement. Existing matching text avoids a redundant edit. Titles/media are not anonymizable.

**Delete** and **Anonymize & Delete** are available only in simulation. Combined mode edits, verifies replacement, waits the configured active-tab delay and then deletes. Failed or uncertain editing never falls back to deletion. Non-editable items are ineligible in combined mode; this release offers no delete fallback switch.

Choose **Review operation**, inspect the action/count/replacement, then explicitly accept. Above 100 items type the exact displayed ANONYMIZE or DELETE phrase. Cancel, Escape or Close cancels confirmation. Settings/selection changes invalidate it. Preview expires after five minutes; an opened confirmation expires after one minute. Scan again when stale.

## Progress and interruptions

Pause/Resume control request boundaries. Stop prevents new requests; submitted requests may finish. Counts distinguish anonymized, deleted, skipped, failed and uncertain. No reliable ETA is calculated; elapsed time and cooldown reason are shown. The app must remain active for delayed deletion; no background work is promised.

Closing the panel stops work and cancels confirmation. A minimal session checkpoint can warn about an interruption after a reload, but never resumes writes automatically. **Clear checkpoint** deletes it. A fresh scan and review are always required; pending interrupted writes are treated as uncertain. Simulated content resets on reload, independently of checkpoint states.

Export report saves local JSON without original/replacement text, names or sensitive filter values. Issue IDs can still identify content. Review before sharing. Privacy mode visually masks sensitive fields/previews; it does not encrypt data or change ownership checks. Light mode and responsive layout are available. Tab through controls; focus indicators remain visible.
