import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { keyedRow } from './treeRows.fixture';

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } },
    panels: { name: 'Panels', children: { dock: { kind: 'boolean', name: 'Dock', description: '', default: true } } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).queryByText(key);

describe('PrefSchemaEditor folds across undo', () => {
  it('keeps a group open when its re-keying is undone and redone', () => {
    render(<Live />);
    // A click on a group's row folds it, and a second opens it again.
    fireEvent.click(row('view')!);
    fireEvent.click(row('view')!);
    expect(row('grid')).not.toBeNull();
    const key = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: 'display' } });
    fireEvent.blur(key);
    expect(keyedRow(structure(), 'display')).toHaveAttribute('aria-expanded', 'true');
    expect(row('grid')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(row('view')).not.toBeNull();
    expect(row('grid')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(row('display')).not.toBeNull();
    expect(row('grid')).not.toBeNull();
  });
});
