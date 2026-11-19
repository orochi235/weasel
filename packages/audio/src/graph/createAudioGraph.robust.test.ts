import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from '../testing/fakeAudioContext';
import { harness, testNode } from '../testing/graphHarness';
import { createAudioGraph } from './createAudioGraph';
import { createOscillatorNode } from './sources';

describe('createAudioGraph options', () => {
  it('refuses a fadeMs that is not finite or is negative', () => {
    const ctx = createFakeAudioContext();
    for (const fadeMs of [NaN, Infinity, -Infinity, -1]) {
      expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs })).toThrow(RangeError);
    }
    expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs: 0 })).not.toThrow();
  });
});

const failing = (ctx: Parameters<typeof testNode>[0]) => {
  const n = testNode(ctx, [], true);
  n.start.mockImplementation(() => { throw new Error('boom'); });
  return n;
};

describe('createAudioGraph sources whose start throws', () => {
  it('an oscillator refuses a non-finite frequency when it is built', () => {
    const ctx = createFakeAudioContext();
    for (const frequency of [NaN, Infinity]) {
      expect(() => createOscillatorNode(ctx as never, { frequency })).toThrow(RangeError);
    }
  });

  it('start starts every other source, then rethrows, and the failed one is not marked running', () => {
    const { ctx, graph } = harness();
    const bad = failing(ctx);
    const good = testNode(ctx, [], true);
    graph.add('bad', bad.def);
    graph.add('good', good.def);
    expect(() => graph.start()).toThrow('boom');
    expect(good.start).toHaveBeenCalledTimes(1);
    expect(graph.isPlaying()).toBe(true);
    graph.stop();
    bad.start.mockImplementation(() => {});
    graph.start();
    expect(bad.start).toHaveBeenCalledTimes(2);
    expect(bad.stop).not.toHaveBeenCalled();
  });

  it('a replace whose new source throws on start still fades the old def out', async () => {
    const { ctx, graph, settle } = harness();
    const old = testNode(ctx, [], true);
    graph.add('s', old.def);
    graph.start();
    expect(() => graph.replace('s', failing(ctx).def)).toThrow('boom');
    settle();
    expect(old.dispose).toHaveBeenCalledTimes(1);
    await expect(graph.settled()).resolves.toBeUndefined();
  });

  it('apply goes on past a source whose start throws, then rethrows', () => {
    const { ctx, graph } = harness();
    graph.start();
    expect(() => graph.apply([
      { kind: 'add', id: 'bad', def: failing(ctx).def },
      { kind: 'connect', from: 'bad', to: { output: true } },
      { kind: 'add', id: 'next', def: testNode(ctx, [], true).def },
    ])).toThrow('boom');
    expect(graph.ids()).toEqual(['bad', 'next']);
  });
});

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createAudioGraph settling on a connection', () => {
  it('settled waits for a new connection to finish fading in', async () => {
    const { ctx, graph, step } = harness();
    graph.add('a', testNode(ctx, []).def);
    graph.connect('a', { output: true });
    let done = false;
    void graph.settled().then(() => { done = true; });
    await tick();
    expect(done).toBe(false);
    step();
    await tick();
    expect(done).toBe(true);
  });

  it('a connection closed while it fades in settles once the close lands', async () => {
    const { ctx, graph, settle } = harness();
    graph.add('a', testNode(ctx, []).def);
    graph.connect('a', { output: true });
    graph.disconnect('a', { output: true });
    settle();
    await expect(graph.settled()).resolves.toBeUndefined();
  });
});
