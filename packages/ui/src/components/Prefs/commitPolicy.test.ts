import { describe, expect, it } from 'vitest';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS, withCommitPolicy, withDrafts, type ParamsSurface } from './commitPolicy';

const onChange = (): void => {};
const number = { kind: 'number', value: 1, onChange } as PropertyControlProps;
const slider = { kind: 'number', control: 'slider', value: 1, onChange } as PropertyControlProps;
const text = { kind: 'string', value: '', onChange } as PropertyControlProps;
const color = { kind: 'color', value: '#000000', onChange } as PropertyControlProps;
const flag = { kind: 'boolean', value: true, onChange } as PropertyControlProps;

/** Whether the field writes only once an edit settles: it was handed an `onInput` to swallow what comes before,
 *  and kept its own `onChange` for the value the edit settles on. */
const settles = (field: PropertyControlProps, surface: ParamsSurface): boolean => {
  const made = withCommitPolicy(field, surface);
  return 'onInput' in made && made.onChange === field.onChange;
};

describe('withDrafts', () => {
  const drafts = (field: PropertyControlProps) => ({ ...field, onChange: () => {} }) as PropertyControlProps;

  it('sends a panel slider its moves through the drafts writer, and leaves its own for the value it settles on', () => {
    const drafted = drafts(slider);
    const field = withDrafts(withCommitPolicy(slider, 'panel'), drafted, 'panel');
    expect(field).toMatchObject({ onChange, onInput: drafted.onChange });
  });

  it('drafts typed text a panel leaves live, and commits it through its own writer once the edit settles', () => {
    const live = { ...PARAMS_SETTLES.panel, string: false };
    const drafted = drafts(text);
    const field = withDrafts(withCommitPolicy(text, 'panel', live), withCommitPolicy(drafted, 'panel', live), 'panel', live);
    expect(field).toMatchObject({ onChange, onInput: drafted.onChange });
  });

  it('leaves a control the surface settles, and one with one write per edit, as it is', () => {
    for (const field of [number, text, color, flag]) {
      const settled = withCommitPolicy(field, 'panel');
      expect(withDrafts(settled, drafts(field), 'panel')).toBe(settled);
    }
    expect(withDrafts(slider, null, 'panel')).toBe(slider);
  });
});

describe('PARAMS_TEXT_WAIT_MS', () => {
  it('holds typed text back only in a lab', () => {
    expect(PARAMS_TEXT_WAIT_MS).toEqual({ form: 0, panel: 0, lab: 150 });
  });
});

describe('withCommitPolicy', () => {
  it('settles every control in a form', () => {
    expect([number, slider, text, color].map((field) => settles(field, 'form'))).toEqual([true, true, true, true]);
  });

  it('settles a typed number, text, and a color in a panel, and writes a slider as it moves', () => {
    expect([number, slider, text, color].map((field) => settles(field, 'panel'))).toEqual([true, false, true, true]);
  });

  it('settles nothing in a lab, which follows every change', () => {
    expect([number, slider, text, color].map((field) => settles(field, 'lab'))).toEqual([false, false, false, false]);
  });

  it('writes a live typed number or text through onInput, which a typed field calls per keystroke', () => {
    for (const field of [number, text]) {
      const made = withCommitPolicy(field, 'lab');
      expect(made).toHaveProperty('onInput', onChange);
      expect(made.onChange).not.toBe(onChange);
    }
    expect(withCommitPolicy(slider, 'lab')).toBe(slider);
    expect(withCommitPolicy(color, 'lab')).toBe(color);
  });

  it('leaves a control with one write per edit as it is, on every surface', () => {
    for (const surface of Object.keys(PARAMS_SETTLES) as ParamsSurface[]) expect(withCommitPolicy(flag, surface)).toBe(flag);
  });
});
