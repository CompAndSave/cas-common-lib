'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SecretsLoader = require('../lib/secrets-loader');

const loadHelper = ()=> {
  delete require.cache[require.resolve('../lib/express-helper')];
  return require('../lib/express-helper');
};

const withSecretClient = (handler)=> async ()=> {
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
    delete require.cache[require.resolve('../lib/express-helper')];
  }
};

test('ensureCognitoCredentials memoizes credentials loaded from Secrets Manager', withSecretClient(Object.assign(
  async () => ({ SecretString: JSON.stringify({ username: 'api-user', password: 'api-pass' }) }),
  {
    async run(calls) {
      const { ensureCognitoCredentials } = loadHelper();
      const cognito = { credentialsSecretId: 'cas/stg/cognito-credentials' };
      const first = await ensureCognitoCredentials(cognito);
      const second = await ensureCognitoCredentials(cognito);

      assert.deepEqual(first, { username: 'api-user', password: 'api-pass' });
      assert.deepEqual(second, first);
      assert.equal(cognito.username, 'api-user');
      assert.equal(cognito.password, 'api-pass');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].SecretId, 'cas/stg/cognito-credentials');
    }
  }
)));

test('ensureCognitoCredentials honors existing in-memory credentials', async () => {
  const { ensureCognitoCredentials } = loadHelper();
  const cognito = { username: 'local-user', password: 'local-pass' };

  const result = await ensureCognitoCredentials(cognito, { secretId: 'cas/stg/cognito-credentials' });

  assert.deepEqual(result, { username: 'local-user', password: 'local-pass' });
});

test('ensureCognitoCredentials evicts failed loads for retry', withSecretClient(Object.assign(
  async (input, calls) => {
    if (calls.length === 1) { throw new Error('temporary-secret-error'); }
    return { SecretString: JSON.stringify({ AWS_COGNITO_USERNAME: 'retry-user', AWS_COGNITO_PASSWORD: 'retry-pass' }) };
  },
  {
    async run(calls) {
      const { ensureCognitoCredentials } = loadHelper();
      const cognito = { credentialsSecretId: 'cas/stg/cognito-credentials' };

      await assert.rejects(ensureCognitoCredentials(cognito), /temporary-secret-error/);
      const result = await ensureCognitoCredentials(cognito);

      assert.deepEqual(result, { username: 'retry-user', password: 'retry-pass' });
      assert.equal(calls.length, 2);
    }
  }
)));