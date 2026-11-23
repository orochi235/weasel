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
  failWhen: ((patches: readonly GraphPatch[]) => unknown) | undefined;
  /** `failWhen` is a start that fails after the patches land, which `check` passes, not a refused batch. */
  landOnFail: boolean;
}
const fakeGraph = (): FakeGraph => {
  const g = {
    applies: [] as GraphPatch[][],
    calls: [] as string[],
    failWhen: undefined as FakeGraph['failWhen'],
    landOnFail: false,
    live: new Set<string>(),
    check(patches: readonly GraphPatch[]) {
      const err = g.landOnFail ? undefined : g.failWhen?.(patches);
      if (err !== undefined) throw err;
    },
    apply(patches: readonly GraphPatch[]) {
      g.applies.push([...patches]);
      const err = g.failWhen?.(patches);
      if (err === undefined || g.landOnFail) {
        for (const p of patches) {
          if (p.kind === 'add') g.live.add(p.id);
          if (p.kind === 'remove') g.live.delete(p.id);
        }
      }
      if (err !== undefined) throw err;
    },
    has: (id: string) => g.live.has(id),
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
const withGain = (frequency: number): EffectPipeline => ({
  stages: [stage('osc', 'audio.oscillator', { frequency }), stage('gain', 'audio.gain'), stage('out', 'audio.output')],
  wires: [wire('osc', 'gain'), wire('gain', 'out')],
});
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

  it('keeps the rest playing beside a feedback loop', () => {
    const { runner, graph } = setup();
    runner.setPipeline({
      stages: [...osc().stages, stage('gain', 'audio.gain'), stage('delay', 'audio.delay')],
      wires: [...osc().wires, wire('gain', 'delay'), wire('delay', 'gain')],
    });
    const later = graph.applies.slice(1).flat();
    expect(later.filter((p) => 'id' in p && p.id === 'osc' && p.kind !== 'set')).toEqual([]);
    expect(later.filter((p) => p.kind === 'disconnect')).toEqual([]);
    expect(graph.applies[0]).toContainEqual({ kind: 'connect', from: 'osc', to: { output: true } });
    const errors = Object.entries(runner.state.run?.stages ?? {}).filter(([, r]) => r.error !== undefined);
    expect(Object.fromEntries(errors.map(([id, r]) => [id, r.error]))).toEqual({ gain: 'on a feedback loop', delay: 'on a feedback loop' });
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

  it('keeps the previous plan when the structural apply throws, sends no sets, and warns once', () => {
    const { runner, graph } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    graph.failWhen = (ps) => (ps.some((p) => p.kind === 'add') ? new Error('@weasel-js/audio: node "gain" has no input port "in"') : undefined);
    runner.setPipeline(withGain(220));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/^@weasel-js\/diagram: /);
    expect(graph.applies).toHaveLength(1);
    expect(runner.state.run?.stages.gain?.error).toMatch(/no input port/);
    graph.failWhen = undefined;
    runner.setPipeline(withGain(220));
    expect(graph.applies).toHaveLength(3);
    expect(graph.applies[1]!.some((p) => p.kind === 'add' && p.id === 'gain')).toBe(true);
    expect(graph.applies[2]).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
    expect(runner.state.run?.stages.gain?.error).toBeUndefined();
  });

  it('adopts the next plan when a set throws, and blames the stage whose set failed', () => {
    const { runner, graph } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const delayMsg = '@weasel-js/audio: delay time 9 is outside 0 to 1';
    graph.failWhen = (ps) => (ps.every((p) => p.kind === 'set') ? new RangeError(delayMsg) : undefined);
    runner.setPipeline(withGain(220));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(graph.applies).toHaveLength(4);
    expect(graph.applies[1]!.some((p) => p.kind === 'add' && p.id === 'gain')).toBe(true);
    expect(runner.state.run?.stages.osc?.error).toBe(delayMsg);
    graph.failWhen = undefined;
    runner.setPipeline(withGain(330));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 330 }]);
    expect(graph.applies.flat().filter((p) => p.kind === 'add' && p.id === 'gain')).toHaveLength(1);
  });

  it('applies the other stages\' writes when one stage\'s write fails, and blames only that stage', () => {
    const { runner, graphs } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    runner.setPipeline(withGain(440));
    const graph = graphs[0]!;
    graph.failWhen = (ps) => (ps.some((p) => p.kind === 'set' && p.id === 'gain') ? new Error('@weasel-js/audio: node "gain" has no param "gain"') : undefined);
    const base = withGain(220);
    const next = { ...base, stages: base.stages.map((s) => (s.id === 'gain' ? stage('gain', 'audio.gain', { gain: 0.5 }) : s)) };
    runner.setPipeline(next);
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
    expect(runner.state.run?.stages.gain?.error).toMatch(/no param/);
    expect(runner.state.run?.stages.osc?.error).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('sends a failed write again on the next edit, and blames its stage until one lands', () => {
    const { runner, graph } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    runner.setPipeline(withGain(440));
    graph.failWhen = (ps) => (ps.some((p) => p.kind === 'set' && p.id === 'gain') ? new Error('@weasel-js/audio: node "gain" has no param "gain"') : undefined);
    const halved = (frequency: number): EffectPipeline => {
      const base = withGain(frequency);
      return { ...base, stages: base.stages.map((s) => (s.id === 'gain' ? stage('gain', 'audio.gain', { gain: 0.5 }) : s)) };
    };
    runner.setPipeline(halved(220));
    expect(runner.state.run?.stages.gain?.error).toMatch(/no param/);
    const before = graph.applies.length;
    runner.setPipeline(halved(330));
    expect(graph.applies.slice(before).flat()).toContainEqual({ kind: 'set', id: 'gain', param: 'gain', value: 0.5 });
    expect(runner.state.run?.stages.gain?.error).toMatch(/no param/);
    graph.failWhen = undefined;
    runner.setPipeline(halved(330));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'gain', param: 'gain', value: 0.5 }]);
    expect(runner.state.run?.stages.gain?.error).toBeUndefined();
  });

  it('blames a stage a landed edit left broken until a later edit naming it lands', () => {
    const { runner, graph } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    graph.landOnFail = true;
    graph.failWhen = (ps) => (ps.some((p) => p.kind === 'add' && p.id === 'gain') ? new Error('node "gain" failed to start') : undefined);
    runner.setPipeline(withGain(440));
    expect(runner.state.run?.stages.gain?.error).toBe('node "gain" failed to start');
    graph.failWhen = undefined;
    runner.setPipeline(withGain(220));
    expect(runner.state.run?.stages.gain?.error).toBe('node "gain" failed to start');
    runner.setPipeline(osc(220));
    expect(runner.state.run?.stages.gain?.error).toBeUndefined();
  });

  it('leaves out a node whose build throws, names its stage, and keeps following the rest', () => {
    const { runner, graph } = setup();
    const withReverb = (frequency: number): EffectPipeline => ({
      stages: [stage('osc', 'audio.oscillator', { frequency }), stage('verb', 'audio.reverb', { seconds: 0 }), stage('out', 'audio.output')],
      wires: [wire('osc', 'verb'), wire('verb', 'out')],
    });
    runner.setPipeline(withReverb(440));
    expect(runner.state.run?.stages.verb?.error).toMatch(/impulse length 0/);
    expect(graph.applies.flat().some((p) => 'id' in p && p.id === 'verb')).toBe(false);
    expect(kinds(graph.applies[1]!)).toEqual(['disconnect osc']);
    runner.setPipeline(withReverb(220));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
  });

  it('leaves out a wire into a port its stage has and its node lacks, names the stage, and keeps following the rest', () => {
    const { runner, graph } = setup();
    const stale = (frequency: number): EffectPipeline => {
      const p = withGain(frequency);
      return {
        stages: p.stages.map((s) => (s.id === 'gain' ? { ...s, inputs: [{ id: 'inn', type: 'audio' }] } : s)),
        wires: [{ from: { stage: 'osc', port: 'out' }, to: { stage: 'gain', port: 'inn' } }, wire('gain', 'out')],
      };
    };
    runner.setPipeline(stale(440));
    expect(runner.state.run?.stages.gain?.error).toBe('no input port "inn"');
    expect(graph.applies.flat().some((p) => p.kind === 'connect' && 'node' in p.to && p.to.port === 'inn')).toBe(false);
    runner.setPipeline(stale(220));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
  });

  it('adopts the next plan when the structural apply throws after its nodes landed', () => {
    const { runner, graph } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    graph.landOnFail = true;
    graph.failWhen = (ps) => (ps.some((p) => p.kind === 'add') ? new Error('start failed') : undefined);
    runner.setPipeline(withGain(440));
    graph.failWhen = undefined;
    runner.setPipeline(withGain(220));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
    expect(graph.applies.flat().filter((p) => p.kind === 'add' && p.id === 'gain')).toHaveLength(1);
  });

  it('adopts the next plan when a batch with no adds throws after it landed', () => {
    const { runner, graph } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    runner.setPipeline(withGain(440));
    graph.landOnFail = true;
    graph.failWhen = (ps) => (ps.some((p) => p.kind === 'remove') ? new Error('start failed') : undefined);
    runner.setPipeline(osc(440));
    graph.failWhen = undefined;
    runner.setPipeline(osc(220));
    expect(graph.applies.at(-1)).toEqual([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }]);
    expect(graph.applies.flat().filter((p) => p.kind === 'remove')).toHaveLength(1);
  });

  it('starts nothing when a pause or reset comes while play waits on the unlock', async () => {
    const { runner, engine, graphs } = setup();
    let unlocked = () => {};
    vi.mocked(engine.unlock).mockImplementation(() => new Promise<void>((r) => { unlocked = r; }));
    const played = runner.play();
    runner.pause();
    unlocked();
    await played;
    expect(graphs[0]!.calls).not.toContain('start');
    expect(runner.state.playing).toBe(false);
    const again = runner.play();
    runner.reset();
    unlocked();
    await again;
    expect(graphs[1]!.calls).not.toContain('start');
    expect(runner.state.playing).toBe(false);
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
