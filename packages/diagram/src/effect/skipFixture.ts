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
