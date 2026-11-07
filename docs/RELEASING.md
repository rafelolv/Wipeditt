# Releasing

The owner's explicit request authorizes commits/push and a v1 release if the required checks and independent validation succeed. Never rewrite published tags or call a gated candidate stable.

1. Align package/lock metadata, changelog and release notes. Current license is GPL-3.0-only; preserve LICENSE, NOTICE, attribution and runtime notices.
2. Run `npm run check` and `npm run test:ui`. Review changes, including the production deletion gate. Generated app/ and dist/ remain ignored.
3. Push the authorized branch and require Linux x64 and Windows x64 native CI/tests/installer builds to pass. No macOS/ARM jobs or artifacts are supported.
4. Complete DELETION-VALIDATION.md before promoting deletion or publishing stable v1. `build/check-release.mjs` rejects stable 1.x+ versions when deletion is unvalidated. Candidate versions retain an explicit prerelease suffix and production gate.
5. Inspect existing tags/releases, then tag the matching version. Tag CI repeats validation, packages AppImage/deb/exe and publishes the matching source ZIP plus SHA256SUMS. Source/build scripts must accompany GPL binaries at the same release page.
6. Verify the tag commit, package contents/license/notices, exact asset set and downloaded checksums. The release workflow marks hyphenated versions as prereleases; stable versions use normal releases only after the guard permits them.

Packages are unsigned. No store submissions, automatic package installation or credential configuration are included. The in-app checker reads fixed public GitHub metadata only and opens an official release page on user action.
