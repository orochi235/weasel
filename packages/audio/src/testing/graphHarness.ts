import { vi } from 'vitest';
import { createAudioGraph } from '../graph/createAudioGraph';
import type { AudioGraph, GraphNodeDef } from '../graph/types';
import { writeParam } from '../param';
import { createFakeAudioContext, type FakeAudioContext, type FakeGain, type FakeNode } from './fakeAudioContext';

export const FADE = 20;

export interface TestNode {
  def: GraphNodeDef;
  inputs: Record<string, FakeGain>;
  output: FakeGain;
  level: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

/** A def over fake gains. Its `dispose` blanket-disconnects its own nodes, as a
 *  real factory's would, so a graph that cuts its faders afterward throws. */
export function testNode(ctx: FakeAudioContext, ports: string[] = ['in'], source = false): TestNode {
  const output = ctx.createGain();
  const inputs: Record<string, FakeGain> = {};
  for (const p of ports) {
    inputs[p] = ctx.createGain();
    inputs[p].connect(output);
  }
  const level = vi.fn((v: number, ms: number) => writeParam(ctx as never, output.gain as never, v, ms));
  const dispose = vi.fn(() => {
    output.disconnect();
    for (const n of Object.values(inputs)) n.disconnect();
  });
  const start = vi.fn();
  const stop = vi.fn();
  const def: GraphNodeDef = {
    inputs: inputs as never,
    output: output as never,
    params: { level },
    dispose,
    ...(source ? { start, stop } : {}),
  };
  return { def, inputs, output, level, dispose, start, stop };
}

export function harness({ running = true } = {}) {
  const ctx = createFakeAudioContext();
  if (running) ctx.state = 'running';
  const timers = new Map<number, () => void>();
  let nextId = 0;
  const graph: AudioGraph = createAudioGraph(ctx as never, ctx.destination as never, {
    fadeMs: FADE,
    setTimer: (cb) => { nextId += 1; timers.set(nextId, cb); return nextId; },
    clearTimer: (h) => { timers.delete(h as number); },
  });
  const step = (): void => {
    ctx._advance(FADE);
    const due = [...timers.values()];
    timers.clear();
    for (const f of due) f();
  };
  const settle = (): void => {
    for (let i = 0; i < 100 && timers.size > 0; i += 1) step();
  };
  const dest = ctx.destination;
  return { ctx, graph, timers, step, settle, dest };
}

/** Every edge reachable from `from`. */
export function edgeCount(from: FakeNode): number {
  const seen = new Set<FakeNode>();
  let n = 0;
  const walk = (x: FakeNode): void => {
    if (seen.has(x)) return;
    seen.add(x);
    n += x.connectedTo.length;
    for (const next of x.connectedTo) walk(next);
  };
  walk(from);
  return n;
}
