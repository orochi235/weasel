import { describe, expect, it } from 'vitest';
import type { FakeGain, FakeNode } from '../testing/fakeAudioContext';
import { edgeCount, FADE, harness, testNode, type TestNode } from '../testing/graphHarness';
import { allPaths } from '../testing/graphWalk';
import { disposeNow } from './createAudioGraph';

/** The fader a def's output feeds: the first gain on its way to `to`. */
const outFaderOf = (n: TestNode, to: FakeNode): FakeGain => allPaths(n.output, to)[0][1] as FakeGain;

const through = (paths: FakeNode[][], n: TestNode): boolean =>
  paths.some((p) => p.includes(n.output));

const tick = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

/** a → b → output. */
function chain(opts?: { running?: boolean }) {
  const h = harness(opts);
  const a = testNode(h.ctx, []);
  const b = testNode(h.ctx);
  h.graph.add('a', a.def);
  h.graph.add('b', b.def);
  h.graph.connect('a', { node: 'b', port: 'in' });
  h.graph.connect('b', { output: true });
  h.settle();
  return { ...h, a, b };
}

describe('replace', () => {
  it('keeps connections and taps across a replace', () => {
    const { ctx, graph, settle, dest, a, b } = chain();
    const tap = graph.tap('b');
    const analyser = tap.node as never as FakeNode;
    const next = testNode(ctx);
    graph.replace('b', next.def);
    settle();
    const paths = allPaths(a.output, dest);
    expect(paths).toHaveLength(1);
    expect(through(paths, next)).toBe(true);
    expect(through(paths, b)).toBe(false);
    expect(allPaths(next.output, analyser)).toHaveLength(1);
    expect(allPaths(b.output, analyser)).toHaveLength(0);
  });

  it('crossfades rather than switches', () => {
    const { ctx, graph, dest, a, b } = chain();
    const next = testNode(ctx);
    const now = ctx.currentTime;
    graph.replace('b', next.def);
    expect(allPaths(a.output, next.inputs.in)).toHaveLength(1);
    expect(allPaths(a.output, b.inputs.in)).toHaveLength(1);
    expect(outFaderOf(b, dest).gain.ramps.at(-1)).toEqual({ value: 0, at: now + FADE / 1000 });
    expect(outFaderOf(next, dest).gain.ramps.at(-1)).toEqual({ value: 1, at: now + FADE / 1000 });
  });

  it('disposes the old def once, after the fade', () => {
    const { ctx, graph, settle, b } = chain();
    const next = testNode(ctx);
    graph.replace('b', next.def);
    expect(b.dispose).not.toHaveBeenCalled();
    settle();
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(next.dispose).not.toHaveBeenCalled();
  });

  it('replaces twice inside one fade', async () => {
    const { ctx, graph, settle, timers, dest, a, b } = chain();
    const d2 = testNode(ctx);
    const d3 = testNode(ctx);
    graph.replace('b', d2.def);
    ctx._advance(FADE / 2);
    graph.replace('b', d3.def);
    const d2Fader = outFaderOf(d2, dest).gain;
    expect(d2Fader.ramps.map((r) => r.value)).toEqual([1, 0]);
    let done = false;
    void graph.settled().then(() => { done = true; });
    ctx._advance(FADE / 2);
    const due = [...timers.values()];
    timers.clear();
    for (const f of due) f();
    await tick();
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(d2.dispose).not.toHaveBeenCalled();
    expect(done).toBe(false);
    settle();
    await tick();
    expect(done).toBe(true);
    const paths = allPaths(a.output, dest);
    expect(paths).toHaveLength(1);
    expect(through(paths, d3)).toBe(true);
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(d2.dispose).toHaveBeenCalledTimes(1);
    expect(d3.dispose).not.toHaveBeenCalled();
  });

  it('starts a replacement source when the graph is playing', () => {
    const { ctx, graph, settle } = harness();
    const old = testNode(ctx, [], true);
    graph.add('src', old.def);
    graph.connect('src', { output: true });
    graph.start();
    const next = testNode(ctx, [], true);
    graph.replace('src', next.def);
    expect(next.start).toHaveBeenCalledWith(ctx.currentTime);
    expect(old.stop).not.toHaveBeenCalled();
    settle();
    expect(old.stop).toHaveBeenCalledTimes(1);
    expect(old.dispose).toHaveBeenCalledTimes(1);
    graph.stop();
    settle();
    expect(next.stop).toHaveBeenCalledTimes(1);
  });

  it('does not start a replacement source while stopped', () => {
    const { ctx, graph, settle } = harness();
    graph.add('src', testNode(ctx, [], true).def);
    const next = testNode(ctx, [], true);
    graph.replace('src', next.def);
    settle();
    expect(next.start).not.toHaveBeenCalled();
    graph.start();
    expect(next.start).toHaveBeenCalledTimes(1);
  });

  it('closes edges into a port the new def lacks', () => {
    const { ctx, graph, settle, dest } = harness();
    const a = testNode(ctx, []);
    const b = testNode(ctx, ['in', 'side']);
    graph.add('a', a.def);
    graph.add('b', b.def);
    graph.connect('a', { node: 'b', port: 'side' });
    graph.connect('b', { output: true });
    const next = testNode(ctx, ['in']);
    graph.replace('b', next.def);
    expect(() => graph.connect('a', { node: 'b', port: 'side' })).toThrow(/"side"/);
    settle();
    expect(allPaths(a.output, dest)).toHaveLength(0);
    // a.output → its out fader → its stable out, and nothing past that.
    expect(edgeCount(a.output)).toBe(2);
  });

  it('starts a port the new def adds unconnected', () => {
    const { ctx, graph, settle, a } = chain();
    const next = testNode(ctx, ['in', 'extra']);
    graph.replace('b', next.def);
    settle();
    expect(allPaths(a.output, next.inputs.extra)).toHaveLength(0);
    graph.connect('a', { node: 'b', port: 'extra' });
    expect(allPaths(a.output, next.inputs.extra)).toHaveLength(1);
  });

  it('throws on an unknown id', () => {
    const { ctx, graph } = harness();
    expect(() => graph.replace('nope', testNode(ctx).def)).toThrow(/@weasel-js\/audio: .*"nope"/);
  });

  it('replaces at once on a suspended context', async () => {
    const { ctx, graph, timers, dest, a, b } = chain({ running: false });
    const next = testNode(ctx);
    graph.replace('b', next.def);
    expect(timers.size).toBe(0);
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(through(allPaths(a.output, dest), next)).toBe(true);
    await expect(graph.settled()).resolves.toBeUndefined();
  });

  it('settled waits for the crossfade', async () => {
    const { ctx, graph, settle } = chain();
    graph.replace('b', testNode(ctx).def);
    let done = false;
    void graph.settled().then(() => { done = true; });
    await tick();
    expect(done).toBe(false);
    settle();
    await tick();
    expect(done).toBe(true);
  });

  it('removes a node mid-crossfade, disposing each def once', () => {
    const { ctx, graph, settle, b } = chain();
    const next = testNode(ctx);
    graph.replace('b', next.def);
    graph.remove('b');
    settle();
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(next.dispose).toHaveBeenCalledTimes(1);
  });

  it('teardown mid-crossfade stops and disposes the outgoing def', () => {
    const { ctx, graph, timers } = harness();
    const old = testNode(ctx, [], true);
    graph.add('src', old.def);
    graph.connect('src', { output: true });
    graph.start();
    const next = testNode(ctx, [], true);
    graph.replace('src', next.def);
    disposeNow(graph);
    expect(timers.size).toBe(0);
    expect(old.stop).toHaveBeenCalledTimes(1);
    expect(old.dispose).toHaveBeenCalledTimes(1);
    expect(next.stop).toHaveBeenCalledTimes(1);
    expect(next.dispose).toHaveBeenCalledTimes(1);
  });
});
