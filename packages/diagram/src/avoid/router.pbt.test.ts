/**
 * The obstacle-avoiding router on random scenes of shapes on a jittered grid, connectors glued to a shape or to some
 * of its ports, and waypoints in the gutters between shapes. Every route it answers leaves and arrives along its
 * ports and passes its waypoints (so the `avoid` router draws it rather than falling back), runs along the axes,
 * never enters a shape, and keeps its clearance from every shape but beside its own ports. An unchanged scene
 * reroutes nothing, whether routed or seeded, and a scene moved whole routes the same, moved.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Vec2 } from '@weasel-js/core/math';
import { runs, samePointsWithin, tally, timeoutFor } from '../pbt.fixture';
import { createAvoidRouter } from './router';
import { build, checkRoutes, scene, sceneSpec, stored } from './scenes.fixture';
import type { AvoidInput } from './types';

const RUNS = 60;

describe('createAvoidRouter', () => {
  it('routes every connector along the axes, fitting its ports and waypoints, clear of every shape', () => {
    const seen = tally();
    fc.assert(fc.property(scene, (input) => {
      checkRoutes(input, createAvoidRouter().update(input), seen);
      if (input.obstacles.some((o) => o.kind === 'region')) seen.count('region');
    }), runs(RUNS));
    seen.atLeast('routed', RUNS);
    seen.atLeast('bent', RUNS / 2);
    seen.atLeast('region', RUNS / 4);
  }, timeoutFor(RUNS, 100));

  it('previews a dragged shape with routes that fit, then commits the frame', () => {
    const seen = tally();
    fc.assert(fc.property(sceneSpec.chain((spec) => fc.tuple(fc.constant(spec), fc.nat(spec.shapes.length - 1),
      fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }))), ([spec, k, jx, jy]) => {
      const input = build(spec);
      const router = createAvoidRouter();
      const routed = stored(input, router.update(input));
      // A preview routes against the obstacles committed, so the frame adds none.
      const hadRegion = input.obstacles.some((o) => o.kind === 'region');
      const frame = build({ ...spec, shapes: spec.shapes.map((s, i) => (i === k ? { ...s, jx, jy } : s)) }, hadRegion);
      const edges = frame.edges.map((e, i) => ({ ...e, ...(routed.edges[i]!.route ? { route: routed.edges[i]!.route } : {}) }));
      const preview = router.update({ ...frame, edges }, { preview: true });
      if (preview.size > 0) seen.count('previewed');
      checkRoutes(frame, preview, seen, false);
      checkRoutes(frame, router.update({ ...frame, edges }), seen, false);
    }), runs(RUNS));
    seen.atLeast('previewed', RUNS / 2);
  }, timeoutFor(RUNS, 200));

  it('reroutes nothing in a scene that has not changed, routed or seeded', () => {
    fc.assert(fc.property(scene, (input) => {
      const router = createAvoidRouter();
      const routed = stored(input, router.update(input));
      expect([...router.update(routed).keys()]).toEqual([]);
      // A seeded router has never searched for a connector holding no route, so it does, and spreads any it finds.
      const seeded = createAvoidRouter();
      seeded.seed(routed);
      const again = seeded.update(routed);
      if (routed.edges.every((e) => e.route !== undefined)) expect([...again.keys()]).toEqual([]);
      expect([...seeded.update(stored(routed, again)).keys()]).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 200));

  it('routes a scene moved whole the same, moved', () => {
    const dist = fc.integer({ min: -40, max: 40 }).map((n) => n * 10);
    // A label stands on its connector's first route, a slanted line until routed, at an irrational point a
    // translation moves by an ulp or so; equal-cost routes tie, and that ulp breaks the tie.
    const unlabeled = sceneSpec.map((spec) => build({ ...spec, edges: spec.edges.map((e) => ({ ...e, label: false })) }));
    fc.assert(fc.property(unlabeled, dist, dist, (input, dx, dy) => {
      const at = (p: Vec2) => ({ x: p.x + dx, y: p.y + dy });
      const moved: AvoidInput = {
        obstacles: input.obstacles.map((o) => ({ ...o, box: { ...o.box, ...at(o.box) } })),
        edges: input.edges.map((e) => ({
          ...e,
          from: { ...e.from, ports: e.from.ports.map((p) => ({ ...p, point: at(p.point) })) },
          to: { ...e.to, ports: e.to.ports.map((p) => ({ ...p, point: at(p.point) })) },
          ...(e.waypoints ? { waypoints: e.waypoints.map(at) } : {}),
        })),
      };
      const routes = createAvoidRouter().update(input);
      const shifted = createAvoidRouter().update(moved);
      // A bundle spread in thirds lands an ulp apart.
      for (const [id, r] of routes) {
        const s = shifted.get(id);
        if (r === null || s == null) expect(s).toBe(r);
        else expect(samePointsWithin(s, r.map(at), 1e-12)).toBe(true);
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 200));
});
