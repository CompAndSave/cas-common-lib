'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const DEFAULT_SECRET_PREFIX = 'cas';

const getDefaultStage = ()=> {
  if (process.env.SECRETS_STAGE) { return process.env.SECRETS_STAGE; }
  if (process.env.STAGE) { return process.env.STAGE; }
  return process.env.NODE_ENV === 'production' ? 'prod' : 'stg';
};

const getDefaultRegion = ()=> process.env.AWS_ACCOUNT_REGION || process.env.AWS_REGION || 'us-west-2';

class SecretsLoader {
  static buildSecretId(domain, { stage = getDefaultStage(), prefix = DEFAULT_SECRET_PREFIX } = {}) {
    if (typeof domain !== 'string' || domain.trim().length === 0) {
      throw new Error('secret-domain-required');
    }
    return `${prefix}/${stage}/${domain.trim()}`;
  }

  static async loadDomain(domain, options = {}) {
    return Promise.resolve(await SecretsLoader.load(SecretsLoader.buildSecretId(domain, options), options));
  }

  static async load(secretId, { parseJson = true, region = getDefaultRegion() } = {}) {
    if (typeof secretId !== 'string' || secretId.trim().length === 0) {
      throw new Error('secret-id-required');
    }

    const cacheKey = `${region}:${secretId.trim()}:${parseJson ? 'json' : 'raw'}`;
    if (!SecretsLoader.cache.has(cacheKey)) {
      const promise = SecretsLoader.fetchSecret(secretId.trim(), { parseJson, region }).catch(error => {
        if (SecretsLoader.cache.get(cacheKey) === promise) {
          SecretsLoader.cache.delete(cacheKey);
        }
        throw error;
      });
      SecretsLoader.cache.set(cacheKey, promise);
    }

    return Promise.resolve(await SecretsLoader.cache.get(cacheKey));
  }

  static reset(secretId) {
    if (typeof secretId === 'undefined') {
      SecretsLoader.cache.clear();
      return;
    }

    for (const key of SecretsLoader.cache.keys()) {
      if (key.includes(`:${secretId}:`)) {
        SecretsLoader.cache.delete(key);
      }
    }
  }

  static setClientForTest(client) {
    SecretsLoader.client = client;
    SecretsLoader.reset();
  }

  static getClient(region) {
    if (SecretsLoader.client) { return SecretsLoader.client; }
    return new SecretsManagerClient({ region });
  }

  static async fetchSecret(secretId, { parseJson, region }) {
    const response = await SecretsLoader.getClient(region).send(new GetSecretValueCommand({ SecretId: secretId }));
    const rawValue = response.SecretString || (response.SecretBinary ? Buffer.from(response.SecretBinary).toString('utf8') : '');
    if (!parseJson) { return rawValue; }
    return JSON.parse(rawValue || '{}');
  }
}

SecretsLoader.cache = new Map();
SecretsLoader.client = null;

module.exports = SecretsLoader;
