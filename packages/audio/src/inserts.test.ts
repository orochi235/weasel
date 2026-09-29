import { describe, expect, it, vi } from 'vitest';
import { createBusGraph } from './buses';
import type { InsertEffect } from './inserts';
import { createFakeAudioContext, type FakeGain, type FakeNode } from './testing/fakeAudioContext';
import { allPaths, reachesCycle } from './testing/graphWalk';

const FADE = 20;

function harness({ running = true } = {}) {
  const ctx = createFakeAudioContext();
  if (running) ctx.state = 'running';
  const timers = new Map<number, () => void>();
  let nextId = 0;
  const graph = createBusGraph(ctx as never, ['sfx'], {
    fadeMs: FADE,
    setTimer: (cb) => { nextId += 1; timers.set(nextId, cb); return nextId; },
    clearTimer: (h) => { timers.delete(h as number); },
  });
  const input = graph.input('sfx') as never as FakeNode;
  const fader = graph.node('sfx') as never as FakeNode;
  const labels = new Map<FakeNode, string>();
  const fx = (label: string): InsertEffect => {
    const n = ctx.createGain();
    labels.set(n, label);
    return { input: n as never, output: n as never };
  };
  /** Run one round of due timers after the fade has elapsed on the audio clock. */
  const step = (): void => {
    ctx._advance(FADE);
    const due = [...timers.values()];
    timers.clear();
    for (const f of due) f();
  };
  const settle = (): void => {
    for (let i = 0; i < 100 && timers.size > 0; i += 1) step();
  };
  /** The effects on the route that passes through the most of them — the
   *  chain order, since a bypass only adds a shorter route beside it. */
  const order = (): string[] => {
    let best: string[] = [];
    for (const path of allPaths(input, fader)) {
      const got = path.flatMap((n) => labels.get(n) ?? []);
      if (got.length > best.length) best = got;
    }
    return best;
  };
  const chain = graph.bus('sfx').inserts;
  return { ctx, graph, chain, input, fader, fx, step, settle, order, timers };
}

describe('insert chain wiring', () => {
  it('routes the bus input to its fader through nothing when the chain is empty', () => {
    const { input, fader, order } = harness();
    expect(allPaths(input, fader)).toHaveLength(1);
    expect(order()).toEqual([]);
    expect((fader as FakeNode).connectedTo).toHaveLength(1);
  });

  it('puts an added effect between the input and the fader', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    h.settle();
    expect(h.order()).toEqual(['A']);
    // The direct route is gone once the splice lands; only the bypass route
    // through the slot's dry gain skips the effect.
    expect(allPaths(h.input, h.fader)).toHaveLength(2);
  });

  it('keeps chain order across adds, including an explicit index', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    h.chain.add(h.fx('B'));
    h.chain.add(h.fx('C'), { index: 0 });
    h.settle();
    expect(h.order()).toEqual(['C', 'A', 'B']);
    expect(h.chain.slots().map((s) => s.index())).toEqual([0, 1, 2]);
  });

  it('reports the edited order at once, before the audio graph catches up', () => {
    const h = harness();
    const a = h.chain.add(h.fx('A'));
    const b = h.chain.add(h.fx('B'));
    b.moveTo(0);
    expect(h.chain.slots()).toEqual([b, a]);
  });

  it('reorders the graph to match a move', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    h.chain.add(h.fx('B'));
    const c = h.chain.add(h.fx('C'));
    h.settle();
    c.moveTo(1);
    h.settle();
    expect(h.order()).toEqual(['A', 'C', 'B']);
  });

  it('never forms a cycle while a move is in flight', () => {
    const h = harness();
    const a = h.chain.add(h.fx('A'));
    h.chain.add(h.fx('B'));
    h.chain.add(h.fx('C'));
    h.settle();
    a.moveTo(2);
    for (let i = 0; i < 20 && h.timers.size > 0; i += 1) {
      expect(reachesCycle(h.input)).toBe(false);
      h.step();
    }
    expect(h.order()).toEqual(['B', 'C', 'A']);
  });

  it('takes a removed effect out of the graph and disposes it', () => {
    const h = harness();
    const dispose = vi.fn();
    const a = h.chain.add({ ...h.fx('A'), dispose });
    h.chain.add(h.fx('B'));
    h.settle();
    const node = a.effect.input as never as FakeNode;
    a.remove();
    expect(a.index()).toBe(-1);
    expect(dispose).not.toHaveBeenCalled();
    h.settle();
    expect(h.order()).toEqual(['B']);
    expect([node.connectedTo, node.connectedFrom]).toEqual([[], []]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('cuts only its own edge from a consumer effect, leaving the consumer’s other wiring', () => {
    const h = harness();
    const effect = h.fx('A');
    const sidechain = h.ctx.createGain();
    (effect.output as never as FakeNode).connect(sidechain);
    const slot = h.chain.add(effect);
    h.settle();
    slot.remove();
    h.settle();
    expect((effect.output as never as FakeNode).connectedTo).toEqual([sidechain]);
  });

  it('clears every effect', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    h.chain.add(h.fx('B'));
    h.settle();
    h.chain.clear();
    h.settle();
    expect(h.order()).toEqual([]);
    expect(allPaths(h.input, h.fader)).toHaveLength(1);
  });

  it('rejects an effect that is already in a slot', () => {
    const h = harness();
    const a = h.fx('A');
    h.chain.add(a);
    expect(() => h.chain.add(a)).toThrow(/already/);
  });
});

describe('insert chain transitions', () => {
  /** The gain nodes feeding `target`, excluding the slot's own dry and wet. */
  const feeds = (target: FakeNode) => target.connectedFrom as FakeGain[];

  it('crossfades a splice-in: the old route ramps out as the new one ramps in', () => {
    const h = harness();
    const [direct] = feeds(h.fader);
    h.chain.add(h.fx('A'));
    const [, incoming] = feeds(h.fader);
    expect(direct.gain.ramps).toEqual([{ value: 0, at: FADE / 1000 }]);
    expect(incoming.gain.holds[0]?.value ?? incoming.gain.value).toBe(0);
    expect(incoming.gain.ramps).toEqual([{ value: 1, at: FADE / 1000 }]);
    // Both routes stay wired until the fade is over.
    expect(feeds(h.fader)).toHaveLength(2);
    h.step();
    expect(feeds(h.fader)).toEqual([incoming]);
    expect(direct.connectedFrom).toEqual([]);
  });

  it('crossfades a splice-out the same way, so the effect tail fades too', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    h.settle();
    const [fromSlot] = feeds(h.fader);
    h.chain.slots()[0].remove();
    expect(fromSlot.gain.ramps.at(-1)).toEqual({ value: 0, at: (2 * FADE) / 1000 });
    expect(feeds(h.fader)).toHaveLength(2);
    h.step();
    expect(feeds(h.fader)).not.toContain(fromSlot);
  });

  it('waits out the fade on the audio clock, not only the timer', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    // The timer fires but the audio clock has not reached the end of the ramp.
    const due = [...h.timers.values()];
    h.timers.clear();
    for (const f of due) f();
    expect(feeds(h.fader)).toHaveLength(2);
    expect(h.timers.size).toBe(1);
    h.step();
    expect(feeds(h.fader)).toHaveLength(1);
  });

  it('bypasses by crossfading the slot’s wet and dry, without rewiring', () => {
    const h = harness();
    const slot = h.chain.add(h.fx('A'));
    h.settle();
    const spy = vi.spyOn(h.ctx, 'createGain');
    const effectOut = slot.effect.output as never as FakeNode;
    const wet = effectOut.connectedTo[0] as FakeGain;
    const dry = (h.input.connectedTo[0].connectedTo[0] as FakeNode).connectedTo
      .find((n) => n !== (slot.effect.input as never)) as FakeGain;
    slot.bypass(true);
    expect(slot.bypassed()).toBe(true);
    const at = h.ctx.currentTime + FADE / 1000;
    expect(wet.gain.ramps.at(-1)).toEqual({ value: 0, at });
    expect(dry.gain.ramps.at(-1)).toEqual({ value: 1, at });
    expect(spy).not.toHaveBeenCalled();
    expect(h.timers.size).toBe(0);
  });

  it('adds an effect already bypassed, passing the signal through untouched', () => {
    const h = harness();
    const slot = h.chain.add(h.fx('A'), { bypassed: true });
    const wet = (slot.effect.output as never as FakeNode).connectedTo[0] as FakeGain;
    expect(wet.gain.value).toBe(0);
    expect(slot.bypassed()).toBe(true);
  });

  it('rewires at once with no ramps while the context is not running', () => {
    const h = harness({ running: false });
    const [direct] = feeds(h.fader);
    h.chain.add(h.fx('A'));
    expect(h.timers.size).toBe(0);
    expect(direct.gain.ramps).toEqual([]);
    expect(h.order()).toEqual(['A']);
    expect(feeds(h.fader)).toHaveLength(1);
  });

  it('settles once the graph matches the chain', async () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    let settled = false;
    const done = h.chain.settled().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    h.settle();
    await done;
    expect(settled).toBe(true);
  });

  it('cancels a pending transition on dispose', () => {
    const h = harness();
    h.chain.add(h.fx('A'));
    expect(h.timers.size).toBe(1);
    h.graph.dispose();
    expect(h.timers.size).toBe(0);
  });
});
