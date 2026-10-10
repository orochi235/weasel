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
    expect(within(structure()).getByRole('treeitem', { name: /^bare group/ })).toBeInTheDocument();
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

  it('labels the preview, and can hide hidden prefs and reset what was set in it', () => {
    const start: PrefGroup = { name: 'Prefs', children: {
      shown: { kind: 'boolean', name: 'Shown', description: '', default: false },
      secret: { kind: 'boolean', name: 'Secret', description: '', default: false, hidden: true },
    } };
    render(<Live start={start} />);
    expect(within(preview()).getByRole('heading', { name: 'Live preview' })).toBeInTheDocument();
    expect(within(preview()).getByText('Secret')).toBeInTheDocument();
    fireEvent.click(within(preview()).getByRole('switch', { name: 'Show hidden' }));
    expect(within(preview()).queryByText('Secret')).toBeNull();
    const reset = within(preview()).getByRole('button', { name: 'Reset values' });
    expect(reset).toBeDisabled();
    fireEvent.click(within(preview()).getByRole('checkbox', { name: 'Shown' }));
    expect(within(preview()).getByRole('checkbox', { name: 'Shown' })).toBeChecked();
    fireEvent.click(reset);
    expect(within(preview()).getByRole('checkbox', { name: 'Shown' })).not.toBeChecked();
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

    it('previews a default until a value is typed over it, and again after a reset', () => {
      render(<LiveNode />);
      const text = () => within(preview()).getByRole('textbox', { name: 'Text' });
      const reset = () => within(preview()).getByRole('button', { name: 'Reset values' });
      expect(reset()).toBeDisabled();
      fireEvent.change(text(), { target: { value: 'typed' } });
      fireEvent.blur(text());
      expect(text()).toHaveValue('typed');
      fireEvent.click(reset());
      expect(text()).toHaveValue('hello');
      expect(reset()).toBeDisabled();
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
