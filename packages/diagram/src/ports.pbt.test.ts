/**
 * `portsOf` on every built-in outline at any bounds: each port is finite, sits on the outline wherever the outline
 * holds the box's center, faces a unit direction, agrees with `portsOnOutline`, and moves and turns with its node.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { pointInPolygon } from '@weasel-js/geom';
import { rotatePoint, type Vec2 } from '@weasel-js/core/math';
import { outlinePolyline, portsOnOutline } from './onOutline';
import { BPMN_OUTLINES } from './outlines/bpmn';
import { FIGURE_OUTLINES } from './outlines/figures';
import { FLOWCHART_OUTLINES } from './outlines/flowchart';
import { MODELING_OUTLINES } from './outlines/modeling';
import { NETWORK_OUTLINES } from './outlines/network';
import { PARTICIPANT_OUTLINES } from './outlines/participants';
import { STATE_OUTLINES } from './outlines/states';
import { STORAGE_OUTLINES } from './outlines/storage';
import { gridCoord, nonFinite, runs, tally, timeoutFor } from './pbt.fixture';
import { COMPASS, portsOf } from './ports';
import type { PortAnchor } from './types';

const RUNS = 300;

const OUTLINES = Object.keys({
  ...FLOWCHART_OUTLINES, ...FIGURE_OUTLINES, ...STORAGE_OUTLINES, ...NETWORK_OUTLINES, ...BPMN_OUTLINES, ...MODELING_OUTLINES,
  ...STATE_OUTLINES, ...PARTICIPANT_OUTLINES,
});

const anchor: fc.Arbitrary<PortAnchor> = fc.oneof(
  fc.constantFrom(...Object.values(COMPASS)),
  fc.record({ u: fc.double({ min: 0, max: 1, noNaN: true }), v: fc.double({ min: 0, max: 1, noNaN: true }) }),
);

const bounds = fc.record({
  x: gridCoord, y: gridCoord, width: fc.integer({ min: 1, max: 300 }), height: fc.integer({ min: 1, max: 300 }),
});

const nodeOf = (outline: string, anchors: readonly PortAnchor[]) => ({
  id: 'n', kind: 'mark' as const, data: { diagram: { outline, ports: anchors.map((at, i) => ({ id: `p${i}`, at })) } },
});

/** How far `p` is from the closed polyline `poly`. */
function distTo(poly: readonly number[], p: Vec2): number {
  let best = Infinity;
  for (let i = 0; i + 3 < poly.length; i += 2) {
    const [ax, ay, bx, by] = [poly[i]!, poly[i + 1]!, poly[i + 2]!, poly[i + 3]!];
    const [dx, dy] = [bx - ax, by - ay];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy)));
  }
  return best;
}

describe('portsOf', () => {
  it('sits each port on its outline wherever the outline holds the center, facing a unit direction', () => {
    const seen = tally();
    fc.assert(fc.property(fc.constantFrom(...OUTLINES), bounds, fc.array(anchor, { minLength: 1, maxLength: 4 }), (outline, b, anchors) => {
      const ports = portsOf(nodeOf(outline, anchors), b);
      expect(ports).toHaveLength(anchors.length);
      expect(nonFinite(ports)).toEqual([]);
      const poly = outlinePolyline(outline, b);
      const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      const holds = pointInPolygon(poly.slice(0, -2), center.x, center.y);
      ports.forEach((p, i) => {
        if (p.normal !== null) expect(Math.abs(Math.hypot(p.normal.x, p.normal.y) - 1)).toBeLessThan(1e-12);
        const a = anchors[i]!;
        if (!holds || (a.u === 0.5 && a.v === 0.5)) return;
        seen.count('on');
        expect(distTo(poly, p.point), `${outline} ${JSON.stringify({ b, a, p })}`).toBeLessThanOrEqual(1e-6 * Math.max(b.width, b.height));
      });
      expect(portsOnOutline(ports.map((p, i) => ({ ...p, point: { x: b.x + anchors[i]!.u * b.width, y: b.y + anchors[i]!.v * b.height } })), outline, b)
        .map((p) => p.point)).toEqual(ports.map((p) => p.point));
    }), runs(RUNS));
    seen.atLeast('on', RUNS);
  }, timeoutFor(RUNS, 3));

  it('moves and turns its ports with the node', () => {
    const turn = fc.oneof(fc.constantFrom(0, Math.PI / 2, Math.PI, -Math.PI / 2), fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }));
    fc.assert(fc.property(fc.constantFrom(...OUTLINES), bounds, fc.array(anchor, { minLength: 1, maxLength: 4 }), turn, gridCoord, gridCoord,
      (outline, b, anchors, rotation, dx, dy) => {
        const node = nodeOf(outline, anchors);
        const flat = portsOf(node, b);
        const moved = portsOf(node, { ...b, x: b.x + dx, y: b.y + dy, rotation });
        const [cx, cy] = [b.x + b.width / 2, b.y + b.height / 2];
        // A curved outline is flattened into float32 coordinates, which a move rounds afresh, and a ray to a
        // corner of a thin box meets its outline at a shallow angle that magnifies the rounding.
        const aspect = Math.max(b.width, b.height) / Math.min(b.width, b.height);
        const tol = 1e-6 * (1 + aspect) * Math.max(1, Math.abs(cx) + Math.abs(cy) + Math.abs(dx) + Math.abs(dy) + b.width + b.height);
        moved.forEach((p, i) => {
          const want = rotatePoint(flat[i]!.point.x, flat[i]!.point.y, cx, cy, rotation);
          expect(Math.hypot(p.point.x - (want.x + dx), p.point.y - (want.y + dy))).toBeLessThanOrEqual(tol);
          const n = flat[i]!.normal;
          if (n === null) expect(p.normal).toBeNull();
          else {
            const wn = rotatePoint(n.x, n.y, 0, 0, rotation);
            expect(Math.hypot(p.normal!.x - wn.x, p.normal!.y - wn.y)).toBeLessThan(1e-12);
          }
        });
      }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});
