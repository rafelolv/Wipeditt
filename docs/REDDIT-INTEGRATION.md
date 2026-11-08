# Native Reddit integration

Wipeditt uses an isolated Electron WebContentsView and Reddit's classic website. Sign-in belongs to Reddit; no Client ID, copied cookie/token, system-browser profile or private endpoint is used. Remote content has sandboxing, context isolation, no Node or privileged preload. The shell's IPC validates the exact trusted main frame.

The main-process adapter schedules navigation and native controls through the serial scheduler. Its constrained DOM function executes in an isolated world. Account identity comes from the page header. Item-local author links, data attributes and labels must agree; native author-only edit controls are a fallback when labels are absent. Unknown listing authors are rechecked on their original. Nested context is excluded. IDs use `reddit:<normalized username>` internally and are not Reddit API account IDs.

## Three operations, one engine

Anonymize uses the native textarea/save control, then independently reloads the original and compares the exact body. Delete uses the item-local `form.del-button`, its native toggle and yes confirmation, then freshly reloads the original. Combined mode verifies the replacement before rechecking account/author and invoking deletion; changed or uncertain replacements never trigger deletion. Native confirmation selectors were checked against Reddit's archived classic template, not invented endpoints.

Deletion verification accepts a positive deleted placeholder bound to the same original ID (including a unique anonymous deleted root at the exact focused permalink with context=0): deleted author, absence of edit/delete controls and a deleted body/title or explicit deleted marker. For a leaf comment that leaves no placeholder, a separate proof requires the completed native delete, the exact focused original (context=0), the matching available parent post and Reddit's explicit empty-thread marker on two consecutive fresh reads. This proof is bound in memory to the same item/account/permalink for at most five minutes and cannot authorize a new write. A hidden or missing row alone is never final proof. Listing absence, an empty original without that combined evidence, inaccessible pages, moderator removal, network failure and unrecognized layouts remain uncertain. Some real post layouts may not expose sufficient proof; these cases must remain uncertain when sufficient evidence is unavailable.

The engine owns mode-aware eligibility, selected IDs, preview expiry, confirmation, stage order and cancellation. Each item records anonymize/delete stage results separately. An edit verified before a rejected delete is partial completion; an uncertain delete retains the edit's verified stage. Reports/checkpoints omit original bodies, names, replacements and sensitive filters. Checkpoint recovery never resumes writes automatically.

Authentication/account/permission changes stop work. Explicit native rate-limit errors have bounded retries and a fresh preflight; ambiguous writes are not retried. Pause waits at boundaries. Stop cannot retract a submitted action.

## Production gate

`src/desktop/capabilities.js` enables production deletion after maintainer-confirmed native edit/delete use and explicit release approval on November 8, 2026. See DELETION-VALIDATION.md for the evidence and detailed live cases still pending. The packaged gate cannot be overridden with an environment flag. `npm run validate:deletion` still provides a separate temporary profile for manual regression checks. Simulation remains a unit-test adapter and is not imported by the production desktop or exposed through its IPC. Intercepted HTTPS fixtures never prove live deletion.

## Distribution and policy

Official packages are Linux x64 and Windows x64 only. Current material is GPL-3.0-only; original attribution and independent runtime notices remain. A successful browser login or test does not establish Reddit policy approval, full history coverage or erasure of external copies.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [classic native button template](https://github.com/reddit-archive/reddit/blob/master/r2/r2/templates/printablebuttons.html), [Reddit Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy).

Native delete controls can update optimistically. The connector waits for POST/XHR completion metadata from the owned WebContents before navigating to the verification page. Only IDs/method/resource type/status are observed; upload data, credentials and response bodies are never inspected. HTTP success alone is not deletion proof. Bounded fresh reads can accommodate propagation delays; neither a hidden row nor a missing page is promoted to success.

The explicit classic empty-list marker (`p#noresults.error`) was checked against Reddit's [archived listing template](https://github.com/reddit-archive/reddit/blob/master/r2/r2/templates/listing.html). Its presence alone is insufficient: the scoped native receipt and independent original-page checks remain mandatory.
