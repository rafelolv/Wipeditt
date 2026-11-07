# Maintenance

Use Node.js 24+, `npm ci --ignore-scripts`, then `npm run setup` to explicitly install the locked Electron runtime. `npm start` rebuilds and launches the desktop application. `ELECTRON_RUN_AS_NODE` is removed by the launcher when inherited from a development host.

`src/desktop/main.js` owns windows, sessions and validated IPC. `controller.js` owns the main-process engine, confirmation and command states. `reddit-browser.js` schedules native navigations and writes; `page.js` is its isolated DOM bridge. The local renderer has no platform network access. Shared engine, filters, scheduling and minimized checkpoints remain independent modules.

The canonical icon is `images/icon.svg`; build/desktop.mjs generates icons using resvg, bundles runtime code and copies local assets into ignored app/. Do not commit generated bundles or installers. Preserve third-party notices in distributions.

After runtime changes run `npm run check`, then `npm run test:ui` (under Xvfb for headless Linux). Tests use a temporary profile and an intercepted fixture session, never an authenticated maintainer session. Do not mix packaged-build output generation with an actively running GUI test. Live tests are manual and require explicit user interaction; never automate real-account mutations.

Maintain classic website selectors conservatively. Recheck exact author/account binding and native form verification after any selector change. Authentication or access failure is not permission to add cookie extraction, private endpoint replay, a new privileged remote bridge or a sandbox bypass.

Packaging: `npm run package`, then `npm run checksums`. Release CI uses native Linux, Windows and both macOS architectures. Packages are unsigned unless a future explicitly authorized signing setup is introduced. There is no automatic updater.
