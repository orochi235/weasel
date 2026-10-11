import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

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
const row = (key: string) => within(structure()).getByText(`(${key})`);
const preview = () => screen.getByRole('region', { name: 'Live preview' });

describe('PrefSchemaEditor', () => {
  it('shows the schema as a tree and the preview as a form', () => {
    render(<Live />);
    expect(within(structure()).getByRole('treeitem', { name: /view/ })).toBeInTheDocument();
    expect(within(preview()).getByText('Show grid')).toBeInTheDocument();
  });

  it('resizes the structure and attributes columns from the handles between them', () => {
    const { container } = render(<Live />);
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
    render(<Live />);
    fireEvent.click(row('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Grid on' } });
    expect(within(preview()).getByText('Grid on')).toBeInTheDocument();
  });

  it('sets the attributes every kind shares beside Key and Kind, and the kind\'s own in a panel below', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    const top = screen.getByRole('region', { name: 'Attributes' });
    // A group's heading sits in a header row, first in its panel.
    const own = within(top).getByRole('heading', { name: 'boolean' }).parentElement!.parentElement!;
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
    render(<Live />);
    fireEvent.click(row('view'));
    const dialog = openAdd('Add pref');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Line width' } });
    expect(within(dialog).getByRole('textbox', { name: 'Id' })).toHaveValue('lineWidth');
    pickKind(dialog, 'number');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('dialog', { name: 'Add pref' })).toBeNull();
    expect(within(structure()).getByText('Line width')).toBeInTheDocument();
    const exact = getDefaultNormalizer({ collapseWhitespace: false });
    expect(screen.getByText(/\+ view\/lineWidth {2}\(number\)/, { normalizer: exact })).toBeInTheDocument();
  });

  it('adds nothing until a pref has a name, a free id and a kind', () => {
    render(<Live />);
    fireEvent.click(row('view'));
    const dialog = openAdd('Add pref');
    const add = within(dialog).getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Snap' } });
    pickKind(dialog, 'boolean');
    expect(within(dialog).getByText(/"snap" is taken here/)).toBeInTheDocument();
    expect(add).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Id' }), { target: { value: 'snapAngle' } });
    expect(add).toBeEnabled();
  });

  it('adds a group with no name, keyed by the id given', () => {
    render(<Live />);
    const dialog = openAdd('Add group');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Id' }), { target: { value: 'misc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(structure()).getByText('misc')).toBeInTheDocument();
  });

  it('shows a row as its name with its key, and a nameless one as its key alone', () => {
    render(<Live start={{ name: 'Prefs', children: { bare: { name: '', children: {} }, view: START.children.view! } }} />);
    expect(within(structure()).getByRole('treeitem', { name: /^View \(view\)/ })).toBeInTheDocument();
    expect(within(structure()).getByRole('treeitem', { name: /^bare 0 ?group/ })).toBeInTheDocument();
  });

  it('draws a group\'s row with the glyph of the palette tool that makes it, and a leaf\'s with none', () => {
    render(<Live start={{ name: 'Prefs', children: { view: { ...START.children.view!, children: {
      box: { name: 'Box', as: 'panel', children: {} },
      grid: (START.children.view as PrefGroup).children.grid!,
    } } } }} />);
    const glyph = (el: Element | null) => el?.querySelector('svg')?.innerHTML;
    const tool = (name: string) => glyph(screen.getByRole('button', { name }));
    const leading = (key: string) => glyph(row(key).closest('[role="treeitem"]')!.querySelector('[class*="leading"]'));
    expect(leading('view')).toBe(tool('Page'));
    expect(leading('box')).toBe(tool('Panel'));
    expect(leading('grid')).toBeUndefined();
  });

  it('opens a page from a press and release on its rail entry in the preview, with no click of the browser\'s', () => {
    render(<Live />);
    const entry = within(preview()).getByRole('button', { name: 'Panels' });
    fireEvent.pointerDown(entry, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(entry, { clientX: 5, clientY: 5 });
    expect(within(preview()).getByText('Dock')).toBeInTheDocument();
  });

  it('selects a group in the tree and the attributes pane from a press on its rail entry in the preview', () => {
    render(<Live />);
    const entry = within(preview()).getByRole('button', { name: 'Panels' });
    fireEvent.pointerDown(entry, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(entry, { clientX: 5, clientY: 5 });
    expect(within(structure()).getByRole('treeitem', { name: /panels/, selected: true })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('panels');
  });

  it('selects the root, the tree\'s General row, from a press on the rail entry for the root\'s own leaves', () => {
    const start: PrefGroup = {
      name: 'Prefs',
      children: { ...START.children, loose: { kind: 'boolean', name: 'Loose', description: '', default: false } },
    };
    render(<Live start={start} />);
    fireEvent.click(row('grid'));
    const attributes = () => screen.getByRole('region', { name: 'Attributes' });
    expect(within(attributes()).getByRole('textbox', { name: 'Key' })).toHaveValue('grid');
    const entry = within(preview()).getByRole('button', { name: 'Prefs' });
    fireEvent.pointerDown(entry, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(entry, { clientX: 5, clientY: 5 });
    expect(within(structure()).getByRole('treeitem', { name: /^Prefs/, selected: true })).toBeInTheDocument();
    // The root has a name and no key.
    expect(within(attributes()).queryByRole('textbox', { name: 'Key' })).toBeNull();
    expect(within(attributes()).getByRole('textbox', { name: 'Name' })).toHaveValue('Prefs');
  });

  it('narrows the tree to the rows a filter matches, under the branches that hold them', () => {
    render(<Live />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter structure' }), { target: { value: 'dock' } });
    expect(within(structure()).getByRole('treeitem', { name: /\(dock\)/ })).toBeInTheDocument();
    expect(within(structure()).getByRole('treeitem', { name: /\(panels\)/ })).toBeInTheDocument();
    expect(within(structure()).queryByRole('treeitem', { name: /\(view\)/ })).toBeNull();
  });

  it('sets the host\'s controls, the palette, and the add and remove buttons in one bar above the panes', () => {
    render(<PrefSchemaEditor schema={START} onChange={() => {}} bar={<button type="button">Source</button>} />);
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
    const changes = () => screen.getByRole('region', { name: 'Changes' });
    const { rerender } = render(<Host original={START} taken={false} />);
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
    render(<PrefSchemaEditor schema={START} onChange={() => {}} maxDepth={1} />);
    const add = screen.getByRole('button', { name: 'Add group' });
    expect(add).toBeEnabled();
    fireEvent.click(row('view'));
    expect(add).toBeDisabled();
  });

  it('undoes and redoes an edit, from its buttons and from the keyboard', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    const name = () => within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name(), { target: { value: 'Grid on' } });
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
    render(<Live />);
    fireEvent.click(row('grid'));
    const name = () => within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    for (const typed of ['G', 'Gr', 'Gri', 'Grid']) fireEvent.change(name(), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(preview()).getByText('Show grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('undoes a removal, and selects the node again', () => {
    render(<Live />);
    fireEvent.click(row('snap'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(within(structure()).queryByText('(snap)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(structure()).getByRole('treeitem', { name: /^Snap \(snap\)/ })).toHaveAttribute('aria-selected', 'true');
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
    render(<Swap />);
    fireEvent.click(row('snap'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'swap' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('labels the preview and can hide hidden prefs', () => {
    const start: PrefGroup = { name: 'Prefs', children: {
      shown: { kind: 'boolean', name: 'Shown', description: '', default: false },
      secret: { kind: 'boolean', name: 'Secret', description: '', default: false, hidden: true },
    } };
    render(<Live start={start} />);
    expect(within(preview()).getByRole('heading', { name: 'Live preview' })).toBeInTheDocument();
    expect(within(preview()).getByText('Secret')).toBeInTheDocument();
    fireEvent.click(within(preview()).getByRole('switch', { name: 'Show hidden' }));
    expect(within(preview()).queryByText('Secret')).toBeNull();
  });

  it('writes a value set in the preview as that pref\'s default, and undoes it', () => {
    render(<Live />);
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
    render(<Live />);
    fireEvent.click(row('snap'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.keyDown(name, { key: 'Backspace' });
    expect(row('snap')).toBeInTheDocument();
    fireEvent.keyDown(structure(), { key: 'Delete' });
    expect(within(structure()).queryByText('(snap)')).toBeNull();
    fireEvent.click(row('dock'));
    fireEvent.keyDown(preview(), { key: 'Backspace' });
    expect(within(structure()).queryByText('(dock)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(row('dock')).toBeInTheDocument();
  });

  it('counts the leaves under each branch of the tree, at any depth', () => {
    const start: PrefGroup = { name: 'Prefs', children: {
      loose: { kind: 'boolean', name: 'Loose', description: '', default: false },
      view: { name: 'View', children: {
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
        more: { name: 'More', children: { snap: { kind: 'boolean', name: 'Snap', description: '', default: false } } },
      } },
    } };
    render(<Live start={start} />);
    const item = (name: RegExp) => within(structure()).getByRole('treeitem', { name });
    expect(within(item(/View/)).getAllByText('2')[0]).toBeInTheDocument();
    expect(within(item(/^Prefs/)).getAllByText('1')[0]).toBeInTheDocument();
  });

  describe('with a draft key', () => {
    function Kept() {
      const [schema, setSchema] = useState(START);
      return <PrefSchemaEditor schema={schema} onChange={setSchema} original={START} draftKey="test-draft" />;
    }
    afterEach(() => localStorage.removeItem('test-draft'));

    it('opens on the edits a previous editor left, still listed as changes from the baseline', () => {
      const first = render(<Kept />);
      expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull();
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      expect(screen.getByText(/Draft saved/)).toBeInTheDocument();
      first.unmount();
      render(<Kept />);
      expect(within(structure()).queryByText('(snap)')).toBeNull();
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
      const first = render(<Filed />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      expect(held.has('test-draft')).toBe(true);
      expect(localStorage.getItem('test-draft')).toBeNull();
      first.unmount();
      render(<Filed />);
      expect(within(structure()).queryByText('(snap)')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(held.has('test-draft')).toBe(false);
    });

    it('still steps back and forward through a previous editor’s edits', () => {
      const first = render(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      fireEvent.click(row('grid'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      first.unmount();
      render(<Kept />);
      expect(row('grid')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
      expect(within(structure()).queryByText('(grid)')).toBeNull();
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
      const first = render(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      first.unmount();
      const draft = JSON.parse(localStorage.getItem('test-draft')!);
      localStorage.setItem('test-draft', JSON.stringify({ ...draft, steps: { schemas: [], current: 4, stacks: {} } }));
      render(<Kept />);
      expect(within(structure()).queryByText('(snap)')).toBeNull();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('carries a draft onto a source that changed since, listing only the reader’s own edits', () => {
      const first = render(<Kept />);
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
      render(<Later />);
      expect(within(structure()).queryByText('(snap)')).toBeNull();
      expect(within(structure()).getByText('Grid lines')).toBeInTheDocument();
      expect(screen.getByText(/− view\/snap/)).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Changes' })).queryByText(/grid/)).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('The source changed since this draft was saved.');
      // And the step that made the edit still goes back, to the new source.
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(row('snap')).toBeInTheDocument();
      expect(screen.getByText('No changes.')).toBeInTheDocument();
    });

    it('goes back to the baseline on Discard draft, and keeps nothing for the next editor', () => {
      const first = render(<Kept />);
      fireEvent.click(row('snap'));
      fireEvent.keyDown(structure(), { key: 'Delete' });
      fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
      expect(row('snap')).toBeInTheDocument();
      expect(localStorage.getItem('test-draft')).toBeNull();
      first.unmount();
      render(<Kept />);
      expect(row('snap')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Discard draft' })).toBeNull();
    });
  });

  it('marks in the preview what the tree selects, and selects in the tree what the preview is pressed on', () => {
    render(<Live />);
    fireEvent.click(row('dock'));
    expect(within(preview()).getByText('Dock').closest('[data-pref-path]')).toHaveAttribute('data-selected');
    fireEvent.pointerDown(within(preview()).getByText('Dock'));
    fireEvent.click(within(preview()).getByRole('button', { name: /View/ }));
    fireEvent.pointerDown(within(preview()).getByText('Snap'));
    expect(within(structure()).getByRole('treeitem', { name: /snap/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists the root\'s own leaves under a General branch, as the preview does, and selects the root from it', () => {
    const start: PrefGroup = { name: '', children: { ...START.children, author: { kind: 'string', name: 'Author', description: '', default: '' } } };
    render(<Live start={start} />);
    const general = within(structure()).getByRole('treeitem', { name: /General/ });
    expect(within(general).getByText('(author)')).toBeInTheDocument();
    expect(general).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(row('dock'));
    expect(general).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(within(general).getByText('General'));
    expect(general).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the literal and the change list side by side', () => {
    render(<Live />);
    expect(screen.getByRole('region', { name: 'Literal' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Changes' })).getByText('No changes.')).toBeInTheDocument();
  });

  it('pairs a leaf with another by picking it from the schema\'s fields', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    const attrs = screen.getByRole('region', { name: 'Attributes' });
    fireEvent.click(within(attrs).getByRole('button', { name: /Add a paired field/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Snap (view.snap)' }));
    fireEvent.change(within(attrs).getByRole('textbox', { name: 'Row label' }), { target: { value: 'Grid' } });
    expect(screen.getByTestId('schema-literal').textContent).toMatch(/pair: \{\s*with: 'view\.snap',\s*label: 'Grid',\s*\}/);
  });

  it('lists stored values no leaf describes, and adds the leaf for one where it lives', () => {
    function WithStored() {
      const [schema, setSchema] = useState(START);
      return <PrefSchemaEditor schema={schema} onChange={setSchema} stored={{ view: { grid: true, zoomStep: 1.5 }, misc: { theme: 'dark' } }} />;
    }
    render(<WithStored />);
    const list = screen.getByRole('list', { name: 'Stored values with no leaf' });
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add a leaf for view.zoomStep', 'Add a leaf for misc.theme',
    ]);
    fireEvent.click(within(list).getByRole('button', { name: 'Add a leaf for misc.theme' }));
    const dialog = screen.getByRole('dialog', { name: 'Add pref' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Theme');
    expect(within(dialog).getByRole('textbox', { name: 'Id' })).toHaveValue('theme');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(structure()).getByRole('treeitem', { name: /^Theme \(theme\)/ })).toBeInTheDocument();
    expect(screen.getByTestId('schema-literal').textContent).toMatch(/misc: \{[\s\S]*theme: \{[\s\S]*default: 'dark'/);
    expect(within(list).queryByRole('button', { name: 'Add a leaf for misc.theme' })).toBeNull();
  });

  it('exports a literal with the edit in it', () => {
    render(<Live />);
    fireEvent.click(row('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Grid on' } });
    expect(screen.getByTestId('schema-literal').textContent).toContain("name: 'Grid on',");
  });

  it('exports a function-valued attribute as KEEP_FROM_SOURCE', () => {
    const encoding = { read: () => true, write: (on: boolean) => on };
    const start: PrefGroup = { name: 'Prefs', children: {
      flag: { kind: 'boolean', name: 'Flag', description: '', default: false, encoding },
    } };
    render(<Live start={start} />);
    expect(screen.getByTestId('schema-literal').textContent).toContain('encoding: KEEP_FROM_SOURCE');
  });

  const rekey = (from: string, to: string) => {
    fireEvent.click(row(from));
    const key = screen.getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: to } });
    fireEvent.blur(key);
  };

  it('refuses an invalid key and says why', () => {
    render(<Live />);
    rekey('grid', 'a.b');
    expect(screen.getByText(/not a valid key/)).toBeInTheDocument();
  });

  it('refuses a key a sibling holds', () => {
    render(<Live />);
    rekey('grid', 'snap');
    expect(screen.getByText(/"snap" is taken here/)).toBeInTheDocument();
  });

  it('accepts a key that only names an inherited property', () => {
    render(<Live />);
    rekey('grid', 'constructor');
    expect(row('constructor')).toBeInTheDocument();
    expect(screen.queryByText(/is taken here/)).toBeNull();
  });

  it('keeps a renamed group open', () => {
    render(<Live />);
    // Activating a branch toggles it, so the second click reopens the group the first selected and closed.
    fireEvent.click(row('view'));
    rekey('view', 'display');
    expect(within(structure()).getByRole('treeitem', { name: /\(display\)/ })).toHaveAttribute('aria-expanded', 'true');
    expect(row('grid')).toBeInTheDocument();
  });

  it('keeps a moved group open', () => {
    render(<Live />);
    act(() => within(structure()).getByRole('treeitem', { name: /\(panels\)/ }).focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', altKey: true });
    expect(within(structure()).getByRole('treeitem', { name: /\(panels\)/ })).toHaveAttribute('aria-level', '2');
    expect(row('dock')).toBeInTheDocument();
  });

  it('keeps the notice region mounted while it is empty', () => {
    render(<Live />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('swallows a refused clipboard write', async () => {
    // vitest does not report this realm's unhandled rejections, so assert a handler was attached (a proxy).
    const refused = Promise.reject(new Error('denied'));
    const then = vi.spyOn(refused, 'then');
    const writeText = vi.fn(() => refused);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      render(<Live />);
      fireEvent.click(within(screen.getByRole('region', { name: 'Literal' })).getByRole('button', { name: 'Copy' }));
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
      render(<LiveNode />);
      fireEvent.click(row('pose.x'));
      const attrs = screen.getByRole('region', { name: 'Attributes' });
      expect(within(attrs).getByRole('textbox', { name: 'Key' })).toHaveValue('pose.x');
      fireEvent.change(within(attrs).getByRole('textbox', { name: 'Name' }), { target: { value: 'Left' } });
      expect(within(structure()).getByText('Left')).toBeInTheDocument();
      expect(within(preview()).getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
      expect(within(preview()).getByRole('textbox', { name: 'Text' })).toHaveValue('hello');
      expect(screen.getByText(/~ layout\/pose\.x\.name/)).toBeInTheDocument();
    });

    it('writes a value typed in the preview as that property\'s default', () => {
      render(<LiveNode />);
      const text = () => within(preview()).getByRole('textbox', { name: 'Text' });
      fireEvent.change(text(), { target: { value: 'typed' } });
      fireEvent.blur(text());
      expect(text()).toHaveValue('typed');
      expect(screen.getByTestId('schema-literal')).toHaveTextContent(/default: 'typed'/);
      expect(screen.getByTestId('schema-literal')).toHaveTextContent(/default: 0/);
    });

    it('adds a section where a preferences schema adds a group, and a pref under a dotted id', () => {
      render(<LiveNode />);
      expect(screen.queryByRole('button', { name: 'Add group' })).toBeNull();
      fireEvent.click(row('layout'));
      const dialog = openAdd('Add pref');
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Width' } });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Id' }), { target: { value: 'pose.width' } });
      pickKind(dialog, 'number');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      expect(row('pose.width')).toBeInTheDocument();
      fireEvent.click(row('layout'));
      const section = openAdd('Add section');
      fireEvent.change(within(section).getByRole('textbox', { name: 'Id' }), { target: { value: 'more' } });
      fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
      expect(screen.getByTestId('schema-literal')).toHaveTextContent(/more: \{[^}]*members: \{\}/);
    });
  });
});
