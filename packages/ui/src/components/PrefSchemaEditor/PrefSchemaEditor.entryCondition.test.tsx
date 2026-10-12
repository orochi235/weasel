import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefLeaf, PrefList } from '@weasel-js/prefs';
import { attributeSchema } from './kindSchemas';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { nodeAt } from './schemaEdit';

afterEach(cleanup);

const phases = {
  kind: 'list', name: 'Phases', description: '', default: [],
  item: { kind: 'object', name: 'Phase', description: '', default: {}, children: {
    locked: { kind: 'boolean', name: 'Locked', description: '', default: false },
  } },
} as PrefLeaf;
const BASE: PrefGroup = { name: 'Prefs', children: { view: { name: 'View', children: {
  locked: { kind: 'boolean', name: 'Lock all', description: '', default: false },
  phases,
} } } };

let latest: PrefGroup = BASE;
function Live() {
  const [schema, setSchema] = useState(BASE);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} original={BASE} />;
}
const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));

describe('PrefSchemaEditor: the condition on a list\'s entry', () => {
  it('lists Enabled if among the entry\'s attributes, and no Shown if, which an entry never answers', () => {
    expect(Object.keys(attributeSchema(phases).entry)).toEqual(['name', 'enableIf']);
    expect(Object.keys(attributeSchema(phases).shared)).toEqual(expect.arrayContaining(['showIf', 'enableIf']));
  });

  it('sets it from the entry\'s own fields, as a test that reads from the entry', () => {
    render(<Live />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('(phases)'));
    expect(attributes().queryByRole('group', { name: 'Entry shown if' })).toBeNull();
    const entry = attributes().getByRole('group', { name: 'Entry enabled if' });
    fireEvent.click(within(entry).getByRole('button', { name: /Add a condition/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Locked this Phase: locked', 'Lock all view.locked']);
    fireEvent.click(screen.getByRole('option', { name: /this Phase/ }));
    expect((nodeAt(latest, 'view/phases') as PrefList).item.enableIf).toEqual({ from: 'item', path: 'locked', is: true });
    expect(nodeAt(latest, 'view/phases')).not.toHaveProperty('enableIf');
  });
});
