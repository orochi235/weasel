import { formatParam, type EffectParam, type EffectParamControl, type EffectPort, type EffectStageType } from '@weasel-js/diagram/effect';

const param = (label: string, control: EffectParamControl): EffectParam => ({ label, value: formatParam(control), control });

const image = (id: string, label?: string): EffectPort => ({ id, type: 'image', ...(label !== undefined ? { label } : {}) });

/** Pipeline mode's palette. Ports carry `image`, `number` or `mask`, and a wire joins only like to like. */
export const CHART_STAGE_TYPES: readonly EffectStageType[] = [
  { type: 'source', title: 'Source', kind: 'source', outputs: [image('out')] },
  {
    type: 'blur', title: 'Blur',
    inputs: [image('in')], outputs: [image('out')],
    params: [param('radius', { kind: 'number', value: 4, min: 0, max: 50, step: 1, unit: 'px' })],
  },
  {
    type: 'composite', title: 'Composite',
    inputs: [image('base'), image('top')], outputs: [image('out')],
    params: [param('blend', {
      kind: 'enum', value: 'normal',
      options: [{ value: 'normal', label: 'Normal' }, { value: 'screen', label: 'Screen' }, { value: 'multiply', label: 'Multiply' }],
    })],
  },
  {
    type: 'mask', title: 'Mask',
    inputs: [image('in'), { id: 'mask', type: 'mask' }], outputs: [image('out')],
  },
  {
    type: 'oscillator', title: 'Oscillator',
    outputs: [{ id: 'value', type: 'number' }],
    params: [param('rate', { kind: 'number', value: 1, min: 0.1, max: 20, step: 0.1, unit: 'Hz' })],
  },
  {
    type: 'decision', title: 'Decision', kind: 'decision',
    inputs: [image('in'), { id: 'test', type: 'number' }], outputs: [image('yes', 'yes'), image('no', 'no')],
  },
  { type: 'out', title: 'Out', kind: 'sink', inputs: [image('in')] },
];
