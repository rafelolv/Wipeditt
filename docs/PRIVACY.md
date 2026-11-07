# Privacy

Wipeditt has no application backend, app analytics, tracking, remote configuration, runtime CDN or remote font dependency. Its local shell uses bundled assets and a restrictive Content Security Policy. The embedded Reddit website makes its own network requests and is subject to Reddit's privacy practices and any sign-in provider you choose.

You sign in directly on the website in an isolated browser session. Remote pages have sandboxing, context isolation, no Node integration and no privileged preload. They cannot call Wipeditt's command bridge. Wipeditt does not extract passwords, cookies or tokens and never reads a system browser profile.

By default the app-owned Reddit session is temporary. Remember session opts into Chromium-managed persistence on this device; it is not a credential export. Persistent session storage should be protected as part of your OS account. Disconnect clears the app-owned temporary/persistent partitions and invalidates its preview, without changing other browsers.

Original text, author and subreddit information are read into memory to review and verify your selected operation. They are not sent to a Wipeditt service. Privacy mode masks sensitive UI text; it does not change Reddit data or protect the OS account. The privacy and theme preferences are stored as simple flags in the local renderer's `localStorage`.

The optional Reddit export import is handled by the Electron main process. Wipeditt reads the selected `comments.csv` file locally, keeps it in memory for the review, and does not upload it or copy it into a Wipeditt service. Imported rows are filtered by the verified account and rechecked against Reddit before any write.

The minimized checkpoint file in Electron's userData directory contains expiring IDs and item/stage statuses only, not original text, account names, replacement text or sensitive filters. Writes use a private atomic file. Interrupted writes become uncertain. Clear local checkpoints through the app; removing them does not undo Reddit changes.

JSON reports are saved only where you choose through the native file dialog. They omit original text, usernames and sensitive filter values, but contain content IDs/statuses and the operation source (`live` or `import`) that may still be identifiable. Share them deliberately. Logs contain bounded activity statuses and IDs, not credentials or original text.

Opening an original link uses your OS browser and that browser's separate session. Wipeditt does not submit crash reports or automatically download/install updates; Electron/Chromium and the operating system may have their own diagnostics outside the app's reporting.

## Release availability checks

Packaged apps check the public releases of `rafelolv/Wipeditt` on GitHub at startup and no more than every four hours while idle. Automatic checks can be disabled in Settings & tools; Check for updates remains available manually. The preference is stored as an enabled flag in `updates-v1.json`, independently of Reddit checkpoints. Development builds only check when requested manually.

The checker sends a fixed public GitHub API request with no Reddit credentials, account name, device identifier or content. GitHub sees normal connection metadata such as your IP address. Release responses are bounded and timed out; remote release text is never executed or rendered as HTML. A notification opens only the official release page in your OS browser. No installer is downloaded or executed by Wipeditt.
