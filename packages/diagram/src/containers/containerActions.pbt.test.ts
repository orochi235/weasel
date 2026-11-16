/**
 * Stateful property test of the container actions, and the router commands on the connectors between what the lanes
 * hold, among lock and unlock edits: Release members and each router command over any selection, a lane boundary
 * drag on any lane, and a click on any lane affordance. Release and the router commands record one entry exactly when
 * their `enabled` says yes and never throw; a boundary is offered, and its drag taken, exactly where the resize writes
 * nothing locked; a click adds a lane in one entry on the add-lane button and passes on a boundary.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  commitOps, createScene, type ActionDeps, type ImmediateInvoker, type InvocationCtx, type NodeId, type OngoingInvoker,
  type RectPose,
} from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { sceneParticipants } from '../portLayer';
import { createSetRouterAction, SET_ROUTER_ACTION_IDS } from '../routerCommands';
import { CONTAINER_STENCILS, containerBuild } from './containerStencils';
import { createAddLaneAction, createLaneResizeAction, createReleaseMembersAction } from './containerActions';
import { createLaneAffordance, type LaneScratch } from './laneBoundaryLayer';
import { runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 150;

function pool() {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
  let n = 0;
  const built = containerBuild(CONTAINER_STENCILS[1]!, { x: 0, y: 0, width: 480, height: 240 }, { layer: 'main', newId: () => `n${n++}` });
  commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
  const lanes = scene.childrenOf(built.id as NodeId).filter((id) => !id.endsWith('/title'));
  for (const [k, lane] of lanes.entries()) {
    scene.add({ id: `m${k}` as NodeId, kind: 'mark', layer: 'main', parent: lane, pose: { x: 10, y: 10, width: 20, height: 10 }, data: {} });
  }
  for (const [k, router] of ['straight', 'orthogonal'].entries()) {
    scene.add({
      id: `e${k}` as NodeId, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, router } }, dependsOn: ['m0' as NodeId, 'm1' as NodeId], derivePath: EDGE_DERIVE_PATH,
    });
  }
  return { scene, poolId: built.id, lanes: lanes as string[] };
}

type Op =
  | { kind: 'lock'; at: number; locked: boolean }
  | { kind: 'release'; picks: number[] }
  | { kind: 'resize'; lane: number }
  | { kind: 'router'; router: Router; picks: number[] }
  | { kind: 'click'; at: number };

type Router = keyof typeof SET_ROUTER_ACTION_IDS;
const ROUTERS = Object.keys(SET_ROUTER_ACTION_IDS) as Router[];

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('lock' as const), at: fc.nat(), locked: fc.boolean() }),
  fc.record({ kind: fc.constant('release' as const), picks: fc.array(fc.nat(), { maxLength: 3 }) }),
  fc.record({ kind: fc.constant('resize' as const), lane: fc.nat() }),
  fc.record({ kind: fc.constant('router' as const), router: fc.constantFrom(...ROUTERS), picks: fc.array(fc.nat(), { maxLength: 3 }) }),
  fc.record({ kind: fc.constant('click' as const), at: fc.nat() }),
);

describe('the container actions, among locks', () => {
  it('record an entry exactly when enabled, and take a boundary drag exactly where it is offered', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(op, { minLength: 1, maxLength: 12 }), (list) => {
      const h = pool();
      const ids = () => [...h.scene.renderOrderNodes()].map((node) => node.id as string);
      for (const o of list) {
        if (o.kind === 'lock') {
          const all = ids();
          if (all.length > 0) h.scene.setLocked(all[o.at % all.length] as NodeId, o.locked);
          continue;
        }
        if (o.kind === 'release') {
          const all = ids();
          const picked = all.length === 0 ? [] : o.picks.map((p) => all[p % all.length]!);
          const action = createReleaseMembersAction({ scene: h.scene as never, selected: () => picked });
          const enabled = action.enabled!({} as never) === true;
          const before = h.scene.historyIndex();
          (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, undefined);
          expect(h.scene.historyIndex() - before).toBe(enabled ? 1 : 0);
          t.count(enabled ? 'released' : 'release off');
          continue;
        }
        if (o.kind === 'router') {
          const all = ids();
          const picked = all.length === 0 ? [] : o.picks.map((p) => all[p % all.length]!);
          const action = createSetRouterAction(o.router, { participants: sceneParticipants(h.scene as never), selected: () => picked });
          const enabled = action.enabled!({ scene: h.scene } as never) === true;
          const before = h.scene.historyIndex();
          expect(() => (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, undefined)).not.toThrow();
          expect(h.scene.historyIndex() - before).toBe(enabled ? 1 : 0);
          t.count(enabled ? 'routed' : 'route off');
          continue;
        }
        if (o.kind === 'click') {
          const regions = createLaneAffordance(h.scene as never).regions({} as never);
          if (regions.length === 0) continue;
          const region = regions[o.at % regions.length]!;
          const payload = (region.bind!() as { initialScratch: LaneScratch }).initialScratch;
          const button = payload.laneId === undefined;
          const before = h.scene.historyIndex();
          const ran = (createAddLaneAction({ scene: h.scene as never }).invoker as ImmediateInvoker)
            .run({ scene: h.scene } as never, { world: { x: 0, y: 0 }, affordance: { payload } } as never);
          expect(ran === 'pass').toBe(!button);
          expect(h.scene.historyIndex() - before).toBe(button ? 1 : 0);
          t.count(button ? 'lane added' : 'click passed');
          continue;
        }
        if (h.scene.get(h.poolId as NodeId) === undefined || h.scene.isLocked(h.poolId as NodeId)) continue;
        const laneId = h.lanes[o.lane % h.lanes.length]!;
        if (h.scene.get(laneId as NodeId) === undefined) continue;
        const offered = createLaneAffordance(h.scene as never).regions({} as never).some((r) => r.id === `${laneId}:boundary`);
        const payload: LaneScratch = { targetId: h.poolId, poolId: h.poolId, laneId };
        const at = { x: 200, y: 120 };
        const ctx = {
          world: at, screen: at, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
          deps: { scene: h.scene } as unknown as ActionDeps,
          drag: { start: at, current: at, delta: { x: 0, y: 0 }, affordance: { kind: 'layer:diagram-lanes', payload } },
        } as unknown as InvocationCtx;
        const handle = (createLaneResizeAction({ scene: h.scene as never }).invoker as OngoingInvoker).start(ctx, undefined);
        expect(handle?.onEnd !== undefined).toBe(offered);
        if (handle?.onEnd === undefined) continue;
        const to = { ...ctx, world: { x: 200, y: 160 } } as InvocationCtx;
        handle.onMove?.(to);
        expect(() => handle.onEnd!(to, 'commit')).not.toThrow();
        t.count('resized');
      }
    }), runs(RUNS));
    for (const k of ['released', 'release off', 'resized', 'routed', 'route off', 'lane added', 'click passed']) t.atLeast(k, RUNS / 10);
  }, timeoutFor(RUNS, 20));
});
