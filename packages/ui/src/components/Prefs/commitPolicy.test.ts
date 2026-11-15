import { describe, expect, it } from 'vitest';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS, withCommitPolicy, withDrafts, type ParamsSurface } from './commitPolicy';

const onChange = (): void => {};
const number = { kind: 'number', value: 1, onChange } as PropertyControlProps;
const slider = { kind: 'number', control: 'slider', value: 1, onChange } as PropertyControlProps;
const text = { kind: 'string', value: '', onChange } as PropertyControlProps;
const color = { kind: 'color', value: '#000000', onChange } as PropertyControlProps;
const flag = { kind: 'boolean', value: true, onChange } as PropertyControlProps;

/** Whether the field writes only once an edit settles: it has no `onInput`, and kept its own `onChange`. */
const settles = (field: PropertyControlProps, surface: ParamsSurface): boolean => {
  const made = withCommitPolicy(field, surface);
  return (made as { onInput?: unknown }).onInput === undefined && made.onChange === field.onChange;
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

  it('writes a live control through onInput as well, and commits through its own onChange', () => {
    for (const field of [number, slider, text, color]) {
      const made = withCommitPolicy(field, 'lab');
      expect(made).toMatchObject({ onInput: onChange, onChange });
    }
  });

  it('keeps a live control\'s own onInput', () => {
    const onInput = (): void => {};
    expect(withCommitPolicy({ ...slider, onInput } as PropertyControlProps, 'lab')).toMatchObject({ onInput, onChange });
  });

  it('leaves a control with one write per edit as it is, on every surface', () => {
    for (const surface of Object.keys(PARAMS_SETTLES) as ParamsSurface[]) expect(withCommitPolicy(flag, surface)).toBe(flag);
  });
});
