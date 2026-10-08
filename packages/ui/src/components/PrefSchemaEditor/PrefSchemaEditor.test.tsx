import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, getDefaultNormalizer, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const START: ToolPrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
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
    fireEvent.click(screen.getByRole('tab', { name: 'Literal' }));
    expect(screen.getByTestId('schema-literal').textContent).toContain("name: 'Show grid',");
  });

  it('refuses a key that is taken and says why', () => {
    render(<Live />);
    fireEvent.click(within(structure()).getByText('grid'));
    const key = screen.getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: 'a.b' } });
    fireEvent.blur(key);
    expect(screen.getByText(/not a valid key/)).toBeInTheDocument();
  });
});
