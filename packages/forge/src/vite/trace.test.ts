import { describe, expect, it } from 'vitest';
import { createTracer } from './trace.ts';

const FILES: Record<string, string> = {
  '/a.ts': "export * from './b';\nexport * from './c';\n",
  '/b.ts': "export * from './a';\nexport const B = 1;\n",
  '/c.ts': "export * from './a';\n",
};

describe('createTracer', () => {
  it('visits each module of an export * cycle once per name it looks up', async () => {
    let resolves = 0;
    const trace = createTracer((file) => FILES[file]!)(async (spec) => {
      resolves++;
      return `/${spec.slice(2)}.ts`;
    });
    expect(await trace.declaring('/a.ts', 'Missing')).toBeNull();
    expect(resolves).toBeLessThan(10);
    expect(await trace.declaring('/c.ts', 'B')).toBe('/b.ts#B');
  });
});

describe('what a module declares', () => {
  const files: Record<string, string> = {
    '/kit.ts': "import * as forge from './forge';\nexport const { meta, story: makeStory } = forge;\nexport enum Size { S, L }\nexport * as Icons from './icons';\nexport * from './other';\n",
    '/forge.ts': 'export function meta() {}\nexport function story() {}\n',
    '/icons.ts': 'export const Star = 1;\n',
    '/other.ts': 'export const Icons = 2;\n',
  };
  const trace = () => createTracer((file) => files[file]!)(async (spec) => `/${spec.slice(2)}.ts`);

  it('follows a name destructured off a namespace import to its declaration', async () => {
    expect(await trace().declaring('/kit.ts', 'meta')).toBe('/forge.ts#meta');
    expect(await trace().declaring('/kit.ts', 'makeStory')).toBe('/forge.ts#story');
  });

  it('declares an exported enum and a namespace re-export, which no export * then answers for', async () => {
    expect(await trace().declaring('/kit.ts', 'Size')).toBe('/kit.ts#Size');
    expect(await trace().declaring('/kit.ts', 'Icons')).toBeNull();
  });
});

describe('a name more than one export * answers for', () => {
  const files: Record<string, string> = {
    '/kit.ts': "export * from './a';\nexport * from './b';\nexport * from './c';\n",
    '/a.ts': 'export function story() {}\nexport function meta() {}\n',
    '/b.ts': 'export function story() {}\n',
    '/c.ts': "export { meta } from './a';\n",
  };
  const trace = () => createTracer((file) => files[file]!)(async (spec) => `/${spec.slice(2)}.ts`);

  it('is ambiguous, and exported by neither, when the modules declare it differently', async () => {
    expect(await trace().declaring('/kit.ts', 'story')).toBeNull();
  });

  it('is exported when every module answers with the same binding', async () => {
    expect(await trace().declaring('/kit.ts', 'meta')).toBe('/a.ts#meta');
  });
});

describe('local aliases', () => {
  const files: Record<string, string> = {
    '/helper.ts': [
      "import { meta } from './forge';",
      'export const defineMeta = meta;',
      'const inner = meta as typeof meta;',
      'export const twice = inner;',
      'export default twice;',
      'export let later = meta;',
      'const a = b;',
      'const b = a;',
      'export { a };',
    ].join('\n'),
    '/forge.ts': 'export function meta() {}\n',
  };
  const trace = () => createTracer((file) => files[file]!)(async (spec) => `/${spec.slice(2)}.ts`);

  it('follows a const bound to another name to what that name is declared as', async () => {
    expect(await trace().declaring('/helper.ts', 'defineMeta')).toBe('/forge.ts#meta');
    expect(await trace().declaring('/helper.ts', 'twice')).toBe('/forge.ts#meta');
    expect(await trace().declaring('/helper.ts', 'default')).toBe('/forge.ts#meta');
  });

  it('stops at a let, which may be reassigned, and at a cycle', async () => {
    expect(await trace().declaring('/helper.ts', 'later')).toBe('/helper.ts#later');
    expect(await trace().declaring('/helper.ts', 'a')).toBe('/helper.ts#a');
  });
});
