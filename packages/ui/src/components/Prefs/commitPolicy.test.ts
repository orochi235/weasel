import { describe, expect, it } from 'vitest';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { PARAMS_SETTLES, withCommitPolicy, type ParamsSurface } from './commitPolicy';

const onChange = (): void => {};
const number = { kind: 'number', value: 1, onChange } as PropertyControlProps;
const slider = { kind: 'number', control: 'slider', value: 1, onChange } as PropertyControlProps;
const text = { kind: 'string', value: '', onChange } as PropertyControlProps;
const color = { kind: 'color', value: '#000000', onChange } as PropertyControlProps;
const flag = { kind: 'boolean', value: true, onChange } as PropertyControlProps;

/** Whether the field writes only once an edit settles: it was handed an `onInput` to swallow what comes before. */
const settles = (field: PropertyControlProps, surface: ParamsSurface): boolean =>
  'onInput' in withCommitPolicy(field, surface);

describe('withCommitPolicy', () => {
  it('settles a typed number, a slider, and a color in a form, and writes text as it is typed', () => {
    expect([number, slider, text, color].map((field) => settles(field, 'form'))).toEqual([true, true, false, true]);
  });

  it('settles a typed number, text, and a color in a panel, and writes a slider as it moves', () => {
    expect([number, slider, text, color].map((field) => settles(field, 'panel'))).toEqual([true, false, true, true]);
  });

  it('settles nothing in a lab, which follows every change', () => {
    expect([number, slider, text, color].map((field) => settles(field, 'lab'))).toEqual([false, false, false, false]);
  });

  it('leaves a control with one write per edit as it is, on every surface', () => {
    for (const surface of Object.keys(PARAMS_SETTLES) as ParamsSurface[]) expect(withCommitPolicy(flag, surface)).toBe(flag);
  });
});
