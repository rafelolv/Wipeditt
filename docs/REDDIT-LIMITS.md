# Reddit limits

- Website history is a bounded listing, not a complete archive. Deleted, hidden, inaccessible or very old entries may be absent. Wipeditt's live scan has no app-imposed item cap, but Reddit can still stop a listing early. A successful scan is not proof of complete coverage.
- `comments.csv` import from Reddit's official data export can reach older comments. It is a snapshot: comments edited or deleted since the export are skipped, duplicate rows are ignored, and text-post bodies are not included.
- Live mode replaces editable comment and text-post bodies. Link posts, titles and non-editable items are ineligible. Deletion remains disabled; simulation demonstrates additional workflows only.
- Classic website structure can change. Missing expected controls, account mismatch or access restrictions must stop the connector rather than trigger a fallback endpoint.
- A verified login confirms session identity, not policy approval, edit permission, full coverage or future availability. Reddit can require verification or deny access.
- Server cooldowns can exceed the selected delay. Pause and Stop apply at request boundaries. An already submitted save can finish after Stop.
- Fresh reads can fail after a successful submission. Such writes are uncertain and are never automatically repeated. Inspect original content and obtain a new preview before retrying.
- Replacing a body does not remove quoted text, search caches, archives, moderation records, backups or other people's copies. There is no erasure guarantee.
