# Security review

## Dependency audit — 2026-11-10

`npm audit --omit=dev` reports high-severity advisories for `@grpc/grpc-js@1.9.16`, pulled in by `firebase@13.2.0` through `@firebase/firestore@4.19.1`. The advisories are:

- [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j): certificate authorization behavior in server-side gRPC authentication contexts.
- [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4): server method-handler errors exposed in gRPC status messages.

Both advisories concern applications running gRPC servers and list `1.13.6` as the first patched version. The Money-Path production app uses Firebase's browser SDK; the generated Firestore client chunk contains no gRPC server implementation markers. `firebase-admin`, which uses a patched `@grpc/grpc-js@1.14.7`, is a development dependency and is not included in the deployed client app.

At the time of review, Firebase `13.2.0` is the latest published version and its Firestore package requires `@grpc/grpc-js` `~1.9.0`. Forcing a newer gRPC version through an override would violate that dependency range and has not been validated. No dependency override or downgrade was applied.

This is a triaged npm audit finding, not a clean audit: npm continues to report the dependency because its audit does not determine whether server-only code is reachable in the browser bundle. Reassess when Firebase releases a compatible Firestore dependency update, and before introducing server-side gRPC or SSR code. Re-run `npm audit --omit=dev` after dependency updates.
