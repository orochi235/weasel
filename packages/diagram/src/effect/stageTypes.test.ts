import { describe, expect, it } from 'vitest';
import { formatParam, stageFromType, type EffectStageType } from './stageTypes';

const blur: EffectStageType = {
  type: 'blur',
  title: 'Blur',
  inputs: [{ id: 'image', type: 'image' }],
  outputs: [{ id: 'out', type: 'image' }],
  params: [{ id: 'r', label: 'radius', value: '6.0 px', control: { kind: 'number', value: 6, unit: 'px' } }],
};

describe('stageFromType', () => {
  it('copies ports and params and tags the type', () => {
    const s = stageFromType(blur, 'blur-2');
    expect(s).toEqual({ ...blur, id: 'blur-2' });
    expect(s.inputs).not.toBe(blur.inputs);
    expect(s.params![0]!.control).not.toBe(blur.params![0]!.control);
  });
});

describe('formatParam', () => {
  it('formats each control', () => {
    expect(formatParam({ kind: 'number', value: 6, unit: 'px' })).toBe('6.0 px');
    expect(formatParam({ kind: 'number', value: 2 })).toBe('2.0');
    expect(formatParam({ kind: 'number', value: 0.04, step: 0.01 })).toBe('0.04');
    expect(formatParam({ kind: 'number', value: 3, step: 1 })).toBe('3');
    expect(formatParam({ kind: 'number', value: 0.5, step: 0.25 })).toBe('0.50');
    expect(formatParam({ kind: 'number', value: -0.02 })).toBe('0.0');
    expect(formatParam({ kind: 'number', value: -0.5 })).toBe('-0.5');
    expect(formatParam({ kind: 'enum', value: 'a', options: [{ value: 'a', label: 'Alpha' }] })).toBe('Alpha');
    expect(formatParam({ kind: 'enum', value: 'b', options: [{ value: 'a' }] })).toBe('b');
    expect(formatParam({ kind: 'boolean', value: true })).toBe('on');
    expect(formatParam({ kind: 'boolean', value: false })).toBe('off');
    expect(formatParam({ kind: 'string', value: 'hi' })).toBe('hi');
  });
});
