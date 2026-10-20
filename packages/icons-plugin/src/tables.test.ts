import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { declaredTable, packageDirFinder, sourceTablesUnder } from './tables';

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
