#!/usr/bin/env node
/**
 * Holds the README's package marks to the code: the table must match what
 * `package-traits.mjs` measures, and a package that opens a WebGL2 context or
 * constructs an AudioContext must declare it in `weasel.needs`.
 *
 * `--write` redraws the table instead of checking it.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageTraits, repoRoot } from './package-traits.mjs';
import { renderReadme } from './readme-packages.mjs';

const write = process.argv.includes('--write');
const problems = [];

const traits = await packageTraits({
  onProbe: (done, total, name) => console.log(`${String(done).padStart(2)}/${total} ${name}`),
});

const readmePath = join(repoRoot, 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const drawn = renderReadme(readme, traits);
if (write) {
  writeFileSync(readmePath, drawn);
  console.log('README.md package table redrawn');
} else if (drawn !== readme) {
  problems.push("README.md's package table is out of date. Run `npm run check:needs -- --write`.");
}

const USES = [
  ['webgl2', /getContext\(\s*['"]webgl2['"]/],
  ['webaudio', /new\s+(?:webkit)?AudioContext\s*\(/],
];
const sources = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'testing' ? [] : sources(p);
    return /\.tsx?$/.test(f) && !/\.(test|spec|stories)\./.test(f) ? [p] : [];
  });
for (const [name, t] of traits) {
  for (const file of sources(join(repoRoot, 'packages', name, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const [need, re] of USES) {
      if (!t[need] && re.test(text)) {
        problems.push(`${file.slice(repoRoot.length + 1)} uses ${need}; add "${need}" to ${name}'s "weasel.needs".`);
      }
    }
  }
}

for (const p of problems) console.error(`\n${p}`);
process.exit(problems.length ? 1 : 0);
