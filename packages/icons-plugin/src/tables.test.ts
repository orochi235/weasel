import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { declaredTable, packageDirFinder, reachableTables, sourceTablesUnder } from './tables';

const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'weasel-icons-tables-'));
  temps.push(dir);
  return dir;
};

it("leaves the plugin's own test fixtures out of the tables a dev server serves", () => {
  expect(sourceTablesUnder(import.meta.dirname).map((t) => t.namespace)).toEqual([]);
});

it("finds a table in a consumer's own directory named fixtures", () => {
  const root = temp();
  mkdirSync(join(root, 'fixtures'));
  writeFileSync(join(root, 'fixtures', 'icons.gen.ts'), `export const icon = scopedIcon<never>('fx');\n`);
  writeFileSync(join(root, 'fixtures', 'icons.table.json'), JSON.stringify({ namespace: 'fx', owner: 'app', icons: {} }));
  expect(sourceTablesUnder(root).map((t) => t.namespace)).toEqual(['fx']);
});

it("reads an unbuilt package's source table where its declared one is missing", () => {
  const root = temp();
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'pkg', weaselIcons: { table: './dist/icons.table.json' } }));
  writeFileSync(join(root, 'src', 'icons.gen.ts'), `export const icon = scopedIcon<'a'>('fx');\n`);
  writeFileSync(join(root, 'src', 'icons.table.json'), JSON.stringify({ namespace: 'fx', owner: 'pkg', icons: {} }));
  expect(declaredTable(root)?.namespace).toBe('fx');
});

it('walks past a package.json with no name to the package root', () => {
  const root = temp();
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'pkg' }));
  writeFileSync(join(root, 'dist', 'package.json'), JSON.stringify({ type: 'module' }));
  expect(packageDirFinder()(join(root, 'dist', 'index.js'))).toBe(root);
});

it("serves a linked workspace package's source table over a stale built one", () => {
  const root = temp();
  const pkg = join(root, 'packages', 'pkg');
  mkdirSync(join(pkg, 'src'), { recursive: true });
  mkdirSync(join(pkg, 'dist'));
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'pkg', weaselIcons: { table: './dist/icons.table.json' } }));
  writeFileSync(join(pkg, 'src', 'icons.gen.ts'), `export const icon = scopedIcon<'a'>('fx');\n`);
  writeFileSync(join(pkg, 'src', 'icons.table.json'), JSON.stringify({ namespace: 'fx', owner: 'pkg', icons: { added: { body: '' } } }));
  writeFileSync(join(pkg, 'dist', 'icons.table.json'), JSON.stringify({ namespace: 'fx', owner: 'pkg', icons: {} }));
  mkdirSync(join(root, 'app', 'node_modules'), { recursive: true });
  symlinkSync(pkg, join(root, 'app', 'node_modules', 'pkg'));
  const fx = reachableTables(join(root, 'app')).filter((t) => t.namespace === 'fx');
  expect(fx.map((t) => Object.keys(t.icons))).toEqual([['added']]);
});

it("serves a worktree's own workspace tables, not the enclosing checkout's", () => {
  const outer = temp();
  const table = (icons: Record<string, { body: string }>) => JSON.stringify({ namespace: 'fx', owner: 'pkg', icons });
  const workspace = (root: string, icons: Record<string, { body: string }>) => {
    const pkg = join(root, 'packages', 'pkg');
    mkdirSync(join(pkg, 'src'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'repo', workspaces: ['packages/*'] }));
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'pkg', weaselIcons: { table: './dist/icons.table.json' } }));
    writeFileSync(join(pkg, 'src', 'icons.gen.ts'), `export const icon = scopedIcon<'a'>('fx');\n`);
    writeFileSync(join(pkg, 'src', 'icons.table.json'), table(icons));
    mkdirSync(join(root, 'apps', 'app'), { recursive: true });
  };
  // The main checkout, installed, with the glyph drawn its old way and no glyph added since.
  workspace(outer, { kept: { body: 'old' } });
  mkdirSync(join(outer, 'node_modules'));
  symlinkSync(join(outer, 'packages', 'pkg'), join(outer, 'node_modules', 'pkg'));
  // A worktree nested in it, with no node_modules of its own.
  const inner = join(outer, '.claude', 'worktrees', 'branch');
  workspace(inner, { kept: { body: 'new' }, added: { body: '' } });
  const fx = reachableTables(join(inner, 'apps', 'app')).filter((t) => t.namespace === 'fx');
  expect(fx.map((t) => t.icons)).toEqual([{ kept: { body: 'new' }, added: { body: '' } }]);
});
