import { describe, it, expect } from 'vitest';
import {
  moveAction,
  type InvocationCtx,
  type ReflowTransition,
  type NodeId,
} from '@weasel-js/core';
import {
  type P,
  type StubScene,
  makeScene,
  makeCtx,
} from './testing/moveLayoutStubs';

describe('moveAction with a reflow transition', () => {
  /** Records what the action asks of the transition, and when. */
  function recorder(scene: StubScene) {
    const calls: string[] = [];
    const reflow: ReflowTransition<unknown> = {
      glide: (id, pose) => { calls.push(`glide:${id}:${(pose as P).x}`); },
      settle: (id, opts) => {
        const from = opts?.from === undefined ? '' : `:from${(opts.from as P).x}`;
        calls.push(`settle:${id}:after${scene.appliedBatches.length}${from}`);
      },
      stop: (id) => { calls.push(`stop:${id}`); },
      poseOf: () => undefined,
    };
    return { calls, reflow };
  }
  const twoCells = () => makeScene(
    {
      C: { x: 0, y: 0, width: 100, height: 100 },
      a: { x: 0, y: 0, width: 50, height: 100 },
      b: { x: 50, y: 0, width: 50, height: 100 },
    },
    { C: null, a: 'C', b: 'C' },
    { C: ['a', 'b'] },
    ['C'],
  );
  const withReflow = (ctx: InvocationCtx, reflow: ReflowTransition<unknown>): InvocationCtx => {
    ctx.deps.layout!.reflow = reflow;
    return ctx;
  };
  const into = { start: { x: 25, y: 50 }, current: { x: 75, y: 50 }, delta: { x: 50, y: 0 } };
  const outside = { start: { x: 25, y: 50 }, current: { x: 400, y: 50 }, delta: { x: 375, y: 0 } };
  const start = (scene: StubScene, reflow: ReflowTransition<unknown>) => {
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    return invoker.start(withReflow(makeCtx(scene, ['a']), reflow));
  };

  it('glides a displaced sibling instead of previewing it, and publishes nothing for it', () => {
    const scene = twoCells();
    const { calls, reflow } = recorder(scene);
    const handle = start(scene, reflow);
    expect(calls).toEqual([]);
    handle.onMove!(makeCtx(scene, ['a'], into));
    expect(calls).toEqual(['glide:b:0']);
    expect([...(handle.previewIds!() as Iterable<string>)]).not.toContain('b');
    expect(scene.overrides.has('b' as NodeId)).toBe(false);
  });

  it('settles a sibling that stops reflowing mid-drag', () => {
    const scene = twoCells();
    const { calls, reflow } = recorder(scene);
    const handle = start(scene, reflow);
    handle.onMove!(makeCtx(scene, ['a'], into));
    handle.onMove!(makeCtx(scene, ['a'], outside));
    expect(calls).toEqual(['glide:b:0', 'settle:b:after0']);
    handle.onEnd!(makeCtx(scene, ['a'], outside), 'cancel');
    expect(calls.slice(2)).toEqual(['settle:a:after0:from375']);
  });

  it('settles every glide after the drop commits, and on a cancel — the dragged child from its release', () => {
    const committed = twoCells();
    const c = recorder(committed);
    const h1 = start(committed, c.reflow);
    h1.onMove!(makeCtx(committed, ['a'], into));
    h1.onEnd!(makeCtx(committed, ['a'], into), 'commit');
    expect(c.calls.slice(-2)).toEqual(['settle:b:after1', 'settle:a:after1:from50']);

    const canceled = twoCells();
    const k = recorder(canceled);
    const h2 = start(canceled, k.reflow);
    h2.onMove!(makeCtx(canceled, ['a'], into));
    h2.onEnd!(makeCtx(canceled, ['a'], into), 'cancel');
    expect(k.calls.slice(-2)).toEqual(['settle:b:after0', 'settle:a:after0:from50']);
  });
});
