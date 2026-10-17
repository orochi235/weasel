import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { keyedRow } from './treeRows.fixture';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'string', name: 'Grid color', description: '', default: '' },
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
    } },
  },
};

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => keyedRow(structure(), key)!.firstElementChild as HTMLElement;
/** The drag ghost, which is portaled out of the editor and hidden from assistive tech. */
const ghost = () => document.querySelector<HTMLElement>('[aria-hidden="true"][class*="ghost"]');

describe('PrefSchemaEditor, a drag begun in the structure tree', () => {
  // jsdom gives the tree no box, so every point is outside it: the proxy for a drag that has left the tree.
  it('shows the node as the form draws it once the drag has left the tree, not the tree\'s row', () => {
    renderWithIcons(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
    const tree = structure();
    tree.setPointerCapture = vi.fn();
    tree.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(row('grid'), { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 400, clientY: 200 });
    const drawn = ghost();
    expect(drawn).not.toBeNull();
    // The form's row for the pref: its label and its control, where the tree's row is the name and the key.
    expect(within(drawn!).getByRole('textbox', { name: 'Grid color', hidden: true })).toBeInTheDocument();
    expect(drawn!.textContent).not.toContain('grid');
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 400, clientY: 200 });
    expect(ghost()).toBeNull();
  });

  it('counts the nodes a drag of several carries', () => {
    renderWithIcons(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
    const tree = structure();
    tree.setPointerCapture = vi.fn();
    tree.releasePointerCapture = vi.fn();
    fireEvent.click(row('grid'));
    fireEvent.click(row('snap'), { metaKey: true });
    fireEvent.pointerDown(row('snap'), { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 400, clientY: 200 });
    expect(ghost()!.textContent).toContain('2');
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 400, clientY: 200 });
  });
});
