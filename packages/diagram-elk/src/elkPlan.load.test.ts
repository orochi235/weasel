import { describe, expect, it, vi } from 'vitest';
import type { Graph } from '@weasel-js/diagram/layout';

const load = vi.hoisted(() => ({ fail: true }));

vi.mock('elkjs/lib/elk.bundled.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('elkjs/lib/elk.bundled.js')>();
  if (load.fail) {
    load.fail = false;
    throw new Error('chunk failed to load');
  }
  return real;
});

const graph: Graph = {
  nodes: [{ id: 'a', bounds: { x: 0, y: 0, width: 80, height: 40 }, pinned: false }],
  edges: [],
  node: (id) => (id === 'a' ? graph.nodes[0] : undefined),
  outgoing: () => [],
  incoming: () => [],
};

describe('elkPlan loading the bundled ELK', () => {
  it('tries the import again on the next layout after one fails', async () => {
    const { elkPlan } = await import('./elkPlan');
    await expect(elkPlan(graph)).rejects.toThrow();
    vi.resetModules();
    await expect(elkPlan(graph)).resolves.toBeDefined();
  });
});
