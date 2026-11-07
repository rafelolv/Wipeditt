# Native Reddit integration

Wipeditt uses an isolated Electron WebContentsView and Reddit's classic website. Sign-in belongs to Reddit; no Client ID, copied cookie/token, system-browser profile or private endpoint is used. Remote content has sandboxing, context isolation, no Node or privileged preload. The shell's IPC validates the exact trusted main frame.

The main-process adapter schedules navigation and native controls through the serial scheduler. Its constrained DOM function executes in an isolated world. Account identity comes from the page header. Item-local author links, data attributes and labels must agree; native author-only edit controls are a fallback when labels are absent. Unknown listing authors are rechecked on their original. Nested context is excluded. IDs use `reddit:<normalized username>` internally and are not Reddit API account IDs.

## Three operations, one engine

Anonymize uses the native textarea/save control, then independently reloads the original and compares the exact body. Delete uses the item-local `form.del-button`, its native toggle and yes confirmation, then freshly reloads the original. Combined mode verifies the replacement before rechecking account/author and invoking deletion; changed or uncertain replacements never trigger deletion. Native confirmation selectors were checked against Reddit's archived classic template, not invented endpoints.

Deletion verification requires the same original ID and a positive deleted placeholder: deleted author, absence of edit/delete controls and a deleted body/title or explicit deleted marker. A hidden or missing row is only an acknowledgement candidate, never final proof. Listing absence, missing/inaccessible original, moderator removal, network failure and unrecognized layouts remain uncertain. Some real post layouts may not expose sufficient proof; the feature must remain gated until manually validated.

The engine owns mode-aware eligibility, selected IDs, preview expiry, confirmation, stage order and cancellation. Each item records anonymize/delete stage results separately. An edit verified before a rejected delete is partial completion; an uncertain delete retains the edit's verified stage. Reports/checkpoints omit original bodies, names, replacements and sensitive filters. Checkpoint recovery never resumes writes automatically.

Authentication/account/permission changes stop work. Explicit native rate-limit errors have bounded retries and a fresh preflight; ambiguous writes are not retried. Pause waits at boundaries. Stop cannot retract a submitted action.

## Production gate

`src/desktop/capabilities.js` currently declares deletion unvalidated. A packaged app ignores the development environment flag. Only `npm run validate:deletion` (unpackaged, separate temporary profile) enables testing against disposable owned content. See DELETION-VALIDATION.md. Simulation and intercepted HTTPS fixtures are separate and never prove live deletion.

## Distribution and policy

Official packages are Linux x64 and Windows x64 only. Current material is GPL-3.0-only; original attribution and independent runtime notices remain. A successful browser login or test does not establish Reddit policy approval, full history coverage or erasure of external copies.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [classic native button template](https://github.com/reddit-archive/reddit/blob/master/r2/r2/templates/printablebuttons.html), [Reddit Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy).
