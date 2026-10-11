import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// jsdom lays nothing out, so the form cannot say what is under a point: the mark is given.
vi.mock('../Prefs', async (original) => ({
  ...(await original<typeof import('../Prefs')>()),
  prefDropTargetAt: () => ({ path: 'panels', where: 'into', rail: true }),
}));

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'string', name: 'Grid color', description: '', default: '' },
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
    } },
    panels: { name: 'Panels', children: { dock: { kind: 'boolean', name: 'Dock', description: '', default: true } } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const item = (key: RegExp) => within(structure()).queryByRole('treeitem', { name: key });

describe('PrefSchemaEditor moves from the live preview', () => {
  it('opens a folded group in the tree when a row is dropped into it', () => {
    render(<Live />);
    fireEvent.click(item(/\(panels\)/)!.querySelector('[data-tree-twisty]')!);
    expect(item(/\(dock\)/)).toBeNull();
    const preview = screen.getByRole('region', { name: 'Live preview' });
    const label = within(preview).getByText('Grid color');
    fireEvent.pointerDown(label, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(label, { clientX: 60, clientY: 60 });
    // The form redraws the row as it is dragged, so the release goes to a row the stage still holds.
    fireEvent.pointerUp(preview.querySelector('[data-pref-path]')!, { clientX: 60, clientY: 60 });
    expect(item(/\(grid\)/)).toHaveAttribute('aria-selected', 'true');
    expect(item(/\(grid\)/)!.closest('[role="group"]')!.closest('[role="treeitem"]')).toHaveAccessibleName(/\(panels\)/);
  });
});
