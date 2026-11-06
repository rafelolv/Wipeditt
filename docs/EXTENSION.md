# Browser distributions

`npm run build:extensions` generates `dist/chromium`, `dist/firefox`, two versioned ZIPs and SHA256SUMS. Each extension includes the byte-identical generated root userscript, license and local PNG icons derived from `images/icon.svg`. No background worker, popup writes, host_permissions, credential permissions, remote code or automatic installation actions exist. Declarative content-script matches are limited to www.reddit.com and old.reddit.com over HTTPS, top frame only.

Chromium: enable Developer mode at `chrome://extensions`, Load unpacked, choose `dist/chromium`. Firefox: use `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, choose `dist/firefox/manifest.json`. Firefox package targets 140+ metadata, not a verified compatibility claim. Temporary unsigned Firefox installations disappear at restart. Permanent Firefox distribution normally requires Mozilla signing. Neither extension has been submitted to a store.

The userscript can be installed through Tampermonkey or Violentmonkey, but those manager/browser combinations are not independently validated. A shared DOM marker prevents duplicate mounting in the same document across isolated extension/userscript worlds. Separate tabs do not share a run lock; live integration remains disabled until that issue is addressed.

`npm run test:ui` loads a real unpacked Chromium content script with a temporary loopback-only manifest and byte-identical executable bytes. It uses an isolated profile, synthetic records and intercepted fixtures. It does not access real Reddit, verify Firefox or prove OAuth permission. Userscript UI checks directly inject the generated script into an intercepted Reddit-origin fixture; this is not a userscript-manager test.

All updates are manual for unsigned extensions. Userscript metadata points to this repository's main artifact. Publishing a GitHub release does not mean store approval or live Reddit readiness.
