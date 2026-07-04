'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SecretsLoader = require('../lib/secrets-loader');

const withClient = (handler)=> async ()=> {
  const originalStage = process.env.SECRETS_STAGE;
  const calls = [];
  SecretsLoader.setClientForTest({
    async send(command) {
      calls.push(command.input);
      return handler(command.input, calls);
    }
  });

  try {
    await handler.run(calls);
  } finally {
    SecretsLoader.setClientForTest(null);
    if (typeof originalStage === 'undefined') {
      delete process.env.SECRETS_STAGE;
    } else {
      process.env.SECRETS_STAGE = originalStage;
    }
  }
};

test('SecretsLoader builds per-stage domain secret ids', () => {
  assert.equal(SecretsLoader.buildSecretId('amazon-seller-credentials', { stage: 'prod' }), 'cas/prod/amazon-seller-credentials');
  assert.equal(SecretsLoader.buildSecretId(' ebay ', { stage: 'stg' }), 'cas/stg/ebay');
});

test('SecretsLoader memoizes successful loads per secret id', withClient(Object.assign(
  async () => ({ SecretString: JSON.stringify({ token: 'abc' }) }),
  {
    async run(calls) {
      const first = await SecretsLoader.load('cas/stg/example');
      const second = await SecretsLoader.load('cas/stg/example');
      assert.deepEqual(first, { token: 'abc' });
      assert.equal(first, second);
      assert.equal(calls.length, 1);
    }
  }
)));

test('SecretsLoader evicts failed loads so a later call retries', withClient(Object.assign(
  async (input, calls) => {
    if (calls.length === 1) { throw new Error('temporary'); }
    return { SecretString: JSON.stringify({ ok: true }) };
  },
  {
    async run(calls) {
      await assert.rejects(SecretsLoader.load('cas/stg/flaky'), /temporary/);
      const value = await SecretsLoader.load('cas/stg/flaky');
      assert.deepEqual(value, { ok: true });
      assert.equal(calls.length, 2);
    }
  }
)));

test('SecretsLoader supports raw secret values', withClient(Object.assign(
  async () => ({ SecretString: 'plain-secret' }),
  {
    async run(calls) {
      assert.equal(await SecretsLoader.load('cas/stg/raw', { parseJson: false }), 'plain-secret');
      assert.equal(calls.length, 1);
    }
  }
)));