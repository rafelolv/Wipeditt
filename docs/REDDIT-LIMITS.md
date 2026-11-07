# Reddit limits

- Website listings and export snapshots are not a complete, current account archive. Available pages can end before older content. Pagination, duplicate and safety limits remain explicit.
- Only owned content with actual native controls is eligible. Anonymize requires an editable body; Delete requires a delete action; combined requires both. Link/media posts may support Delete while remaining ineligible for the other modes.
- Deletion is implemented but production-gated pending independent manual validation. Follow DELETION-VALIDATION.md; synthetic tests do not certify the live website.
- A deleted comment/post can retain a placeholder. Verification requires positive deleted evidence: a fresh original placeholder, or a completed native delete followed by two focused empty-thread reads with the matching available parent post and explicit Reddit empty marker. A missing item, a hidden row, a history disappearance, a moderator removal or a network/navigation failure is not enough.
- A combined operation can end with only a verified replacement. Reports distinguish failed, skipped and uncertain deletion from complete deletion.
- Authentication/account changes stop work. Server cooldowns can be stricter than the selected interval. Stop cannot retract an already submitted action; uncertain actions are never replayed automatically.
- Website layouts can change; missing controls fail closed. No cookies are extracted, no private endpoints are replayed, and no access restrictions are bypassed.
- Editing/deleting cannot erase third-party copies, caches, moderation records or backups. No complete erasure is guaranteed.
