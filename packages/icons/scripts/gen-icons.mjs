// Emits each package's icon table and bound icon() from its icons/ definitions.
//
//   node packages/icons/scripts/gen-icons.mjs
//
// Proof a change before committing it: CLAUDE.md ("Drawing icons") requires
// inspecting at 240-320px, not at chrome size.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { camel, checkMark, element, fillElement } from './lib/emit.mjs';
import { writeLegacyUi } from './lib/legacy-ui.mjs';
import { emitGen, emitTableModule } from './lib/modules.mjs';

const REPO = join(import.meta.dirname, '../../..');

/** Every directory that owns icons: a package or an app with an icons/ directory. */
export function discover() {
  const roots = [];
  for (const parent of ['packages', 'apps']) {
    for (const name of readdirSync(join(REPO, parent))) {
      const dir = join(REPO, parent, name);
      if (existsSync(join(dir, 'icons'))) roots.push(dir);
    }
  }
  return roots;
}

async function readPackage(root) {
  const index = join(root, 'icons', 'index.mjs');
  if (!existsSync(index)) throw new Error(`${relative(REPO, root)}/icons has no index.mjs`);
  const def = await import(pathToFileURL(index).href);
  if (!def.namespace || !def.owner) throw new Error(`${relative(REPO, index)} must export namespace and owner`);
  return { root, ...def };
}

function buildTable(pkg) {
  const icons = {};
  const groups = [];
  for (const [label, set, opts = {}] of pkg.groups) {
    const names = [];
    groups.push({ label, names });
    for (const [rawKey, glyph] of Object.entries(set)) {
      if (rawKey.startsWith('_') || rawKey === 'attrs') continue;
      const key = camel(pkg.rename?.[rawKey] ?? rawKey);
      const body = element(glyph);
      const prior = icons[key];
      if (prior) {
        if (prior.body === body) continue;
        throw new Error(`icon "${key}" is drawn twice, differently, in "${pkg.namespace}" — rename one`);
      }
      if (label === pkg.markGroup) checkMark(key, body);
      const fill = fillElement(glyph);
      icons[key] = { body, ...(fill ? { fill } : {}), group: label, tags: opts.tags?.[rawKey] ?? [] };
      names.push(key);
    }
  }
  return { table: { namespace: pkg.namespace, owner: pkg.owner, icons }, groups };
}

function writePackage({ pkg, table, groups }) {
  const src = join(pkg.root, 'src');
  writeFileSync(join(src, 'icons.table.json'), JSON.stringify(table, null, 2) + '\n');
  writeFileSync(join(src, 'icons.table.ts'), emitTableModule(table));
  writeFileSync(join(src, 'icons.gen.ts'), emitGen(table, groups));
  if (table.namespace === 'ui') writeLegacyUi({ repo: REPO, root: pkg.root, table: { ...table, groups }, markGroup: pkg.markGroup });
}

/** Read every root's definitions and build its table; with `write`, emit the generated files. */
export async function generate({ roots = discover(), write = true } = {}) {
  const pkgs = await Promise.all(roots.map(readPackage));
  const owners = new Map();
  for (const p of pkgs) {
    const prior = owners.get(p.namespace);
    if (prior) throw new Error(`namespace "${p.namespace}" is declared by both ${prior} and ${relative(REPO, p.root)}`);
    owners.set(p.namespace, relative(REPO, p.root));
  }
  const built = pkgs.map((p) => ({ pkg: p, ...buildTable(p) }));
  if (write) {
    built.forEach(writePackage);
    const manifest = built.map(({ table }) => ({
      namespace: table.namespace,
      owner: table.owner,
      names: Object.entries(table.icons).map(([name, g]) => ({ name, group: g.group, tags: g.tags })),
    }));
    writeFileSync(join(REPO, 'apps/site/icons.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  return { tables: built.map((b) => b.table) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { tables } = await generate();
  for (const t of tables) console.log(`${t.namespace}: ${Object.keys(t.icons).length} glyphs`);
}
