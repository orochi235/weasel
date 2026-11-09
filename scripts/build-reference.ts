/**
 * Split TypeDoc's JSON for the workspace into one reference file per package,
 * in the shape the site's package pages draw (`apps/shared/reference.ts`).
 *
 * Reads `dist/typedoc.json`, which `typedoc` writes (`json` in
 * `typedoc.config.mjs`), and writes `dist-demo/reference/<package>.json`.
 * The site fetches those, and the directory holds one file per published
 * package and nothing else. TypeDoc's own file, far larger than their sum,
 * stays outside the deployed tree for forge's index pages to read.
 *
 * Usage: `npm run build:reference`, after `typedoc`. `npm run build:api` runs both.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { JSONOutput } from 'typedoc';
import { readProject } from './lib/reference/project.ts';

const DIR = resolve(import.meta.dirname, '../dist-demo/reference');
const INPUT = resolve(import.meta.dirname, '../dist/typedoc.json');

if (!existsSync(INPUT)) {
  console.error(`build-reference: ${INPUT} does not exist. Run \`npm run build:api\`, which writes it and then runs this.`);
  process.exit(1);
}

const project = JSON.parse(readFileSync(INPUT, 'utf8')) as JSONOutput.ProjectReflection;
const references = readProject(project);
if (references.length === 0) {
  console.error('build-reference: the TypeDoc project holds no packages; was it built with entryPointStrategy "packages"?');
  process.exit(1);
}

mkdirSync(DIR, { recursive: true });
const width = Math.max(...references.map((r) => r.package.length));
const written = new Set<string>();
references.forEach((reference, i) => {
  const file = `${reference.package}.json`;
  const text = JSON.stringify(reference);
  writeFileSync(join(DIR, file), text);
  written.add(file);
  const exports = reference.modules.reduce((n, module) => n + module.symbols.length, 0);
  const position = `${String(i + 1).padStart(String(references.length).length)}/${references.length}`;
  const kb = (Buffer.byteLength(text) / 1024).toFixed(1);
  console.log(`[${position}] ${reference.package.padEnd(width)}  ${String(exports).padStart(5)} exports  ${kb.padStart(8)} kB`);
});

// A package that is no longer published would otherwise keep its page's data forever.
for (const file of readdirSync(DIR)) {
  if (!written.has(file)) rmSync(join(DIR, file));
}
