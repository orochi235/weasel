import { describe, expect, it } from 'vitest';
import { typeColors } from './draw';
import type { EffectPipeline } from './types';

describe('typeColors', () => {
  it('gives a type named for an Object.prototype member a series color, not the built-in', () => {
    const pipeline: EffectPipeline = { stages: [{ id: 'a', title: 'a', outputs: [{ id: 'out', type: 'toString' }] }], wires: [] };
    const color = typeColors(pipeline, {}, ['#123456']);
    expect(color('toString')).toBe('#123456');
    expect(typeof color('constructor')).toBe('string');
  });

  it('gives a type with no color given the untyped color when the series is empty', () => {
    const pipeline: EffectPipeline = { stages: [{ id: 'a', title: 'a', outputs: [{ id: 'out', type: 'audio' }] }], wires: [] };
    const color = typeColors(pipeline, {}, []);
    expect(color('audio')).toBe(color(undefined));
    expect(typeof color('audio')).toBe('string');
  });
});
