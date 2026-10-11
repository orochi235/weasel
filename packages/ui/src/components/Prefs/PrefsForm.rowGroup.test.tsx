import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const OPTIONS = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
const style = (control: string): PrefLeaf =>
  ({ kind: 'enum', name: 'Style', description: '', default: 'b', options: OPTIONS, control }) as PrefLeaf;

const top = (leaf: PrefLeaf): PrefGroup => ({ name: 'Prefs', children: { style: leaf } });
const nested = (leaf: PrefLeaf): PrefGroup => ({
  name: 'Prefs',
  children: {
    box: { kind: 'object', name: 'Box', description: '', default: { style: 'b' }, children: { style: leaf } } as PrefLeaf,
  },
});

/** The leaf's own row: the last one drawn, inside the object leaf's where there is one. */
const row = (): Element => [...document.querySelectorAll('[data-property-row]')].at(-1)!;

describe.each([['a row of its own', top], ['a field of an object leaf', nested]] as const)('PrefsForm, %s', (_, schema) => {
  it('does not hand a click on the name of a radio enum to its first option', () => {
    const onChange = vi.fn();
    render(<PrefsForm layout="list" schema={schema(style('radio'))} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('Style'));
    expect(onChange).not.toHaveBeenCalled();
    expect(row().tagName).toBe('DIV');
    expect(screen.getByRole('radio', { name: 'Apple' })).toBeInTheDocument();
  });

  it.each(['toggle', 'menu'])('draws a %s enum as a group, not inside a label', (control) => {
    render(<PrefsForm layout="list" schema={schema(style(control))} values={{}} onChange={() => {}} />);
    expect(row().tagName).toBe('DIV');
  });

  it('keeps a select enum inside its label', () => {
    render(<PrefsForm layout="list" schema={schema(style('select'))} values={{}} onChange={() => {}} />);
    expect(row().tagName).toBe('LABEL');
  });

  it.each(['switch', 'toggle'])('draws a %s boolean as a group, not inside a label', (control) => {
    const leaf = { kind: 'boolean', name: 'Style', description: '', default: false, control } as PrefLeaf;
    render(<PrefsForm layout="list" schema={schema(leaf)} values={{}} onChange={() => {}} />);
    expect(row().tagName).toBe('DIV');
  });
});
