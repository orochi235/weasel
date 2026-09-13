#!/usr/bin/env node
// labkit never imports forge; forge reaches labkit only through its published entries.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SPEC = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(name)) yield path;
  }
}

const problems = [];
for (const file of files(join(root, 'packages/labkit'))) {
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(SPEC)) {
    if (spec.startsWith('@weasel-js/forge')) problems.push(`${relative(root, file)} imports ${spec}`);
  }
}
for (const file of files(join(root, 'packages/forge'))) {
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(SPEC)) {
    if (/packages\/labkit|@weasel-js\/labkit\/src/.test(spec)) {
      problems.push(`${relative(root, file)} reaches into labkit: ${spec}`);
    }
  }
}
if (problems.length > 0) {
  console.error(`forge boundary: ${problems.length} violation(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('forge boundary: clean');
