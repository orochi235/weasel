/** Counterexamples `router.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@weasel-js/core/math';
import { edgeBetween, entersBox, rectShape } from './avoidFixture';
import { createAvoidRouter, type AvoidRoutes } from './router';
import { inflate, type AvoidEdge, type AvoidInput, type AvoidObstacle } from './types';

function stored(input: AvoidInput, routes: AvoidRoutes): AvoidInput {
  return {
    obstacles: input.obstacles,
    edges: input.edges.map((e) => {
      const r = routes.get(e.id);
      if (r === undefined) return e;
      const { route: _r, ...rest } = e;
      return r === null ? rest : { ...rest, route: r };
    }),
  };
}

const label = (id: string) => ({ label: { id: `${id}/label`, placement: { at: 'mid' as const, offset: 9 }, size: { width: 40, height: 14 } } });

/** Whether `full` comes within the default clearance, 10, of `box` past its first and last segments. */
const grazes = (full: readonly Vec2[], box: AvoidObstacle['box']) =>
  full.slice(2, -1).some((p, i) => entersBox(full[i + 1]!, p, inflate(box, 10 - 1e-6)));

describe('createAvoidRouter, shrunk', () => {
  it('spreads two runs sharing a channel without taking either into a shape\'s clearance', () => {
    const s1 = rectShape('s1', 220, 6, 50, 40);
    const s3 = rectShape('s3', 1, 260, 100, 60);
    const routes = createAvoidRouter().update({
      obstacles: [s1, s3],
      edges: [edgeBetween('e0', s1, s3, 'w', 'w'), edgeBetween('e1', s1, s3, 'w', 'w', [{ x: -20, y: -20 }])],
    });
    for (const id of ['e0', 'e1']) {
      const full = [{ x: 220, y: 26 }, ...routes.get(id)!, { x: 1, y: 290 }];
      expect(grazes(full, s3.box), JSON.stringify(full)).toBe(false);
    }
  });

  it('routes a scene moved by less than a hash cell the same, moved', () => {
    const shapes = (dy: number) => [
      rectShape('s6', 1, 362 + dy, 40, 70), rectShape('s0', 39, 80 + dy, 80, 60), rectShape('s1', 181, 46 + dy, 60, 70),
      rectShape('s3', 70, 183 + dy, 70, 50), rectShape('s7', 180, 429 + dy, 100, 40),
    ];
    const at = (dy: number) => {
      const [s6, s0, , s3, s7] = shapes(dy);
      return createAvoidRouter().update({
        obstacles: shapes(dy), edges: [edgeBetween('e0', s7!, s3!, 'e', 's'), edgeBetween('e1', s6!, s0!, 'e', 's')],
      });
    };
    const [here, there] = [at(0), at(-20)];
    for (const id of ['e0', 'e1']) expect(there.get(id)).toEqual(here.get(id)!.map((p) => ({ x: p.x, y: p.y - 20 })));
  });

  it('reroutes a connector whose route before spreading meets a shape that moved, rather than spreading it back there', () => {
    const shapes = (s5: AvoidObstacle) => [
      rectShape('s4', 182, 182, 60, 50), s5, rectShape('s1', 182, 5, 70, 40), rectShape('s3', 22, 191, 50, 70),
      rectShape('s0', 80, 11, 60, 70), rectShape('s2', 430, 25, 70, 70),
    ];
    const sceneWith = (s5: AvoidObstacle, routedFrom?: AvoidInput): AvoidInput => {
      const [s4, , s1, s3, s0, s2] = shapes(s5) as [AvoidObstacle, AvoidObstacle, AvoidObstacle, AvoidObstacle, AvoidObstacle, AvoidObstacle];
      const edges: AvoidEdge[] = [
        edgeBetween('e0', s3, s5, 'n', 'ns'),
        edgeBetween('e1', s2, s4, 's', 'nesw', [{ x: -20, y: 340 }]),
        { ...edgeBetween('e2', s2, s0, 'sw', 'nesw'), ...label('e2') },
        edgeBetween('e3', s1, s0, 'ew', 'n', [{ x: -20, y: 520 }, { x: 340, y: 520 }]),
        { ...edgeBetween('e4', s5, s3, 'nesw', 'n', [{ x: 520, y: -20 }, { x: 160, y: 520 }]), ...label('e4') },
      ];
      return {
        obstacles: shapes(s5),
        edges: routedFrom === undefined ? edges : edges.map((e, i) => ({ ...e, ...(routedFrom.edges[i]!.route ? { route: routedFrom.edges[i]!.route } : {}) })),
      };
    };
    const router = createAvoidRouter();
    const before = sceneWith(rectShape('s5', 387, 274, 80, 30));
    const routed = stored(before, router.update(before));
    const moved = rectShape('s5', 360, 180, 80, 30);
    const frame = sceneWith(moved, routed);
    router.update(frame, { preview: true });
    const after = stored(frame, router.update(frame));
    const e1 = after.edges[1]!;
    const full = [e1.from.ports[0]!.point, ...e1.route!, { x: 182, y: 207 }];
    expect(grazes(full, moved.box), JSON.stringify(full)).toBe(false);
  });

  it('answers nothing again for a connector it found no path for, while nothing it depends on changes', () => {
    const s4 = rectShape('s4', 207, 184, 60, 30);
    const s7 = rectShape('s7', 280, 450, 40, 50);
    const region: AvoidObstacle = { id: 'region', kind: 'region', box: { x: 75, y: -13, width: 440, height: 348 }, members: new Set(['s5']) };
    const input: AvoidInput = { obstacles: [s4, s7, region], edges: [edgeBetween('e0', s4, s7, 'w', 'w')] };
    const router = createAvoidRouter();
    const first = router.update(input);
    expect(first.get('e0')).toBeNull();
    expect([...router.update(stored(input, first)).keys()]).toEqual([]);
  });

  it('routes a connector whose waypoint another connector\'s label covered only while that one waited to be routed', () => {
    const [s7, s2, s4, s1] = [
      rectShape('s7', 240, 420, 80, 40), rectShape('s2', 410, 36, 90, 70), rectShape('s4', 237, 277, 80, 40), rectShape('s1', 250, 67, 60, 40),
    ];
    const routes = createAvoidRouter().update({
      obstacles: [s7, s2, s4, rectShape('s3', 70, 225, 70, 30), rectShape('s6', 4, 433, 40, 60), s1, rectShape('s5', 383, 212, 70, 60)],
      edges: [
        edgeBetween('e0', s4, s7, 'e', 'e', [{ x: 340, y: 160 }]),
        { ...edgeBetween('e1', s4, s2, 'nw', 'w', [{ x: -20, y: -20 }]), ...label('e1') },
        edgeBetween('e2', s1, s7, 's', 'ew'),
        edgeBetween('e3', s7, s2, 'w', 'w'),
      ],
    });
    expect(routes.get('e0')).not.toBeNull();
  });
});
