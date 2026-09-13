#!/usr/bin/env node
// labkit never imports forge; forge reaches labkit only through its published entries.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const SPEC = /(?:from\s+|import\s*\(\s*|import\s+|vi\.mock\(\s*|import\.meta\.glob\(\s*)['"]([^'"]+)['"]/g;

/**
 * @param {{ labkitExports: string[], files: { path: string, source: string }[] }} input
 *   `path` is relative to the repo root, `/`-separated.
 * @returns {string[]}
 */
export function findViolations({ labkitExports, files }) {
  const published = new Set(labkitExports);
  const within = (pkg, path) => path === pkg || path.startsWith(`${pkg}/`);
  const problems = [];
  for (const { path, source } of files) {
    for (const [, spec] of source.matchAll(SPEC)) {
      const target = spec.startsWith('.') ? posix.join(posix.dirname(path), spec) : null;
      if (within('packages/labkit', path)) {
        if (/^@weasel-js\/forge(\/|$)/.test(spec) || (target && within('packages/forge', target))) {
          problems.push(`${path} imports forge: ${spec}`);
        }
      } else if (within('packages/forge', path)) {
        const sub = /^@weasel-js\/labkit(\/.*)?$/.exec(spec);
        if ((sub && sub[1] && !published.has(`.${sub[1]}`)) || (target && within('packages/labkit', target))) {
          problems.push(`${path} reaches past labkit's published entries: ${spec}`);
        }
      }
    }
  }
  return problems;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(name)) yield path;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('..', import.meta.url).pathname;
  const files = ['packages/labkit', 'packages/forge'].flatMap((pkg) =>
    [...walk(join(root, pkg))].map((file) => ({
      path: relative(root, file).split('\\').join('/'),
      source: readFileSync(file, 'utf8'),
    })),
  );
  const labkitExports = Object.keys(JSON.parse(readFileSync(join(root, 'packages/labkit/package.json'), 'utf8')).exports);
  const problems = findViolations({ labkitExports, files });
  if (problems.length > 0) {
    console.error(`forge boundary: ${problems.length} violation(s)\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log('forge boundary: clean');
}
