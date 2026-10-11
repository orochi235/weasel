import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const BASE: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
    } },
  },
};
/** The baseline and one group it does not hold. */
const START: PrefGroup = {
  ...BASE,
  children: { ...BASE.children, page: { name: 'New page', as: 'page', children: { gap: { kind: 'number', name: 'New pref', description: '', default: 0 } } } },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} original={BASE} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));
const select = (key: string) => fireEvent.click(within(structure()).getByText(`(${key})`));
const rename = (to: string) => {
  const name = attributes().getByRole('textbox', { name: 'Name' });
  act(() => name.focus());
  fireEvent.change(name, { target: { value: to } });
  act(() => attributes().getByRole('textbox', { name: 'Name' }).blur());
};
const keyField = () => attributes().getByRole('textbox', { name: 'Key' });

describe('PrefSchemaEditor: the key follows the name', () => {
  it('sets the name above the key', () => {
    render(<Live />);
    select('snap');
    const name = attributes().getByRole('textbox', { name: 'Name' });
    expect(name.compareDocumentPosition(keyField()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rekeys a new node from its name when the name loses focus, and its new child after it', () => {
    render(<Live />);
    select('page');
    rename('Side panels');
    expect(keyField()).toHaveValue('sidePanels');
    expect(Object.keys(latest.children)).toEqual(['view', 'sidePanels']);
    // Picking the group folded it; picking it again opens it.
    select('sidePanels');
    select('gap');
    rename('Line width');
    expect(Object.keys((latest.children.sidePanels as PrefGroup).children)).toEqual(['lineWidth']);
  });

  it('numbers the key when a sibling holds it', () => {
    render(<Live />);
    select('page');
    rename('View');
    expect(keyField()).toHaveValue('view2');
  });

  it('rekeys a node from the baseline only when its key was the name\'s already', () => {
    render(<Live />);
    select('grid');
    rename('Show the grid');
    expect(keyField()).toHaveValue('grid');
    select('snap');
    rename('Snap to grid');
    expect(keyField()).toHaveValue('snapToGrid');
  });
});
