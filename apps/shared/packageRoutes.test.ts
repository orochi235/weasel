import { describe, expect, it } from 'vitest';
import { packageRoute, parsePackageRoute, splitReferencePath, symbolRoute } from './packageRoutes';

describe('parsePackageRoute', () => {
  it('reads a bare package as its overview', () => {
    expect(parsePackageRoute('pkg/geom')).toEqual({ package: 'geom', tab: 'overview', rest: '' });
  });

  it('keeps everything after the tab, slashes included', () => {
    expect(parsePackageRoute('pkg/geom/reference/booleans/unionPaths')).toEqual({
      package: 'geom',
      tab: 'reference',
      rest: 'booleans/unionPaths',
    });
  });

  it('answers null for a demo id, the index, and a tab that does not exist', () => {
    expect(parsePackageRoute('gestures')).toBeNull();
    expect(parsePackageRoute('pkg')).toBeNull();
    expect(parsePackageRoute('pkg/geom/changelog')).toBeNull();
  });
});

describe('packageRoute', () => {
  it('round-trips through the parser', () => {
    for (const id of ['pkg/geom', 'pkg/geom/guides/paths', 'pkg/geom/reference', 'pkg/text-dom/demos']) {
      const route = parsePackageRoute(id)!;
      expect(packageRoute(route.package, route.tab, route.rest)).toBe(id);
    }
  });
});

describe('symbolRoute', () => {
  it('puts a subpath export under its module and a root export under the package', () => {
    expect(symbolRoute('geom', '', 'Box')).toBe('pkg/geom/reference/Box');
    expect(symbolRoute('geom', 'booleans', 'unionPaths')).toBe('pkg/geom/reference/booleans/unionPaths');
  });
});

describe('splitReferencePath', () => {
  const modules = ['', 'booleans', 'testing/renderSettled'];

  it('reads a module name as that module', () => {
    expect(splitReferencePath('', modules)).toEqual({ module: '', symbol: null });
    expect(splitReferencePath('booleans', modules)).toEqual({ module: 'booleans', symbol: null });
    expect(splitReferencePath('testing/renderSettled', modules)).toEqual({ module: 'testing/renderSettled', symbol: null });
  });

  it('reads the last segment of anything else as the export', () => {
    expect(splitReferencePath('Box', modules)).toEqual({ module: '', symbol: 'Box' });
    expect(splitReferencePath('testing/renderSettled/renderSettled', modules)).toEqual({
      module: 'testing/renderSettled',
      symbol: 'renderSettled',
    });
  });
});
