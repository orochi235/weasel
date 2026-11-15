// Copied into an installed consumer by smoke-consumer-install.mjs and run there: imports each entry in
// `smoke-entries.json`, after the module named as its argument (a consumer's browser globals), and fails
// naming every one that threw as it loaded. An entry that cannot find an optional peer of its package
// the install left out is skipped: a consumer that does not use that entry has no reason to install it.
//
//   node consumer-entries.mjs [./dom.mjs]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (process.argv[2]) await import(pathToFileURL(process.argv[2]).href);
const entries = JSON.parse(readFileSync('smoke-entries.json', 'utf8'));
const failed = [];
const skipped = [];
for (const { spec, absent } of entries) {
  try {
    await import(spec);
  } catch (err) {
    const missing = err?.code === 'ERR_MODULE_NOT_FOUND' && /Cannot find package '([^']+)'/.exec(err.message)?.[1];
    if (missing && absent.includes(missing)) skipped.push(`${spec} (needs ${missing}, an optional peer)`);
    else failed.push(`${spec} threw as it loaded:\n${err?.stack ?? err}`);
  }
}
if (failed.length) {
  console.error(failed.join('\n\n'));
  process.exit(1);
}
console.log(`imported ${entries.length - skipped.length} entries, none of which threw` +
  (skipped.length ? `; skipped ${skipped.join(', ')}` : ''));
