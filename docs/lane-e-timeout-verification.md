# Lane E: optional request timeout

Verified 2026-10-29. Base/master/origin-master: 4da7fdb (0.13.0).
Branch: codex/optional-request-timeout. Prepared version: 0.13.1.
Commit only; no publish, push, consumer install, or deploy.
Registry read (`npm view cas-common-lib version`) returned 0.13.0.

## Contract

- callAPI appends timeout in position seven; expiresIn stays in position six.
- callAPIWithoutJWT appends timeout in position five.
- Only a supplied, non-undefined timeout adds an Axios config key. Explicit 0
  is forwarded. No default is armed for existing consumers.
- G3 captures the complete configs, not source text. The five baseline objects
  were captured by invoking unchanged 4da7fdb with deterministic offline JWT
  stubs before editing production code. Includes headers and omitted headers,
  default JWT expiration, and explicit sixth-argument expiration. Deep equality
  preserves undefined-valued own properties; serialized equality also passes.
- Tests never reach a real authenticated service. Hung-server tests use a real
  Axios client and an ephemeral 127.0.0.1 server. All other calls are intercepted
  at Axios. JWT fixtures are offline test values only.

## Baseline and fail-first

Unmodified npm test: 17 tests, 17 pass, exit 0.
New tests before the implementation: 22 tests, 18 pass, 4 fail, exit 1.

| Gate | Before fix | After fix |
| --- | --- | --- |
| G1a: non-JWT connected, never-responding server | RED: own harness deadline | GREEN |
| G1b: JWT connected, never-responding server | RED: own harness deadline | GREEN |
| G3: complete no-timeout config baseline | GREEN, regression control | GREEN |
| Explicit 0, non-JWT | RED: missing own timeout key | GREEN |
| Explicit 0, JWT | RED: missing own timeout key | GREEN |

Both G1 tests passed the control that the server accepted the connection.
Each uses a supplied 100 ms request timeout and a separate 1500 ms harness
deadline. Sockets are tracked from connection, destroyed in finally, and the
server is closed there even after the deliberate base-state harness failure.
The intentionally red process terminated normally, with no cancelled tests.

Fail-first messages:

```text
callAPIWithoutJWT: harness deadline 1500ms exceeded; supplied 100ms timeout was not applied
callAPI: harness deadline 1500ms exceeded; supplied 100ms timeout was not applied
Explicit-zero tests: Expected values to be strictly equal: false !== true
```

First fixed full run: 22/22, exit 0. Measured request rejection times were
124.4 ms (non-JWT) and 106.5 ms (JWT), with one accepted connection each.

## Separate mutations, with restored controls

Each mutation ran the entire new test file. Each restored control passed 5/5.

| Mutation | Result | Intact controls |
| --- | --- | --- |
| Drop non-JWT timeout config entry only | G1a RED, non-JWT explicit-zero RED | G1b/G3 GREEN |
| Drop JWT timeout config entry only | G1b RED, JWT explicit-zero RED | G1a/G3 GREEN |
| Add default 2500 only to non-JWT config | G3 RED, 4 pass/1 fail | Both G1 and both explicit-zero tests GREEN |
| Add default 2500 only to JWT config | G3 RED, 4 pass/1 fail | Both G1 and both explicit-zero tests GREEN |

The dropped-timeout mutation messages were the exact two harness-deadline
messages above. Each default-timeout mutation failed deep equality with an
unexpected `timeout: 2500` property in that helper's no-argument configs.
All mutations were restored before final verification and commit.

## Remaining verification

- npm test: 22/22, exit 0.
- npm run lint -- --config E:/Projects/Library/cas-common-lib/.eslintrc.js:
  exit 0. The repository's existing ESLint config is gitignored, so the isolated
  worktree explicitly uses the main checkout's existing config without editing it.
- JavaScript package; no typecheck script is declared.
- Only existing test edited: tracking-carrier.test.js's package-version test,
  renamed and updated from 0.13.0 to 0.13.1. Carrier behavior assertions unchanged.
- Dependency declarations unchanged; no new dependency. Lockfile is already
  gitignored and is not committed.

## Compatibility and release hold

Compared 0.12.12 (fffa8d6) with 0.13.0 (4da7fdb): additive tracking-carrier
helpers/exports, tests, and package version. No caxios or dependency changes.
user-acl-lib therefore takes option (a), minimum ^0.13.1, not ^0.13.0.

Andrew's sequence: publish common-lib 0.13.1; update ACL minimum and publish;
Lane F live in production; install in order-client; print the installed tree
and the actual common-lib resolution from user-acl-lib, including any nested
copy; require >=0.13.1; commit consumer lockfile; deploy. Installing a lockfile
is required; committing it alone does not change node_modules.

The ACL opt-in bounds each validate request, not preceding Cognito.checkToken,
the entire ACL operation, or the page. No order-client files were changed and
no rollout verification is claimed before its approved install occurs.
