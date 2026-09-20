import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serializeDefinition } from '../src/theme/store';
import { createThemeStore, type ThemeStore } from './themeStore';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let root: string;
let store: ThemeStore;
const at = (...parts: string[]) => resolve(root, ...parts);

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'wzl-theme-store-'));
  mkdirSync(at('themes'));
  mkdirSync(at('labkit'));
  copyFileSync(resolve(repo, 'packages/theme/themes/weasel.json'), at('themes/weasel.json'));
  copyFileSync(resolve(repo, 'packages/labkit/src/theme/interstellar.theme.json'), at('labkit/interstellar.theme.json'));
  store = createThemeStore({
    themesDir: at('themes'),
    extraFiles: [at('labkit/interstellar.theme.json')],
    generatedDir: at('generated'),
  });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('theme store', () => {
  it('lists every known definition, and which of them emit', () => {
    expect(store.list().map((t) => [t.name, t.emits])).toEqual([['weasel', true], ['interstellar', false]]);
  });

  it('writes the definition and regenerates the token files', () => {
    const weasel = store.read('weasel')!;
    const edited: ThemeDefinition = { ...weasel.definition, description: 'edited' };
    const result = store.write('weasel', edited, weasel.hash);
    expect(result).toMatchObject({ status: 'saved', regenerated: true, issues: [] });
    expect(readFileSync(at('themes/weasel.json'), 'utf8')).toBe(serializeDefinition(edited));
    expect(readFileSync(at('generated/tokens.css'), 'utf8')).toBe(
      readFileSync(resolve(repo, 'packages/theme/src/generated/tokens.css'), 'utf8'),
    );
  });

  it('answers a stale hash with the current one and leaves the file alone', () => {
    const before = readFileSync(at('themes/weasel.json'), 'utf8');
    const weasel = store.read('weasel')!;
    expect(store.write('weasel', { ...weasel.definition, description: 'x' }, 'stale')).toEqual({
      status: 'conflict',
      hash: weasel.hash,
    });
    expect(readFileSync(at('themes/weasel.json'), 'utf8')).toBe(before);
  });

  it('saves a definition with issues but leaves the generated files alone', () => {
    const weasel = store.read('weasel')!;
    const probe = { ramp: 'gray', contrast: { min: 30, against: ['surface'] } };
    const result = store.write('weasel', { ...weasel.definition, semantics: { ...weasel.definition.semantics, probe } }, weasel.hash);
    if (result.status !== 'saved') throw new Error(result.status);
    // One per selection: every mode crossed with every density.
    expect(result.issues.map((r) => r.issue.kind)).toEqual(Array(6).fill('contrast-unmet'));
    expect(result.regenerated).toBe(false);
    expect(result.problems).toHaveLength(6);
    expect(existsSync(at('generated/tokens.css'))).toBe(false);
    expect(JSON.parse(readFileSync(at('themes/weasel.json'), 'utf8')).semantics.probe).toEqual(probe);
  });

  it('saves interstellar without emitting anything', () => {
    const inter = store.read('interstellar')!;
    const result = store.write('interstellar', { ...inter.definition, description: 'x' }, inter.hash);
    expect(result).toMatchObject({ status: 'saved', regenerated: false, problems: [] });
    expect(existsSync(at('generated'))).toBe(false);
  });

  it('creates a new theme in themes/ only while no file holds that name', () => {
    const harbor: ThemeDefinition = { name: 'harbor', extends: 'weasel', pins: { 'radius-md': { value: '2px', type: 'dimension' } } };
    expect(store.write('harbor', harbor, null)).toMatchObject({ status: 'saved', regenerated: true });
    expect(existsSync(at('themes/harbor.json'))).toBe(true);
    expect(store.write('harbor', harbor, null).status).toBe('conflict');
  });

  it('refuses a second emitting theme that extends nothing, and writes nothing', () => {
    expect(store.write('harbor', { name: 'harbor' }, null)).toMatchObject({ status: 'invalid' });
    expect(existsSync(at('themes/harbor.json'))).toBe(false);
  });

  it('refuses an emitting theme that extends a theme which does not emit', () => {
    expect(store.write('harbor', { name: 'harbor', extends: 'interstellar' }, null)).toMatchObject({ status: 'invalid' });
    expect(existsSync(at('themes/harbor.json'))).toBe(false);
  });

  it('refuses a definition derive cannot run, and leaves the file alone', () => {
    const before = readFileSync(at('themes/weasel.json'), 'utf8');
    const weasel = store.read('weasel')!;
    const broken = { ...weasel.definition, semantics: { ...weasel.definition.semantics, dangling: { ref: 'nope' } } };
    expect(store.write('weasel', broken, weasel.hash)).toMatchObject({ status: 'invalid' });
    expect(readFileSync(at('themes/weasel.json'), 'utf8')).toBe(before);
  });

  it('refuses a name that is not a theme name, or that the definition does not carry', () => {
    expect(store.write('../evil', { name: '../evil' }, null)).toMatchObject({ status: 'invalid' });
    expect(store.write('harbor', { name: 'other' }, null)).toMatchObject({ status: 'invalid' });
    expect(existsSync(at('themes/harbor.json'))).toBe(false);
  });
});
