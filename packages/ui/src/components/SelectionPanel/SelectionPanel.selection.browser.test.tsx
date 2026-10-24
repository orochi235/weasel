import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SelectionPanel } from './SelectionPanel';

// Whether a marked row shows its mark is the stylesheet's to answer, and this file loads only what the panel imports.

afterEach(cleanup);

const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' });
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
const properties: NodePropertiesEntry[] = [
  { name: 'thing', schema: { name: 'Thing', members: { 'data.name': text('Name'), 'data.tint': text('Tint') } } },
];

test('a selected row is outlined, and no other', () => {
  const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: {} });
  render(<SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} selected={['data.tint']} />);
  const outlined = (name: string): boolean => getComputedStyle(screen.getByText(name).closest('[data-pref-path]')!).outlineStyle === 'solid';
  expect([outlined('Name'), outlined('Tint')]).toEqual([false, true]);
});

const SECTIONED: PrefSection = {
  name: 'Thing',
  members: {
    place: {
      name: 'Place',
      members: { 'pose.x': { ...text('X'), pair: { with: 'pose.y', label: 'Position' } } as PrefLeaf, 'pose.y': text('Y'), 'data.tint': text('Tint') },
    },
    edge: { name: 'Edge', as: 'panel', members: { 'data.radius': text('Radius') } },
    one: { name: 'One', as: 'tab', members: { 'data.a': text('Alpha') } },
    two: { name: 'Two', as: 'tab', members: { 'data.b': text('Beta') } },
  },
};

function sectioned(selected: readonly string[], onSelect?: (path: string) => void) {
  const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: {} });
  render(
    <SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={[{ name: 'thing', schema: SECTIONED }]}
      routing={routing} selected={selected} onSelect={onSelect} />,
  );
}

const outlinedAt = (el: Element): boolean => getComputedStyle(el).outlineStyle === 'solid';

test('a paired row is outlined when its second leaf is selected, and its controls still share the row evenly', () => {
  sectioned(['pose.y']);
  const [x, y] = [screen.getByRole('textbox', { name: 'Position X' }), screen.getByRole('textbox', { name: 'Position Y' })];
  const row = x.closest('[data-pref-path]')!;
  expect(outlinedAt(row)).toBe(true);
  expect(outlinedAt(screen.getByText('Tint').closest('[data-pref-path]')!)).toBe(false);
  const [a, b] = [x.getBoundingClientRect(), y.getBoundingClientRect()];
  expect(a.width).toBeGreaterThan(20);
  expect(Math.abs(a.width - b.width)).toBeLessThan(1);
  expect(a.top).toBe(b.top);
});

test('a selected section is outlined: under a heading, in a panel, and as the open tab\'s panel but not its tab', () => {
  sectioned(['place', 'edge', 'one']);
  expect(outlinedAt(screen.getByRole('heading', { name: 'Place' }).closest('section')!)).toBe(true);
  expect(outlinedAt(screen.getByRole('group', { name: 'Edge' }))).toBe(true);
  expect(outlinedAt(screen.getByRole('tabpanel'))).toBe(true);
  expect(outlinedAt(screen.getByRole('tab', { name: 'One' }))).toBe(false);
  // The rows inside a marked section carry no mark of their own.
  expect(outlinedAt(screen.getByText('Tint').closest('[data-pref-path]')!)).toBe(false);
});

test('a real press on a tab reports its section, and one on a heading reports that section', async () => {
  const onSelect = vi.fn();
  sectioned([], onSelect);
  await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
  expect(onSelect).toHaveBeenLastCalledWith('two', { toggle: false });
  await userEvent.click(screen.getByRole('heading', { name: 'Edge' }));
  expect(onSelect).toHaveBeenLastCalledWith('edge', { toggle: false });
});
