import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { prefType, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const GradientStop = prefType('GradientStop', {
  kind: 'object', name: 'Stop', description: '', default: { at: 0.5 },
  children: { at: { kind: 'number', name: 'At', description: '', default: 0.5 } },
} as PrefLeaf);

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
      first: { ...GradientStop, name: 'First stop' },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} types={[GradientStop]} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(`(${key})`);
const rows = () => within(structure()).getAllByRole('treeitem').map((r) => r.textContent);
const entryField = (attr: string) => attributes().querySelector<HTMLInputElement>(`[data-pref-path="$entry.${attr}"] input`)!;
const attributes = () => screen.getByRole('region', { name: 'Attributes' });
const literal = () => screen.getByTestId('schema-literal');
const pick = (button: RegExp, option: string) => {
  fireEvent.click(within(attributes()).getByRole('button', { name: button }));
  fireEvent.click(screen.getByRole('option', { name: option }));
};

describe('PrefSchemaEditor over a list, a union and a typed leaf', () => {
  it('shows each as one row, with nothing under it', () => {
    render(<Live />);
    expect(rows().filter((text) => /\((item|circle|at)\)/.test(text ?? ''))).toEqual([]);
    expect(row('phases')).toBeInTheDocument();
    expect(row('shape')).toBeInTheDocument();
    expect(row('first')).toBeInTheDocument();
  });

  it('names a typed leaf\'s row by its type', () => {
    render(<Live />);
    expect(row('first').closest('[role="treeitem"]')).toHaveTextContent('GradientStop');
  });

  it('edits a list\'s entry among the list\'s own attributes', () => {
    render(<Live />);
    fireEvent.click(row('phases'));
    fireEvent.change(entryField('name'), { target: { value: 'Hold' } });
    expect(literal()).toHaveTextContent(/item: \{ kind: 'number', name: 'Hold'/);
  });

  it('changes what an entry is to another kind', () => {
    render(<Live />);
    fireEvent.click(row('phases'));
    pick(/Entry kind/, 'boolean');
    expect(literal()).toHaveTextContent(/item: \{ kind: 'boolean', name: 'Phase'/);
  });

  it('makes an entry a registered type, printed by its name', () => {
    render(<Live />);
    fireEvent.click(row('phases'));
    pick(/Entry kind/, 'GradientStop');
    expect(literal()).toHaveTextContent(/item: GradientStop,/);
  });

  it('offers an entry no kind with a shape of its own', () => {
    render(<Live />);
    fireEvent.click(row('phases'));
    fireEvent.click(within(attributes()).getByRole('button', { name: /Entry kind/ }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('GradientStop');
    for (const kind of ['object', 'list', 'map', 'union']) expect(options).not.toContain(kind);
  });

  it('adds a pref of a registered type by its name, and no blank union', () => {
    render(<Live />);
    fireEvent.click(row('phases'));
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    const dialog = screen.getByRole('dialog', { name: 'Add pref' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Last stop' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Kind/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).not.toContain('union');
    fireEvent.click(screen.getByRole('option', { name: 'GradientStop' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(literal()).toHaveTextContent(/phases: \{.*\}, lastStop: \{ \.\.\.GradientStop, name: 'Last stop', \}, shape: \{/);
  });

  it('prints a typed leaf as its type\'s name under what the leaf sets', () => {
    render(<Live />);
    expect(literal()).toHaveTextContent(/first: \{ \.\.\.GradientStop, name: 'First stop', \}/);
  });

  it('removes a list like any leaf', () => {
    render(<Live />);
    fireEvent.click(row('phases'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(literal()).not.toHaveTextContent(/phases/);
  });
});
