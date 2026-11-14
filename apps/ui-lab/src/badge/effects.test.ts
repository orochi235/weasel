import { describe, expect, it } from 'vitest';
import {
  addEffect, effectDefaults, effectSpecs, nextEffectId, setEffectParam, setEffectType, type LabEffect,
} from './effects';

describe('the effect stack', () => {
  it('appends an effect at its defaults, named for its type, under the next free id', () => {
    const [shadow] = addEffect([], 'shadow');
    expect(shadow).toEqual({ id: 1, type: 'shadow', name: 'Shadow', on: true, params: { dx: 1, dy: 2, opacity: 0.28 } });
    expect(addEffect([{ ...shadow!, id: 4 }], 'bevel2').map((e) => [e.id, e.name])).toEqual([[4, 'Shadow'], [5, 'Bevel 2']]);
  });

  it('numbers past every id in the list', () => {
    expect(nextEffectId([])).toBe(1);
    expect(nextEffectId(addEffect(addEffect([], 'shadow'), 'sheen'))).toBe(3);
  });

  it('edits one effect by id', () => {
    const list = addEffect(addEffect([], 'shadow'), 'shadow');
    expect(setEffectParam(list, 2, 'dx', 5).map((e) => e.params.dx)).toEqual([1, 5]);
  });

  it('retypes an effect at its new defaults, its name following the type unless it was renamed', () => {
    const list: LabEffect[] = [...addEffect([], 'shadow'), { ...addEffect([], 'shadow')[0]!, id: 2, name: 'Drop' }];
    const retyped = setEffectType(setEffectType(list, 1, 'spikes'), 2, 'spikes');
    expect(retyped.map((e) => e.name)).toEqual(['Spikes', 'Drop']);
    expect(retyped[0]!.params).toEqual(effectDefaults('spikes'));
  });

  it('leaves an effect that is off out of the badge, and hands a color param over as a color literal', () => {
    const [outline] = addEffect([], 'outline');
    const specs = effectSpecs([{ ...outline!, params: { ...outline!.params, color: '#ff0000' } }, { ...outline!, id: 2, on: false }]);
    expect(specs).toHaveLength(1);
    expect(specs[0]!.params).toMatchObject({ width: 1, dash: '', color: expect.objectContaining({}) });
    expect(typeof (specs[0]!.params as { color: unknown }).color).not.toBe('string');
  });

  it('gives a heading row no param', () => {
    expect(Object.keys(effectSpecs(addEffect([], 'aqua'))[0]!.params ?? {})).not.toContain('__body__');
  });
});
