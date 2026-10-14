/** Test fixture: a pipeline with a decision that skips ahead, shared by the chain and rack tests. */
import type { EffectPipeline, EffectStage } from './types';

export const w = (from: [string, string], to: [string, string]) =>
  ({ from: { stage: from[0], port: from[1] }, to: { stage: to[0], port: to[1] } });
export const io = (id: string, extra: Partial<EffectStage> = {}): EffectStage =>
  ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }], ...extra });

export const SKIP: EffectPipeline = {
  types: { number: { control: true } },
  stages: [
    io('src', { inputs: [] }),
    { id: 'q', title: 'high quality?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image', label: 'yes' }, { id: 'no', type: 'image', label: 'no' }] },
    io('blur', { inputs: [{ id: 'in', type: 'image' }, { id: 'radius', type: 'number' }] }),
    io('mix'),
    io('out', { outputs: [] }),
    { id: 'osc', title: 'Oscillator', outputs: [{ id: 'value', type: 'number' }] },
  ],
  wires: [
    w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['blur', 'in']), w(['q', 'no'], ['mix', 'in']),
    w(['blur', 'out'], ['mix', 'in']), w(['mix', 'out'], ['out', 'in']), w(['osc', 'value'], ['blur', 'radius']),
  ],
};

const decision = (id: string): EffectStage => ({
  id, title: id, kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
  outputs: [{ id: 'yes', type: 'image', label: 'yes' }, { id: 'no', type: 'image', label: 'no' }],
});

/** Two skip-ahead decisions in a row: src, q1, q2, mix, blur, out. */
export const ADJACENT: EffectPipeline = {
  stages: [io('src', { inputs: [] }), decision('q1'), decision('q2'), io('mix'), io('blur'), io('out', { outputs: [] })],
  wires: [
    w(['src', 'out'], ['q1', 'in']), w(['q1', 'yes'], ['q2', 'in']), w(['q1', 'no'], ['mix', 'in']),
    w(['q2', 'yes'], ['mix', 'in']), w(['q2', 'no'], ['blur', 'in']),
    w(['mix', 'out'], ['blur', 'in']), w(['blur', 'out'], ['out', 'in']),
  ],
};

/** A skip-ahead decision whose skip exit lands on another decision: src, q, a, d, out. */
export const LANDS_ON_DECISION: EffectPipeline = {
  stages: [io('src', { inputs: [] }), decision('q'), io('a'), decision('d'), io('out', { outputs: [] })],
  wires: [
    w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['a', 'in']), w(['q', 'no'], ['d', 'in']),
    w(['a', 'out'], ['d', 'in']), w(['d', 'yes'], ['out', 'in']), w(['d', 'no'], ['out', 'in']),
  ],
};
