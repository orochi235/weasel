/** One-off gate for the DTCG → definition conversion. Usage: tsx gate-conversion.ts <old-dir> <new-dir> */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [oldDir, newDir] = process.argv.slice(2).map((d) => resolve(d));
const failures: string[] = [];

function blocks(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    const decls = new Map<string, string>();
    let pending = '';
    for (const line of m[2].split('\n').map((l) => l.trim()).filter(Boolean)) {
      const comment = /^\/\* (.*) \*\/$/.exec(line);
      if (comment) {
        pending = comment[1];
        continue;
      }
      const d = /^([\w-]+)\s*:\s*(.+);$/.exec(line);
      if (d) decls.set(d[1], `${d[2]}${pending ? `  /* ${pending} */` : ''}`);
      pending = '';
    }
    out.set(selector, decls);
  }
  return out;
}

const read = (dir: string, f: string) => readFileSync(resolve(dir, f), 'utf8');

const before = blocks(read(oldDir, 'tokens.css'));
const after = blocks(read(newDir, 'tokens.css'));
if ([...before.keys()].sort().join('|') !== [...after.keys()].sort().join('|')) {
  failures.push(`selectors differ:\n  old ${[...before.keys()].join(' | ')}\n  new ${[...after.keys()].join(' | ')}`);
}
let declCount = 0;
for (const [selector, decls] of before) {
  const next = after.get(selector) ?? new Map();
  declCount += decls.size;
  for (const [prop, value] of decls) if (next.get(prop) !== value) failures.push(`${selector} ${prop}: ${value} → ${next.get(prop)}`);
  for (const prop of next.keys()) if (!decls.has(prop)) failures.push(`${selector} ${prop}: added`);
}

const rows = (text: string) => new Map([...text.matchAll(/^ {2}\{ name: '([^']+)'.*$/gm)].map((m) => [m[1], m[0]]));
const oldRows = rows(read(oldDir, 'manifest.ts'));
const newRows = rows(read(newDir, 'manifest.ts'));
if (oldRows.size !== newRows.size) failures.push(`manifest rows ${oldRows.size} → ${newRows.size}`);
for (const [name, row] of oldRows) if (newRows.get(name) !== row) failures.push(`manifest ${name}:\n  ${row}\n  ${newRows.get(name)}`);

let valueCount = 0;
const oldThemes = await import(resolve(oldDir, 'themes.ts'));
const newThemes = await import(resolve(newDir, 'themes.ts'));
for (const [mode, values] of Object.entries(oldThemes.THEMES.weasel.modes as Record<string, Record<string, string>>)) {
  const next = newThemes.THEMES.weasel.selections[`mode=${mode}`] ?? {};
  valueCount += Object.keys(values).length;
  for (const [name, v] of Object.entries(values)) if (next[name] !== v) failures.push(`THEMES ${mode} ${name}: ${v} → ${next[name]}`);
  if (Object.keys(next).length !== Object.keys(values).length) failures.push(`THEMES ${mode}: ${Object.keys(values).length} → ${Object.keys(next).length} tokens`);
}
const tokenNames = (text: string) => [...text.matchAll(/^ {2}\| '([^']+)'/gm)].map((m) => m[1]).join(',');
if (tokenNames(read(oldDir, 'themes.ts')) !== tokenNames(read(newDir, 'themes.ts'))) failures.push('TokenName differs');

console.log(`compared ${before.size} blocks / ${declCount} declarations, ${oldRows.size} manifest rows, ${valueCount} THEMES values`);
console.log(failures.length === 0 ? 'gate: same declarations, rows and values' : failures.join('\n'));
process.exit(failures.length === 0 ? 0 : 1);
