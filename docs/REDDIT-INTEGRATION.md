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

## Edit verification and Markdown

A native editor closing is acknowledgement, not proof of persistence. The connector observes the owned native POST completing, reads native errors and then reloads the focused original. It compares the textarea's raw saved Markdown with the requested replacement; rendered labels/links are never compared with Markdown source. Bounded fresh reads accommodate delayed propagation without resending a write. A stale editor does not prevent a fresh-source proof; unchanged, unavailable or mismatched source remains uncertain and stops combined deletion. Diagnostic categories omit private text.

## History coverage and read pacing

Profile scans request 100 items on the initial normal HTML listing and follow Reddit-provided pagination, including next links marked with rel=next. They never invent cursors or infer a complete archive. Classic Reddit precomputes separate newest, top, controversial and hot views with a 1,000-entry boundary per ordering. When the newest view ends at that boundary, the connector continues with the other native orderings before using the ordinary overview for shorter profiles. This can expose older popular or controversial entries that the newest view omits, but the union of available views is still not proof that every profile entry is available. Reddit's [profile-history announcement](https://www.reddit.com/r/help/comments/1gae6uo/update_enabling_easier_access_to_your_content_on/) describes expanded history but its rollout notes and classic-layout discussion differ; this is not proof that every current classic profile exposes all history. The [official data request](https://support.reddithelp.com/hc/en-us/articles/360043483511-Where-and-how-can-I-access-my-Reddit-data-and-information) is the complementary user-directed export path.

Exports without an author column are bound to the currently verified account only as preview claims. Explicit foreign authors are rejected. Relative links are resolved against Reddit and validated through the same original-link policy. Imported labels never authorize a native write: actual account, author and controls are independently checked.

A read may bypass network pacing only inside the serial scheduler after checking that the exact focused original is still loaded, no navigation failed and no main-frame load is active. It re-runs the DOM reader with account validation, never returns cached item text, and sends body expansion back through network pacing. Native writes retain fresh original preflights and independent verification.
