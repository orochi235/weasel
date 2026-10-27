import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefSelectHow } from '../Prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const text = (name: string, pair?: { with: string; label: string }): PrefLeaf =>
  ({ kind: 'string', name, description: '', default: '', ...(pair ? { pair } : {}) }) as PrefLeaf;

const STROKE: PrefLeaf = {
  kind: 'object', name: 'Stroke', description: '', default: {}, block: true,
  children: {
    width: text('Width'),
    cap: text('Cap', { with: 'data.stroke.join', label: 'Corners' }),
    join: text('Join'),
  },
} as PrefLeaf;

const SCHEMA: PrefSection = {
  name: 'Thing',
  members: {
    'data.name': text('Name'),
    place: {
      name: 'Place',
      members: {
        'pose.x': text('X', { with: 'pose.y', label: 'Position' }),
        'pose.y': text('Y'),
        inner: { name: 'Inner', members: { 'data.deep': text('Deep') } },
      },
    },
    look: { name: 'Look', as: 'panel', members: { 'data.tint': text('Tint'), 'data.stroke': STROKE } },
    one: { name: 'One', as: 'tab', members: { 'data.a': text('Alpha') } },
    two: { name: 'Two', as: 'tab', members: { 'data.b': text('Beta') } },
    loose: { name: 'Loose', as: 'fragment', members: { 'data.l': text('Lambda') } },
    tools: { name: 'Tools', as: 'bar', members: { 'data.c': text('Gamma') } },
  },
};

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: SCHEMA }];
const selection = { current: [asNodeId('n')] };

function panel(selected?: readonly string[], onSelect?: (path: string, how: PrefSelectHow) => void) {
  const scene = createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { stroke: {} } });
  const view = (now?: readonly string[]) => (
    <SelectionPanel scene={scene} selection={selection} properties={properties} routing={routing} selected={now} onSelect={onSelect} />
  );
  const { container, rerender } = render(view(selected));
  return {
    container,
    select: (now?: readonly string[]) => rerender(view(now)),
    marked: () => [...container.querySelectorAll('[data-pref-path][data-selected]')].map((el) => el.getAttribute('data-pref-path')),
  };
}

describe('a paired row', () => {
  it('is marked, under its first leaf, when any of its leaves is selected', () => {
    const { marked, select } = panel(['pose.x']);
    expect(marked()).toEqual(['pose.x']);
    select(['pose.y']);
    expect(marked()).toEqual(['pose.x']);
    select(['pose.x', 'pose.y']);
    expect(marked()).toEqual(['pose.x']);
    select(['data.tint']);
    expect(marked()).toEqual(['data.tint']);
  });

  it('is marked inside an object leaf the same way', () => {
    const { marked, select } = panel(['data.stroke.join']);
    expect(marked()).toEqual(['data.stroke.cap']);
    select(['data.stroke.width']);
    expect(marked()).toEqual(['data.stroke.width']);
  });

  it('keeps its controls as the direct children of the cell that sizes them', () => {
    panel(['pose.y']);
    const [x, y] = [screen.getByRole('textbox', { name: 'Position X' }), screen.getByRole('textbox', { name: 'Position Y' })];
    const row = x.closest('[data-pref-path]')!;
    expect(row.getAttribute('data-pref-path')).toBe('pose.x');
    expect(y.closest('[data-pref-path]')).toBe(row);
    expect(row.querySelector('[data-pref-path]')).toBeNull();
  });

  it('reports its first leaf, wherever in it the press lands', () => {
    const onSelect = vi.fn();
    panel(undefined, onSelect);
    fireEvent.pointerDown(screen.getByText('Position'));
    expect(onSelect).toHaveBeenLastCalledWith('pose.x', { toggle: false });
    onSelect.mockClear();
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Position Y' }));
    expect(onSelect).toHaveBeenLastCalledWith('pose.x', { toggle: false });
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Join' }), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('data.stroke.cap', { toggle: true });
  });

  it('is scrolled to when a leaf of it is selected from outside', () => {
    const scrolled: Array<string | null> = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this.getAttribute('data-pref-path')); };
    try {
      const { select } = panel();
      select(['pose.y']);
      select(['data.stroke.join']);
      expect(scrolled).toEqual(['pose.x', 'data.stroke.cap']);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('a section', () => {
  it('is marked when its own key is selected, beside any leaf selected with it', () => {
    const { marked, select } = panel(['place']);
    expect(marked()).toEqual(['place']);
    select(['data.name', 'look']);
    expect(marked()).toEqual(['data.name', 'look']);
  });

  it('marks nothing for a section nested in another, which draws no heading', () => {
    const { marked } = panel(['inner']);
    expect(marked()).toEqual([]);
    expect(screen.getByText('Deep')).toBeInTheDocument();
  });

  it('marks nothing for a top-level section that draws no heading, tab, or panel: a fragment, or a bar', () => {
    const { marked, container } = panel(['loose', 'tools']);
    expect(marked()).toEqual([]);
    expect(container.querySelector('[data-pref-path="loose"], [data-pref-path="tools"]')).toBeNull();
    expect(container.querySelector('[data-pref-path="place"]')).not.toBeNull();
  });

  it('reports its key for a press on its heading or its panel title', () => {
    const onSelect = vi.fn();
    panel(undefined, onSelect);
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Place' }));
    expect(onSelect).toHaveBeenLastCalledWith('place', { toggle: false });
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Look' }), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('look', { toggle: true });
    fireEvent.pointerDown(screen.getByText('Tint'));
    expect(onSelect).toHaveBeenLastCalledWith('data.tint', { toggle: false });
  });

  // A tab keeps its pointer events to itself, so what reaches the panel from a press is the focus it takes. Whether a
  // real press does that is the browser test's to say.
  it('reports its key when its tab takes focus', () => {
    const onSelect = vi.fn();
    panel(undefined, onSelect);
    fireEvent.focus(screen.getByRole('tab', { name: 'Two' }));
    expect(onSelect).toHaveBeenLastCalledWith('two', { toggle: false });
  });

  it('opens its tab when selected, marks it once, and leaves the reader free to open another', () => {
    const { marked, select } = panel();
    expect(marked()).toEqual([]);
    select(['two']);
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(marked()).toEqual(['two']);
    fireEvent.click(screen.getByRole('tab', { name: 'One' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(marked()).toEqual([]);
  });
});
