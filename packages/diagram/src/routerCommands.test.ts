import { describe, expect, it } from 'vitest';
import { createScene, type ImmediateInvoker, type RectPose } from '@weasel-js/core';
import { installAvoidRouting } from './avoid/install';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from './edge';
import type { DiagramEdge } from './edgeTrait';
import { sceneParticipants } from './portLayer';
import { createSetRouterAction, SET_ROUTER_ACTION_IDS } from './routerCommands';

const box = (id: string, x: number, y: number) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width: 100, height: 60 }, data: { diagram: {} } });

function load(router: string) {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [
      box('a', 0, 0), box('b', 400, 0), box('wall', 200, 0),
      {
        id: 'ab' as never, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {}, router } }, dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH,
      },
    ] as never,
  });
  installAvoidRouting(scene);
  const opts = { participants: sceneParticipants<RectPose>(scene as never), selected: () => ['ab'] };
  const run = (key: keyof typeof SET_ROUTER_ACTION_IDS) =>
    (createSetRouterAction(key, opts).invoker as ImmediateInvoker).run({ scene } as never, undefined);
  const edge = () => (scene.get('ab' as never)!.data as { diagram: DiagramEdge }).diagram;
  return { scene, opts, run, edge };
}

describe('the router commands', () => {
  it('put the selected connector on Around shapes and route it, in one entry', () => {
    const { scene, run, edge } = load('orthogonal');
    run('avoid');
    expect(edge().router).toBe('avoid');
    expect(edge().route!.length).toBeGreaterThan(0);
    expect(scene.historyEntries()).toHaveLength(1);
    scene.undo();
    expect(edge()).toEqual({ from: {}, to: {}, router: 'orthogonal' });
  });

  it('drop the stored route when the connector leaves Around shapes', () => {
    const { run, edge } = load('orthogonal');
    run('avoid');
    run('bezier');
    expect(edge()).toEqual({ from: {}, to: {}, router: 'bezier' });
  });

  it('are active while every selected connector is on that router, and off with none selected', () => {
    const { opts } = load('orthogonal');
    expect(createSetRouterAction('orthogonal', opts).active!()).toBe(true);
    expect(createSetRouterAction('avoid', opts).active!()).toBe(false);
    expect(createSetRouterAction('avoid', { ...opts, selected: () => [] }).enabled!({} as never)).not.toBe(true);
  });
});
