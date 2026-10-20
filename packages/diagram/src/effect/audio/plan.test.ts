import { describe, expect, it } from 'vitest';
import type { EffectPipeline, EffectStage, EffectWire } from '../types';
import { audioStageNodes } from './nodes';
import { livePlan } from './plan';
import { AUDIO_STAGE_TYPES } from './stageTypes';

const stage = (id: string, type: string, extra: Partial<EffectStage> = {}): EffectStage => {
  const t = AUDIO_STAGE_TYPES.find((x) => x.type === type)!;
  return { id, title: id, type, inputs: t.inputs, outputs: t.outputs, params: t.params, ...extra };
};
const wire = (from: string, to: string, port = 'in'): EffectWire => ({ from: { stage: from, port: 'out' }, to: { stage: to, port } });
const plan = (stages: EffectStage[], wires: EffectWire[], sources = {}) =>
  livePlan({ stages, wires }, audioStageNodes, sources);

describe('livePlan', () => {
  it('plans oscillator to gain to output', () => {
    const p = plan(
      [stage('osc', 'audio.oscillator'), stage('gain', 'audio.gain'), stage('out', 'audio.output')],
      [wire('osc', 'gain'), wire('gain', 'out')],
    );
    expect(Object.keys(p.nodes).sort()).toEqual(['gain', 'osc']);
    expect(p.nodes.osc).toEqual({ type: 'audio.oscillator', settings: { wave: 'sine' }, levels: { frequency: 440 } });
    expect(p.edges).toHaveLength(2);
    expect(p.edges).toEqual(expect.arrayContaining([
      { from: 'osc', to: { node: 'gain', port: 'in' } },
      { from: 'gain', to: { output: true } },
    ]));
  });

  it('keeps every wire into one input so they sum', () => {
    const p = plan(
      [stage('a', 'audio.oscillator'), stage('b', 'audio.oscillator'), stage('gain', 'audio.gain')],
      [wire('a', 'gain'), wire('b', 'gain')],
    );
    expect(p.edges).toEqual([
      { from: 'a', to: { node: 'gain', port: 'in' } },
      { from: 'b', to: { node: 'gain', port: 'in' } },
    ]);
  });

  it('leaves out a file with no audio, and what only it feeds', () => {
    const p = plan([stage('file', 'audio.file'), stage('gain', 'audio.gain')], [wire('file', 'gain')]);
    expect(p.errors).toEqual({ file: 'no source audio' });
    expect(p.nodes.file).toBeUndefined();
    expect(p.nodes.gain).toBeUndefined();
    expect(p.edges).toEqual([]);
  });

  it('carries an edge across a bypassed stage', () => {
    const p = plan(
      [stage('osc', 'audio.oscillator'), stage('filter', 'audio.filter', { bypassed: true }), stage('out', 'audio.output')],
      [wire('osc', 'filter'), wire('filter', 'out')],
    );
    expect(p.edges).toEqual([{ from: 'osc', to: { output: true } }]);
    expect(p.nodes.filter).toBeUndefined();
  });

  it('leaves out both stages of a feedback loop', () => {
    const p = plan(
      [stage('gain', 'audio.gain'), stage('delay', 'audio.delay')],
      [wire('gain', 'delay'), wire('delay', 'gain')],
    );
    expect(p.errors).toEqual({ gain: 'on a feedback loop', delay: 'on a feedback loop' });
    expect(p.nodes).toEqual({});
    expect(p.edges).toEqual([]);
  });

  it('ignores an image stage', () => {
    const pipeline: EffectPipeline = {
      stages: [stage('osc', 'audio.oscillator'), { id: 'blur', title: 'Blur', type: 'blur' }, stage('out', 'audio.output')],
      wires: [wire('osc', 'out')],
    };
    const p = livePlan(pipeline, audioStageNodes, {});
    expect(Object.keys(p.nodes)).toEqual(['osc']);
    expect(p.errors).toEqual({});
  });
});
