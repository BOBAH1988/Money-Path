# Security review

## Dependency audit — 2026-11-10

The current dependency tree uses `@grpc/grpc-js@1.14.7` through an npm override scoped to `@firebase/firestore`. This is newer than Firestore `4.19.1`'s declared `~1.9.0` range, because Firebase `13.2.0` / Firestore `4.19.1` are the latest published versions checked and still declare that older range. The override selects the patched `1.x` line without downgrading Firebase. Both `npm audit` and `npm audit --omit=dev` report zero vulnerabilities.

The advisories that prompted the override are:

- [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j): certificate authorization behavior in server-side gRPC authentication contexts.
- [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4): server method-handler errors exposed in gRPC status messages.

Both advisories list `1.13.6` as the first patched version and concern applications running gRPC servers. Money-Path uses Firebase's browser SDK; `firebase-admin` is development-only. The override is nevertheless applied to the transitive dependency so the lockfile no longer contains the vulnerable version. The production build, unit tests, Firestore rules/emulator tests, and both npm audits passed with `1.14.7`.

The override intentionally exceeds Firestore's declared dependency range. Keep it until Firebase/Firestore publishes a compatible range that includes a patched gRPC version; then remove the override and re-run the full checks. When upgrading Firebase or `@grpc/grpc-js`, also verify Dependabot alerts refresh and close automatically rather than dismissing them manually.

## Dependabot security update — 2026-11-10

The Dependabot security-update run [42781606038](https://github.com/BOBAH1988/Money-Path/actions/runs/42781606038) failed because Firestore constrained `@grpc/grpc-js` to `~1.9.0`, preventing Dependabot from resolving the patched version without downgrading packages. A scoped npm override now resolves this path to `1.14.7`; see the dependency audit section above. Verify GitHub's alerts refresh after the updated lockfile is pushed. Do not dismiss an alert manually as a workaround.

The same Dependabot run included a GitHub-hosted-runner notice that `ubuntu-latest` will migrate to a newer Ubuntu image. It is informational and unrelated to the update failure; it did not fail the application deployment workflow.

## Google API key secret-scanning alert — 2026-11-10

A Firebase web API key was hardcoded as a fallback in `src/lib/firebase.ts` and was detected by GitHub secret scanning. It was temporarily removed, but the GitHub Actions secret `VITE_FIREBASE_API_KEY` was not configured, so the resulting deployment could not initialize Firebase Auth. The fallback has been restored to keep the app working. This is a public Firebase web-app configuration value, not a password or service-account credential; it is delivered to browsers by design. Restrict it in Google Cloud Console to the app's HTTP referrers and required APIs. Enforce data access through Firebase Security Rules. GitHub may continue to report the key because it appears in repository history.
