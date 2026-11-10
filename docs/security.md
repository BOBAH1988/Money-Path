# Security review

## Dependency audit — 2026-11-10

`npm audit --omit=dev` was rerun on 2026-11-10 and still reports four high-severity package findings (two advisories, repeated through the dependency chain) for `@grpc/grpc-js@1.9.16`, pulled in by `firebase@13.2.0` through `@firebase/firestore@4.19.1`. The full `npm audit` also reports one additional high-severity package finding through the development-only `@firebase/rules-unit-testing` dependency. Registry metadata confirmed Firebase `13.2.0` and Firestore `4.19.1` are the latest published stable versions at the time of this check, and Firestore declares `@grpc/grpc-js: ~1.9.0`. The advisories are:

- [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j): certificate authorization behavior in server-side gRPC authentication contexts.
- [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4): server method-handler errors exposed in gRPC status messages.

Both advisories concern applications running gRPC servers and list `1.13.6` as the first patched version. The Money-Path production app uses Firebase's browser SDK; the generated Firestore client chunk contains no gRPC server implementation markers. `firebase-admin`, which uses a patched `@grpc/grpc-js@1.14.7`, is a development dependency and is not included in the deployed client app.

The installed production bundle was checked again: no gRPC server implementation markers were found in the generated Firestore client chunk. These findings still appear in the package audit because npm evaluates the dependency tree, not which code is reachable in the browser bundle.

`npm audit fix` was applied without `--force`; it removed the reported moderate `glob`/`minimatch` findings from development dependencies. The remaining gRPC-related advisories have no compatible upstream patch available yet. Forcing a newer gRPC version through an override would violate Firestore's declared dependency range and has not been validated, so no dependency override or Firebase downgrade was applied. Weekly Dependabot npm version checks, vulnerability alerts, and automated security fixes are enabled; review any proposed Firebase update and re-run `npm audit` plus the complete test/build suite before merging.

This is a triaged npm audit finding, not a clean audit: npm continues to report the dependency because its audit does not determine whether server-only code is reachable in the browser bundle. Reassess when Firebase releases a compatible Firestore dependency update, and before introducing server-side gRPC or SSR code. Re-run `npm audit --omit=dev` after dependency updates.

## Dependabot security update — 2026-11-10

The Dependabot security-update run [42781606038](https://github.com/BOBAH1988/Money-Path/actions/runs/42781606038) failed while trying to update `@grpc/grpc-js` to the first patched version, `1.13.6`. Dependabot reported `security_update_not_possible`; its proposed npm resolution would downgrade dependencies. The dependency path is `firebase` → `@firebase/firestore` → `@grpc/grpc-js`, and the installed Firestore package constrains gRPC to `~1.9.0`.

This is not a failure of the application's build or deployment. The app deploy workflow for commit `b5e4c99` completed successfully, while the two GitHub Dependabot alerts for `@grpc/grpc-js` remain open (one high and one low severity). Do not close or dismiss those alerts as a workaround. Revisit after Firebase/Firestore publishes a compatible dependency range, then rerun the audit and project checks.

The same Dependabot run included a GitHub-hosted-runner notice that `ubuntu-latest` will migrate to a newer Ubuntu image. It is informational and unrelated to the update failure; it did not fail the application deployment workflow.
