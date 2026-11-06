# Browser distributions — 0.2.0

`npm run build:extensions` generates unsigned Chromium/Firefox directories and ZIPs plus SHA256SUMS. Each package includes the byte-identical generated userscript, proprietary LICENSE, canonical-icon PNGs and a bundled request broker. The broker is a transport only: it does not run timers, scan accounts or change content without a foreground request.

The declarative top-frame content script matches www.reddit.com and old.reddit.com over HTTPS. Live connection/mutations use www only; old links to www. OAuth callback handling runs at document-start, while normal panel mounting waits for DOM readiness. A shared DOM marker prevents duplicate extension/userscript panels.

Host permissions are limited to `https://www.reddit.com/*` for OAuth exchange and `https://oauth.reddit.com/*` for documented API routes. No cookies/storage/browser identity permissions are requested. Network code further validates allowed route/method/header combinations and the requesting extension/Reddit origin. Chromium uses a service worker; Firefox uses a packaged background script. Background fetch omits cookies and rejects redirects. Tokens travel only through the extension's own messaging and directly to Reddit, never through a remote service.

Chromium: Developer mode at chrome://extensions → Load unpacked → dist/chromium. Firefox: about:debugging#/runtime/this-firefox → Load Temporary Add-on → dist/firefox/manifest.json. The Firefox package targets 140+ metadata but runtime is unverified. Temporary unsigned Firefox installs disappear at restart; normal permanent distribution requires signing. Neither package is store-published.

Userscripts require their manager's `GM_xmlhttpRequest` grant and Reddit-only @connect permissions. Requests use anonymous mode and request redirect rejection; actual manager/browser behavior is not fully validated. Normal fetch is retained for isolated tests/compatible execution contexts; CORS failures must not be treated as success. No website cookies/tokens are extracted.

The browser suite intercepts all traffic while loading the **unmodified production manifest, content script and broker** into a temporary Chromium profile. It exercises consent/callback, token exchange, identity, scans, guarded edits and verification with fixture responses. Another suite emulates userscript document-start injection, including popup callbacks, and tests the normal fetch transport. Unit tests cover the privileged manager transport contract. These checks do not prove actual Reddit approval, real-account success, Firefox runtime or installed-manager compatibility.

Updates to unsigned extensions are manual. Userscript update metadata points to main. A GitHub release is not store review or proof that Reddit approved the application.
