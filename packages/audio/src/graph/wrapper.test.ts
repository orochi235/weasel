import { describe, expect, it } from 'vitest';
import { createFakeAudioContext, type FakeNode } from '../testing/fakeAudioContext';
import { harness, testNode } from '../testing/graphHarness';
import { createFileSourceNode } from './sources';
import { createWrapper, tapWrapper } from './wrapper';

const timers = { setTimer: () => 0, clearTimer: () => {} };

describe('tapWrapper', () => {
  it('a disposed tap leaves the wrapper', () => {
    const ctx = createFakeAudioContext();
    const w = createWrapper(ctx as never, timers, 'a', testNode(ctx).def);
    const gone: FakeNode[] = [];
    for (let i = 0; i < 3; i += 1) {
      const t = tapWrapper(ctx as never, w);
      t.dispose();
      t.dispose();
      gone.push(t.node as never);
    }
    const live = tapWrapper(ctx as never, w);
    expect(w.taps.size).toBe(1);
    expect([...w.taps][0]).toBe(live);
    for (const n of gone) expect(n.connectedFrom).toHaveLength(0);
  });
});

describe('a source that ends on its own', () => {
  it('starts again on a start inside the stop fade', () => {
    const { ctx, graph } = harness();
    const file = createFileSourceNode(ctx as never, { buffer: ctx.createBuffer(1, 100, 100) as never, loop: false });
    graph.add('f', file);
    graph.connect('f', { output: true });
    graph.start();
    ctx._advance(1500);
    expect(ctx._sources[0].ended).toBe(true);
    graph.stop();
    graph.start();
    expect(ctx._sources).toHaveLength(2);
  });
});
