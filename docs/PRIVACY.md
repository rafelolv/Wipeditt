# Privacy and data lifecycle

Wipeditt 0.1.0 has no live Reddit transport. Its runtime makes no network requests. It has no telemetry, analytics, backend, remote configuration, external fonts, CDN scripts or third-party credential proxy. Installing it does not grant API access. It never reads browser cookies or collects Reddit passwords.

Preview/account objects and synthetic original content are held in memory. Closing the panel stops processing; it may leave the current preview in memory for reopening. Reloading or closing the tab clears runtime memory. Successfully deleted simulated text is cleared from the adapter and preview; successful replacement updates the preview value. Reports/logs/checkpoints never store original text. Content might still exist in browser memory until garbage collection; no secure-memory erasure guarantee is made.

The sessionStorage key `wipeditt.checkpoint.v1` stores only a simulation flag, expiry and `{ id, state }` records. It expires after 24 hours on the next app read and normally disappears with the tab session; browsers may restore sessions. **Clear checkpoint** removes it immediately. It is not encrypted, and scripts from the same origin can access it. No account identifier, subreddit, replacement, filters, text or token is included. Storage denial does not prevent the panel from working; persistent recovery then is unavailable.

An interrupted checkpoint never authorizes a mutation. Pending/editing/waiting states load as uncertain; the app warns and requires fresh scan/review. No original content is restored or auto-replayed. Synthetic data resets on reload.

Reports include application/version/time, simulation flag, operation, elapsed time, safe filter flags, counts, issue IDs/categories and scheduler statistics. IDs can identify content. Keep reports private unless reviewed. Export uses a local Blob download and does not transmit the report. Activity contains statuses and IDs only, bounded to 30 entries, and never API credentials or original text.

Privacy mode masks subreddit names, search/filter text and previews visually. It does not encrypt data, prevent browser inspection or alter account ownership checks. Synthetic identity is not a real account.

Future live implementation must honor Reddit's [retention requirements](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki), clear deleted content and account-identifying data as required, keep tokens in memory and minimize scans. Editing visible text cannot remove copies from archives, caches, moderation records or third parties. Wipeditt cannot guarantee complete anonymization.
