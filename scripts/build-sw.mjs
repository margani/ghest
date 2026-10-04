// Writes the precache list and a content hash into www/sw.js.
// Any change to any file under www/ produces a new VERSION, which is what makes
// installed PWAs pick up the update. `--check` fails if sw.js is stale (used in CI).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WWW = new URL('../www/', import.meta.url).pathname;
const SW = join(WWW, 'sw.js');
const SKIP = new Set(['sw.js', 'webview-update.html']);

function walk(dir) {
  return readdirSync(dir).sort().flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    const rel = relative(WWW, p);
    return SKIP.has(rel) || name.endsWith('.LICENSE') || name === 'OFL.txt' ? [] : [rel];
  });
}

const files = walk(WWW);
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(WWW, f)));
const version = hash.digest('hex').slice(0, 12);

const src = readFileSync(SW, 'utf8');
const next = src
  .replace(/^const VERSION = .*$/m, `const VERSION = '${version}';`)
  .replace(/^const FILES = .*$/m, `const FILES = ${JSON.stringify(['./', ...files])};`);

if (process.argv.includes('--check')) {
  if (next !== src) { console.error('www/sw.js is out of date: run `npm run build:sw`'); process.exit(1); }
  console.log(`sw.js up to date (${version}, ${files.length} files)`);
} else {
  writeFileSync(SW, next);
  console.log(`sw.js ${version}, ${files.length} files`);
}
