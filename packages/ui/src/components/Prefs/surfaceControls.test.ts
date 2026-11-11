import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import type { ParamsSurface } from './commitPolicy';
import { prefFieldProps } from './prefField';
import { enumControlAt, PARAMS_CONTROLS, withRowControl } from './surfaceControls';

const leaf = (kind: string, rest: object = {}): PrefLeaf =>
  ({ kind, name: 'Leaf', description: '', default: undefined, ...rest }) as PrefLeaf;

const SURFACES = Object.keys(PARAMS_CONTROLS) as ParamsSurface[];

/** The control each surface draws for `of`, in the order form, panel, lab. */
const controls = (of: PrefLeaf): unknown[] =>
  SURFACES.map((surface) => {
    const field = prefFieldProps(of, { value: undefined, setValue: () => {} }, surface);
    return field && 'control' in field ? field.control : undefined;
  });

describe('prefFieldProps on a surface', () => {
  it('lists the surfaces in the order these tests read them', () => {
    expect(SURFACES).toEqual(['form', 'panel', 'lab']);
  });

  it('draws a toggle flag as a checkbox in a lab', () => {
    expect(controls(leaf('boolean', { control: 'toggle' }))).toEqual(['toggle', 'toggle', 'checkbox']);
    expect(controls(leaf('boolean', { control: 'switch' }))).toEqual(['switch', 'switch', 'switch']);
  });

  it('slides a slider with an end missing on every surface, as it does one with both', () => {
    expect(controls(leaf('number', { control: 'slider', min: 0 }))).toEqual(['slider', 'slider', 'slider']);
    expect(controls(leaf('number', { control: 'slider', max: 0 }))).toEqual(['slider', 'slider', 'slider']);
    expect(controls(leaf('number', { control: 'slider', min: 0, max: 5 }))).toEqual(['slider', 'slider', 'slider']);
  });

  it('draws an enum the control it asks for on every surface', () => {
    const options = [{ value: 'a', label: 'A' }];
    expect(controls(leaf('enum', { control: 'radio', options }))).toEqual(['radio', 'radio', 'radio']);
    expect(controls(leaf('enum', { control: 'menu', options }))).toEqual(['menu', 'menu', 'menu']);
    expect(controls(leaf('enum', { control: 'toggle', options }))).toEqual(['toggle', 'toggle', 'toggle']);
  });

  it('leaves a leaf naming no control without one, for a bar to pick its own', () => {
    expect(controls(leaf('boolean'))).toEqual([undefined, undefined, undefined]);
  });

  it('writes typed text as it is typed only where the surface writes as it goes', () => {
    const text = leaf('string');
    const writesPerKey = SURFACES.map((surface) => {
      let wrote = false;
      const field = prefFieldProps(text, { value: '', setValue: () => (wrote = true) }, surface)!;
      if (field.kind === 'string') field.onInput?.('a');
      return wrote;
    });
    expect(Object.fromEntries(SURFACES.map((surface, i) => [surface, writesPerKey[i]]))).toEqual({
      form: false,
      panel: false,
      lab: true,
    });
  });
});

describe('withRowControl', () => {
  it('gives a flag naming no control the row control of its surface', () => {
    const flag = prefFieldProps(leaf('boolean'), { value: true, setValue: () => {} })!;
    expect(SURFACES.map((surface) => (withRowControl(flag, surface) as { control?: string }).control)).toEqual([
      'checkbox',
      'switch',
      'checkbox',
    ]);
  });

  it('keeps the control a flag names', () => {
    const flag = prefFieldProps(leaf('boolean', { control: 'toggle' }), { value: true, setValue: () => {} })!;
    expect(withRowControl(flag, 'panel')).toBe(flag);
  });
});

describe('enumControlAt', () => {
  const asked = ['select', 'radio', 'toggle', 'menu', undefined] as const;

  it('draws each control as asked in a row, a select where none is named', () => {
    expect(asked.map((c) => enumControlAt(c, 'row'))).toEqual(['select', 'radio', 'toggle', 'menu', 'select']);
  });

  it('draws radios as segments in a bar, which has one line of room', () => {
    expect(asked.map((c) => enumControlAt(c, 'bar'))).toEqual(['select', 'toggle', 'toggle', 'menu', 'select']);
  });

  it('lists the options as radios in a popover where the control would open a popup of its own', () => {
    expect(asked.map((c) => enumControlAt(c, 'popover'))).toEqual(['radio', 'radio', 'toggle', 'radio', 'radio']);
  });
});
