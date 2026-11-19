import { describe, expect, it } from 'vitest';
import { PAGE_A, pagedScene } from 'core/pages/pagedFixture';
import { insertSite } from './insertSite';

describe('insertSite', () => {
  it('keeps a node inserted into a group on a page partly on that page, with the pasteboard off', () => {
    const { scene } = pagedScene();
    const g = scene.add({ kind: 'group', layer: 'ink', parent: PAGE_A, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} } as never);
    const site = insertSite(scene as never, { into: g, at: { x: -500, y: 10 } });
    expect(site.parent).toBe(g);
    const placed = site.local({ x: -500, y: 10, width: 20, height: 10 }) as { x: number };
    expect(placed.x + 20).toBeGreaterThan(0);
  });

  it('leaves it where it is with the pasteboard on', () => {
    const { scene } = pagedScene({ pasteboard: true });
    const g = scene.add({ kind: 'group', layer: 'ink', parent: PAGE_A, pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} } as never);
    const site = insertSite(scene as never, { into: g, at: { x: -500, y: 10 } });
    expect((site.local({ x: -500, y: 10, width: 20, height: 10 }) as { x: number }).x).toBe(-500);
  });
});
