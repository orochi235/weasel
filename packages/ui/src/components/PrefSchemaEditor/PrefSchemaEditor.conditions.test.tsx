import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { nodeAt } from './schemaEdit';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const BASE: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      size: { kind: 'number', name: 'Grid size', description: '', default: 8 },
      units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }] } as PrefLeaf,
    } },
  },
};
/** `BASE` with the grid's size shown only while the grid is, and enabled only in millimeters. */
const CONDITIONED: PrefGroup = {
  ...BASE,
  children: { view: { ...(BASE.children.view as PrefGroup), children: {
    ...(BASE.children.view as PrefGroup).children,
    size: { kind: 'number', name: 'Grid size', description: '', default: 8, showIf: { path: 'view.grid', is: true }, enableIf: { path: 'view.units', is: 'mm' } },
  } } },
};

let latest: PrefGroup = BASE;
function Live({ start }: { start: PrefGroup }) {
  const [schema, setSchema] = useState(start);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} original={start} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));
const select = (key: string) => fireEvent.click(within(structure()).getByText(key));
const treeRow = (key: string) => within(structure()).getByText(key).closest('[data-tree-id]') as HTMLElement;
const attr = (name: string) => attributes().getByRole('group', { name });
const pick = (inside: HTMLElement, button: RegExp, option: string | RegExp) => {
  fireEvent.click(within(inside).getByRole('button', { name: button }));
  fireEvent.click(screen.getByRole('option', { name: option }));
};
const held = (path: string) => nodeAt(latest, path) as { showIf?: unknown; enableIf?: unknown };

describe('PrefSchemaEditor: the conditions a node is shown and enabled by', () => {
  it('sets a pref\'s from its attributes, into the schema and the exported literal, and Undo takes it back', () => {
    renderWithIcons(<Live start={BASE} />);
    select('size');
    pick(attr('Shown if'), /Add a condition/, /Show grid/);
    expect(held('view/size').showIf).toEqual({ path: 'view.grid', is: true });
    expect(held('view/size').enableIf).toBeUndefined();
    expect(screen.getByTestId('schema-literal')).toHaveTextContent(/size: \{[^}]*showIf: \{ path: 'view\.grid', is: true,? \}/);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(held('view/size')).not.toHaveProperty('showIf');
  });

  it('sets a group\'s, and removes the attribute with the last row', () => {
    const two: PrefGroup = { ...BASE, children: { ...BASE.children, panels: { name: 'Panels', children: {
      dock: { kind: 'boolean', name: 'Dock', description: '', default: true },
    } } } };
    renderWithIcons(<Live start={two} />);
    select('view');
    pick(attr('Enabled if'), /Add a condition/, /Dock/);
    expect(held('view').enableIf).toEqual({ path: 'panels.dock', is: true });
    fireEvent.click(within(attr('Enabled if')).getByRole('button', { name: 'Remove condition 1' }));
    expect(held('view')).not.toHaveProperty('enableIf');
  });

  it('keeps a condition on the pref it reads when that pref\'s key is changed', () => {
    renderWithIcons(<Live start={CONDITIONED} />);
    select('grid');
    const key = attributes().getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: 'lines' } });
    fireEvent.blur(key);
    expect(held('view/size').showIf).toEqual({ path: 'view.lines', is: true });
  });

  it('marks the row whose condition reads a pref that was removed, and says so on the condition\'s own row', () => {
    renderWithIcons(<Live start={CONDITIONED} />);
    expect(treeRow('size')).not.toHaveTextContent('bad condition');
    select('grid');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(held('view/size').showIf).toEqual({ path: 'view.grid', is: true });
    expect(treeRow('size')).toHaveTextContent('bad condition');
    expect(treeRow('units')).not.toHaveTextContent('bad condition');
    select('size');
    expect(attr('Shown if')).toHaveTextContent('no leaf holds a value at "view.grid"');
    expect(attr('Enabled if')).not.toHaveTextContent('no leaf');
  });

  it('marks the row whose condition compares a pref against a value its new kind never holds', () => {
    renderWithIcons(<Live start={CONDITIONED} />);
    select('units');
    pick(screen.getByRole('region', { name: 'Attributes' }), /Kind/, 'number');
    expect(held('view/size').enableIf).toEqual({ path: 'view.units', is: 'mm' });
    expect(treeRow('size')).toHaveTextContent('bad condition');
    select('size');
    expect(attr('Enabled if')).toHaveTextContent('"view.units" never holds \'mm\': it is a number');
  });

  it('draws conditions that differ as none, marked as mixed, and writes the first edit over them all', () => {
    renderWithIcons(<Live start={CONDITIONED} />);
    select('grid');
    fireEvent.click(within(structure()).getByText('size'), { metaKey: true });
    const shown = attr('Shown if');
    expect(within(shown).queryByRole('group', { name: 'Condition 1' })).toBeNull();
    expect(shown.closest('[data-mixed]')).not.toBeNull();
    expect(held('view/size').showIf).toEqual({ path: 'view.grid', is: true });
    pick(shown, /Add a condition/, /Units/);
    expect(held('view/grid').showIf).toEqual({ path: 'view.units', is: 'px' });
    expect(held('view/size').showIf).toEqual({ path: 'view.units', is: 'px' });
    expect(attr('Shown if').closest('[data-mixed]')).toBeNull();
  });

  it('sets one condition on several prefs at once', () => {
    renderWithIcons(<Live start={CONDITIONED} />);
    select('grid');
    fireEvent.click(within(structure()).getByText('units'), { metaKey: true });
    pick(attr('Shown if'), /Add a condition/, /Grid size/);
    expect(held('view/grid').showIf).toEqual({ path: 'view.size', above: 0 });
    expect(held('view/units').showIf).toEqual({ path: 'view.size', above: 0 });
  });

  it('offers a pref every pref but itself to be conditioned on, and a group none of its own', () => {
    renderWithIcons(<Live start={BASE} />);
    const offered = (): string[] => {
      fireEvent.click(within(attr('Shown if')).getByRole('button', { name: /Add a condition/ }));
      const names = screen.getAllByRole('option').map((o) => (o.textContent ?? '').replace(/ ?view\..*$/, ''));
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
      return names;
    };
    select('size');
    expect(offered()).toEqual(['Show grid', 'Units']);
    fireEvent.click(within(structure()).getByText('units'), { metaKey: true });
    expect(offered()).toEqual(['Show grid']);
    select('view');
    expect(within(attr('Shown if')).getByRole('button', { name: /Add a condition/ })).toBeDisabled();
  });
});
