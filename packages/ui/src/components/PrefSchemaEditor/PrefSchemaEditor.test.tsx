import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const START: ToolPrefGroup = {
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

function Live({ start = START }: { start?: ToolPrefGroup }) {
  const [schema, setSchema] = useState(start);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });

describe('PrefSchemaEditor', () => {
  it('shows the schema as a tree and the preview as a form', () => {
    render(<Live />);
    expect(within(structure()).getByRole('treeitem', { name: /view/ })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Preview' })).getByText('Show grid')).toBeInTheDocument();
  });

  it('edits a leaf attribute and the preview follows', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Grid on' } });
    expect(within(screen.getByRole('region', { name: 'Preview' })).getByText('Grid on')).toBeInTheDocument();
  });

  it('adds a pref into the selected group and lists it under Changes', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('view'));
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    expect(within(structure()).getByText('newPref')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    const exact = getDefaultNormalizer({ collapseWhitespace: false });
    expect(screen.getByText(/\+ view\.newPref {2}\(boolean\)/, { normalizer: exact })).toBeInTheDocument();
  });

  it('exports a literal with the edit in it', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('grid'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Grid on' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Literal' }));
    expect(screen.getByTestId('schema-literal').textContent).toContain("name: 'Grid on',");
  });

  it('exports a function-valued attribute as KEEP_FROM_SOURCE', () => {
    const encoding = { read: () => true, write: (on: boolean) => on };
    const start: ToolPrefGroup = { name: 'Prefs', children: {
      flag: { kind: 'boolean', name: 'Flag', description: '', default: false, encoding },
    } };
    render(<Live start={start} />);
    expect(screen.getByTestId('schema-literal').textContent).toContain('encoding: KEEP_FROM_SOURCE');
  });

  const rekey = (from: string, to: string) => {
    fireEvent.click(within(structure()).getByText(from));
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
    expect(within(structure()).getByText('constructor')).toBeInTheDocument();
    expect(screen.queryByText(/is taken here/)).toBeNull();
  });

  it('keeps a renamed group open', () => {
    render(<Live />);
    // Activating a branch toggles it, so the second click reopens the group the first selected and closed.
    fireEvent.click(within(structure()).getByText('view'));
    rekey('view', 'display');
    expect(within(structure()).getByRole('treeitem', { name: /^display/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(structure()).getByText('grid')).toBeInTheDocument();
  });

  it('keeps a moved group open', () => {
    render(<Live />);
    act(() => within(structure()).getByRole('treeitem', { name: /^panels/ }).focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', altKey: true });
    expect(within(structure()).getByRole('treeitem', { name: /^panels/ })).toHaveAttribute('aria-level', '2');
    expect(within(structure()).getByText('dock')).toBeInTheDocument();
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
      fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Copy' }));
      await new Promise((r) => setTimeout(r, 0));
      expect(writeText).toHaveBeenCalled();
      expect(then).toHaveBeenCalledWith(undefined, expect.any(Function));
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
