# App updates

Windows x64 NSIS installations and Linux x64 AppImage packages support Download update followed by Install and restart. Debian packages keep the official release-page flow. Update checks remain optional in Settings; turning them off still permits manual checking and downloading. The app never installs merely because it closes.

Install this first updater-enabled version manually. Older installations cannot acquire the updater code without that one manual upgrade. Future compatible stable releases can use the integrated buttons. Previews, missing source/checksum assets and releases without valid GitHub SHA256 digest metadata retain the manual release-page fallback.

The main process retains the fixed public GitHub releases endpoint, bounded metadata response, timeout, cache and official version/link validation. An electron-updater custom provider receives a single validated artifact description from that response. It does not fetch remote YAML, release notes or provider configuration. Downloads are restricted to HTTPS GitHub release/asset origins, omit credentials and staging identifiers, enforce the published file size and use the SHA256 asset digest. Bytes, regular-file status and size are checked again before the explicit installation handoff. No independent publisher signing certificate is currently configured; integrity relies on the official GitHub channel and its digests, as with the manual release installers.

Download and installation each require a click. Installation is refused during login, a scan or an edit/delete operation. Main-process commands are locked synchronously while pre-install verification runs. The existing quit handlers flush checkpoints. autoDownload and autoInstallOnAppQuit remain false; differential downloads are disabled to avoid auxiliary artifact requests. The library uses a separate app-owned update session/cache, never the Reddit session.

Runtime dependency notices are collected in UPDATER-NOTICES.txt, distributed with packages and readable through License & source. The author credit opens the fixed GitHub project page; legal text remains in the license dialog.

Automated checks use synthetic bytes, an intercepted HTTPS session and a stubbed installation handoff. They test the real electron-updater download/cache/hash path without executing an OS installer. They do not substitute for a maintainer-confirmed in-place Windows or AppImage upgrade between two published versions. Release CI additionally checks packaged updater modules, local cache configuration and notices on both supported platforms.
