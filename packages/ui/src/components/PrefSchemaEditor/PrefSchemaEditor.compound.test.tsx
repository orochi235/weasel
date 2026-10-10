import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    timing: { name: 'Timing', children: {
      phases: {
        kind: 'list', name: 'Phases', description: '', default: [],
        item: { kind: 'number', name: 'Phase', description: '', default: 0 },
      },
      shape: {
        kind: 'union', name: 'Shape', description: '', tag: 'type', default: { type: 'circle' },
        variants: { circle: { kind: 'object', name: 'Circle', description: '', default: {}, children: {} } },
      },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(`(${key})`);
const attributes = () => screen.getByRole('region', { name: 'Attributes' });
const literal = () => screen.getByTestId('schema-literal');

describe('PrefSchemaEditor over a list and a union', () => {
  it('shows a list\'s item as a row under it, edited like any leaf but for its key', () => {
    render(<Live />);
    fireEvent.click(row('item'));
    expect(within(attributes()).queryByRole('textbox', { name: 'Key' })).toBeNull();
    fireEvent.change(within(attributes()).getByRole('textbox', { name: 'Name' }), { target: { value: 'Hold' } });
    expect(literal()).toHaveTextContent(/item: \{ kind: 'number', name: 'Hold'/);
  });

  it('changes an item\'s kind in place', () => {
    render(<Live />);
    fireEvent.click(row('item'));
    fireEvent.click(within(attributes()).getByRole('button', { name: /^(?!About ).*Kind/ }));
    fireEvent.click(screen.getByRole('option', { name: 'boolean' }));
    expect(literal()).toHaveTextContent(/item: \{ kind: 'boolean', name: 'Phase'/);
  });

  it('will not remove an item, by the button or by Delete', () => {
    render(<Live />);
    fireEvent.click(row('item'));
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(row('item')).toBeInTheDocument();
  });

  it('adds a pref after the list when its item is selected', () => {
    render(<Live />);
    fireEvent.click(row('item'));
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    const dialog = screen.getByRole('dialog', { name: 'Add pref' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Gap' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Kind/ }));
    fireEvent.click(screen.getByRole('option', { name: 'number' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(literal()).toHaveTextContent(/phases: \{.*\}, gap: \{.*shape: \{/);
  });

  it('adds only object leaves to a union, as its variants, and keeps a variant an object', () => {
    render(<Live />);
    fireEvent.click(row('shape'));
    expect(screen.getByRole('button', { name: /^Add (group|section)$/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    const dialog = screen.getByRole('dialog', { name: 'Add pref' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Kind/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['object']);
    fireEvent.click(screen.getByRole('option', { name: 'object' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Box' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(literal()).toHaveTextContent(/variants: \{ circle: \{.*box: \{ kind: 'object', name: 'Box'/);
    fireEvent.click(row('box'));
    expect(within(attributes()).queryByRole('button', { name: /^(?!About ).*Kind/ })).toBeNull();
    expect(within(attributes()).getByRole('textbox', { name: 'Key' })).toHaveValue('box');
  });
});
