import { describe, expect, it } from 'vitest';
import { translate } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import type { NodeId } from 'core/scene/types';
import { insertAction } from './action';

function start(into: string | null) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({
    kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
    copiesFromPose: () => [translate(100, 0)],
  });
  const ctx: InvocationCtx = {
    world: { x: 5, y: 10 },
    screen: { x: 5, y: 10 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      insert: { commit: () => 'n' as NodeId },
      scene,
      insertInto: { get: () => (into === 'group' ? group : into) },
    } as never,
    drag: { start: { x: 5, y: 10 }, current: { x: 5, y: 10 }, delta: { x: 0, y: 0 } },
  };
  const invoker = insertAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = invoker.start(ctx, { params: { kind: 'rect' } });
  handle.onMove!({ ...ctx, world: { x: 40, y: 30 } });
  return handle.overlay!() as { copies?: unknown[] } | null;
}

describe('insertAction preview under a container that draws copies', () => {
  it('carries the copies the shape will be drawn in', () => {
    expect(start('group')?.copies).toEqual([translate(100, 0)]);
  });

  it('carries none at the top of the tree', () => {
    expect(start(null)?.copies).toBeUndefined();
  });
});
