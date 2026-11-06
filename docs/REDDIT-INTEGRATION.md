# Reddit integration decision

Research date: **2026-11-06**. Status: **blocked live integration**, synthetic engine tested. No real Reddit account was accessed and no real content was modified.

## Decision

Ship one local browser runtime in a userscript and two extension packages, with a fail-closed adapter. The production adapter (`src/adapters/blocked.js`) refuses account, listing, read, edit and delete calls. The independently selected synthetic adapter is functional and never performs network requests. There is no authentication implementation or hidden developer switch that enables real operations.

Browser packaging is practical for local UI and business logic. It does not establish Reddit approval, permitted use of session cookies or cross-origin OAuth feasibility. Website-private endpoints, cookie extraction and password collection are not acceptable substitutes for approval. No Devvit API has been demonstrated here to support a user's account-wide cleanup; availability of Devvit does not establish this product's feasibility.

## Official sources reviewed

- [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy): explicit approval is required before accessing Reddit data through the API. Do not circumvent limits. Developers are directed toward Devvit.
- [Developer FAQ](https://developers.reddit.com/docs/guides/faq): external Data API integrations have a separate approval process; unsupported Devvit use cases should follow Reddit Help guidance.
- [Developer Platform & Accessing Reddit Data](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data): access requirements and application guidance.
- [Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki): OAuth identification, response quota headers, eligible-client quota guidance and data retention obligations. Legacy technical guidance can be out of date.
- [API reference](https://www.reddit.com/dev/api/): own identity, listings, content information and edit/delete methods.
- [Archived official OAuth2 guidance](https://github.com/reddit-archive/reddit/wiki/OAuth2): historical installed/public-client and implicit flows. This is not proof that a new client registration or that flow is currently approved.
- [Developer terms](https://redditinc.com/policies/developer-terms) and [Data API terms](https://redditinc.com/policies/data-api-terms): must be reviewed against the approved use case before activating live integration.
- [Developer registration](https://developers.reddit.com/app-registration): currently describes migration/registration and a January 12, 2027 enforcement milestone. Recheck before release of any live client.

The absence of an approval artifact/configuration in this new repository is not a claim that approval is universally impossible. Approval and authentication are separate prerequisites.

## Endpoint research; not shipped networking

| Intended operation | Documented REST route | Expected scope |
| --- | --- | --- |
| Verify account | `GET /api/v1/me` | `identity` |
| Discover own comments | `GET /user/{username}/comments` | `history` |
| Discover own posts | `GET /user/{username}/submitted` | `history` |
| Re-read content | `GET /api/info?id={fullname}` | `read` |
| Replace comment/self-post body | `POST /api/editusertext` | `edit` |
| Delete own content | `POST /api/del` | `edit` |

Use registered OAuth against `https://oauth.reddit.com`, documented fullnames, pagination cursors and `raw_json=1` where appropriate. Post titles are not editable. Non-self media/link content must not be passed off as an editable body. Server capability and permission decisions remain authoritative, including restrictions on archived/locked/removed content. A successful HTTP response alone does not verify the final state. Recheck scope requirements in the current official reference during implementation.

## Authentication release gates

1. Obtain explicit Reddit approval for this exact account-history cleanup use case and register the application through the current process.
2. Confirm a permitted public-client flow for both userscript and extension distributions. Never embed a confidential client secret. The archived installed-app implicit flow is historical research, not a production recommendation.
3. Verify redirect registration, anti-CSRF state, token expiry/revocation, required scopes, browser CORS, extension origin behavior and truthful application identification. Tokens must remain in memory, never in URLs after callback handling, logs, checkpoints or reports. Browser-controlled User-Agent limitations need an approved solution.
4. Implement an official transport adapter with request timeouts and normalized HTTP/API errors; all reads, guards and writes must pass through the scheduler. Do not use a backend proxy or extract website tokens/cookies.
5. Recheck account and ownership at every write dispatch/retry, including after cooldowns. Stop on account/auth/permission changes. Verify edits before deletion and final outcomes after writes.
6. With separate explicit authorization, test a tiny disposable own-account selection on real Reddit. Document actual evidence and limitations before removing blocked labels. Deletion must remain unavailable until approved anonymization works and deletion itself is verified.

## Adapter contract

`account()` returns `{ id, name }`; `page({ account, after, type })` returns `{ items, after }`; `get(id)` returns normalized current content. Items have a validated fullname, `authorId`, `author`, `subreddit`, `type`, `created` (epoch ms), `score`, `edited`, `editable`, `deleted`, `text` and safe `permalink`. Unknown ownership/capabilities must fail closed.

`edit(id, replacement, expectedAccount)` and `delete(id, expectedAccount, verifiedReplacement?)` must enforce the supplied identity and ownership at dispatch, not merely trust preview objects. The synthetic adapter checks both synchronously with its mutation. No real transport exists yet; network guards will require scheduler-aware implementation and race analysis. Combined deletion must additionally enforce the verified replacement at dispatch. Both operations must distinguish explicit rejection from ambiguous dispatch. `get()` must prove a final state; missing/unreadable content alone is not proof of deletion.

Scheduler tasks may return `{ data, headers }` and throw structured errors containing `status`, `headers`, `code` and optional `retryAfterMs`. API body cooldowns must be normalized to `RATELIMIT`; errors must never contain credentials or original text.

## Future import boundary

An official data-export importer can normalize records into the same item schema, but must label offline data and never infer current identity, ownership or edit permission solely from an export. Validate archive paths, size, format and IDs; verify each selected item through the approved adapter before any live write. Import is planned, not implemented.
