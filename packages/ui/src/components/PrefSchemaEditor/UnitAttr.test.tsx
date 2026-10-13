import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefLinearUnit, PrefNumber } from '@weasel-js/prefs';
import { ATTR_RENDERERS } from './attrRenderers';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

interface Seen { unit?: PrefLinearUnit }

function Unit({ seen, start }: { seen: Seen; start?: PrefLinearUnit }) {
  const [value, setValue] = useState<PrefLinearUnit | undefined>(start);
  seen.unit = value;
  return <>{ATTR_RENDERERS.unit({
    path: 'unit', pref: { kind: 'unit', name: 'Unit', description: '', default: undefined }, value,
    setValue: (v) => setValue(v as PrefLinearUnit | undefined), auto: false, setAuto: () => {},
  })}</>;
}

const box = (name: string) => screen.getByRole('textbox', { name });
const type = (name: string, text: string) => fireEvent.change(box(name), { target: { value: text } });
/** A number is taken when its field is left. */
const enter = (name: string, text: string) => {
  type(name, text);
  fireEvent.blur(box(name));
};

describe('the unit attribute', () => {
  it('is several controls, which a label may not wrap', () => {
    expect(ATTR_RENDERERS.unit.group).toBe(true);
  });

  it('makes a unit of a suffix typed where there was none, at a scale of 1', () => {
    const seen: Seen = {};
    render(<Unit seen={seen} />);
    expect(box('Unit scale')).toHaveValue('1');
    type('Unit suffix', '°');
    expect(seen.unit).toEqual({ suffix: '°', scale: 1 });
  });

  it('takes a scale, an offset, and a count of places when each field is left', () => {
    const seen: Seen = {};
    render(<Unit seen={seen} start={{ suffix: '°C', scale: 1 }} />);
    enter('Unit scale', '0.5');
    enter('Unit offset', '273.15');
    enter('Unit places', '1');
    expect(seen.unit).toEqual({ suffix: '°C', scale: 0.5, offset: 273.15, precision: 1 });
  });

  it('refuses a scale of zero, text that is no number, and places that are no whole count', () => {
    const seen: Seen = {};
    const start = { suffix: 'cm', scale: 10 };
    render(<Unit seen={seen} start={start} />);
    enter('Unit scale', '0');
    expect(box('Unit scale')).toHaveValue('10');
    enter('Unit scale', 'ten');
    enter('Unit places', '1.5');
    enter('Unit places', '-1');
    expect(box('Unit places')).toHaveValue('');
    expect(seen.unit).toEqual(start);
  });

  it('removes the unit once nothing of it is left: no suffix, a scale of 1, nothing else', () => {
    const seen: Seen = {};
    render(<Unit seen={seen} start={{ suffix: 'cm', scale: 10, offset: 2, precision: 1 }} />);
    enter('Unit offset', '');
    enter('Unit places', '');
    expect(seen.unit).toEqual({ suffix: 'cm', scale: 10 });
    enter('Unit scale', '');
    expect(seen.unit).toEqual({ suffix: 'cm', scale: 1 });
    type('Unit suffix', '');
    expect(seen.unit).toBeUndefined();
  });

  it('adds a suffix to accept, as a bare scale until it has an offset, and removes it', () => {
    const seen: Seen = {};
    render(<Unit seen={seen} start={{ suffix: 'cm', scale: 10 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add accepted suffix' }));
    type('Accepted suffix 1', 'mm');
    enter('Accepted suffix 1 scale', '0.1');
    expect(seen.unit).toEqual({ suffix: 'cm', scale: 10, accepts: { mm: 0.1 } });
    enter('Accepted suffix 1 offset', '3');
    expect(seen.unit?.accepts).toEqual({ mm: { factor: 0.1, offset: 3 } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove accepted suffix 1' }));
    expect(seen.unit).toEqual({ suffix: 'cm', scale: 10 });
  });

  it('keeps the accepted suffixes in order as one is renamed, and refuses a name another holds', () => {
    const seen: Seen = {};
    render(<Unit seen={seen} start={{ scale: 10, accepts: { mm: 0.1, m: 100 } }} />);
    type('Accepted suffix 1', 'mil');
    expect(Object.keys(seen.unit!.accepts!)).toEqual(['mil', 'm']);
    type('Accepted suffix 1', 'm');
    expect(seen.unit!.accepts).toEqual({ mil: 0.1, m: 100 });
  });

  it('refuses an accepted suffix that starts with a digit, which a typed number would end in', () => {
    const seen: Seen = {};
    render(<Unit seen={seen} start={{ scale: 10, accepts: { mm: 0.1, m: 100 } }} />);
    type('Accepted suffix 2', '2');
    type('Accepted suffix 2', '2x');
    expect(seen.unit).toEqual({ scale: 10, accepts: { mm: 0.1, m: 100 } });
    expect(box('Accepted suffix 2')).toHaveValue('m');
    type('Accepted suffix 2', 'm2');
    expect(Object.keys(seen.unit!.accepts!)).toEqual(['mm', 'm2']);
  });
});

const START: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { zoom: { kind: 'number', name: 'Zoom', description: '', default: 1 } } } },
};

describe('a number pref selected in PrefSchemaEditor', () => {
  it('takes a unit from its attributes as one step, which Undo takes back', () => {
    let latest = START;
    function Live() {
      const [schema, setSchema] = useState(START);
      latest = schema;
      return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
    }
    render(<Live />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('(zoom)'));
    const attributes = screen.getByRole('region', { name: 'Attributes' });
    fireEvent.change(within(attributes).getByRole('textbox', { name: 'Unit suffix' }), { target: { value: '%' } });
    const zoom = () => (latest.children.view as PrefGroup).children.zoom as PrefNumber;
    expect(zoom().unit).toEqual({ suffix: '%', scale: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(zoom()).not.toHaveProperty('unit');
  });
});
