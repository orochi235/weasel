import type { AnalyserTap, AudioEngine, AudioGraph, GraphPatch } from '@weasel-js/audio';
import { createFakeAudioContext } from '@weasel-js/audio/testing/fakeAudioContext';
import { describe, expect, it, vi } from 'vitest';
import type { EffectPipeline, EffectStage } from '../types';
import { createLiveAudioRunner } from './liveRunner';
import { AUDIO_STAGE_TYPES } from './stageTypes';

vi.mock('./scope', () => ({
  drawScope: () => ({ close: vi.fn(), kind: 'scope' }),
  drawSpectrum: () => ({ close: vi.fn(), kind: 'spectrum' }),
}));

const stage = (id: string, type: string): EffectStage => {
  const t = AUDIO_STAGE_TYPES.find((x) => x.type === type)!;
  return { id, title: id, type, inputs: t.inputs, outputs: t.outputs, params: t.params as never };
};
const pipeline = (...ids: string[]): EffectPipeline => ({
  stages: [...ids.map((id) => stage(id, 'audio.oscillator')), stage('out', 'audio.output')],
  wires: ids.map((id) => ({ from: { stage: id, port: 'out' }, to: { stage: 'out', port: 'in' } })),
});

/** A graph that knows which ids are live, so a tap on a removed node throws as the real one does. */
function fakeGraph() {
  const live = new Set<string>();
  const taps: { id: string; dispose: ReturnType<typeof vi.fn> }[] = [];
  const g = {
    taps,
    apply(patches: readonly GraphPatch[]) {
      for (const p of patches) {
        if (p.kind === 'add') live.add(p.id);
        if (p.kind === 'remove') live.delete(p.id);
      }
    },
    tap: vi.fn((id: string) => {
      if (!live.has(id)) throw new Error(`no node "${id}"`);
      const t = { id, dispose: vi.fn() };
      taps.push(t);
      return t as never as AnalyserTap;
    }),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  return g as typeof g & AudioGraph;
}

const setup = (p: EffectPipeline = pipeline('a')) => {
  const graphs: ReturnType<typeof fakeGraph>[] = [];
  const engine = {
    context: createFakeAudioContext(),
    unlock: async () => {},
    graph: () => { const g = fakeGraph(); graphs.push(g); return g; },
  } as never as AudioEngine;
  const runner = createLiveAudioRunner({ engine, pipeline: p });
  return { runner, graphs, graph: graphs[0]! };
};

describe('live runner previews', () => {
  it('taps nothing until previews are on, then every planned node and each one added later', () => {
    const { runner, graph } = setup();
    expect(graph.tap).not.toHaveBeenCalled();
    runner.setPreviews('scope');
    expect(graph.taps.map((t) => t.id)).toEqual(['a']);
    runner.setPipeline(pipeline('a', 'b'));
    expect(graph.taps.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('taps a node again once it is removed and added back, and when its type changes', () => {
    const { runner, graph } = setup(pipeline('a', 'b'));
    runner.setPreviews('scope');
    runner.setPipeline(pipeline('a'));
    runner.setPipeline(pipeline('a', 'b'));
    expect(graph.taps.map((t) => t.id)).toEqual(['a', 'b', 'b']);
    const both = pipeline('a', 'b');
    runner.setPipeline({ ...both, stages: [both.stages[0]!, stage('b', 'audio.noise'), both.stages[2]!] });
    expect(graph.taps.map((t) => t.id)).toEqual(['a', 'b', 'b', 'b']);
  });

  it('disposes every tap when previews go off, and frames draw nothing', () => {
    const { runner, graph } = setup();
    runner.setPreviews('spectrum');
    runner.setPreviews('off');
    expect(graph.taps[0]!.dispose).toHaveBeenCalled();
    const run = runner.state.run;
    runner.frame();
    expect(runner.state.run).toBe(run);
  });

  it('publishes a frame with previews.out per tapped stage and keeps the errors', () => {
    const { runner } = setup({ stages: [stage('a', 'audio.oscillator'), stage('f', 'audio.file')], wires: [] });
    runner.setPreviews('scope');
    runner.frame();
    const stages = runner.state.run!.stages;
    expect(stages.a?.previews?.out).toMatchObject({ kind: 'scope' });
    expect(stages.f?.error).toBe('no source audio');
    expect(stages.f?.previews).toBeUndefined();
  });

  it('taps the fresh graph after a reset', () => {
    const { runner, graphs } = setup();
    runner.setPreviews('scope');
    runner.reset();
    expect(graphs[1]!.taps.map((t) => t.id)).toEqual(['a']);
  });

  it('closes the bitmaps of runs before the drawn one, and every held one on dispose', () => {
    const { runner } = setup();
    runner.setPreviews('scope');
    runner.frame();
    const first = runner.state.run!;
    runner.frame();
    const second = runner.state.run!;
    runner.frame();
    const third = runner.state.run!;
    const bitmap = (r: typeof first) => r.stages.a!.previews!.out as unknown as { close: ReturnType<typeof vi.fn> };
    runner.drawn(second);
    expect(bitmap(first).close).toHaveBeenCalledOnce();
    expect(bitmap(second).close).not.toHaveBeenCalled();
    expect(bitmap(third).close).not.toHaveBeenCalled();
    runner.dispose();
    expect(bitmap(second).close).toHaveBeenCalledOnce();
    expect(bitmap(third).close).toHaveBeenCalledOnce();
  });

  it('disposes the taps before the graph on dispose', () => {
    const { runner, graph } = setup();
    runner.setPreviews('scope');
    runner.dispose();
    expect(graph.taps[0]!.dispose.mock.invocationCallOrder[0]).toBeLessThan(graph.dispose.mock.invocationCallOrder[0]!);
  });
});
