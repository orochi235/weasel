import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createThemeStore, type ThemeStore } from './theme-store';

/** Set to make the next write of a path matching it stop half-way, as a full disk or a killed server would. */
const fault = { match: null as RegExp | null };

function writeFile(path: string, text: string): void {
  if (fault.match?.test(path)) {
    fault.match = null;
    writeFileSync(path, text.slice(0, Math.floor(text.length / 2)));
    throw new Error('ENOSPC: no space left on device');
  }
  writeFileSync(path, text);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let root: string;
let store: ThemeStore;
const at = (...parts: string[]) => resolve(root, ...parts);

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'wzl-theme-store-atomic-'));
  mkdirSync(at('themes'));
  copyFileSync(resolve(repo, 'packages/theme/themes/weasel.json'), at('themes/weasel.json'));
  store = createThemeStore({ themesDir: at('themes'), extraFiles: [], generatedDir: at('generated'), writeFile });
});
afterEach(() => {
  fault.match = null;
  rmSync(root, { recursive: true, force: true });
});

it('leaves the definition whole when its write stops half-way', () => {
  const before = readFileSync(at('themes/weasel.json'), 'utf8');
  const weasel = store.read('weasel')!;
  fault.match = /weasel\.json/;
  expect(() => store.write('weasel', { ...weasel.definition, description: 'edited' }, weasel.hash)).toThrow(/ENOSPC/);
  expect(readFileSync(at('themes/weasel.json'), 'utf8')).toBe(before);
  expect(readdirSync(at('themes'))).toEqual(['weasel.json']);
  expect(store.list().map((t) => t.name)).toEqual(['weasel']);
});

it('leaves every generated file as it was when one of them cannot be written', () => {
  const weasel = store.read('weasel')!;
  expect(store.write('weasel', weasel.definition, weasel.hash)).toMatchObject({ status: 'saved', regenerated: true });
  const before = readdirSync(at('generated')).sort().map((f) => [f, readFileSync(at('generated', f), 'utf8')]);

  const saved = store.read('weasel')!;
  const pins = { ...saved.definition.pins, 'radius-md': { value: '9px', type: 'dimension' } };
  fault.match = /themes\.ts/;
  const result = store.write('weasel', { ...saved.definition, pins }, saved.hash);
  expect(result).toMatchObject({ status: 'saved', regenerated: false });
  if (result.status === 'saved') expect(result.problems.join('\n')).toMatch(/ENOSPC/);
  expect(readdirSync(at('generated')).sort().map((f) => [f, readFileSync(at('generated', f), 'utf8')])).toEqual(before);
});
