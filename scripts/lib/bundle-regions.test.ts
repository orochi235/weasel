import { describe, expect, it } from 'vitest';
import { moduleRegions } from './bundle-regions.mjs';

const PATH = 'packages/renderer/src/draw.ts';

describe('moduleRegions', () => {
  it("reads rolldown's //#region markers, only to the region's end", () => {
    const body = [
      '//#region ../../packages/renderer/src/draw.ts',
      'const a = 1;',
      '//#endregion',
      '//#region packages/geom/src/box.ts',
      'const u_tileOrigin = 2;',
      '//#endregion',
    ].join('\n');
    expect(moduleRegions(body, PATH)).toEqual(['const a = 1;']);
  });

  it("reads esbuild's // <path> markers, to the next module", () => {
    const body = ['// packages/renderer/src/draw.ts', 'var a = 1;', '// ../packages/geom/src/box.ts', 'var u_tileOrigin = 2;'].join('\n');
    expect(moduleRegions(body, PATH)).toEqual(['var a = 1;']);
  });

  it('finds nothing for a module the bundle does not hold, or a path that only ends the same', () => {
    expect(moduleRegions('//#region node_modules/x/packages/renderer/src/draw.ts\nx\n//#endregion', PATH)).toEqual([]);
    expect(moduleRegions('', PATH)).toEqual([]);
  });
});
