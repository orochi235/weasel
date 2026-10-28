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
  it('sets whether a leaf can be auto and whether it starts so', () => {
    renderWithIcons(<Live />);
    select('gap');
    const mode = within(attributes().getByRole('radiogroup', { name: 'Auto' }));
    expect(mode.getByRole('radio', { name: 'Allowed' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(mode.getByRole('radio', { name: 'Never' }));
    expect(leaf('gap')).toMatchObject({ manual: true });
    expect('unpinned' in leaf('gap')).toBe(false);
    // The two say three states between them, so picking one clears the other.
    fireEvent.click(mode.getByRole('radio', { name: 'Starts auto' }));
    expect(leaf('gap')).toMatchObject({ unpinned: true });
    expect('manual' in leaf('gap')).toBe(false);
    fireEvent.click(mode.getByRole('radio', { name: 'Allowed' }));
    expect('manual' in leaf('gap') || 'unpinned' in leaf('gap')).toBe(false);
    expect(mode.getByRole('radio', { name: 'Allowed' })).toHaveAttribute('aria-checked', 'true');
  });

  it('leaves the auto value unset, its control off, until the switch beside it is on', () => {
    renderWithIcons(<Live />);
    select('gap');
    const on = () => attributes().getByRole('switch', { name: 'Set Value' });
    expect(on()).not.toBeChecked();
    expect(attributes().getByRole('spinbutton', { name: 'Value' })).toBeDisabled();
    expect(attributes().queryByText('not set')).toBeNull();
    expect(attributes().queryByRole('button', { name: 'Pin Value' })).toBeNull();
    expect('autoValue' in leaf('gap')).toBe(false);
    fireEvent.click(on());
    expect(leaf('gap').autoValue).toBe(12);
    expect(on()).toBeChecked();
    expect(attributes().getByRole('spinbutton', { name: 'Value' })).toBeEnabled();
    fireEvent.click(on());
    expect('autoValue' in leaf('gap')).toBe(false);
  });

  it('keeps an auto value of false, which an optional attribute would drop', () => {
    renderWithIcons(<Live />);
    select('grid');
    expect(attributes().getByRole('checkbox', { name: 'Value' })).toBeDisabled();
    fireEvent.click(attributes().getByRole('switch', { name: 'Set Value' }));
    expect(leaf('grid').autoValue).toBe(true);
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Value' }));
    expect(leaf('grid').autoValue).toBe(false);
    expect(attributes().getByRole('switch', { name: 'Set Value' })).toBeChecked();
  });

  it('draws the switch and the control in a row that is not a label, which would hand its clicks to the switch', () => {
    renderWithIcons(<Live />);
    select('gap');
    expect(attributes().getByRole('switch', { name: 'Set Value' }).closest('[data-property-row]')?.tagName).toBe('DIV');
  });

  it('offers none of it for a leaf that holds no value', () => {
    renderWithIcons(<Live />);
    select('reset');
    expect(attributes().queryByRole('radiogroup', { name: 'Mode' })).toBeNull();
  });
});
