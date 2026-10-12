import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { SelectionPanel } from '../SelectionPanel';
import { PrefsForm } from './PrefsForm';

// The mark's dimming and the badge's box are the stylesheet's, which jsdom does not load.

afterEach(cleanup);

const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const opacityAt = (path: string): number =>
  Number(getComputedStyle(document.querySelector(`[data-pref-path="${path}"]`)!).opacity);

it('dims a hidden row and a hidden group of a form once each, and sets the badge on the label line', () => {
  const schema: PrefGroup = {
    name: 'Prefs',
    children: {
      on: flag('On'),
      size: num('Size', { showIf: { path: 'on' } }),
      plain: num('Plain'),
      grid: { name: 'Grid', showIf: { path: 'on' }, children: { fine: num('Fine') } },
    },
  };
  render(<PrefsForm layout="list" schema={schema} values={{}} onChange={() => {}} markHidden />);
  expect(opacityAt('size')).toBeCloseTo(0.55);
  expect(opacityAt('plain')).toBe(1);
  expect(opacityAt('grid')).toBeCloseTo(0.55);
  expect(opacityAt('grid.fine')).toBe(1);
  const [rowBadge] = screen.getAllByText('hidden');
  const badge = rowBadge!.getBoundingClientRect();
  const label = screen.getByText('Size').getBoundingClientRect();
  expect(badge.width).toBeGreaterThan(0);
  expect(badge.left).toBeGreaterThanOrEqual(label.left);
  expect(badge.top).toBeLessThan(label.bottom);
  expect(badge.bottom).toBeGreaterThan(label.top);
});

it('dims a hidden row and a hidden section of a selection panel once each', () => {
  const scene = createScene<Record<string, unknown>, 'default', Record<string, number>>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'default', pose: {}, data: { on: false } });
  const members: PrefSection['members'] = {
    'data.size': num('Size', { showIf: { path: 'data.on' } }),
    'data.plain': num('Plain'),
    corners: { name: 'Corners', showIf: { path: 'data.on' }, members: { 'data.radius': num('Radius') } },
  };
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
  render(<SelectionPanel scene={scene} selection={{ current: ['a'] } as unknown as SelectionApi} properties={properties} routing={routing} markHidden />);
  expect(opacityAt('data.size')).toBeCloseTo(0.55);
  expect(opacityAt('data.plain')).toBe(1);
  expect(opacityAt('data.radius')).toBe(1);
  const section = screen.getByRole('heading', { name: /Corners/ }).closest('section')!;
  expect(Number(getComputedStyle(section).opacity)).toBeCloseTo(0.55);
  // On the control's line, and not pushing it off. The label column is narrow: the badge may touch the field.
  const badge = screen.getAllByText('hidden')[0]!.getBoundingClientRect();
  const field = screen.getByRole('spinbutton', { name: 'Size' }).getBoundingClientRect();
  expect(badge.right).toBeLessThanOrEqual(field.left + 4);
  expect(Math.abs((badge.top + badge.bottom) / 2 - (field.top + field.bottom) / 2)).toBeLessThan(field.height);
});
