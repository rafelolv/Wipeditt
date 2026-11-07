# Wipeditt

A local desktop app for reviewing and anonymizing your own Reddit comments and text posts. Created by **Rafael (rafaelolv)**. Proprietary software; [LICENSE](LICENSE) governs original code and artwork.

![Wipeditt review](images/screenshots/desktop-review-dark.png)

## Desktop preview

Download installers from [Releases](https://github.com/rafelolv/Wipeditt/releases). Version 0.3.0 replaces the userscript/extension with an Electron desktop app. Linux AppImage and Debian packages, Windows installer and macOS disk images are built on native CI runners. Packages are unsigned; macOS builds are not notarized. Verify downloaded files against the release's `SHA256SUMS`.

1. Open Wipeditt and choose **Connect Reddit**.
2. Sign in directly on Reddit inside the app, then choose **Verify account**. No registered API application or Client ID is needed for this website connector.
3. Set a small **Maximum items** and choose **Scan history**.
4. Review matching items, select eligible content and set replacement text.
5. Inspect the confirmation, then explicitly authorize anonymization. Changes can be permanent.

The connector operates Reddit's classic website forms using your own session. It does not import browser cookies or ask you to paste credentials. Website availability, account restrictions and Reddit's rules still apply. Authentication, account changes and uncertain writes stop the operation.

**Validation:** the maintainer confirmed real Reddit sign-in, account identification and a scan displaying their comments. Automated tests cover native form editing and verification against local fixtures. **Real-account editing has not been validated. Live deletion remains disabled.**

## What it does

- Scan comments, text posts or both; filter by date, subreddit, text and score.
- Separate inspected, discovered, matched, eligible and selected counts. Review per item or subreddit.
- Replace editable body text; recheck account/author and reread saved text. Titles, link posts and inaccessible content cannot be anonymized by body replacement.
- Pause, resume, stop, bounded throttling and minimized local checkpoints. Submitted edits may finish after Stop; uncertain writes are never automatically replayed.
- Local privacy mode, light/dark themes and JSON reports without original content or account names.
- Optional clearly labeled simulation for exploring edit/delete workflows without touching Reddit.

History listings can be partial; a successful scan is not proof of complete account coverage. Editing cannot remove external copies, quotations or backups. See [limits](docs/REDDIT-LIMITS.md).

## Development

Node.js 24+ and npm are required. Native Electron GUI dependencies and a graphical session are required on Linux.

```sh
npm ci --ignore-scripts
npm run setup
npm start
```

`setup` explicitly downloads the locked Electron runtime. Build outputs live in ignored `app/` and `dist/`.

```sh
npm run check
npm run test:ui
npm run package
npm run checksums
```

For headless Linux tests use `xvfb-run -a npm run test:ui`. Tests intercept HTTPS in an isolated synthetic session; no Reddit account is required. Packaging targets the host platform by default; release CI builds each supported target natively.

Read the [user guide](docs/USER-GUIDE.md), [privacy details](docs/PRIVACY.md), [integration design](docs/REDDIT-INTEGRATION.md), [validation record](docs/VALIDATION.md) and [third-party notices](docs/THIRD-PARTY.md). Previous browser integrations remain available only in historical tags; see [migration](docs/EXTENSION.md).

Original Wipeditt material may not be redistributed, adapted or used commercially without Rafael's permission except as expressly allowed by the license or applicable rights. Third-party components retain their independent licenses. Wipeditt is independent of Reddit and Redact.
