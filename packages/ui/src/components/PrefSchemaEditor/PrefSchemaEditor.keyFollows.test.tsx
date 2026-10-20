import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import type { SubmitChanges } from './ExportPanel';
import { renderWithIcons } from '../../testing/withIcons';

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
const select = (key: string) => fireEvent.click(within(structure()).getByText(key));
const rename = (to: string) => {
  const name = attributes().getByRole('textbox', { name: 'Name' });
  act(() => name.focus());
  fireEvent.change(name, { target: { value: to } });
  act(() => attributes().getByRole('textbox', { name: 'Name' }).blur());
};
const keyField = () => attributes().getByRole('textbox', { name: 'Key' });

describe('PrefSchemaEditor: the path under the key', () => {
  it('shows the selected node\'s whole path as plain text, not a field, and follows a new key', () => {
    renderWithIcons(<Live />);
    select('snap');
    const path = () => attributes().getByText(/^(view|page)\./);
    expect(path()).toHaveTextContent('view.snap');
    expect(attributes().queryByRole('textbox', { name: 'Path' })).toBeNull();
    expect(path().closest('input, [role="textbox"]')).toBeNull();
    expect(keyField().compareDocumentPosition(path()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    select('gap');
    rename('Line width');
    expect(path()).toHaveTextContent('page.lineWidth');
  });
});

describe('PrefSchemaEditor: the key follows the name', () => {
  it('sets the name above the key', () => {
    renderWithIcons(<Live />);
    select('snap');
    const name = attributes().getByRole('textbox', { name: 'Name' });
    expect(name.compareDocumentPosition(keyField()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rekeys a new node from its name when the name loses focus, and its new child after it', () => {
    renderWithIcons(<Live />);
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
    renderWithIcons(<Live />);
    select('page');
    rename('View');
    expect(keyField()).toHaveValue('view2');
  });

  it('keeps the key of a node from the baseline, whose values may be stored under it', () => {
    renderWithIcons(<Live />);
    select('grid');
    rename('Show the grid');
    expect(keyField()).toHaveValue('grid');
    // Even a key that was its name in camelCase.
    select('snap');
    rename('Snap to grid');
    expect(keyField()).toHaveValue('snap');
    expect(Object.keys((latest.children.view as PrefGroup).children)).toEqual(['grid', 'snap']);
  });

  it('hands over a renamed baseline pref as a change of name alone', async () => {
    const onSubmit = vi.fn<SubmitChanges>(async () => {});
    function Sent() {
      const [schema, setSchema] = useState(BASE);
      return <PrefSchemaEditor schema={schema} onChange={setSchema} original={BASE} onSubmit={onSubmit} />;
    }
    renderWithIcons(<Sent />);
    select('snap');
    rename('Snap to grid');
    fireEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    const listed = screen.getByRole('tabpanel', { name: 'Changes' }).textContent ?? '';
    expect(listed).toMatch(/~ view\/snap\.name/);
    expect(listed).not.toMatch(/[+−↕] /);
    await act(async () => { fireEvent.click(within(screen.getByRole('region', { name: 'Export' })).getByRole('button', { name: 'Submit' })); });
    const [changes, literal] = onSubmit.mock.calls[0]!;
    expect(changes).toEqual([{ op: 'attr', path: 'view/snap', key: 'name', from: 'Snap', to: 'Snap to grid' }]);
    expect(literal).toMatch(/\bsnap: /);
    expect(literal).not.toMatch(/snapToGrid/);
  });
});
