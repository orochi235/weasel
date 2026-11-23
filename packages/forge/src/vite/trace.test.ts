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
