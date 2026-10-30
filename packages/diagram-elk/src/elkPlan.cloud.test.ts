import { describe, expect, it } from 'vitest';
import type { Graph, LayoutFn, LayoutPlan } from '@weasel-js/diagram/layout';
import { diagramScene } from '../../diagram/src/fromData';
import { CLOUD } from '../../diagram/src/layered/cloudFixture';
import { wiresThroughBoxes } from '../../diagram/src/layered/overlaps';
import { elkPlan } from './elkPlan';

/** `CLOUD`'s graph as `diagramScene` lays it out, laid out by ELK. */
async function cloudPlan() {
  let graph: Graph | undefined;
  const capture = Object.assign(() => new Map(), {
    plan: (g: Graph): LayoutPlan => ((graph = g), { moves: new Map() }),
  }) as unknown as LayoutFn;
  diagramScene(CLOUD, { layout: capture });
  return { graph: graph!, plan: await elkPlan(graph!) };
}

describe('elkPlan on a grouped cloud architecture', () => {
  it('runs every wire inside the drawing', async () => {
    const { graph, plan } = await cloudPlan();
    const xs = [...plan.groups.values()].flatMap((b) => [b.x, b.x + b.width]);
    for (const n of graph.nodes) {
      const at = plan.moves.get(n.id) ?? n.bounds;
      xs.push(at.x, at.x + n.bounds.width);
    }
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    expect(plan.routes.size).toBeGreaterThan(40);
    for (const [id, route] of plan.routes) {
      for (const p of route) {
        expect(p.x, id).toBeGreaterThanOrEqual(lo - 1);
        expect(p.x, id).toBeLessThanOrEqual(hi + 1);
      }
    }
  });

  it('draws no wire through a box it does not join', async () => {
    const { plan } = await cloudPlan();
    const replay = Object.assign(() => plan.moves, { plan: (): LayoutPlan => plan }) as unknown as LayoutFn;
    expect(wiresThroughBoxes(CLOUD, diagramScene(CLOUD, { layout: replay, router: 'orthogonal' }))).toEqual([]);
  });
});
