#!/usr/bin/env node
/**
 * Holds the README's package marks to the code: the table must match what
 * `package-traits.mjs` measures, and a package that opens a WebGL2 context or
 * constructs an AudioContext must declare it in `weasel.needs`. Each subpath
 * in `react-free-entries.mjs` must typecheck with no React in its program, or
 * every package built on it is marked as needing React; unless it is marked
 * `dom: true`, it must typecheck with no `lib.dom` too.
 *
 * `--write` redraws the table instead of checking it.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageTraits, probeEntries, repoRoot } from './package-traits.mjs';
import { REACT_FREE_ENTRIES } from './react-free-entries.mjs';
import { renderReadme } from './readme-packages.mjs';

const write = process.argv.includes('--write');
const problems = [];

const traits = await packageTraits({
  onProbe: (done, total, name) => console.log(`${String(done).padStart(2)}/${total} ${name}`),
});

const free = await probeEntries(REACT_FREE_ENTRIES.map((e) => e.spec), {
  onProbe: (done, total, spec) => console.log(`${String(done).padStart(2)}/${total} ${spec} (React-free)`),
});
for (const { spec, dom } of REACT_FREE_ENTRIES) {
  const p = free.get(spec);
  if (p.react) {
    problems.push(
      `${spec} promises no React, but its source reaches React types or a .tsx file. ` +
        'Find the import that reaches a barrel and import from the leaf instead.',
    );
  }
  if (p.dom && !dom) {
    problems.push(
      `${spec} promises no DOM, but its source fails to typecheck without lib.dom. ` +
        'Find the import that reaches a browser-only module and import from a DOM-free leaf instead.',
    );
  }
}

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
