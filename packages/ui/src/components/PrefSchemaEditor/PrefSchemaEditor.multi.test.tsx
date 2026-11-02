import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

/** Types `value` and leaves the field, which is when a typed field commits. */
const settle = (el: HTMLElement, value: string): void => {
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
};

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
      snap: { kind: 'boolean', name: 'Snap', description: 'Snap to the grid.', default: false },
      zoom: { kind: 'number', name: 'Zoom', description: 'How far in.', default: 1, min: 0 },
    } },
    panels: { name: 'Panels', children: {
      dock: { kind: 'boolean', name: 'Dock', description: 'Dock panels to the edge.', default: true },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(key);
const item = (key: string) => row(key).closest('[role="treeitem"]')!;
const queryRow = (key: string) => within(structure()).queryByText(key);
const attributes = () => screen.getByRole('region', { name: 'Attributes' });

describe('PrefSchemaEditor with several nodes selected', () => {
  it('adds a row to the selection with Cmd held, and a range with Shift', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(row('grid'));
    fireEvent.click(row('zoom'), { shiftKey: true });
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'false');
  });

  it('selects every row the tree shows with Cmd+A', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.keyDown(item('grid'), { key: 'a', ctrlKey: true });
    for (const key of ['grid', 'snap', 'zoom', 'dock']) expect(item(key)).toHaveAttribute('aria-selected', 'true');
  });

  it('says how many are selected', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    expect(within(attributes()).getByText('2 selected')).toBeInTheDocument();
  });

  it('removes every selected node as one step, and undo brings them back selected', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(queryRow('grid')).toBeNull();
    expect(queryRow('dock')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'true');
  });

  const pickTwo = () => {
    fireEvent.click(row('grid'));
    fireEvent.click(row('snap'), { metaKey: true });
  };
  const field = (name: string) => within(attributes()).getByRole('textbox', { name });

  it('shows no value where the nodes differ, and no key', () => {
    renderWithIcons(<Live />);
    pickTwo();
    expect(field('Name')).toHaveValue('');
    expect(field('Name')).toHaveAttribute('placeholder', 'Mixed');
    expect(within(attributes()).queryByRole('textbox', { name: 'Key' })).toBeNull();
  });

  it('writes an edit to every selected node, as one step back', () => {
    renderWithIcons(<Live />);
    pickTwo();
    settle(field('Description'), 'Both.');
    fireEvent.click(row('grid'));
    expect(field('Description')).toHaveValue('Both.');
    fireEvent.click(row('snap'));
    expect(field('Description')).toHaveValue('Both.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(row('grid'));
    expect(field('Description')).toHaveValue('Draw the grid.');
  });

  it('leaves the keys alone when several nodes are named at once', () => {
    renderWithIcons(<Live />);
    pickTwo();
    fireEvent.focus(field('Name'));
    settle(field('Name'), 'Same');
    fireEvent.blur(field('Name'));
    expect(row('grid')).toBeInTheDocument();
    expect(row('snap')).toBeInTheDocument();
    fireEvent.click(row('snap'));
    expect(field('Name')).toHaveValue('Same');
  });

  const preview = () => screen.getByRole('region', { name: 'Live preview' });
  const previewRow = (label: string) => within(preview()).getByText(label).closest('[data-pref-path]')!;

  it('marks every selected node in the preview', () => {
    renderWithIcons(<Live />);
    pickTwo();
    expect(previewRow('Show grid')).toHaveAttribute('data-selected');
    expect(previewRow('Snap')).toHaveAttribute('data-selected');
    expect(previewRow('Zoom')).not.toHaveAttribute('data-selected');
  });

  it('adds a preview row to the selection with Cmd held, and takes it out again', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.pointerDown(previewRow('Snap'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
    fireEvent.pointerDown(previewRow('Show grid'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'false');
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
  });

  it('takes the preview rows from the first selected to the one pressed with Shift held', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.pointerDown(previewRow('Zoom'), { shiftKey: true });
    for (const key of ['grid', 'snap', 'zoom']) expect(item(key)).toHaveAttribute('aria-selected', 'true');
    // The first selected stays the end the next range runs from.
    fireEvent.pointerDown(previewRow('Snap'), { shiftKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
    expect(item('zoom')).toHaveAttribute('aria-selected', 'false');
  });

  it('offers only what every kind has when the kinds differ', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('zoom'));
    expect(field('Min')).toBeInTheDocument();
    fireEvent.click(row('grid'), { metaKey: true });
    expect(field('Name')).toBeInTheDocument();
    expect(within(attributes()).queryByRole('textbox', { name: 'Min' })).toBeNull();
  });
});
