# Reddit limits and outcomes

The [official Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki) currently describes an eligible free-client quota of 100 queries/minute per OAuth client, averaged across a ten-minute window. That is conditional guidance, not a universal guarantee or a per-user edit allowance. Separate write cooldowns, approval restrictions and account permissions can be stricter. Recheck official guidance before live integration.

Wipeditt serializes all adapter calls. Its automatic minimum is 1500 ms; larger user intervals are honored. `X-Ratelimit-Remaining`, `X-Ratelimit-Reset` and `Retry-After` can impose longer waits. A normalized body cooldown can also extend waiting. HTTP 429 and explicit RATELIMIT rejection have at most three retries after the initial attempt; absent a server duration, throttling waits at least 60 seconds. Read network/5xx errors use bounded exponential backoff. 401/403 stop the operation. No random bypass delays, burst scheduling or unlimited retry loops exist.

An ambiguous write timeout/5xx is **uncertain**, never automatically retried. Explicit throttling may be retried only while the adapter rechecks ownership at dispatch. Verification failure after a submitted write stays uncertain. Reports count final states, not requests sent.

Pause takes effect at request boundaries; Stop aborts waits and prevents dispatch of new tasks. Submitted requests may finish. Delay timers need an active tab; browsers may throttle timers, so deletion can occur later than requested. Closing the tab never guarantees delayed deletion.

Listings may omit older, removed or inaccessible content. Pagination deduplication, cursor-loop detection, a 1000-page guard and custom item limits prevent runaway scans. Every preview records its stopping reason and sets `completeHistory: false`. Unknown score/edited values do not match filters requiring those values.

Editing a comment or self-post body cannot change its title or ensure archive/cache removal. An edit capability is provisional until the server accepts and a read verifies it. Do not infer deletability after editing fails. Current release implements real OAuth reads/anonymization and tests them through HTTP fixtures. Real-account approval/authentication/editing are not verified. Live deletion/combined mode remain unavailable.
