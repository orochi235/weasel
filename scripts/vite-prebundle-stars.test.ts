import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { nameStarsOfSourced, runtimeExportsOf } from './vite-prebundle-stars';

const dir = mkdtempSync(join(tmpdir(), 'prebundle-stars-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const file = (name: string, code: string) => {
  const path = join(dir, name);
  writeFileSync(path, code);
  return path;
};

const view = file('view.ts', `
export interface ViewTransform { panX: number }
export type Pair = [number, number];
export function worldToScreen(x: number): Pair { return [x, x]; }
export const ZOOM = 1;
export default 7;
export * from './more';
`);
file('more.ts', `export { screenToWorld } from './inverse'; export type { Pair as Twin } from './view';`);
file('inverse.ts', `export const screenToWorld = (x: number) => x;`);

describe('runtimeExportsOf', () => {
  test('lists the names a module exports at runtime, its own stars followed, with no types and no default', () => {
    expect([...runtimeExportsOf(view)!].sort()).toEqual(['ZOOM', 'screenToWorld', 'worldToScreen']);
  });

  test('cannot know the names behind a star from a package', () => {
    expect(runtimeExportsOf(file('pkg.ts', `export const a = 1;\nexport * from '@weasel-js/geom';`))).toBeNull();
  });
});

describe('nameStarsOfSourced', () => {
  const barrel = join(dir, 'barrel.ts');
  const sourced = async (spec: string) => (spec === './view' ? view : null);

  test('writes out a star from a module served from source as its names', async () => {
    const code = `export * from './view';\nexport * from './bundled';\nexport { other } from './view';\n`;
    expect(await nameStarsOfSourced(barrel, code, sourced)).toBe(
      `export { ZOOM, screenToWorld, worldToScreen } from "./view";\nexport * from './bundled';\nexport { other } from './view';\n`,
    );
  });

  test('leaves a module with no star from a sourced module untouched', async () => {
    expect(await nameStarsOfSourced(barrel, `export * from './bundled';\n`, sourced)).toBeNull();
    expect(await nameStarsOfSourced(barrel, `export { a } from './view';\n`, sourced)).toBeNull();
  });

  test('keeps a star whose names cannot all be known', async () => {
    expect(await nameStarsOfSourced(barrel, `export * from './view';\n`, sourced, () => null)).toBeNull();
  });
});
