import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { SelectionPanel } from './SelectionPanel';

// The panel's rows are its own, so the dimmed label is its own rule, which jsdom does not resolve.

afterEach(cleanup);

const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;

it('dims the label of a disabled row below that of the row beside it', () => {
  const scene = createScene<{ locked: boolean }, 'default', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { locked: true } });
  const members: PrefSection['members'] = {
    'data.radius': num('Radius', { enableIf: { path: 'data.locked', is: false } }),
    'data.inset': num('Inset'),
  };
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
  render(<SelectionPanel scene={scene} selection={{ current: ['a'] } as unknown as SelectionApi} properties={properties} routing={routing} />);
  const opacity = (label: string): number => Number(getComputedStyle(screen.getByText(label)).opacity);
  expect(opacity('Radius')).toBe(0.5);
  // The panel draws every label a little back already, so an enabled one is not at 1.
  expect(opacity('Inset')).toBeGreaterThan(opacity('Radius'));
  expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeDisabled();
});
