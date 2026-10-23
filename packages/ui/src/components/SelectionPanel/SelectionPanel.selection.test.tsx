import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefSelectHow } from '../Prefs';
import { panelShownPath } from './selection';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' });

const STROKE: PrefLeaf = {
  kind: 'object', name: 'Stroke', description: '', default: {}, block: true,
  children: {
    width: text('Width'),
    ends: { name: 'Ends', as: 'tab', members: { cap: text('Cap') } },
    joins: { name: 'Joins', as: 'tab', members: { join: text('Join') } },
    marks: { name: 'Marks', as: 'bar', members: { arrow: text('Arrow') } },
  },
} as PrefLeaf;

const SCHEMA: PrefSection = {
  name: 'Thing',
  members: {
    'data.name': text('Name'),
    look: { name: 'Look', members: { 'data.tint': text('Tint'), 'data.stroke': STROKE } },
    one: { name: 'One', as: 'tab', members: { 'data.a': text('Alpha') } },
    two: { name: 'Two', as: 'tab', members: { 'data.b': text('Beta') } },
    tools: { name: 'Tools', as: 'bar', members: { 'data.c': text('Gamma') } },
  },
};

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: SCHEMA }];
const selection = { current: [asNodeId('n')] };

function sceneOf() {
  const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { stroke: {} } });
  return scene;
}

function panel(selected?: readonly string[], onSelect?: (path: string, how: PrefSelectHow) => void) {
  const scene = sceneOf();
  const view = (now?: readonly string[]) => (
    <SelectionPanel scene={scene} selection={selection} properties={properties} routing={routing} selected={now} onSelect={onSelect} />
  );
  const { container, rerender } = render(view(selected));
  return {
    container,
    select: (now?: readonly string[]) => rerender(view(now)),
    // An open tab carries `data-selected` too, as its own state.
    marked: () => [...container.querySelectorAll('[data-pref-path][data-selected]')].map((el) => el.getAttribute('data-pref-path')),
  };
}

describe('panelShownPath', () => {
  const rows: Array<[string, PrefLeaf]> = [['data.name', text('Name')], ['data.stroke', STROKE]];

  it('is the path of a leaf or of a field of an object leaf, the row a path lies inside, and null for one the panel lacks', () => {
    expect(panelShownPath(rows, 'data.name')).toBe('data.name');
    expect(panelShownPath(rows, 'data.stroke')).toBe('data.stroke');
    expect(panelShownPath(rows, 'data.stroke.width')).toBe('data.stroke.width');
    // A section inside the object adds nothing to its fields' paths.
    expect(panelShownPath(rows, 'data.stroke.cap')).toBe('data.stroke.cap');
    expect(panelShownPath(rows, 'data.stroke.gone')).toBe('data.stroke');
    expect(panelShownPath(rows, 'data.names')).toBeNull();
  });
});

describe('a selected path', () => {
  it('marks the row of the leaf it names', () => {
    const { marked, select } = panel(['data.name']);
    expect(marked()).toEqual(['data.name']);
    select(['data.tint']);
    expect(marked()).toEqual(['data.tint']);
    select(['nowhere']);
    expect(marked()).toEqual([]);
  });

  it('marks every row named, and an object leaf apart from its fields', () => {
    const { marked, select } = panel(['data.name', 'data.stroke.width']);
    expect(marked()).toEqual(['data.name', 'data.stroke.width']);
    select(['data.stroke']);
    expect(marked()).toEqual(['data.stroke']);
  });

  it('marks a leaf drawn in a bar', () => {
    expect(panel(['data.c']).marked()).toEqual(['data.c']);
    expect(panel(['data.stroke.arrow']).marked()).toEqual(['data.stroke.arrow']);
  });

  it('opens the tab that holds it, and leaves the reader free to open another afterward', () => {
    const { marked, select } = panel();
    expect(screen.queryByText('Beta')).toBeNull();
    select(['data.b']);
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(marked()).toEqual(['data.b']);
    fireEvent.click(screen.getByRole('tab', { name: 'One' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('opens the tab inside an object leaf that holds the field it names', () => {
    const { marked, select } = panel();
    expect(screen.queryByText('Join')).toBeNull();
    select(['data.stroke.join']);
    expect(screen.getByText('Join')).toBeInTheDocument();
    expect(marked()).toEqual(['data.stroke.join']);
  });

  it('scrolls to it when it changes, but not when the reader picked it here', () => {
    const scrolled: Array<string | null> = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this.getAttribute('data-pref-path')); };
    try {
      const onSelect = vi.fn();
      const { select } = panel(undefined, onSelect);
      select(['data.stroke.width']);
      expect(scrolled).toEqual(['data.stroke.width']);
      fireEvent.pointerDown(screen.getByText('Name'));
      expect(onSelect).toHaveBeenLastCalledWith('data.name', { toggle: false });
      select(['data.name']);
      expect(scrolled).toEqual(['data.stroke.width']);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('onSelect', () => {
  it('reports the row pressed, and the field when the press lands inside an object leaf', () => {
    const onSelect = vi.fn();
    panel(undefined, onSelect);
    fireEvent.pointerDown(screen.getByText('Tint'));
    expect(onSelect).toHaveBeenLastCalledWith('data.tint', { toggle: false });
    fireEvent.pointerDown(screen.getByText('Width'));
    expect(onSelect).toHaveBeenLastCalledWith('data.stroke.width', { toggle: false });
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Stroke' }));
    expect(onSelect).toHaveBeenLastCalledWith('data.stroke', { toggle: false });
  });

  it('reports a press with Cmd or Ctrl held as a toggle', () => {
    const onSelect = vi.fn();
    panel(['data.name'], onSelect);
    fireEvent.pointerDown(screen.getByText('Tint'), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('data.tint', { toggle: true });
    fireEvent.pointerDown(screen.getByText('Name'), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('data.name', { toggle: true });
  });

  it('reports focus into a row, once for a press and the focus it causes', () => {
    const onSelect = vi.fn();
    panel(undefined, onSelect);
    fireEvent.focus(screen.getByRole('textbox', { name: 'Tint' }));
    expect(onSelect).toHaveBeenLastCalledWith('data.tint', { toggle: false });
    onSelect.mockClear();
    fireEvent.pointerDown(screen.getByText('Name'));
    fireEvent.focus(screen.getByRole('textbox', { name: 'Name' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
