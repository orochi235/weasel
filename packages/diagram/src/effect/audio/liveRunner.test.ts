import type { AudioEngine, AudioGraph, GraphPatch } from '@weasel-js/audio';
import { createFakeAudioContext } from '@weasel-js/audio/testing/fakeAudioContext';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectPipeline, EffectStage, EffectWire } from '../types';
import { createLiveAudioRunner } from './liveRunner';
import { AUDIO_STAGE_TYPES } from './stageTypes';

const stage = (id: string, type: string, values: Record<string, unknown> = {}): EffectStage => {
  const t = AUDIO_STAGE_TYPES.find((x) => x.type === type)!;
  const params = (t.params ?? []).map((p) => (p.id !== undefined && p.id in values ?{ ...p, control: { ...p.control!, value: values[p.id] } } : p));
  return { id, title: id, type, inputs: t.inputs, outputs: t.outputs, params: params as never };
};
const wire = (from: string, to: string): EffectWire => ({ from: { stage: from, port: 'out' }, to: { stage: to, port: 'in' } });
const osc = (frequency = 440): EffectPipeline => ({
  stages: [stage('osc', 'audio.oscillator', { frequency }), stage('out', 'audio.output')],
  wires: [wire('osc', 'out')],
});

interface FakeGraph extends AudioGraph {
  applies: GraphPatch[][];
  calls: string[];
  failNext: unknown;
}
const fakeGraph = (): FakeGraph => {
  const g = {
    applies: [] as GraphPatch[][],
    calls: [] as string[],
    failNext: undefined as unknown,
    apply(patches: readonly GraphPatch[]) {
      g.applies.push([...patches]);
      if (g.failNext !== undefined) {
        const err = g.failNext;
        g.failNext = undefined;
        throw err;
      }
    },
    start: () => { g.calls.push('start'); },
    stop: () => { g.calls.push('stop'); },
    dispose: () => { g.calls.push('dispose'); },
  };
  return g as never;
};

const setup = (pipeline: EffectPipeline = osc()) => {
  const ctx = createFakeAudioContext();
  const graphs: FakeGraph[] = [];
  const order: string[] = [];
  const engine = {
    context: ctx,
    unlock: vi.fn(async () => { order.push('unlock'); }),
    graph: vi.fn(() => { const g = fakeGraph(); graphs.push(g); return g; }),
  } as never as AudioEngine;
  const runner = createLiveAudioRunner({ engine, pipeline });
  const buffer = () => ctx.createBuffer(1, 8, 8000) as never as AudioBuffer;
  return { runner, engine, graphs, graph: graphs[0]!, buffer, order };
};
const kinds = (patches: GraphPatch[]) => patches.map((p) => `${p.kind} ${'id' in p ? p.id : p.from}`);

afterEach(() => vi.restoreAllMocks());

describe('createLiveAudioRunner', () => {
  it('adds and connects the pipeline once on creation', () => {
    const { graph } = setup();
    expect(graph.applies).toHaveLength(1);
    expect(kinds(graph.applies[0]!)).toEqual(['add osc', 'connect osc']);
    expect(graph.applies[0]![1]).toEqual({ kind: 'connect', from: 'osc', to: { output: true } });
  });

  it('patches only the changed param', () => {
    const { runner, graph } = setup();
    runner.setPipeline(osc(220));
    expect(graph.applies[1]).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
  });

  it('plans no connection for a feedback loop and reports both stages', () => {
    const { runner, graph } = setup();
    runner.setPipeline({
      stages: [stage('a', 'audio.gain'), stage('b', 'audio.gain')],
      wires: [wire('a', 'b'), wire('b', 'a')],
    });
    expect(graph.applies.slice(1).flat().filter((p) => p.kind === 'connect')).toEqual([]);
    expect(runner.state.run?.stages.a?.error).toBe('on a feedback loop');
    expect(runner.state.run?.stages.b?.error).toBe('on a feedback loop');
  });

  it('unlocks before starting, and stops on pause', async () => {
    const { runner, graph, order } = setup();
    const done = runner.play();
    expect(graph.calls).toEqual([]);
    await done;
    expect(order).toEqual(['unlock']);
    expect(graph.calls).toEqual(['start']);
    expect(runner.state.playing).toBe(true);
    runner.pause();
    expect(graph.calls).toEqual(['start', 'stop']);
    expect(runner.state.playing).toBe(false);
  });

  it('reports a file with no audio until a source arrives, then replaces on the next one', () => {
    const { runner, graph, buffer } = setup({ stages: [stage('file', 'audio.file')], wires: [] });
    expect(runner.state.run?.stages.file?.error).toBe('no source audio');
    runner.setSources({ audio: buffer() });
    expect(graph.applies.at(-1)!.map((p) => `${p.kind} ${'id' in p ? p.id : ''}`)).toEqual(['add file']);
    expect(runner.state.run?.stages.file?.error).toBeUndefined();
    runner.setSources({ audio: buffer() });
    expect(graph.applies.at(-1)!.map((p) => p.kind)).toEqual(['replace']);
  });

  it('keeps the run object while the errors are unchanged', () => {
    const { runner } = setup();
    const before = runner.state.run;
    runner.setPipeline(osc(220));
    expect(runner.state.run).toBe(before);
  });

  it('notifies subscribers on a change and not after unsubscribing', async () => {
    const { runner } = setup();
    const l = vi.fn();
    const off = runner.subscribe(l);
    await runner.play();
    expect(l).toHaveBeenCalledTimes(1);
    off();
    runner.pause();
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous plan when apply throws structurally, and warns once', () => {
    const { runner, graph } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    graph.failNext = new Error('@weasel-js/audio: node "osc" has no param "frequency"');
    runner.setPipeline(osc(220));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/^@weasel-js\/diagram: /);
    expect(runner.state.run?.stages.osc?.error).toMatch(/no param/);
    runner.setPipeline(osc(220));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
    expect(runner.state.run?.stages.osc?.error).toBeUndefined();
  });

  it('adopts the next plan when a set throws, and warns once', () => {
    const { runner, graph } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    graph.failNext = new RangeError('frequency out of range');
    runner.setPipeline(osc(220));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(runner.state.run?.stages.osc?.error).toBe('frequency out of range');
    runner.setPipeline(osc(330));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 330 }]);
  });

  it('resets onto a fresh graph holding the current plan, not playing', async () => {
    const { runner, graphs, engine } = setup();
    await runner.play();
    runner.reset();
    expect(graphs[0]!.calls).toContain('dispose');
    expect(engine.graph).toHaveBeenCalledTimes(2);
    expect(kinds(graphs[1]!.applies[0]!)).toEqual(['add osc', 'connect osc']);
    expect(runner.state.playing).toBe(false);
  });

  it('disposes the graph once, and every method is a no-op afterwards', async () => {
    const { runner, graph, engine } = setup();
    runner.dispose();
    runner.dispose();
    expect(graph.calls.filter((c) => c === 'dispose')).toHaveLength(1);
    runner.setPipeline(osc(220));
    runner.reset();
    runner.pause();
    await runner.play();
    expect(graph.applies).toHaveLength(1);
    expect(graph.calls).toEqual(['dispose']);
    expect(engine.graph).toHaveBeenCalledTimes(1);
    expect(runner.state.playing).toBe(false);
  });
});
