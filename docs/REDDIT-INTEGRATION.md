# Reddit integration — 0.2.0

Research date: 2026-11-06. A real installed-app OAuth code flow and API adapter are implemented. End-to-end validation uses intercepted HTTP fixtures, not a real registered app/account. There is no shared approved Wipeditt Client ID; registration and use-case approval remain Reddit-controlled prerequisites.

## Authentication

The user configures the public Client ID of an installed app whose registered redirect URI is exactly `https://www.reddit.com/`. No confidential secret is requested or embedded. OAuth uses `response_type=code`, temporary duration, the scopes `identity history read edit`, and a 256-bit random state bound to the initiating window/origin. Tokens expire after at most an hour and stay in private memory fields; no refresh token is stored.

The official [OAuth2 reference](https://github.com/reddit-archive/reddit/wiki/OAuth2) documents code exchange with Basic authentication using the installed Client ID and an empty password. It also documents implicit flow, which this project does not use. This reference is archived; actual current server acceptance is not established by reading it. PKCE support is not assumed or invented. Revalidate registration, redirect acceptance and the public-client flow with the maintainer's approved app before declaring live integration verified.

The consent window returns an authorization code to Reddit's root page. The callback removes code/state/error parameters from browser history before forwarding the code. The receiver checks the exact popup source/origin and matching state. A same-origin BroadcastChannel provides a state-matched fallback when browser isolation severs window.opener; duplicate responses cannot redeem a code twice. Neither channel broadcasts an access token. Closing the panel/canceling sign-in aborts exchange; late responses cannot restore a disconnected token. Sign-in can be explicitly canceled and times out after ten minutes.

Only the public Client ID is saved to localStorage. API identity comes from `/api/v1/me`, never a username input or website cookie. Passwords stay on Reddit. OAuth account identity is independent of whichever account happens to be open in a separate website tab; writes use only the explicit authorization and recheck its account.

## Transport and scheduling

`src/network.js` restricts HTTPS hosts, paths, methods, credential placement and headers. The userscript uses `GM_xmlhttpRequest` in anonymous mode with Reddit-only @connect permissions. The extension content script sends requests to its packaged broker; only this extension's Reddit-origin content scripts are accepted. The broker uses cookie-free fetch, refuses redirects and supports cancellation/timeouts. There is no credential proxy, cookie extraction, private website endpoint or off-platform destination. Browser/user-agent restrictions and manager redirect behavior require real-platform verification; only truthful application identification is attempted.

Authentication, API reads, ownership preflights and writes share a serial scheduler. The scheduler's `before` guards run as paced internal reads before every write attempt, including throttled retries; they do not recursively queue work and deadlock. Account, ownership and preview/cancellation guards are rechecked before dispatch. Header/body cooldowns cannot be overridden by custom intervals.

## Documented API routes

| Purpose | Route | Scope |
| --- | --- | --- |
| Authorize / exchange code | `www.reddit.com/api/v1/authorize`, `/api/v1/access_token` | User consent |
| Verify identity | `oauth.reddit.com/api/v1/me` | `identity` |
| Discover comments/posts/both | `/user/{name}/comments`, `/submitted`, `/overview` | `history` |
| Verify current content | `/api/info?id={fullname}` | `read` |
| Replace body | `POST /api/editusertext` | `edit` |

The API adapter normalizes fullnames, author identity, text bodies, dates, score and edited/capability metadata. Unknown author identity fails closed. Non-self media/link bodies, archived/locked/removed items and unsupported targets are ineligible for editing. Server rejections remain authoritative. A separate read must verify exact replacement after a write. Missing or unreadable content is not proof of success. No live deletion endpoint is called: deletion/combined mode remain demo-only until independently validated on an authorized real account.

Live UI is restricted to www.reddit.com. A non-queued origin Web Lock prevents simultaneous runs in multiple tabs. old.reddit.com offers a link to www instead of creating a second origin for live operations. No timer or background mutation resumes after closing the panel/tab.

## Approval and alternatives evaluated

The [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) requires explicit approval for API access. The [Developer FAQ](https://developers.reddit.com/docs/guides/faq) distinguishes external OAuth clients from Devvit. Registering/signing into Devvit does not yield external OAuth credentials. [Devvit user actions](https://developers.reddit.com/docs/capabilities/server/userActions) document posting/commenting/subscribing on behalf of a user, not an account-wide editing capability suitable for this tool.

Classic website/session tools were investigated as alternatives. Availability of legacy session endpoints or native forms does not establish approval or permission to bypass the API process. Wipeditt does not extract session tokens/cookies, borrow another product's Client ID, automate CAPTCHA or switch endpoints after a denial.

Relevant primary sources: [API reference](https://www.reddit.com/dev/api/), [Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki), [Developer access guidance](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data), [Developer terms](https://redditinc.com/policies/developer-terms), [Data API terms](https://redditinc.com/policies/data-api-terms), [app registration](https://developers.reddit.com/app-registration). The registration page currently describes a January 12, 2027 enforcement milestone; recheck before future releases.

## Remaining verification

Obtain an installed-app registration and the applicable Reddit approval. Verify redirect acceptance, actual browser/manager behavior, identity/listing retrieval and a separately authorized tiny own-account anonymization. No real content modifications are authorized by automated test execution. Document live evidence before claiming success or enabling deletion. Official-export import remains planned; imported records must never alone authorize a write.
