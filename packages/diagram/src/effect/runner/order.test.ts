import { describe, expect, it } from 'vitest';
import type { EffectPipeline, EffectStage } from '../types';
import { runOrder } from './order';

const stage = (id: string): EffectStage => ({
  id, title: id, inputs: [{ id: 'in', type: 'image' }, { id: 'n', type: 'number' }], outputs: [{ id: 'out', type: 'image' }],
});
const wire = (from: string, to: string, port = 'in') => ({ from: { stage: from, port: 'out' }, to: { stage: to, port } });

describe('runOrder', () => {
  it('puts every stage after the stages that feed it, data and control wires alike', () => {
    const p: EffectPipeline = {
      stages: ['c', 'b', 'a', 'osc'].map(stage),
      wires: [wire('a', 'b'), wire('b', 'c'), wire('osc', 'a', 'n')],
    };
    expect(runOrder(p)).toEqual({ order: ['osc', 'a', 'b', 'c'], cyclic: [] });
  });

  it('keeps stage order among stages free to go in either order', () => {
    const p: EffectPipeline = { stages: ['x', 'y', 'z'].map(stage), wires: [wire('z', 'y')] };
    expect(runOrder(p).order).toEqual(['x', 'z', 'y']);
  });

  it('leaves the stages of a cycle out and reports them, and still orders what they feed', () => {
    const p: EffectPipeline = {
      stages: ['s', 'a', 'b', 'after', 'self'].map(stage),
      wires: [wire('s', 'a'), wire('a', 'b'), wire('b', 'a', 'n'), wire('b', 'after'), wire('self', 'self')],
    };
    expect(runOrder(p)).toEqual({ order: ['s', 'after'], cyclic: ['a', 'b', 'self'] });
  });

  it('ignores a wire to a stage that is not there, and a repeated stage id', () => {
    const p: EffectPipeline = { stages: [stage('a'), stage('a'), stage('b')], wires: [wire('ghost', 'a'), wire('a', 'b')] };
    expect(runOrder(p).order).toEqual(['a', 'b']);
  });
});
