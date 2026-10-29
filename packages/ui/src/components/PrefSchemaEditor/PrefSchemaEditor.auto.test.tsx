import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
      gap: { kind: 'number', name: 'Gap', description: 'Space between cells.', default: 12 },
      reset: { kind: 'action', name: 'Reset', description: '', default: undefined, run: () => {} },
    } },
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));
const select = (key: string) => fireEvent.click(within(structure()).getByText(key));
const leaf = (key: string) => (latest.children.view as PrefGroup).children[key] as unknown as Record<string, unknown>;

describe('PrefSchemaEditor auto attributes', () => {
  it('sets whether a leaf can be auto and whether it starts so, in its one auto field', () => {
    renderWithIcons(<Live />);
    select('gap');
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Never auto' }));
    expect(leaf('gap').auto).toBe(false);
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Starts auto' }));
    expect(leaf('gap').auto).toEqual({ on: true });
    expect(attributes().getByRole('checkbox', { name: 'Never auto' })).not.toBeChecked();
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Starts auto' }));
    expect('auto' in leaf('gap')).toBe(false);
  });

  it('leaves the auto value unset, its control off, until the switch beside it is on', () => {
    renderWithIcons(<Live />);
    select('gap');
    const on = () => attributes().getByRole('switch', { name: 'Set Auto value' });
    expect(on()).not.toBeChecked();
    expect(attributes().getByRole('spinbutton', { name: 'Auto value' })).toBeDisabled();
    expect(attributes().queryByText('not set')).toBeNull();
    expect(attributes().queryByRole('button', { name: 'Pin Auto value' })).toBeNull();
    expect('auto' in leaf('gap')).toBe(false);
    fireEvent.click(on());
    expect(leaf('gap').auto).toEqual({ value: 12 });
    expect(on()).toBeChecked();
    expect(attributes().getByRole('spinbutton', { name: 'Auto value' })).toBeEnabled();
    fireEvent.click(on());
    expect('auto' in leaf('gap')).toBe(false);
  });

  it('keeps an auto value of false, which an optional attribute would drop', () => {
    renderWithIcons(<Live />);
    select('grid');
    expect(attributes().getByRole('checkbox', { name: 'Auto value' })).toBeDisabled();
    fireEvent.click(attributes().getByRole('switch', { name: 'Set Auto value' }));
    expect(leaf('grid').auto).toEqual({ value: true });
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Auto value' }));
    expect(leaf('grid').auto).toEqual({ value: false });
    expect(attributes().getByRole('switch', { name: 'Set Auto value' })).toBeChecked();
  });

  it('draws the switch and the control in a row that is not a label, which would hand its clicks to the switch', () => {
    renderWithIcons(<Live />);
    select('gap');
    expect(attributes().getByRole('switch', { name: 'Set Auto value' }).closest('[data-property-row]')?.tagName).toBe('DIV');
  });

  it('offers none of it for a leaf that holds no value', () => {
    renderWithIcons(<Live />);
    select('reset');
    expect(attributes().queryByRole('checkbox', { name: 'Never auto' })).toBeNull();
  });
});
