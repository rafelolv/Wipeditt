# Reddit integration

## Native website connector

Version 0.3.0 uses an Electron WebContentsView containing Reddit's website. Sign-in belongs to Reddit. A separate owned Chromium session is temporary by default, persistable only by explicit user choice. No Client ID, private API client, copied website token or imported browser profile is involved.

The main-process adapter navigates classic account history and original permalinks, then executes a constrained DOM bridge in an isolated JavaScript world. The bridge reads native listing metadata and author links, opens the native editor, sets its textarea using the native setter, dispatches input/change events and clicks the native save control. This implementation was written independently; no Redact implementation is claimed or copied.

The browser session naturally manages its own authentication cookies. Wipeditt does not enumerate, export or persist those cookie values in app code. Owned session storage is cleared on Disconnect. The local renderer has no network permission or remote code; remote pages have no privileged preload, Node access or app bridge.

## Ownership and execution

Account identity is derived from the authenticated page header and validated username links. Internal adapter IDs use `reddit:<normalized username>` and are not represented as Reddit API account IDs. Author declarations must agree with author links. Nested things are excluded when locating an item's controls/body.

Every item is bound to a validated original Reddit URL. Immediately before saving, Wipeditt freshly loads the original and verifies the account, author, content and editable control. The main-process engine owns preview expiry, explicit confirmation, selected IDs and cancellation. The renderer cannot submit arbitrary URLs or scripts.

The serial scheduler controls reads and writes. Response headers and explicit website rate-limit messages can impose stricter cooldowns. Authentication/account/permission changes stop work. Explicit rejected forms fail; ambiguous submissions become uncertain and are not replayed. Saved replacement is checked after a fresh navigation. Native deletion is disabled pending independent live validation.

## Constraints and evidence

The maintainer manually confirmed real login/account verification and history comments in a scan. Native edits, server rejection, pagination, ownership changes and post handling are tested with synthetic local pages. No real-account mutation has been validated. A browser connector is not evidence of Reddit policy approval or a guarantee of ongoing access.

References: [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Reddit Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy). These describe platform interfaces and obligations; they do not certify Wipeditt.
