'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const leafPath = path.join(projectRoot, 'lib', 'tracking-carrier.js');
const loadLeaf = ()=> require(leafPath);

test('infers all supported tracking carriers and rejects an unknown value', () => {
  const { inferCarrierFromTrackingNumber } = loadLeaf();

  assert.equal(inferCarrierFromTrackingNumber('1Z16E50BYW47166086'), 'ups');
  assert.equal(inferCarrierFromTrackingNumber('GFUS01065748129987'), 'gof');
  assert.equal(inferCarrierFromTrackingNumber('9400111899223856928499'), 'usps');
  assert.equal(inferCarrierFromTrackingNumber('123456789012'), 'fedex');
  assert.equal(inferCarrierFromTrackingNumber('123456789012345'), 'fedex');
  assert.equal(inferCarrierFromTrackingNumber('TEMU-PACKAGE-1'), null);
});

test('rejects 13-digit and 14-digit numbers as FedEx tracking numbers', () => {
  const { inferCarrierFromTrackingNumber } = loadLeaf();

  assert.equal(inferCarrierFromTrackingNumber('1'.repeat(13)), null);
  assert.equal(inferCarrierFromTrackingNumber('1'.repeat(14)), null);
});

test('rejects short and malformed USPS tracking numbers', () => {
  const { inferCarrierFromTrackingNumber } = loadLeaf();

  assert.equal(inferCarrierFromTrackingNumber('9999'), null);
  assert.equal(inferCarrierFromTrackingNumber('9'.repeat(21)), null);
});

test('trims tracking numbers before carrier inference', () => {
  const { inferCarrierFromTrackingNumber } = loadLeaf();

  assert.equal(inferCarrierFromTrackingNumber(' 123456789012 '), 'fedex');
  assert.equal(inferCarrierFromTrackingNumber('1Z999\r\n'), 'ups');
});

test('normalizes only supported carrier names', () => {
  const { normalizeCarrier } = loadLeaf();

  assert.equal(normalizeCarrier(' UPS '), 'ups');
  assert.equal(normalizeCarrier('dhl'), null);
});

test('returns display names only for supported carrier keys', () => {
  const { carrierDisplayName } = loadLeaf();

  assert.equal(carrierDisplayName('gof'), 'GOFO');
  assert.equal(carrierDisplayName('dhl'), null);
});

test('exports six exact constants and functions identically through the barrel', () => {
  const leaf = loadLeaf();
  const barrel = require('..');

  assert.equal(Object.keys(leaf).length, 6);
  for (const key of Object.keys(leaf)) {
    assert.equal(barrel[key], leaf[key]);
  }
  assert.deepEqual(
    leaf.VALID_TRACKING_CARRIER_LIST,
    ['ups', 'fedex', 'usps', 'gof']
  );
  assert.equal(Object.isFrozen(leaf.VALID_TRACKING_CARRIER_LIST), true);
  assert.deepEqual(
    [...leaf.VALID_TRACKING_CARRIERS],
    leaf.VALID_TRACKING_CARRIER_LIST
  );
  assert.equal(leaf.VALID_TRACKING_CARRIERS.size, 4);
  assert.deepEqual(leaf.CARRIER_DISPLAY_NAMES, {
    ups: 'UPS',
    gof: 'GOFO',
    usps: 'USPS',
    fedex: 'FedEx'
  });
  assert.equal(Object.isFrozen(leaf.CARRIER_DISPLAY_NAMES), true);
});

test('leaf source has no CommonJS or ESM dependency imports', () => {
  const source = fs.readFileSync(leafPath, 'utf8');

  assert.doesNotMatch(source, /\brequire\s*\(/);
  assert.doesNotMatch(source, /\bimport\s/);
});

test('requiring only the leaf adds exactly one module to require.cache', () => {
  const childScript = [
    'const modulePath = process.argv[1];',
    'const before = Object.keys(require.cache).length;',
    'require(modulePath);',
    'const cacheGrowth = Object.keys(require.cache).length - before;',
    'if (cacheGrowth !== 1) {',
    '  process.stderr.write(`require.cache grew by ${cacheGrowth}`);',
    '  process.exitCode = 1;',
    '}'
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', childScript, leafPath], {
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `leaf-only child process failed:\n${result.stdout}${result.stderr}`
  );
});

test('package metadata declares version 0.13.0', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
  );

  assert.equal(packageJson.version, '0.13.0');
});
