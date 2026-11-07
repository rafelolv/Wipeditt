# Releasing

Release actions require the owner's authorization; a request to commit and release authorizes this workflow. Never rewrite published tags. Keep LICENSE/author attribution and independent runtime notices.

1. Align package.json, package-lock.json, build metadata, changelog and docs/releases/vVERSION.md. Record actual validation and limitations.
2. Run npm run check and the Electron GUI fixture test. Review the diff and commit source/docs/workflows. Generated app/ and dist/ stay ignored.
3. Push the authorized branch and require native CI to pass on Linux x64, Windows x64, macOS arm64 and macOS x64.
4. Inspect existing tags/releases, then create and push the new matching vVERSION tag.
5. Tag CI repeats checks/tests and builds native installers. Publication waits for every matrix build. Release assets include Linux AppImage/deb, Windows exe, macOS dmg per architecture, a source zip and SHA256SUMS.
6. Verify tag commit, successful jobs, exact asset set and checksums. Report unsigned/not-notarized status and live-validation limits. No store submission or automatic update is included.

Installers are technical previews published as prereleases. Test-only CI disables Chromium's sandbox only in the isolated GUI fixture process where necessary; production packages retain sandboxed remote preferences and do not inject --no-sandbox.
