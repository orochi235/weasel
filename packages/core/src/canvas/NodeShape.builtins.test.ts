import { describe, expect, it, vi } from 'vitest';

// Each test imports NodeShape's whole graph cold, which takes seconds on a loaded fleet node.
const COLD_IMPORT_MS = 30_000;

describe('built-in shape painters', () => {
  it('are in place, ahead of a consumer painter registered before anything was read', async () => {
    vi.resetModules();
    const shapes = await import('./NodeShape');
    const mine = { id: 'mine', matches: () => false, paint: () => [] } as never;
    const dispose = shapes.registerNodeShape(mine);
    const order = shapes.getNodeShapes();
    expect(order.length).toBeGreaterThan(1);
    expect(order[order.length - 1]).toBe(mine);
    dispose();
  }, COLD_IMPORT_MS);

  it('lets a high-priority painter in ahead of them', async () => {
    vi.resetModules();
    const shapes = await import('./NodeShape');
    const mine = { id: 'mine', matches: () => true, paint: () => [] } as never;
    const dispose = shapes.registerNodeShape(mine, { priority: 'high' });
    expect(shapes.getNodeShapes()[0]).toBe(mine);
    expect(shapes.findNodeShape({ id: 'n', kind: 'leaf', layer: 'l', pose: {}, data: {} } as never)).toBe(mine);
    dispose();
  }, COLD_IMPORT_MS);
});
