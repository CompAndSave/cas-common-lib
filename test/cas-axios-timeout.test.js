'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const helperPath = require.resolve('../lib/cas-axios');

const loadHelper = (t)=> {
  delete require.cache[helperPath];
  t.after(() => { delete require.cache[helperPath]; });
  return require(helperPath);
};

const captureConfigs = (t)=> {
  const configs = [];
  const signs = [];
  t.mock.method(axios, 'default', async (config)=> {
    configs.push(config);
    return { data: 'offline-response' };
  });
  t.mock.method(jwt, 'sign', (payload, secret, options)=> {
    signs.push({ payload, secret, options });
    return 'offline-signed-request';
  });
  t.mock.method(jwt, 'verify', ()=> ({ data: { ok: true } }));
  return { helper: loadHelper(t), configs, signs };
};

// Captured from unmodified 4da7fdb with deterministic, offline JWT stubs.
const noTimeoutBaseline = [
  {
    method: 'put', url: 'http://offline.invalid/validate',
    data: { permission_request: 'test-Allow' }, headers: { 'X-Test': 'plain' }
  },
  {
    method: 'get', url: 'http://offline.invalid/list',
    data: { page: 2 }, headers: undefined
  },
  {
    method: 'post', url: 'http://offline.invalid/signed',
    headers: { 'X-Test': 'signed' },
    data: { api_key: 'offline-key', data: 'offline-signed-request' }
  },
  {
    method: 'patch', url: 'http://offline.invalid/signed',
    headers: { 'X-Test': 'expiry' },
    data: { api_key: 'offline-key', data: 'offline-signed-request' }
  },
  {
    method: 'post', url: 'http://offline.invalid/signed', headers: undefined,
    data: { api_key: 'offline-key', data: 'offline-signed-request' }
  }
];

test('G3 BASE-GREEN: both helpers preserve the entire no-timeout config', async (t)=> {
  const { helper, configs, signs } = captureConfigs(t);
  await helper.callAPIWithoutJWT('PUT', 'http://offline.invalid/validate',
    { permission_request: 'test-Allow' }, { 'X-Test': 'plain' });
  await helper.callAPIWithoutJWT('GET', 'http://offline.invalid/list', { page: 2 });
  await helper.callAPI('POST', 'http://offline.invalid/signed', 'offline-secret',
    { api_key: 'offline-key', value: 7 }, { 'X-Test': 'signed' });
  await helper.callAPI('PATCH', 'http://offline.invalid/signed', 'offline-secret',
    { api_key: 'offline-key', value: 8 }, { 'X-Test': 'expiry' }, '2m');
  await helper.callAPI('POST', 'http://offline.invalid/signed', 'offline-secret',
    { api_key: 'offline-key', value: 9 });

  assert.deepEqual(configs, noTimeoutBaseline);
  assert.equal(JSON.stringify(configs), JSON.stringify(noTimeoutBaseline));
  assert.ok(configs.every(config => !Object.hasOwn(config, 'timeout')));
  assert.deepEqual(signs, [
    { payload: { data: { value: 7 } }, secret: 'offline-secret', options: { expiresIn: '5m' } },
    { payload: { data: { value: 8 } }, secret: 'offline-secret', options: { expiresIn: '2m' } },
    { payload: { data: { value: 9 } }, secret: 'offline-secret', options: { expiresIn: '5m' } }
  ]);
});

for (const name of ['callAPIWithoutJWT', 'callAPI']) {
  test(`${name} preserves an explicitly supplied zero timeout`, async (t)=> {
    const { helper, configs, signs } = captureConfigs(t);
    if (name === 'callAPI') {
      await helper.callAPI('POST', 'http://offline.invalid/signed', 'offline-secret',
        { api_key: 'offline-key' }, undefined, '2m', 0);
      assert.deepEqual(signs[0].options, { expiresIn: '2m' });
    } else {
      await helper.callAPIWithoutJWT('PUT', 'http://offline.invalid/validate', {}, undefined, 0);
    }
    assert.equal(Object.hasOwn(configs[0], 'timeout'), true);
    assert.equal(configs[0].timeout, 0);
  });
}

const assertHungRequestTimesOut = async (t, name)=> {
  const sockets = new Set();
  let accepted = 0;
  const server = http.createServer(request => { request.resume(); });
  server.on('connection', socket => {
    accepted++;
    sockets.add(socket);
    socket.on('close', ()=> sockets.delete(socket));
  });
  const helper = loadHelper(t);
  const timeoutMs = 100;
  const harnessMs = 1500;
  let timer;
  let outcome;
  let elapsed;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/never-responds`;
    const started = performance.now();
    const request = name === 'callAPI'
      ? helper.callAPI('POST', url, 'offline-test-secret', { api_key: 'offline-key' }, undefined, '2m', timeoutMs)
      : helper.callAPIWithoutJWT('PUT', url, {}, undefined, timeoutMs);
    outcome = await Promise.race([
      request.then(value => ({ value }), error => ({ error })),
      new Promise(resolve => { timer = setTimeout(()=> resolve({ harnessExpired: true }), harnessMs); })
    ]);
    elapsed = performance.now() - started;
  } finally {
    clearTimeout(timer);
    for (const socket of sockets) { socket.destroy(); }
    await new Promise(resolve => server.close(resolve));
  }

  assert.ok(accepted > 0, 'control: the local server accepted the connection');
  assert.notEqual(outcome.harnessExpired, true,
    `${name}: harness deadline ${harnessMs}ms exceeded; supplied ${timeoutMs}ms timeout was not applied`);
  assert.equal(axios.isAxiosError(outcome.error), true);
  assert.match(outcome.error.code, /^(ECONNABORTED|ETIMEDOUT)$/);
  assert.ok(elapsed >= timeoutMs * 0.5 && elapsed < harnessMs,
    `expected approximately ${timeoutMs}ms, observed ${elapsed}ms`);
  t.diagnostic(`${name} rejected in ${elapsed.toFixed(1)}ms; accepted=${accepted}`);
};

test('G1a: callAPIWithoutJWT bounds a connected server that never responds', async (t)=> {
  await assertHungRequestTimesOut(t, 'callAPIWithoutJWT');
});

test('G1b: callAPI bounds a connected server that never responds', async (t)=> {
  await assertHungRequestTimesOut(t, 'callAPI');
});
