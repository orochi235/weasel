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
      grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

// By selector: a modal dialog hides the rest of the page from the accessibility tree.
const row = (key: string) => document.querySelector<HTMLElement>(`[data-tree-id$="${key}"]`);
const pick = (key: string) => fireEvent.click(row(key)!.firstElementChild!);

describe('PrefSchemaEditor keys pressed in its own dialogs', () => {
  it('leaves the selected node alone when Backspace or Delete is pressed on a dialog\'s button', () => {
    renderWithIcons(<Live />);
    pick('grid');
    expect(row('grid')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    const kind = within(screen.getByRole('dialog', { name: 'Add pref' })).getByRole('button', { name: /Kind/ });
    fireEvent.keyDown(kind, { key: 'Backspace' });
    fireEvent.keyDown(kind, { key: 'Delete' });
    expect(row('grid')).not.toBeNull();
  });

  it('leaves the schema\'s history alone when Mod+Z is pressed in a dialog', () => {
    renderWithIcons(<Live />);
    pick('grid');
    fireEvent.keyDown(row('snap')!, { key: 'Delete' });
    expect(row('grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    fireEvent.keyDown(within(screen.getByRole('dialog', { name: 'Add pref' })).getByRole('textbox', { name: 'Name' }), { key: 'z', ctrlKey: true });
    expect(row('grid')).toBeNull();
  });
});
