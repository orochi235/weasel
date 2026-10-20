import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 });
const NODE: PrefSection = {
  name: 'Rect',
  members: {
    layout: { name: 'Layout', members: { 'pose.x': num('X') } },
    look: { name: 'Look', members: { opacity: num('Opacity') } },
  },
};

let latest: PrefSection = NODE;
function Live({ start = NODE }: { start?: PrefSection }) {
  const [schema, setSchema] = useState(start);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(key);
const treeRows = (key: string) => within(structure()).getAllByText(key).map((el) => el.closest('[data-tree-id]') as HTMLElement);
const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));

describe('PrefSchemaEditor over a node property schema: one value path, one pref', () => {
  it('refuses, in Add pref, an id a pref in another section holds', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('look'));
    fireEvent.click(screen.getByRole('button', { name: 'Add pref' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Left' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Key' }), { target: { value: 'pose.x' } });
    expect(dialog).toHaveTextContent('"pose.x" is taken here.');
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Key' }), { target: { value: 'pose.y' } });
    expect(dialog).not.toHaveTextContent('is taken here');
  });

  it('refuses a key edit that names a pref in another section', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('opacity'));
    const key = attributes().getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: 'pose.x' } });
    fireEvent.blur(key);
    expect(screen.getByRole('region', { name: 'Attributes' })).toHaveTextContent('"pose.x" is taken here.');
    expect(latest).toBe(NODE);
  });

  it('refuses a section key that names a pref, and a pref key that names a section', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('layout'));
    const key = attributes().getByRole('textbox', { name: 'Key' });
    fireEvent.change(key, { target: { value: 'opacity' } });
    fireEvent.blur(key);
    expect(screen.getByRole('region', { name: 'Attributes' })).toHaveTextContent('"opacity" is taken here.');
    fireEvent.click(row('opacity'));
    const leafKey = attributes().getByRole('textbox', { name: 'Key' });
    fireEvent.change(leafKey, { target: { value: 'layout' } });
    fireEvent.blur(leafKey);
    expect(screen.getByRole('region', { name: 'Attributes' })).toHaveTextContent('"layout" is taken here.');
    expect(latest).toBe(NODE);
  });

  it('marks the section and the pref of a schema that came naming both alike', () => {
    const shared: PrefSection = { ...NODE, members: { ...NODE.members, opacity: { name: 'Opacity', members: { 'pose.y': num('Y') } } } };
    renderWithIcons(<Live start={shared} />);
    const rows = treeRows('opacity');
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.firstElementChild).toHaveTextContent('key taken');
    expect(within(structure()).getByText('look').closest('[data-tree-id]')!.firstElementChild).not.toHaveTextContent('key taken');
  });

  it('marks both rows of a schema that came holding one value path twice, and no other row', () => {
    const twice: PrefSection = { ...NODE, members: { ...NODE.members, look: { name: 'Look', members: { 'pose.x': num('X again') } } } };
    renderWithIcons(<Live start={twice} />);
    const rows = treeRows('pose.x');
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r).toHaveTextContent('key taken');
    expect(within(structure()).getByText('look').closest('[data-tree-id]')!.firstElementChild).not.toHaveTextContent('key taken');
  });
});
