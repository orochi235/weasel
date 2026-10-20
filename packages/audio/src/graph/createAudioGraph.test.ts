import { describe, expect, it } from 'vitest';
import type { FakeGain, FakeNode } from '../testing/fakeAudioContext';
import { edgeCount, FADE, harness, testNode } from '../testing/graphHarness';
import { allPaths, reachesCycle } from '../testing/graphWalk';

describe('createAudioGraph wiring', () => {
  it('wires a node to the output through a fader that opens', () => {
    const { ctx, graph, dest } = harness();
    const a = testNode(ctx, []);
    graph.add('a', a.def);
    expect(allPaths(a.output, dest)).toHaveLength(0);
    const now = ctx.currentTime;
    graph.connect('a', { output: true });
    const paths = allPaths(a.output, dest);
    expect(paths).toHaveLength(1);
    const opening = (paths[0] as FakeGain[]).filter(
      (n) => n.kind === 'gain' && n.gain.ramps.at(-1)?.value === 1,
    );
    expect(opening.map((g) => g.gain.ramps.at(-1)!.at)).toContain(now + FADE / 1000);
  });

  it('connects to a named port', () => {
    const { ctx, graph } = harness();
    const a = testNode(ctx, []);
    const b = testNode(ctx, ['in', 'side']);
    graph.add('a', a.def);
    graph.add('b', b.def);
    graph.connect('a', { node: 'b', port: 'side' });
    expect(allPaths(a.output, b.inputs.side)).toHaveLength(1);
    expect(allPaths(a.output, b.inputs.in)).toHaveLength(0);
  });

  it('throws on an unknown node, port or param', () => {
    const { ctx, graph } = harness();
    graph.add('a', testNode(ctx).def);
    graph.add('b', testNode(ctx).def);
    expect(() => graph.connect('x', { output: true })).toThrow(/"x"/);
    expect(() => graph.connect('a', { node: 'y', port: 'in' })).toThrow(/"y"/);
    expect(() => graph.connect('a', { node: 'b', port: 'nope' })).toThrow(/"nope"/);
    expect(() => graph.set('a', 'nope', 1)).toThrow(/"nope"/);
    expect(() => graph.set('z', 'level', 1)).toThrow(/"z"/);
    expect(() => graph.set('a', 'toString', 1)).toThrow(/"toString"/);
    expect(() => graph.connect('a', { node: 'b', port: 'toString' })).toThrow(/@weasel-js\/audio: /);
  });

  it('throws on a duplicate live id', () => {
    const { ctx, graph } = harness();
    graph.add('a', testNode(ctx).def);
    expect(() => graph.add('a', testNode(ctx).def)).toThrow(/"a"/);
  });

  it('connect is idempotent', () => {
    const { ctx, graph, dest } = harness();
    const a = testNode(ctx, []);
    graph.add('a', a.def);
    graph.connect('a', { output: true });
    graph.connect('a', { output: true });
    expect(allPaths(a.output, dest)).toHaveLength(1);
  });

  it('disconnects with a fade, then cuts', () => {
    const { ctx, graph, dest, settle } = harness();
    const a = testNode(ctx, []);
    graph.add('a', a.def);
    graph.connect('a', { output: true });
    graph.disconnect('a', { output: true });
    expect(allPaths(a.output, dest)).toHaveLength(1);
    settle();
    expect(allPaths(a.output, dest)).toHaveLength(0);
    expect(() => graph.disconnect('a', { output: true })).not.toThrow();
    expect(() => graph.disconnect('nobody', { output: true })).not.toThrow();
  });

  it('reconnects an edge still fading out through a fresh fader', () => {
    const { ctx, graph, dest, settle } = harness();
    const a = testNode(ctx, []);
    graph.add('a', a.def);
    graph.connect('a', { output: true });
    graph.disconnect('a', { output: true });
    graph.connect('a', { output: true });
    expect(allPaths(a.output, dest)).toHaveLength(2);
    settle();
    expect(allPaths(a.output, dest)).toHaveLength(1);
  });

  it('rejects a connection that closes a cycle', () => {
    const { ctx, graph } = harness();
    const a = testNode(ctx);
    const b = testNode(ctx);
    graph.add('a', a.def);
    graph.add('b', b.def);
    graph.connect('a', { node: 'b', port: 'in' });
    const before = edgeCount(a.inputs.in);
    expect(() => graph.connect('b', { node: 'a', port: 'in' })).toThrow(/cycle/);
    expect(() => graph.connect('a', { node: 'a', port: 'in' })).toThrow(/cycle/);
    expect(reachesCycle(a.inputs.in)).toBe(false);
    expect(edgeCount(a.inputs.in)).toBe(before);
  });
});

describe('createAudioGraph lifetime', () => {
  it('removes a node by fading its edges, then disposes it once', () => {
    const { ctx, graph, dest, settle } = harness();
    const src = testNode(ctx, []);
    const a = testNode(ctx);
    graph.add('src', src.def);
    graph.add('a', a.def);
    graph.connect('src', { node: 'a', port: 'in' });
    graph.connect('a', { output: true });
    graph.remove('a');
    expect(graph.has('a')).toBe(false);
    expect(graph.ids()).toEqual(['src']);
    expect(allPaths(src.output, dest)).toHaveLength(1);
    expect(a.dispose).not.toHaveBeenCalled();
    settle();
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(allPaths(src.output, a.inputs.in)).toHaveLength(0);
    expect(allPaths(a.output, dest)).toHaveLength(0);
    expect(() => graph.remove('a')).not.toThrow();
  });

  it('re-adds an id that is still fading out', () => {
    const { ctx, graph, dest, settle } = harness();
    const old = testNode(ctx, []);
    const fresh = testNode(ctx, []);
    graph.add('a', old.def);
    graph.connect('a', { output: true });
    graph.remove('a');
    graph.add('a', fresh.def);
    graph.connect('a', { output: true });
    expect(graph.ids()).toEqual(['a']);
    settle();
    expect(old.dispose).toHaveBeenCalledTimes(1);
    expect(fresh.dispose).not.toHaveBeenCalled();
    expect(allPaths(fresh.output, dest)).toHaveLength(1);
    expect(allPaths(old.output, dest)).toHaveLength(0);
    expect(graph.ids()).toEqual(['a']);
  });

  it('set passes the graph\'s fade when no ramp is given', () => {
    const { ctx, graph } = harness();
    const a = testNode(ctx);
    graph.add('a', a.def);
    graph.set('a', 'level', 0.5);
    expect(a.level).toHaveBeenLastCalledWith(0.5, FADE);
    graph.set('a', 'level', 0.5, 0);
    expect(a.level).toHaveBeenLastCalledWith(0.5, 0);
  });

  it('retargets a ramp in flight from where it is', () => {
    const { ctx, graph } = harness();
    const a = testNode(ctx);
    graph.add('a', a.def);
    const p = a.output.gain;
    graph.set('a', 'level', 0.2);
    ctx._advance(5);
    // The fake's `value` does not follow a ramp; a real param reports this.
    const at5 = 1 + (0.2 - 1) * (5 / FADE);
    p.value = at5;
    const now = ctx.currentTime;
    const holds = p.holds.length;
    graph.set('a', 'level', 0.8);
    expect(p.cancels.at(-1)).toBe(now);
    expect(p.holds.slice(holds)).toEqual([{ value: at5, at: now }]);
    expect(p.ramps.at(-1)).toEqual({ value: 0.8, at: now + FADE / 1000 });
  });

  it('applies edits at once on a suspended context', async () => {
    const { ctx, graph, dest, timers } = harness({ running: false });
    const a = testNode(ctx, []);
    const b = testNode(ctx);
    graph.add('a', a.def);
    graph.add('b', b.def);
    graph.connect('a', { node: 'b', port: 'in' });
    graph.connect('b', { output: true });
    expect(allPaths(a.output, dest)).toHaveLength(1);
    graph.disconnect('a', { node: 'b', port: 'in' });
    expect(allPaths(a.output, b.inputs.in)).toHaveLength(0);
    graph.remove('b');
    expect(b.dispose).toHaveBeenCalledTimes(1);
    graph.start();
    graph.stop();
    expect(timers.size).toBe(0);
    await expect(graph.settled()).resolves.toBeUndefined();
  });

  it('apply runs patches in order through the same methods', () => {
    const run = (viaApply: boolean) => {
      const h = harness({ running: false });
      const a = testNode(h.ctx, []);
      const b = testNode(h.ctx);
      if (viaApply) {
        h.graph.apply([
          { kind: 'add', id: 'a', def: a.def },
          { kind: 'add', id: 'b', def: b.def },
          { kind: 'connect', from: 'a', to: { node: 'b', port: 'in' } },
          { kind: 'connect', from: 'a', to: { output: true } },
          { kind: 'set', id: 'a', param: 'level', value: 0.3 },
          { kind: 'disconnect', from: 'a', to: { output: true } },
          { kind: 'remove', id: 'b' },
        ]);
      } else {
        h.graph.add('a', a.def);
        h.graph.add('b', b.def);
        h.graph.connect('a', { node: 'b', port: 'in' });
        h.graph.connect('a', { output: true });
        h.graph.set('a', 'level', 0.3);
        h.graph.disconnect('a', { output: true });
        h.graph.remove('b');
      }
      return {
        ids: h.graph.ids(),
        toDest: allPaths(a.output, h.dest).length,
        toB: allPaths(a.output, b.inputs.in).length,
        level: a.level.mock.calls,
        disposed: [a.dispose.mock.calls.length, b.dispose.mock.calls.length],
      };
    };
    expect(run(true)).toEqual(run(false));
    expect(run(true).level).toEqual([[0.3, 0]]);
    expect(run(true).disposed).toEqual([0, 1]);
    const h = harness();
    expect(() => h.graph.apply([{ kind: 'replace', id: 'a', def: testNode(h.ctx).def }])).toThrow(/no node "a"/);
  });

  it('starts sources on start and on add while playing; stop fades out then stops them', () => {
    const { ctx, graph, dest, settle } = harness();
    const s1 = testNode(ctx, [], true);
    graph.add('s1', s1.def);
    expect(s1.start).not.toHaveBeenCalled();
    expect(graph.playing()).toBe(false);
    ctx._advance(3);
    graph.start();
    expect(graph.playing()).toBe(true);
    expect(s1.start).toHaveBeenCalledWith(ctx.currentTime);
    graph.start();
    expect(s1.start).toHaveBeenCalledTimes(1);
    const s2 = testNode(ctx, [], true);
    graph.add('s2', s2.def);
    expect(s2.start).toHaveBeenCalledWith(ctx.currentTime);

    const out = dest.connectedFrom[0] as FakeGain;
    const now = ctx.currentTime;
    graph.stop();
    expect(graph.playing()).toBe(false);
    expect(out.gain.ramps.at(-1)).toEqual({ value: 0, at: now + FADE / 1000 });
    expect(s1.stop).not.toHaveBeenCalled();
    settle();
    expect(s1.stop).toHaveBeenCalledTimes(1);
    expect(s2.stop).toHaveBeenCalledTimes(1);

    graph.start();
    expect(s1.start).toHaveBeenCalledTimes(2);
    expect(out.gain.ramps.at(-1)!.value).toBe(1);
  });

  it('stops a playing source it removes', () => {
    const { ctx, graph, settle } = harness();
    const s = testNode(ctx, [], true);
    graph.add('s', s.def);
    graph.connect('s', { output: true });
    graph.start();
    graph.remove('s');
    expect(s.stop).not.toHaveBeenCalled();
    settle();
    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(s.dispose).toHaveBeenCalledTimes(1);
  });

  it('taps a node\'s output and disposes the tap with the node', () => {
    const { ctx, graph, settle } = harness();
    const a = testNode(ctx, []);
    graph.add('a', a.def);
    graph.connect('a', { output: true });
    const tap = graph.tap('a', { fftSize: 512 });
    const analyser = tap.node as never as FakeNode;
    expect(tap.node.fftSize).toBe(512);
    expect(allPaths(a.output, analyser)).toHaveLength(1);
    expect(() => graph.tap('nope')).toThrow(/"nope"/);
    graph.remove('a');
    expect(allPaths(a.output, analyser)).toHaveLength(1);
    settle();
    expect(analyser.connectedFrom).toHaveLength(0);
  });

  it('dispose cancels fades and tears everything down', async () => {
    const { ctx, graph, dest, timers } = harness();
    const a = testNode(ctx, [], true);
    const b = testNode(ctx);
    graph.add('a', a.def);
    graph.add('b', b.def);
    graph.connect('a', { node: 'b', port: 'in' });
    graph.connect('b', { output: true });
    graph.tap('b');
    graph.start();
    graph.disconnect('a', { node: 'b', port: 'in' });
    graph.remove('a');
    expect(timers.size).toBeGreaterThan(0);
    const settled = graph.settled();
    graph.dispose();
    expect(timers.size).toBe(0);
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);
    expect(a.stop).toHaveBeenCalledTimes(1);
    expect(dest.connectedFrom).toHaveLength(0);
    await expect(settled).resolves.toBeUndefined();
  });
});

const tick = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

/** a → b, then the edge reversed inside the old one's fade. */
function reversed() {
  const h = harness();
  const a = testNode(h.ctx);
  const b = testNode(h.ctx);
  h.graph.add('a', a.def);
  h.graph.add('b', b.def);
  h.graph.connect('a', { node: 'b', port: 'in' });
  h.graph.disconnect('a', { node: 'b', port: 'in' });
  h.graph.connect('b', { node: 'a', port: 'in' });
  return { ...h, a, b };
}

describe('createAudioGraph deferred edges and settling', () => {
  it('defers a reversed edge until the old one has faded', async () => {
    const { graph, a, b, settle } = reversed();
    expect(reachesCycle(a.inputs.in)).toBe(false);
    expect(allPaths(b.output, a.inputs.in)).toHaveLength(0);
    expect(() => graph.connect('b', { node: 'a', port: 'in' })).not.toThrow();
    expect(() => graph.connect('a', { node: 'b', port: 'in' })).toThrow(/cycle/);
    let done = false;
    void graph.settled().then(() => { done = true; });
    await tick();
    expect(done).toBe(false);
    settle();
    expect(allPaths(b.output, a.inputs.in)).toHaveLength(1);
    expect(allPaths(a.output, b.inputs.in)).toHaveLength(0);
    expect(reachesCycle(a.inputs.in)).toBe(false);
    await tick();
    expect(done).toBe(true);
  });

  it('drops a deferred edge on disconnect, with no fade', async () => {
    const { graph, a, b, settle } = reversed();
    graph.disconnect('b', { node: 'a', port: 'in' });
    settle();
    expect(allPaths(b.output, a.inputs.in)).toHaveLength(0);
    await expect(graph.settled()).resolves.toBeUndefined();
    expect(() => graph.connect('a', { node: 'b', port: 'in' })).not.toThrow();
  });

  it('drops a deferred edge when either end is removed', async () => {
    for (const gone of ['a', 'b'] as const) {
      const h = reversed();
      h.graph.remove(gone);
      h.settle();
      expect(h[gone].dispose).toHaveBeenCalledTimes(1);
      expect(allPaths(h.b.output, h.a.inputs.in)).toHaveLength(0);
      expect(allPaths(h.a.output, h.b.inputs.in)).toHaveLength(0);
      await expect(h.graph.settled()).resolves.toBeUndefined();
    }
  });

  it('settled waits for the output fade-in a start begins', async () => {
    const { ctx, graph, step } = harness();
    graph.add('s', testNode(ctx, [], true).def);
    graph.start();
    let done = false;
    void graph.settled().then(() => { done = true; });
    await tick();
    expect(done).toBe(false);
    step();
    await tick();
    expect(done).toBe(true);
  });

  it('throws from every mutator once disposed', () => {
    const { ctx, graph } = harness();
    graph.add('a', testNode(ctx).def);
    graph.dispose();
    const def = testNode(ctx).def;
    const calls: (() => unknown)[] = [
      () => graph.add('b', def),
      () => graph.remove('a'),
      () => graph.replace('a', def),
      () => graph.connect('a', { output: true }),
      () => graph.disconnect('a', { output: true }),
      () => graph.set('a', 'level', 1),
      () => graph.apply([]),
      () => graph.start(),
      () => graph.stop(),
      () => graph.tap('a'),
    ];
    for (const call of calls) expect(call).toThrow('@weasel-js/audio: graph is disposed');
    expect(() => graph.dispose()).not.toThrow();
  });
});
