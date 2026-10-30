# Library for CAS

## Optional HTTP timeout (0.13.1)

`caxios.callAPI(type, url, secret, request, headers, expiresIn, timeout)` accepts
an optional seventh argument in milliseconds. The sixth argument remains the
JWT expiration. `caxios.callAPIWithoutJWT(type, url, request, headers, timeout)`
accepts it as the fifth argument. Omitted or `undefined` leaves the entire
Axios configuration unchanged, including the absence of a `timeout` key.
An explicitly supplied `0` is passed through to Axios.

This release sets no new default timeout for existing consumers. ACL validation
opts in separately through user-acl-lib; its rollout must wait for order-client's
Lane F error-path fix so timeouts do not redirect users to logout.

```

// algo
const { algo } = require('cas-common-lib');

// caxios
const { caxios } = require('cas-common-lib');

// jwt sign
const { jwt } = require('cas-common-lib');

// Logger
// Initialize Log when application starts
const { Log } = require('cas-common-lib');
Log.initialize(YOUR_LOG_FILE_PATH);

```
