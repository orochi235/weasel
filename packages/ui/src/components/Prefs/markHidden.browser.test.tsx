import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
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
  const scene = createScene<Record<string, unknown>, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: {}, data: { on: false } });
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
  const badgeEl = screen.getAllByText('hidden')[0]!;
  const badge = badgeEl.getBoundingClientRect();
  const field = screen.getByRole('spinbutton', { name: 'Size' }).getBoundingClientRect();
  // The label column is narrower than the name and the badge together: the badge wraps under the name.
  expect(badge.right).toBeLessThanOrEqual(field.left);
  expect(Math.abs((badge.top + badge.bottom) / 2 - (field.top + field.bottom) / 2)).toBeLessThan(field.height);
});

it('sets a hidden page\'s badge inside its rail entry, on the name\'s line', () => {
  const schema: PrefGroup = {
    name: 'Prefs',
    children: {
      main: { name: 'Main', children: { on: flag('On') } },
      grid: { name: 'A page with a long name', showIf: { path: 'main.on' }, children: { fine: num('Fine') } },
    },
  };
  render(<PrefsForm layout="rail" schema={schema} values={{}} onChange={() => {}} markHidden />);
  const entry = document.querySelector<HTMLElement>('[data-pref-rail="grid"]')!;
  expect(Number(getComputedStyle(entry).opacity)).toBeCloseTo(0.55);
  expect(Number(getComputedStyle(document.querySelector('[data-pref-rail="main"]')!).opacity)).toBe(1);
  const box = entry.getBoundingClientRect();
  const badge = within(entry).getByText('hidden').getBoundingClientRect();
  const name = entry.firstElementChild!.getBoundingClientRect();
  expect(badge.width).toBeGreaterThan(0);
  expect(badge.left).toBeGreaterThanOrEqual(name.right);
  expect(badge.right).toBeLessThanOrEqual(box.right);
  expect(badge.top).toBeGreaterThanOrEqual(box.top);
  expect(badge.bottom).toBeLessThanOrEqual(box.bottom);
});

it('sets a hidden bar cell\'s badge inside the cell, beside its control and inside the bar', () => {
  const bar: PrefGroup = { name: 'Bar', as: 'bar', children: { on: flag('On'), size: num('Size', { showIf: { path: 'on' } }) } };
  render(<PrefsForm schema={bar} values={{}} onChange={() => {}} markHidden />);
  const cell = document.querySelector<HTMLElement>('[data-pref-path="size"]')!;
  expect(Number(getComputedStyle(cell).opacity)).toBeCloseTo(0.55);
  const box = cell.getBoundingClientRect();
  const strip = document.querySelector('[data-pref-bar]')!.getBoundingClientRect();
  const badge = within(cell).getByText('hidden').getBoundingClientRect();
  const field = within(cell).getByRole('spinbutton').getBoundingClientRect();
  expect(badge.width).toBeGreaterThan(0);
  expect(badge.left).toBeGreaterThanOrEqual(field.right);
  expect(badge.right).toBeLessThanOrEqual(box.right);
  expect(badge.top).toBeGreaterThanOrEqual(strip.top);
  expect(badge.bottom).toBeLessThanOrEqual(strip.bottom);
});
