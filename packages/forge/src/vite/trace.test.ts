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
