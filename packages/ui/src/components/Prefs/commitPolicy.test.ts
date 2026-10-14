import { describe, expect, it } from 'vitest';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS, withCommitPolicy, withDrafts, type ParamsSurface } from './commitPolicy';

const onChange = (): void => {};
const number = { kind: 'number', value: 1, onChange } as PropertyControlProps;
const slider = { kind: 'number', control: 'slider', value: 1, onChange } as PropertyControlProps;
const text = { kind: 'string', value: '', onChange } as PropertyControlProps;
const color = { kind: 'color', value: '#000000', onChange } as PropertyControlProps;
const flag = { kind: 'boolean', value: true, onChange } as PropertyControlProps;

/** Whether the field writes only once an edit settles: it was handed an `onInput` to swallow what comes before. */
const settles = (field: PropertyControlProps, surface: ParamsSurface): boolean =>
  'onInput' in withCommitPolicy(field, surface);

describe('withDrafts', () => {
  const drafts = (field: PropertyControlProps) => ({ ...field, onChange: () => {} }) as PropertyControlProps;

  it('sends a panel slider its moves through the drafts writer, and leaves its own for the value it settles on', () => {
    const drafted = drafts(slider);
    const field = withDrafts(withCommitPolicy(slider, 'panel'), drafted, 'panel');
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
