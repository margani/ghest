// Writes the precache list and a content hash into www/sw.js, and www/version.json with
// versionName (android/app/build.gradle, the single source) and that same hash.
// Any change to any file under www/, or to versionName, produces a new VERSION, which is
// what makes installed PWAs pick up the update. `--check` fails if either is stale (CI).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WWW = new URL('../www/', import.meta.url).pathname;
const SW = join(WWW, 'sw.js');
const VERSION_JSON = join(WWW, 'version.json');
// version.json holds the hash, so it can't be part of it; it is precached separately.
const SKIP = new Set(['sw.js', 'webview-update.html', '_headers', 'version.json']);

function walk(dir) {
  return readdirSync(dir).sort().flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    const rel = relative(WWW, p);
    return SKIP.has(rel) || name.endsWith('.LICENSE') || name === 'OFL.txt' ? [] : [rel];
  });
}

const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
const versionName = gradle.match(/^\s*versionName "(.+)"/m)?.[1];
if (!versionName) { console.error('versionName not found in android/app/build.gradle'); process.exit(1); }

const files = walk(WWW);
const hash = createHash('sha256').update(versionName);
for (const f of files) hash.update(f).update(readFileSync(join(WWW, f)));
const version = hash.digest('hex').slice(0, 12);

const src = readFileSync(SW, 'utf8');
const next = src
  .replace(/^const VERSION = .*$/m, `const VERSION = '${version}';`)
  .replace(/^const FILES = .*$/m, `const FILES = ${JSON.stringify(['./', ...files, 'version.json'])};`);
const versionJson = `${JSON.stringify({ version: versionName, build: version })}\n`;
let oldVersionJson = '';
try { oldVersionJson = readFileSync(VERSION_JSON, 'utf8'); } catch {}

if (process.argv.includes('--check')) {
  if (next !== src || versionJson !== oldVersionJson) {
    console.error('www/sw.js or www/version.json is out of date: run `npm run build:sw`');
    process.exit(1);
  }
  console.log(`sw.js and version.json up to date (${versionName}, ${version}, ${files.length} files)`);
} else {
  writeFileSync(SW, next);
  writeFileSync(VERSION_JSON, versionJson);
  console.log(`sw.js ${version}, version.json ${versionName}, ${files.length} files`);
}
