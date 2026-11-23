import { describe, expect, it } from 'vitest';
import { createBindings } from './bindings.ts';
import { moduleInfo } from './moduleInfo.ts';

const FILES: Record<string, string> = {
  '/a.ts': "export * from './b';\nexport * from './c';\n",
  '/b.ts': "export * from './a';\nexport const B = 1;\n",
  '/c.ts': "export * from './a';\n",
  '/story.ts': "import { Missing, B } from './a';\n",
};

describe('createBindings', () => {
  it('visits each module of an export * cycle once per name it looks up', async () => {
    let reads = 0;
    const info = (file: string) => {
      reads++;
      return moduleInfo(FILES[file]!, file);
    };
    const bindings = createBindings(info, new Map(), async (spec) => `/${spec.slice(2)}.ts`);
    const imports = moduleInfo(FILES['/story.ts']!, '/story.ts').imports;
    expect(await bindings.importKey('/story.ts', imports.get('Missing')!)).toBeNull();
    expect(reads).toBeLessThan(10);
    expect(await bindings.importKey('/story.ts', imports.get('B')!)).toBe('/b.ts#B');
  });
});
