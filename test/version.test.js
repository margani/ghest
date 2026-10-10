import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('version.json carries versionName from build.gradle and the build hash of sw.js', () => {
  const versionName = read('android/app/build.gradle').match(/^\s*versionName "(.+)"/m)[1];
  const swVersion = read('www/sw.js').match(/^const VERSION = '(.+)';$/m)[1];
  const v = JSON.parse(read('www/version.json'));
  assert.deepEqual(v, { version: versionName, build: swVersion });
  // The service worker must precache it, so the shown version is the running build's.
  assert.ok(read('www/sw.js').includes('"version.json"'));
});
