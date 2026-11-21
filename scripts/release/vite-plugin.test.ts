import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import { isOlderRelease } from '../../apps/shared/releaseMajor.ts';
import { changelogs } from './vite-plugin.ts';

const CHANGELOG = `# @weasel-js/core

## 2.0.0

### Major Changes

- abc1234: A new thing.

## 1.9.0

### Patch Changes

- def5678: An old fix.
`;

let root: string;
let load: (id: string) => string | null;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'changelogs-'));
  mkdirSync(join(root, 'packages', 'core'), { recursive: true });
  writeFileSync(join(root, 'packages', 'core', 'CHANGELOG.md'), CHANGELOG);
  const plugin = changelogs({ root }) as Plugin;
  load = (id) => (plugin.load as (id: string) => string | null)(`\0${id}`);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('the changelogs plugin', () => {
  it('indexes releases from the current major in virtual:changelogs', () => {
    const index = load('virtual:changelogs')!;
    expect(index).toContain('"version":"2.0.0"');
    expect(index).not.toContain('1.9.0');
  });

  it('indexes every older release in virtual:changelogs/older, with a chunk for each', () => {
    const index = load('virtual:changelogs/older')!;
    expect(index).toContain('"version":"1.9.0"');
    expect(index).toContain('import("virtual:changelogs/1.9.0")');
    expect(index).not.toContain('2.0.0');
  });

  it("serves a release's entries from its own chunk", () => {
    expect(load('virtual:changelogs/1.9.0')).toContain('An old fix.');
  });
});

describe('isOlderRelease', () => {
  it('puts every version below the current major on the older page', () => {
    expect(['0.8.0', '1.0.0', '1.39.2'].map(isOlderRelease)).toEqual([true, true, true]);
    expect(['2.0.0', '2.0.0-pre.1', '10.0.0', 'Unreleased'].map(isOlderRelease)).toEqual([false, false, false, false]);
  });
});
