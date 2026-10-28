import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, getDefaultNormalizer, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { keyedRow, rowKey } from './treeRows.fixture';
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
    } },
    panels: { name: 'Panels', children: {
      dock: { kind: 'boolean', name: 'Dock', description: 'Dock panels to the edge.', default: true },
    } },
  },
};

function Live({ start = START }: { start?: PrefGroup }) {
  const [schema, setSchema] = useState(start);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
/** A row in the structure tree, by the key it shows after its name. */
const row = (key: string) => within(structure()).getByText(key);
const preview = () => screen.getByRole('region', { name: 'Live preview' });

describe('PrefSchemaEditor', () => {
  it('shows the schema as a tree and the preview as a form', () => {
    renderWithIcons(<Live />);
    expect(within(structure()).getByRole('treeitem', { name: /view/ })).toBeInTheDocument();
    expect(within(preview()).getByText('Show grid')).toBeInTheDocument();
  });

  it('resizes the structure and attributes columns from the handles between them', () => {
    const { container } = renderWithIcons(<Live />);
    const editor = container.firstElementChild as HTMLElement;
    const before = (v: string) => editor.style.getPropertyValue(v);
    const structureWidth = before('--structure-w');
    const attributesWidth = before('--attributes-w');
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize structure' }), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize attributes' }), { key: 'ArrowLeft' });
    expect(parseFloat(before('--structure-w'))).toBeGreaterThan(parseFloat(structureWidth));
    expect(parseFloat(before('--attributes-w'))).toBeLessThan(parseFloat(attributesWidth));
  });

  it('edits a leaf attribute and the preview follows', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    settle(name, 'Grid on');
    expect(within(preview()).getByText('Grid on')).toBeInTheDocument();
  });

  it('sets the attributes every kind shares beside Key and Kind, and the kind\'s own in a panel below', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    const top = screen.getByRole('region', { name: 'Attributes' });
    // The kind's own attributes are a panel named by its heading.
    const own = within(top).getByRole('group', { name: 'boolean' });
    expect(within(top).queryByRole('heading', { name: /^(Pref|Group)$/ })).toBeNull();
    for (const field of ['Key', 'Name', 'Description']) {
      expect(within(top).getByRole('textbox', { name: field })).toBeInTheDocument();
      expect(within(own).queryByRole('textbox', { name: field })).toBeNull();
    }
    expect(within(top).getByRole('button', { name: /^(?!About ).*Kind/ })).toBeInTheDocument();
    expect(within(own).getByRole('checkbox', { name: 'Default' })).toBeInTheDocument();
  });

  const openAdd = (what: 'Add pref' | 'Add group' | 'Add section') => {
    fireEvent.click(screen.getByRole('button', { name: what }));
    return screen.getByRole('dialog', { name: what });
  };
  const pickKind = (dialog: HTMLElement, kind: string) => {
    fireEvent.click(within(dialog).getByRole('button', { name: /Kind/ }));
    fireEvent.click(screen.getByRole('option', { name: kind }));
  };

  it('adds a pref into the selected group from a name, an id and a kind, and lists it under Changes', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('view'));
    const dialog = openAdd('Add pref');
    settle(within(dialog).getByRole('textbox', { name: 'Name' }), 'Line width');
    expect(within(dialog).getByRole('textbox', { name: 'Key' })).toHaveValue('lineWidth');
    pickKind(dialog, 'number');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('dialog', { name: 'Add pref' })).toBeNull();
    expect(within(structure()).getByText('Line width')).toBeInTheDocument();
    const exact = getDefaultNormalizer({ collapseWhitespace: false });
    expect(screen.getByText(/\+ view\/lineWidth {2}\(number\)/, { normalizer: exact })).toBeInTheDocument();
  });

  it('adds nothing until a pref has a name, a free id and a kind', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('view'));
    const dialog = openAdd('Add pref');
    const add = within(dialog).getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    settle(within(dialog).getByRole('textbox', { name: 'Name' }), 'Snap');
    pickKind(dialog, 'boolean');
    expect(within(dialog).getByText(/"snap" is taken here/)).toBeInTheDocument();
    expect(add).toBeDisabled();
    settle(within(dialog).getByRole('textbox', { name: 'Key' }), 'snapAngle');
    expect(add).toBeEnabled();
  });

  it('adds a group with no name, keyed by the id given', () => {
    renderWithIcons(<Live />);
    const dialog = openAdd('Add group');
    settle(within(dialog).getByRole('textbox', { name: 'Key' }), 'misc');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(structure()).getByText('misc')).toBeInTheDocument();
  });

  it('shows a row as its name with its key, and a nameless one as its key alone', () => {
    renderWithIcons(<Live start={{ name: 'Prefs', children: { bare: { name: '', children: {} }, view: START.children.view! } }} />);
    expect(within(structure()).getByRole('treeitem', { name: /^View view/ })).toBeInTheDocument();
    expect(within(structure()).getByRole('treeitem', { name: /^bare 0$/ })).toBeInTheDocument();
  });

  it('draws a group\'s row with the glyph of the palette tool that makes it, and a leaf\'s with its kind\'s', () => {
    renderWithIcons(<Live start={{ name: 'Prefs', children: { view: { ...START.children.view!, children: {
      box: { name: 'Box', as: 'panel', children: {} },
      grid: (START.children.view as PrefGroup).children.grid!,
    } } } }} />);
    const glyph = (el: Element | null) => el?.querySelector('svg')?.innerHTML;
    const tool = (name: string) => glyph(screen.getByRole('button', { name }));
    const leading = (key: string) => glyph(row(key).closest('[role="treeitem"]')!.querySelector('[class*="leading"]'));
    expect(leading('view')).toBe(tool('Page'));
    expect(leading('box')).toBe(tool('Panel'));
    expect(leading('grid')).toBeTruthy();
    expect(leading('grid')).not.toBe(tool('Page'));
  });

  it('opens a page from a press and release on its rail entry in the preview, with no click of the browser\'s', () => {
    renderWithIcons(<Live />);
    const entry = within(preview()).getByRole('button', { name: 'Panels' });
    fireEvent.pointerDown(entry, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(entry, { clientX: 5, clientY: 5 });
    expect(within(preview()).getByText('Dock')).toBeInTheDocument();
  });

  it('selects a group in the tree and the attributes pane from a press on its rail entry in the preview', () => {
    renderWithIcons(<Live />);
    const entry = within(preview()).getByRole('button', { name: 'Panels' });
    fireEvent.pointerDown(entry, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(entry, { clientX: 5, clientY: 5 });
    expect(within(structure()).getByRole('treeitem', { name: /panels/, selected: true })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('panels');
  });

  it('narrows the tree to the rows a filter matches, under the branches that hold them', () => {
    renderWithIcons(<Live />);
    settle(screen.getByRole('textbox', { name: 'Filter structure' }), 'dock');
    expect(keyedRow(structure(), 'dock')).toBeInTheDocument();
    expect(keyedRow(structure(), 'panels')).toBeInTheDocument();
    expect(keyedRow(structure(), 'view')).toBeNull();
  });

  it('narrows the structure and the unplaced rows by a tag as by a name', () => {
    const start: PrefGroup = { name: 'Prefs', children: {
      ...START.children,
      panels: { name: 'Panels', children: { dock: { kind: 'boolean', name: 'Dock', description: '', default: true, tags: ['sidebar'] } } },
    } };
    const waiting: PrefGroup = { name: '', children: { glow: { kind: 'boolean', name: 'Glow', description: '', default: false, tags: ['halo'] } } };
    renderWithIcons(<PrefSchemaEditor schema={start} onChange={() => {}} unplaced={waiting} />);
    const filter = screen.getByRole('textbox', { name: 'Filter structure' });
    fireEvent.change(filter, { target: { value: 'Sideb' } });
    expect(keyedRow(structure(), 'dock')).toBeInTheDocument();
    expect(keyedRow(structure(), 'view')).toBeNull();
    fireEvent.change(filter, { target: { value: 'halo' } });
    expect(keyedRow(screen.getByRole('tree', { name: 'Unplaced' }), 'glow')).toBeInTheDocument();
  });

  it('narrows the unplaced rows by the same filter', () => {
    const start: PrefGroup = { name: '', children: { ...START.children, author: { kind: 'string', name: 'Author', description: '', default: '' } } };
    const waiting: PrefGroup = { name: '', children: { glow: { kind: 'boolean', name: 'Glow', description: '', default: false } } };
    renderWithIcons(<PrefSchemaEditor schema={start} onChange={() => {}} unplaced={waiting} />);
    const unplaced = screen.getByRole('tree', { name: 'Unplaced' });
    settle(screen.getByRole('textbox', { name: 'Filter structure' }), 'glo');
    expect(keyedRow(unplaced, 'glow')).toBeInTheDocument();
    expect(keyedRow(unplaced, 'author')).toBeNull();
  });

  it('sets the host\'s controls, the palette, and the add and remove buttons in one bar above the panes', () => {
    renderWithIcons(<PrefSchemaEditor schema={START} onChange={() => {}} bar={<button type="button">Source</button>} />);
    const bar = screen.getByRole('group', { name: 'Schema tools' });
    for (const name of ['Source', 'Page', 'Add pref', 'Add group', 'Remove', 'Undo', 'Redo'])
      expect(within(bar).getByRole('button', { name })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Structure' })).queryByRole('button', { name: 'Add pref' })).toBeNull();
  });

  it('drops what it submitted from the changes once the host says the source took it', async () => {
    const renamed: PrefGroup = { ...START, children: { ...START.children, view: { ...(START.children.view as PrefGroup), name: 'Viewing' } } };
    function Host({ original, taken }: { original: PrefGroup; taken: boolean }) {
      const [schema, setSchema] = useState(renamed);
      return <PrefSchemaEditor schema={schema} onChange={setSchema} original={original} taken={taken} onSubmit={async () => {}} />;
    }
    const changes = () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
      return screen.getByRole('region', { name: 'Export' });
    };
    const { rerender } = renderWithIcons(<Host original={START} taken={false} />);
    expect(within(changes()).queryByText('No changes.')).toBeNull();
    await act(async () => { fireEvent.click(within(changes()).getByRole('button', { name: 'Submit' })); });
    // The source took the rename in words of its own, which only the host's say-so tells from an edit still owed.
    const took: PrefGroup = { ...START, children: { ...START.children, view: { ...(START.children.view as PrefGroup), name: 'Views' } } };
    rerender(<Host original={took} taken={false} />);
    expect(within(changes()).queryByText('No changes.')).toBeNull();
    rerender(<Host original={took} taken />);
    expect(within(changes()).getByText('No changes.')).toBeInTheDocument();
  });

  it('offers no group inside one that already sits at the depth allowed', () => {
    renderWithIcons(<PrefSchemaEditor schema={START} onChange={() => {}} maxDepth={1} />);
    const add = screen.getByRole('button', { name: 'Add group' });
    expect(add).toBeEnabled();
    fireEvent.click(row('view'));
    expect(add).toBeDisabled();
  });

  it('draws the host\'s mark on a row by where its node sits in the original, wherever it has been moved', () => {
    const mark = (original: string) => (original === 'view.grid' ? <b data-testid="mark">m</b> : null);
    const moved: PrefGroup = { ...START, children: {
      view: { ...(START.children.view as PrefGroup), children: { snap: (START.children.view as PrefGroup).children.snap! } },
      panels: { ...(START.children.panels as PrefGroup), children: { ...(START.children.panels as PrefGroup).children, grid: (START.children.view as PrefGroup).children.grid! } },
    } };
    const { rerender } = renderWithIcons(<PrefSchemaEditor schema={START} original={START} onChange={() => {}} rowMark={mark} />);
    expect(rowKey(screen.getByTestId('mark').closest('[role="treeitem"]')!)).toBe('grid');
    rerender(<PrefSchemaEditor schema={moved} original={START} onChange={() => {}} rowMark={mark} />);
    expect(screen.getAllByTestId('mark')).toHaveLength(1);
    expect(rowKey(screen.getByTestId('mark').closest('[role="group"]')!.closest('[role="treeitem"]')!)).toBe('panels');
  });

  it('opens with the rows folded that were folded under its draft key last time', () => {
    localStorage.clear();
    const first = renderWithIcons(<PrefSchemaEditor schema={START} onChange={() => {}} draftKey="folds-test" />);
    fireEvent.click(row('view').closest('[role="treeitem"]')!.querySelector('[data-tree-twisty]')!);
    expect(keyedRow(structure(), 'view')).toHaveAttribute('aria-expanded', 'false');
    first.unmount();
    renderWithIcons(<PrefSchemaEditor schema={START} onChange={() => {}} draftKey="folds-test" />);
    expect(keyedRow(structure(), 'view')).toHaveAttribute('aria-expanded', 'false');
    expect(keyedRow(structure(), 'panels')).toHaveAttribute('aria-expanded', 'true');
    localStorage.clear();
  });

  it('undoes and redoes an edit, from its buttons and from the keyboard', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    const name = () => within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    settle(name(), 'Grid on');
    fireEvent.click(undo);
    expect(within(preview()).getByText('Show grid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(within(preview()).getByText('Grid on')).toBeInTheDocument();
    fireEvent.keyDown(name(), { key: 'z', metaKey: true });
    expect(within(preview()).getByText('Show grid')).toBeInTheDocument();
    fireEvent.keyDown(name(), { key: 'z', metaKey: true, shiftKey: true });
    expect(within(preview()).getByText('Grid on')).toBeInTheDocument();
  });

  it('undoes a run of keystrokes in one field as one step', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    const name = () => within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    for (const typed of ['G', 'Gr', 'Gri', 'Grid']) settle(name(), typed);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(preview()).getByText('Show grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('undoes a removal, and selects the node again', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('snap'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(within(structure()).queryByText('snap')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(structure()).getByRole('treeitem', { name: /^Snap snap/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('starts the history over on a schema it did not write', () => {
    function Swap() {
      const [schema, setSchema] = useState(START);
      return (
        <>
          <button type="button" onClick={() => setSchema({ name: 'Other', children: {} })}>swap</button>
          <PrefSchemaEditor schema={schema} onChange={setSchema} />
        </>
      );
    }
    renderWithIcons(<Swap />);
    fireEvent.click(row('snap'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'swap' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('labels the preview and can hide hidden prefs', () => {
    const start: PrefGroup = { name: 'Prefs', children: { page: { name: 'Page', children: {
      shown: { kind: 'boolean', name: 'Shown', description: '', default: false },
      secret: { kind: 'boolean', name: 'Secret', description: '', default: false, hidden: true },
    } } } };
    renderWithIcons(<Live start={start} />);
    expect(within(preview()).getByRole('heading', { name: 'Live preview' })).toBeInTheDocument();
    expect(within(preview()).getByText('Secret')).toBeInTheDocument();
    fireEvent.click(within(preview()).getByRole('switch', { name: 'Show hidden' }));
    expect(within(preview()).queryByText('Secret')).toBeNull();
  });

  it('writes a value set in the preview as that pref\'s default, and undoes it', () => {
    renderWithIcons(<Live />);
    const snap = () => within(preview()).getByRole('checkbox', { name: 'Snap' });
    expect(snap()).not.toBeChecked();
    fireEvent.click(snap());
    expect(snap()).toBeChecked();
    expect(screen.getByTestId('schema-literal')).toHaveTextContent(/snap: \{[^}]*default: true/);
    expect(screen.getByText(/~ view\/snap/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(snap()).not.toBeChecked();
    expect(screen.getByTestId('schema-literal')).toHaveTextContent(/snap: \{[^}]*default: false/);
  });

  it('removes the selected node on Delete or Backspace, and leaves a key pressed in a text field to the field', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('snap'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.keyDown(name, { key: 'Backspace' });
    expect(row('snap')).toBeInTheDocument();
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(within(structure()).queryByText('snap')).toBeNull();
    fireEvent.click(row('dock'));
    fireEvent.keyDown(preview(), { key: 'Backspace' });
    expect(within(structure()).queryByText('dock')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(row('dock')).toBeInTheDocument();
  });

  it('counts the leaves under each branch of the tree, at any depth', () => {
    const start: PrefGroup = { name: 'Prefs', children: {
      view: { name: 'View', children: {
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
        more: { name: 'More', children: { snap: { kind: 'boolean', name: 'Snap', description: '', default: false } } },
      } },
    } };
    renderWithIcons(<Live start={start} />);
    const item = (name: RegExp) => within(structure()).getByRole('treeitem', { name });
    expect(within(item(/View/)).getAllByText('2')[0]).toBeInTheDocument();
    expect(within(item(/More/)).getAllByText('1')[0]).toBeInTheDocument();
  });

  describe('with a draft key', () => {
    function Kept() {
      const [schema, setSchema] = useState(START);
      return <PrefSchemaEditor schema={schema} onChange={setSchema} original={START} draftKey="test-draft" />;
    }
    afterEach(() => localStorage.removeItem('test-draft'));

    it('opens on the edits a previous editor left, still listed as changes from the baseline', () => {
      const first = renderWithIcons(<Kept />);
      expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull();
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      expect(screen.getByText(/Draft saved/)).toBeInTheDocument();
      first.unmount();
      renderWithIcons(<Kept />);
      expect(within(structure()).queryByText('snap')).toBeNull();
      expect(row('grid')).toBeInTheDocument();
      expect(screen.getByText(/− view\/snap/)).toBeInTheDocument();
    });

    it('keeps the draft in the storage it is given, and nothing in localStorage', () => {
      const held = new Map<string, string>();
      const storage = {
        getItem: (key: string) => held.get(key) ?? null,
        setItem: (key: string, value: string) => void held.set(key, value),
        removeItem: (key: string) => void held.delete(key),
      };
      function Filed() {
        const [schema, setSchema] = useState(START);
        return <PrefSchemaEditor schema={schema} onChange={setSchema} original={START} draftKey="test-draft" draftStorage={storage} />;
      }
      const first = renderWithIcons(<Filed />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      expect(held.has('test-draft')).toBe(true);
      expect(localStorage.getItem('test-draft')).toBeNull();
      first.unmount();
      renderWithIcons(<Filed />);
      expect(within(structure()).queryByText('snap')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(held.has('test-draft')).toBe(false);
    });

    it('still steps back and forward through a previous editor’s edits', () => {
      const first = renderWithIcons(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      fireEvent.click(row('grid'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      first.unmount();
      renderWithIcons(<Kept />);
      expect(row('grid')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
      expect(within(structure()).queryByText('grid')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(row('snap')).toBeInTheDocument();
      expect(row('grid')).toBeInTheDocument();
      // Back on the baseline itself, not a copy of it: nothing is left to keep.
      expect(screen.getByText('No changes.')).toBeInTheDocument();
      expect(localStorage.getItem('test-draft')).toBeNull();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('opens a draft whose steps do not read, without them', () => {
      const first = renderWithIcons(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      first.unmount();
      const draft = JSON.parse(localStorage.getItem('test-draft')!);
      localStorage.setItem('test-draft', JSON.stringify({ ...draft, steps: { schemas: [], current: 4, stacks: {} } }));
      renderWithIcons(<Kept />);
      expect(within(structure()).queryByText('snap')).toBeNull();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('carries a draft onto a source that changed since, listing only the reader’s own edits', () => {
      const first = renderWithIcons(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      first.unmount();
      const view = START.children.view as PrefGroup;
      const grid = view.children.grid!;
      const moved: PrefGroup = { ...START, children: { ...START.children, view: { ...view, children: { ...view.children, grid: { ...grid, name: 'Grid lines' } } } } };
      function Later() {
        const [schema, setSchema] = useState(moved);
        return <PrefSchemaEditor schema={schema} onChange={setSchema} original={moved} draftKey="test-draft" />;
      }
      renderWithIcons(<Later />);
      expect(within(structure()).queryByText('snap')).toBeNull();
      expect(within(structure()).getByText('Grid lines')).toBeInTheDocument();
      expect(screen.getByText(/− view\/snap/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
      expect(within(screen.getByRole('tabpanel', { name: 'Changes' })).queryByText(/grid/)).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('The source changed since this draft was saved.');
      // And the step that made the edit still goes back, to the new source.
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(row('snap')).toBeInTheDocument();
      expect(screen.getByText('No changes.')).toBeInTheDocument();
    });

    it('goes back to the baseline on Discard draft, and keeps nothing for the next editor', () => {
      const first = renderWithIcons(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
      expect(row('snap')).toBeInTheDocument();
      expect(localStorage.getItem('test-draft')).toBeNull();
      first.unmount();
      renderWithIcons(<Kept />);
      expect(row('snap')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull();
    });
  });

  it('marks in the preview what the tree selects, and selects in the tree what the preview is pressed on', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('dock'));
    expect(within(preview()).getByText('Dock').closest('[data-pref-path]')).toHaveAttribute('data-selected');
    fireEvent.pointerDown(within(preview()).getByText('Dock'));
    fireEvent.click(within(preview()).getByRole('button', { name: /View/ }));
    fireEvent.pointerDown(within(preview()).getByText('Snap'));
    expect(within(structure()).getByRole('treeitem', { name: /snap/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists what the root holds on no page as unplaced, out of the tree and the preview, and selects one from there', () => {
    const start: PrefGroup = { name: '', children: { ...START.children, author: { kind: 'string', name: 'Author', description: '', default: '' } } };
    renderWithIcons(<Live start={start} />);
    expect(within(structure()).queryByText('author')).toBeNull();
    expect(within(structure()).queryByRole('treeitem', { name: /General/ })).toBeNull();
    expect(within(preview()).queryByText('Author')).toBeNull();
    const waiting = screen.getByRole('tree', { name: 'Unplaced' });
    fireEvent.click(within(waiting).getByText('author'));
    expect(within(waiting).getByRole('treeitem', { name: /author/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('author');
  });

  it('shows the literal and the change list a tab each, the literal first', () => {
    renderWithIcons(<Live />);
    expect(screen.getByRole('tab', { name: 'Literal' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Literal' })).toContainElement(screen.getByTestId('schema-literal'));
    fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(screen.getByRole('tab', { name: 'Changes' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('tabpanel', { name: 'Changes' })).getByText('No changes.')).toBeInTheDocument();
  });

  it('pairs a leaf with another by picking it from the schema\'s fields', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    const attrs = screen.getByRole('region', { name: 'Attributes' });
    fireEvent.click(within(attrs).getByRole('button', { name: /Add a paired field/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Snap (view.snap)' }));
    settle(within(attrs).getByRole('textbox', { name: 'Row label' }), 'Grid');
    expect(screen.getByTestId('schema-literal').textContent).toMatch(/pair: \{\s*with: 'view\.snap',\s*label: 'Grid',\s*\}/);
  });

  it('lists what the host says is unplaced as a tree of whole nodes, less what the schema holds already', () => {
    const waiting: PrefGroup = { name: '', children: {
      glow: { kind: 'boolean', name: 'Glow', description: 'Lights the edge.', default: false },
      grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      motion: { name: 'Motion', children: { ease: { kind: 'number', name: 'Ease', description: '', default: 1 } } },
    } };
    renderWithIcons(<PrefSchemaEditor schema={START} onChange={() => {}} unplaced={waiting} />);
    const tree = screen.getByRole('tree', { name: 'Unplaced' });
    expect(within(tree).getAllByRole('treeitem').map((r) => r.getAttribute('aria-level'))).toEqual(['1', '1', '2']);
    expect(within(tree).getByRole('treeitem', { name: /^Glow glow/ })).toBeInTheDocument();
    expect(within(tree).getByRole('treeitem', { name: /^Ease ease/ })).toBeInTheDocument();
    expect(keyedRow(tree, 'grid')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Add pref' })).toBeNull();
  });

  it('exports a literal with the edit in it', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    settle(name, 'Grid on');
    expect(screen.getByTestId('schema-literal').textContent).toContain("name: 'Grid on',");
  });

  it('exports a function-valued attribute as KEEP_FROM_SOURCE', () => {
    const encoding = { read: () => true, write: (on: boolean) => on };
    const start: PrefGroup = { name: 'Prefs', children: {
      flag: { kind: 'boolean', name: 'Flag', description: '', default: false, encoding },
    } };
    renderWithIcons(<Live start={start} />);
    expect(screen.getByTestId('schema-literal').textContent).toContain('encoding: KEEP_FROM_SOURCE');
  });

  const rekey = (from: string, to: string) => {
    fireEvent.click(row(from));
    const key = screen.getByRole('textbox', { name: 'Key' });
    settle(key, to);
    fireEvent.blur(key);
  };

  it('refuses an invalid key and says why', () => {
    renderWithIcons(<Live />);
    rekey('grid', 'a.b');
    expect(screen.getByText(/not a valid key/)).toBeInTheDocument();
  });

  it('refuses a key a sibling holds', () => {
    renderWithIcons(<Live />);
    rekey('grid', 'snap');
    expect(screen.getByText(/"snap" is taken here/)).toBeInTheDocument();
  });

  it('accepts a key that only names an inherited property', () => {
    renderWithIcons(<Live />);
    rekey('grid', 'constructor');
    expect(row('constructor')).toBeInTheDocument();
    expect(screen.queryByText(/is taken here/)).toBeNull();
  });

  it('keeps a moved group open', () => {
    renderWithIcons(<Live />);
    act(() => keyedRow(structure(), 'panels')!.focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', altKey: true });
    expect(keyedRow(structure(), 'panels')).toHaveAttribute('aria-level', '2');
    expect(row('dock')).toBeInTheDocument();
  });

  it('keeps the notice region mounted while it is empty', () => {
    renderWithIcons(<Live />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('copies the text of the tab shown', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      renderWithIcons(<Live />);
      const copy = () => fireEvent.click(within(screen.getByRole('region', { name: 'Export' })).getByRole('button', { name: 'Copy' }));
      copy();
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("name: 'Prefs',"));
      fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
      copy();
      expect(writeText).toHaveBeenLastCalledWith('No changes.');
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('swallows a refused clipboard write', async () => {
    // vitest does not report this realm's unhandled rejections, so assert a handler was attached (a proxy).
    const refused = Promise.reject(new Error('denied'));
    const then = vi.spyOn(refused, 'then');
    const writeText = vi.fn(() => refused);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      renderWithIcons(<Live />);
      fireEvent.click(within(screen.getByRole('region', { name: 'Export' })).getByRole('button', { name: 'Copy' }));
      await new Promise((r) => setTimeout(r, 0));
      expect(writeText).toHaveBeenCalled();
      expect(then).toHaveBeenCalledWith(undefined, expect.any(Function));
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  describe('over a node property schema', () => {
    const NODE: PrefSection = {
      name: 'Rect',
      members: {
        layout: { name: 'Layout', members: {
          'pose.x': { kind: 'number', name: 'X', description: 'Left edge.', default: 0 },
        } },
        content: { name: 'Content', members: {
          'data.text': { kind: 'string', name: 'Text', description: 'Text content.', default: 'hello' },
        } },
      },
    };
    function LiveNode() {
      const [schema, setSchema] = useState(NODE);
      return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
    }

    it('opens a leaf keyed by a dotted node path and previews the schema as a properties panel', () => {
      renderWithIcons(<LiveNode />);
      fireEvent.click(row('pose.x'));
      const attrs = screen.getByRole('region', { name: 'Attributes' });
      expect(within(attrs).getByRole('textbox', { name: 'Key' })).toHaveValue('pose.x');
      settle(within(attrs).getByRole('textbox', { name: 'Name' }), 'Left');
      expect(within(structure()).getByText('Left')).toBeInTheDocument();
      expect(within(preview()).getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
      expect(within(preview()).getByRole('textbox', { name: 'Text' })).toHaveValue('hello');
      expect(screen.getByText(/~ layout\/pose\.x\.name/)).toBeInTheDocument();
    });

    it('writes a value typed in the preview as that property\'s default', () => {
      renderWithIcons(<LiveNode />);
      const text = () => within(preview()).getByRole('textbox', { name: 'Text' });
      settle(text(), 'typed');
      fireEvent.blur(text());
      expect(text()).toHaveValue('typed');
      expect(screen.getByTestId('schema-literal')).toHaveTextContent(/default: 'typed'/);
      expect(screen.getByTestId('schema-literal')).toHaveTextContent(/default: 0/);
    });

    it('adds a section where a preferences schema adds a group, and a pref under a dotted id', () => {
      renderWithIcons(<LiveNode />);
      expect(screen.queryByRole('button', { name: 'Add group' })).toBeNull();
      fireEvent.click(row('layout'));
      const dialog = openAdd('Add pref');
      settle(within(dialog).getByRole('textbox', { name: 'Name' }), 'Width');
      settle(within(dialog).getByRole('textbox', { name: 'Key' }), 'pose.width');
      pickKind(dialog, 'number');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      expect(row('pose.width')).toBeInTheDocument();
      fireEvent.click(row('layout'));
      const section = openAdd('Add section');
      settle(within(section).getByRole('textbox', { name: 'Key' }), 'more');
      fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
      expect(screen.getByTestId('schema-literal')).toHaveTextContent(/more: \{[^}]*members: \{\}/);
    });
  });
});

describe('PrefSchemaEditor changed fields and aliases', () => {
  const attrs = () => screen.getByRole('region', { name: 'Attributes' });
  const marked = (field: string) => within(attrs()).getByRole('textbox', { name: field }).closest('[data-changed]') !== null;

  it('marks the attribute that was edited in the Attributes pane, and no other', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('grid'));
    expect(marked('Description')).toBe(false);
    settle(within(attrs()).getByRole('textbox', { name: 'Description' }), 'Other.');
    expect(marked('Description')).toBe(true);
    expect(marked('Name')).toBe(false);
  });

  it('adds an alias of the selected pref after it from the bar, and offers none for a group', () => {
    renderWithIcons(<Live />);
    const add = () => screen.getByRole('button', { name: 'Add alias' });
    expect(add()).toBeDisabled();
    fireEvent.click(row('panels'));
    expect(add()).toBeDisabled();
    fireEvent.click(row('grid'));
    fireEvent.click(add());
    const keys = within(structure()).getAllByRole('treeitem').map(rowKey);
    expect(keys.indexOf('grid2')).toBe(keys.indexOf('grid') + 1);
    expect(within(attrs()).getByRole('button', { name: /Of/ })).toHaveTextContent('view.grid');
  });

  it('offers no alias of a field inside an object pref', () => {
    const start: PrefGroup = { name: 'Prefs', children: { view: { name: 'View', children: {
      stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1 },
      } } as PrefGroup['children'][string],
    } } } };
    renderWithIcons(<Live start={start} />);
    const add = () => screen.getByRole('button', { name: 'Add alias' });
    fireEvent.click(row('width'));
    expect(add()).toBeDisabled();
    fireEvent.click(row('stroke'));
    expect(add()).toBeEnabled();
  });
});
