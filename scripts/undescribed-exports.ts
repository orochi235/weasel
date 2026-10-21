/**
 * List the exports whose row on their package page has no description: no doc
 * comment, so the reference shows the name alone.
 *
 * Converts the workspace with TypeDoc exactly as `npm run build:api` does, into a
 * temporary file, and reads it with the same code `build-reference.ts` uses, so a
 * name counted here is a name the site shows bare. A re-export counts when the
 * declaration it points at is undescribed, since its row borrows that summary.
 *
 * Usage: `npm run check:undescribed` prints each package's count and names;
 * `-- <package>…` limits it to those packages, and `-- --counts` drops the names.
 * It reports and never fails.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { JSONOutput } from 'typedoc';
import { readProject } from './lib/reference/project.ts';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const countsOnly = args.includes('--counts');
const only = new Set(args.filter((arg) => !arg.startsWith('--')));

const dir = mkdtempSync(join(tmpdir(), 'undescribed-'));
try {
  const json = join(dir, 'typedoc.json');
  console.error('undescribed: converting the workspace with TypeDoc…');
  execFileSync('npx', ['typedoc', '--json', json, '--logLevel', 'Error'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const project = JSON.parse(readFileSync(json, 'utf8')) as JSONOutput.ProjectReflection;

  const rows = readProject(project).map((reference) => {
    const names = reference.modules.flatMap((module) =>
      module.symbols
        .filter((symbol) => symbol.summary.trim() === '')
        .map((symbol) => (module.name ? `${module.name}/${symbol.name}` : symbol.name)),
    );
    return { package: reference.package, names: [...new Set(names)] };
  });

  const total = rows.reduce((n, row) => n + row.names.length, 0);
  const width = Math.max(...rows.map((row) => row.package.length));
  for (const row of [...rows].sort((a, b) => b.names.length - a.names.length)) {
    if (row.names.length === 0) continue;
    if (only.size > 0 && !only.has(row.package)) continue;
    console.log(`${row.package.padEnd(width)}  ${String(row.names.length).padStart(4)}`);
    if (!countsOnly) for (const name of row.names.sort()) console.log(`  ${name}`);
  }
  console.log(`${'total'.padEnd(width)}  ${String(total).padStart(4)}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
