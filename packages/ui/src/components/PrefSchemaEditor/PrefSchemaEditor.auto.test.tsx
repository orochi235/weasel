import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

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
const select = (key: string) => fireEvent.click(within(structure()).getByText(`(${key})`));
const leaf = (key: string) => (latest.children.view as PrefGroup).children[key] as unknown as Record<string, unknown>;

describe('PrefSchemaEditor auto attributes', () => {
  it('sets whether a leaf can be auto and whether it starts so', () => {
    render(<Live />);
    select('gap');
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Never auto' }));
    expect(leaf('gap').manual).toBe(true);
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Starts auto' }));
    expect(leaf('gap').unpinned).toBe(true);
  });

  it('leaves the auto value unset until its label pins it, starting from the default', () => {
    render(<Live />);
    select('gap');
    const pin = attributes().getByRole('button', { name: 'Pin Auto value' });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    expect(attributes().getByText('not set')).toBeInTheDocument();
    expect('autoValue' in leaf('gap')).toBe(false);
    fireEvent.click(pin);
    expect(leaf('gap').autoValue).toBe(12);
    fireEvent.click(attributes().getByRole('button', { name: 'Pin Auto value' }));
    expect('autoValue' in leaf('gap')).toBe(false);
  });

  it('keeps an auto value of false, which an optional attribute would drop', () => {
    render(<Live />);
    select('grid');
    fireEvent.click(attributes().getByRole('button', { name: 'Pin Auto value' }));
    expect(leaf('grid').autoValue).toBe(true);
    fireEvent.click(attributes().getByRole('checkbox', { name: 'Auto value' }));
    expect(leaf('grid').autoValue).toBe(false);
  });

  it('offers none of it for a leaf that holds no value', () => {
    render(<Live />);
    select('reset');
    expect(attributes().queryByRole('checkbox', { name: 'Never auto' })).toBeNull();
  });
});
