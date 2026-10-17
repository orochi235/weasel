import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { keyedRow } from './treeRows.fixture';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    canvas: { name: 'Canvas', children: { grid: flag('Grid'), snapping: { name: 'Snapping', children: { on: flag('Snap on') } } } },
    io: { name: 'Export', children: { alpha: flag('Keep alpha') } },
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const row = (key: string) => within(structure()).getByText(key);
const item = (key: string) => keyedRow(structure(), key);
const preview = () => screen.getByRole('region', { name: 'Live preview' });
const attributes = () => screen.getByRole('region', { name: 'Attributes' });
const entry = (path: string) => preview().querySelector<HTMLElement>(`[data-pref-rail="${path}"]`)!;
const page = () => preview().querySelector('[data-pref-into]')!.getAttribute('data-pref-into');

const drawAsPage = (): void => {
  fireEvent.click(within(attributes()).getByRole('button', { name: /Drawn as/ }));
  fireEvent.click(screen.getByRole('option', { name: /page/i }));
};

describe('PrefSchemaEditor previewing sections and pages', () => {
  it('draws a nested group as a section of its page, as a form given the schema would', () => {
    renderWithIcons(<Live />);
    expect(page()).toBe('canvas');
    expect(within(preview()).getByText('Snap on')).toBeInTheDocument();
    expect(entry('canvas.snapping')).toBeNull();
  });

  it('gives a nested group a page of its own once it is drawn as a page, and opens it', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('snapping'));
    expect(page()).toBe('canvas');
    drawAsPage();
    expect(page()).toBe('canvas.snapping');
    expect(entry('canvas.snapping')).toHaveAttribute('aria-current', 'page');
    expect(within(preview()).getByText('Snap on')).toBeInTheDocument();
    expect(within(preview()).queryByText('Grid')).toBeNull();
  });

  it('opens the page of what the tree selects, and selects in the tree the entry the rail is pressed on', () => {
    renderWithIcons(<Live />);
    fireEvent.click(row('snapping'));
    drawAsPage();
    fireEvent.click(row('alpha'));
    expect(page()).toBe('io');
    fireEvent.click(row('grid'));
    expect(page()).toBe('canvas');
    fireEvent.click(row('snapping'));
    expect(page()).toBe('canvas.snapping');

    fireEvent.pointerDown(entry('canvas'));
    fireEvent.click(entry('canvas'));
    expect(item('canvas')).toHaveAttribute('aria-selected', 'true');
    expect(page()).toBe('canvas');
    fireEvent.pointerDown(entry('canvas.snapping'));
    fireEvent.click(entry('canvas.snapping'));
    expect(item('snapping')).toHaveAttribute('aria-selected', 'true');
    expect(page()).toBe('canvas.snapping');
  });
});
