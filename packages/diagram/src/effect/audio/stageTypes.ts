import { formatParam, type EffectStageType } from '../stageTypes';
import type { EffectParam, EffectParamControl, EffectPort } from '../types';

const param = (id: string, control: EffectParamControl): EffectParam => ({ id, label: id, value: formatParam(control), control });

const amount = (value: number, min: number, max: number, step: number, unit?: string): EffectParamControl =>
  ({ kind: 'number', value, min, max, step, ...(unit !== undefined ? { unit } : {}) });

const choice = (value: string, ...options: string[]): EffectParamControl =>
  ({ kind: 'enum', value, options: options.map((o) => ({ value: o, label: o[0]!.toUpperCase() + o.slice(1) })) });

const port = (id: string): EffectPort => ({ id, type: 'audio' });
/** Every audio input sums whatever is wired into it. */
const input = (id: string): EffectPort => ({ ...port(id), many: true });
const IN = [input('in')];
const OUT = [port('out')];

/** Stage types over audio, each with a graph node in `audioStageNodes` except
 *  `audio.output`, which is the graph's own output. Every `type` is prefixed
 *  because `IMAGE_STAGE_TYPES` already has an `oscillator`. */
export const AUDIO_STAGE_TYPES: readonly EffectStageType[] = [
  { type: 'audio.file', title: 'File', kind: 'source', outputs: OUT },
  {
    type: 'audio.oscillator', title: 'Oscillator', kind: 'source', outputs: OUT,
    params: [
      param('wave', choice('sine', 'sine', 'square', 'sawtooth', 'triangle')),
      param('frequency', amount(440, 20, 20000, 1, 'Hz')),
    ],
  },
  {
    type: 'audio.noise', title: 'Noise', kind: 'source', outputs: OUT,
    params: [param('color', choice('white', 'white', 'pink', 'brown'))],
  },
  { type: 'audio.gain', title: 'Gain', inputs: IN, outputs: OUT, params: [param('gain', amount(1, 0, 2, 0.01))] },
  { type: 'audio.pan', title: 'Pan', inputs: IN, outputs: OUT, params: [param('pan', amount(0, -1, 1, 0.01))] },
  {
    type: 'audio.filter', title: 'Filter', inputs: IN, outputs: OUT,
    params: [
      param('type', choice('lowpass', 'lowpass', 'highpass', 'bandpass')),
      param('frequency', amount(1000, 20, 20000, 1, 'Hz')),
      param('Q', amount(1, 0.1, 20, 0.1)),
    ],
  },
  {
    type: 'audio.delay', title: 'Delay', inputs: IN, outputs: OUT,
    params: [
      param('time', amount(300, 0, 2000, 10, 'ms')),
      param('feedback', amount(0.4, 0, 0.95, 0.01)),
      param('mix', amount(0.5, 0, 1, 0.01)),
    ],
  },
  {
    type: 'audio.reverb', title: 'Reverb', inputs: IN, outputs: OUT,
    params: [param('seconds', amount(2, 0.1, 10, 0.1, 's')), param('mix', amount(0.3, 0, 1, 0.01))],
  },
  {
    type: 'audio.compressor', title: 'Compressor', inputs: IN, outputs: OUT,
    params: [param('threshold', amount(-24, -60, 0, 1, 'dB')), param('ratio', amount(4, 1, 20, 0.5))],
  },
  {
    type: 'audio.mix', title: 'Mix', inputs: [input('a'), input('b')], outputs: OUT,
    params: [param('a', amount(1, 0, 2, 0.01)), param('b', amount(1, 0, 2, 0.01))],
  },
  { type: 'audio.output', title: 'Output', kind: 'sink', inputs: IN },
];
