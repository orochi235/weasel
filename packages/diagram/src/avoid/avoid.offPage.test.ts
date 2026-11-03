import { describe, expect, it } from 'vitest';
import { derivedDepOf } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH } from '../edge';
import { edgeLabelSpec } from '../edgeLabel';
import type { DiagramEdge } from '../edgeTrait';
import { installLabelPlacement } from '../labels/install';
import { installOffPageMarkers } from '../offPage/install';
import { dragTo, pagedScene, worldBox, type PagedScene } from '../offPage/pagedFixture';
import { entersBox } from './avoidFixture';
import { installAvoidRouting } from './install';

const LOOK = { style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: '#111111', background: '#ffffff' };

const box = (id: string, x: number, y: number, width = 40, height = 30) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string, extra: Partial<DiagramEdge>) => ({
  id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {}, ...extra } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

/** The points connector `id` draws through. */
function drawn(scene: PagedScene, id: string): Vec2[] {
  const coords = [...((derivedDepOf(scene, id as never)?.path as { coords?: Float32Array } | null)?.coords ?? [])];
  return coords.flatMap((v, i) => (i % 2 === 0 ? [{ x: v, y: coords[i + 1]! }] : []));
}

describe('avoid routing around a split connector’s label', () => {
  it('routes another connector around the label standing on the split connector’s first stub', () => {
    // `ab` leaves a's east port at (60, 35); `gh` runs straight down x = 72, across where ab's label sits on its stub.
    const scene = pagedScene([
      box('a', 20, 20), box('b', 120, 20), box('g', 57, -60, 30, 20), box('h', 57, 70, 30, 20),
      connector('ab', 'a', 'b', { from: { port: 'e' }, to: { port: 'w' }, router: 'avoid', route: [] }),
      connector('gh', 'g', 'h', { from: { port: 's' }, to: { port: 'n' }, router: 'avoid', route: [] }),
      edgeLabelSpec('ab', 'note', { layer: 'main', label: { at: 'mid', offset: 9 } }),
    ]);
    installOffPageMarkers(scene, { look: () => LOOK });
    installAvoidRouting(scene);
    installLabelPlacement(scene);

    dragTo(scene, 'b', 300);
    expect((scene.get('ab' as never)!.data as { diagram: DiagramEdge }).diagram.offPage).toBeDefined();
    const label = worldBox(scene, 'ab/label');
    expect(label.x).toBeLessThan(72);
    expect(label.x + label.width).toBeGreaterThan(72);
    const points = drawn(scene, 'gh');
    expect(points.length).toBeGreaterThan(2);
    points.slice(1).forEach((p, i) => expect(entersBox(points[i]!, p, label)).toBe(false));
  });
});
