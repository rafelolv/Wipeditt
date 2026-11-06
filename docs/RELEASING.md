# Release process

Publication requires maintainer authorization. A user request to commit and release authorizes preparing, committing, pushing, tagging and publishing that release; it does not authorize browser-store submission.

1. Confirm a clean starting tree and preserve unrelated work. Inspect remote tags/releases; never reuse a published version.
2. Align package/lock versions, changelog, userscript and manifests. Prepare `docs/releases/vVERSION.md` with actual features and validation limits.
3. Run `npm ci`, `npm run check` and `npm run test:ui`. Rebuild once and compare SHA256SUMS with the same toolchain if packaging changes. Include the generated root userscript in the commit.
4. Commit with repository-local Rafael identity, push main and the new annotated `vVERSION` tag only after checks pass.
5. The tag-only Release workflow validates again and publishes a GitHub **prerelease** with userscript, unsigned ZIPs, source archive and SHA256SUMS. It never submits to browser stores. Ordinary branch pushes/PRs only run CI.
6. Inspect workflow result and the actual GitHub release. Verify release tag, prerelease flag and downloaded checksums before reporting success. A pushed tag alone is not a published release.

All 0.1.0 publication material must say live integration is blocked. Do not remove that label until the approval/authentication/live-validation gates in REDDIT-INTEGRATION.md are met. Adding a workflow does not by itself establish that a release exists. If push or Actions is blocked, report the exact remaining step honestly.
