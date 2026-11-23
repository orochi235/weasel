import { describe, expect, it } from 'vitest';
import { buildOrder, packagesHolding } from './check-unnameable-types.mjs';

const ROOT = '/repo';
const ws = (name: string) => ({ dir: `${ROOT}/packages/${name}`, manifest: { name } });

describe('packagesHolding', () => {
  const all = [ws('core'), ws('core-extra'), ws('ui')];

  it('keeps the packages a path falls inside, and every package for no paths', () => {
    const names = (paths: string[]) => packagesHolding(all, paths, ROOT).map((w) => w.manifest.name);
    expect(names(['packages/ui/src/Select.tsx', 'docs/x.md'])).toEqual(['ui']);
    expect(names(['packages/core/src/a.ts'])).toEqual(['core']);
    expect(names(['apps/site/a.ts'])).toEqual([]);
    expect(names([])).toEqual(['core', 'core-extra', 'ui']);
  });
});

describe('buildOrder', () => {
  const graph = new Map([['geom', []], ['core', ['geom']], ['ui', ['core']], ['forge', ['ui', 'core']]]);

  it('builds each wanted package after its siblings, and an unwanted sibling only when it has no dist', () => {
    expect(buildOrder(graph, ['forge', 'core'], () => true)).toEqual(['core', 'forge']);
    expect(buildOrder(graph, ['forge'], (n) => n !== 'geom')).toEqual(['forge']);
    expect(buildOrder(graph, ['ui'], (n) => n !== 'geom')).toEqual(['ui']);
    expect(buildOrder(graph, ['ui'], () => false)).toEqual(['geom', 'core', 'ui']);
  });
});
