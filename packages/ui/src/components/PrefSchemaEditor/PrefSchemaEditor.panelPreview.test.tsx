import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' });

const START: PrefSection = {
  name: 'Node',
  members: {
    look: { name: 'Look', members: {
      'data.tint': text('Tint'),
      'data.shade': text('Shade'),
      'data.stroke': { kind: 'object', name: 'Stroke', description: '', default: {}, children: { width: text('Width') } } as PrefLeaf,
    } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(`(${key})`);
const item = (key: RegExp) => within(structure()).getByRole('treeitem', { name: key });
const preview = () => screen.getByRole('region', { name: 'Live preview' });
const marked = () => [...preview().querySelectorAll('[data-pref-path][data-selected]')].map((el) => el.getAttribute('data-pref-path'));

describe('PrefSchemaEditor with a properties-panel preview', () => {
  it('marks in the preview the leaf or the field the tree selects', () => {
    render(<Live />);
    fireEvent.click(row('data.tint'));
    expect(marked()).toEqual(['data.tint']);
    fireEvent.click(row('width'));
    expect(marked()).toEqual(['data.stroke.width']);
  });

  it('selects in the tree the row the preview is pressed on, and adds one with Cmd held', () => {
    render(<Live />);
    fireEvent.pointerDown(within(preview()).getByText('Width'));
    expect(item(/\(width\)/)).toHaveAttribute('aria-selected', 'true');
    fireEvent.pointerDown(within(preview()).getByText('Tint'));
    expect(item(/\(data\.tint\)/)).toHaveAttribute('aria-selected', 'true');
    expect(item(/\(width\)/)).toHaveAttribute('aria-selected', 'false');
    fireEvent.pointerDown(within(preview()).getByText('Shade'), { metaKey: true });
    expect(item(/\(data\.tint\)/)).toHaveAttribute('aria-selected', 'true');
    expect(item(/\(data\.shade\)/)).toHaveAttribute('aria-selected', 'true');
    expect(marked()).toEqual(['data.tint', 'data.shade']);
  });
});
