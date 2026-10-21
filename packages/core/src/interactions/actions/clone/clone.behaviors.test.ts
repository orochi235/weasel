/** `cloneAction` runs its binding's behaviors: they shape the drag and decide the commit. */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import type { CloneBehavior } from '../../gestures/types';
import { cloneAction } from './action';

const MODS = { alt: true, ctrl: false, meta: false, shift: false };

function fixture(behavior: CloneBehavior<RectPose>) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  let selected: NodeId[] = [a];
  const selection = { get: () => selected, set: (ids: NodeId[]) => { selected = ids; } };
  const base = { world: { x: 0, y: 0 }, modifiers: MODS, deps: { selection, scene } };
  const at = (x: number): InvocationCtx => ({
    ...base,
    world: { x, y: 0 },
    drag: { start: { x: 0, y: 0 }, current: { x, y: 0 }, delta: { x, y: 0 } },
  }) as unknown as InvocationCtx;
  const opts = { behaviors: [behavior] } as BindingOpts;
  const start = () => (cloneAction.invoker as OngoingInvoker).start(base as unknown as InvocationCtx, opts) as OngoingHandle;
  const copies = () => [...scene.renderOrder()].filter((id) => id !== a).map((id) => scene.get(id)!.pose);
  return { scene, a, start, at, copies };
}

describe('cloneAction behaviors', () => {
  it('lands the copy where a behavior moved the drag', () => {
    const f = fixture({ onMove: () => ({ transform: { kind: 'translate', dx: 20, dy: 0 } }) });
    const handle = f.start();
    handle.onMove!(f.at(13));
    expect(handle.previewPose!(f.a)).toMatchObject({ x: 20, y: 0 });
    handle.onEnd!(f.at(13), 'commit');
    expect(f.copies()).toEqual([{ x: 20, y: 0, width: 10, height: 10 }]);
  });

  it('takes a move behavior', () => {
    const grid: CloneBehavior<RectPose> = {
      onMove(ctx, t) {
        const o = ctx.origin.get(ctx.draggedIds[0]!);
        if (t.kind !== 'translate' || !o) return;
        return { transform: { kind: 'translate', dx: Math.round((o.x + t.dx) / 10) * 10 - o.x, dy: t.dy } };
      },
    };
    const f = fixture(grid);
    const handle = f.start();
    handle.onMove!(f.at(13));
    handle.onEnd!(f.at(13), 'commit');
    expect(f.copies()).toMatchObject([{ x: 10, y: 0 }]);
  });

  it('tells a behavior the start, the end, and that the commit landed', () => {
    const calls: string[] = [];
    const f = fixture({
      onStart: (ctx) => { calls.push(`start ${ctx.draggedIds.length}`); },
      onEnd: (ctx) => { calls.push(`end ${(ctx.current.get(ctx.draggedIds[0]) as RectPose).x}`); },
      onCancel: () => { calls.push('cancel'); },
      onSettled: (_ctx, committed) => { calls.push(`settled ${committed}`); },
    });
    const handle = f.start();
    handle.onMove!(f.at(13));
    handle.onEnd!(f.at(13), 'commit');
    expect(calls).toEqual(['start 1', 'end 13', 'settled true']);
  });

  it('makes no copy when a behavior aborts', () => {
    const calls: string[] = [];
    const f = fixture({ onEnd: () => null, onSettled: (_ctx, committed) => { calls.push(`settled ${committed}`); } });
    const handle = f.start();
    handle.onMove!(f.at(13));
    handle.onEnd!(f.at(13), 'commit');
    expect(f.copies()).toEqual([]);
    expect(calls).toEqual(['settled false']);
  });

  it('commits a behavior\'s ops in place of the copies', () => {
    const f = fixture({ onEnd: () => [] });
    const handle = f.start();
    handle.onMove!(f.at(13));
    handle.onEnd!(f.at(13), 'commit');
    expect(f.copies()).toEqual([]);
  });

  it('cancels its behaviors on a canceled drag', () => {
    const calls: string[] = [];
    const f = fixture({
      onEnd: () => { calls.push('end'); },
      onCancel: () => { calls.push('cancel'); },
      onSettled: (_ctx, committed) => { calls.push(`settled ${committed}`); },
    });
    const handle = f.start();
    handle.onMove!(f.at(13));
    handle.onEnd!(f.at(13), 'cancel');
    expect(calls).toEqual(['cancel', 'settled false']);
  });
});
