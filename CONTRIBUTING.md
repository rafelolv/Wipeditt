# Contributing

Wipeditt is proprietary software. Bug reports and validation reports are welcome; code changes to covered proprietary material require prior written permission from Rafael (rafaelolv).

## Before reporting

- Use the latest official release.
- Check the [user guide](docs/USER-GUIDE.md), [limits](docs/REDDIT-LIMITS.md) and [troubleshooting](README.md#troubleshooting).
- Reproduce with sample data when the issue is in the review UI.
- Include the Wipeditt version, operating system, workflow and exact error code from **Search details & activity**.

Never include passwords, cookies, session tokens, account identifiers or original private comment text in an issue or screenshot. Redact usernames and content first.

## Validation expectations

Runtime changes require:

```bash
npm run check
npm run test:ui
```

On headless Linux, run the UI test under `xvfb-run`. Tests use a temporary profile and synthetic HTTPS fixtures. Do not automate real-account writes, and do not mix a packaged build with a running GUI test.

## License

Original Wipeditt material remains proprietary under [LICENSE](LICENSE). Third-party components retain their own licenses and notices. See [licensing details](docs/LICENSING.md), [maintenance](docs/MAINTENANCE.md) and [release preparation](docs/RELEASING.md).
