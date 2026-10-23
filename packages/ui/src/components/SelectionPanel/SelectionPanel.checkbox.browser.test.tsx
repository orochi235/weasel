import '@weasel-js/theme/tokens.css';
// First, so the panel's sheet lands after the checkbox's: a consumer's bundle may order them either way.
import '../checkbox.module.css';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { SelectionPanel } from './SelectionPanel';

// A row's controls share its width by a rule that ties with the checkbox's own on specificity, so which
// stylesheet loaded last decided whether a checkbox was a box or a bar across the row.

afterEach(cleanup);

it('draws a checkbox as a box, not across the row', () => {
  const scene = createScene<{ grid: boolean }, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { grid: true } });
  const members: PrefSection['members'] = {
    'data.grid': { kind: 'boolean', name: 'Grid', description: '', default: true, control: 'checkbox' } as PrefLeaf,
  };
  const properties: NodePropertiesEntry[] = [{ name: 'card', schema: { name: 'Card', members } }];
  const routing: NodeRoutingEntry[] = [{ name: 'card', matches: () => true }];
  render(<SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} />);
  const box = screen.getByRole('checkbox', { name: 'Grid' }).getBoundingClientRect();
  expect(box.width).toBe(box.height);
});
