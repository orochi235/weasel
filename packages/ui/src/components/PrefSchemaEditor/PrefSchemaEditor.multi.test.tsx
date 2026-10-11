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
const row = (key: string) => within(structure()).getByText(`(${key})`);
const item = (key: string) => row(key).closest('[role="treeitem"]')!;
const queryRow = (key: string) => within(structure()).queryByText(`(${key})`);
const attributes = () => screen.getByRole('region', { name: 'Attributes' });

describe('PrefSchemaEditor with several nodes selected', () => {
  it('adds a row to the selection with Cmd held, and a range with Shift', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(row('grid'));
    fireEvent.click(row('zoom'), { shiftKey: true });
    expect(item('snap')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'false');
  });

  it('says how many are selected', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    expect(within(attributes()).getByText('2 selected')).toBeInTheDocument();
  });

  it('removes every selected node as one step, and undo brings them back selected', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    fireEvent.click(row('dock'), { metaKey: true });
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(queryRow('grid')).toBeNull();
    expect(queryRow('dock')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(item('grid')).toHaveAttribute('aria-selected', 'true');
    expect(item('dock')).toHaveAttribute('aria-selected', 'true');
  });
});
