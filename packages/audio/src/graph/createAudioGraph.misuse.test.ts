import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from '../testing/fakeAudioContext';
import { harness, testNode, type TestNode } from '../testing/graphHarness';
import { allPaths } from '../testing/graphWalk';
import { createAudioGraph } from './createAudioGraph';

describe('createAudioGraph misuse', () => {
  it('refuses a fade that is not a finite length of zero or more', () => {
    const ctx = createFakeAudioContext();
    ctx.state = 'running';
    for (const fadeMs of [NaN, Infinity, -Infinity, -1]) {
      expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs })).toThrow(RangeError);
    }
    expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs: 0 })).not.toThrow();
  });
});

describe('a source whose start throws', () => {
  const failOnce = (t: TestNode): void => {
    t.start.mockImplementationOnce(() => { throw new Error('boom'); });
  };

  it('leaves start undone, so the next start tries every source again', async () => {
    const { ctx, graph, settle } = harness();
    const a = testNode(ctx, [], true);
    const b = testNode(ctx, [], true);
    graph.add('a', a.def);
    graph.add('b', b.def);
    failOnce(b);
    expect(() => graph.start()).toThrow('boom');
    expect(graph.isPlaying()).toBe(false);
    expect(a.stop).toHaveBeenCalledTimes(1);
    settle();
    await graph.settled();
    graph.start();
    expect(graph.isPlaying()).toBe(true);
    expect(a.start).toHaveBeenCalledTimes(2);
    expect(b.start).toHaveBeenCalledTimes(2);
  });

  it('leaves an add while playing undone', () => {
    const { ctx, graph } = harness();
    graph.start();
    const a = testNode(ctx, [], true);
    failOnce(a);
    expect(() => graph.add('a', a.def)).toThrow('boom');
    expect(graph.has('a')).toBe(false);
    expect(a.output.connectedTo).toHaveLength(0);
    graph.add('a', a.def);
    expect(graph.has('a')).toBe(true);
    expect(a.start).toHaveBeenCalledTimes(2);
  });

  it('leaves a replace while playing undone', async () => {
    const { ctx, graph, settle } = harness();
    const a = testNode(ctx, [], true);
    graph.add('a', a.def);
    graph.connect('a', { output: true });
    graph.start();
    const b = testNode(ctx, [], true);
    failOnce(b);
    expect(() => graph.replace('a', b.def)).toThrow('boom');
    expect(b.output.connectedTo).toHaveLength(0);
    settle();
    await graph.settled();
    expect(a.stop).not.toHaveBeenCalled();
    expect(a.dispose).not.toHaveBeenCalled();
    expect(allPaths(a.output, ctx.destination)).toHaveLength(1);
  });
});
