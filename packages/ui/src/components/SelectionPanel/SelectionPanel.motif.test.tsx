import { cleanup, render, screen } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { DefaultMotif } from '../MotifFrame';
import { tab } from '../MotifFrame/motifs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const BLUR: PrefLeaf = { kind: 'number', name: 'Blur', description: '', default: 4 } as PrefLeaf;
const SHADOW = {
  kind: 'object', name: 'Shadow', description: '', default: { blur: 0 },
  children: { box: { name: 'Blur box', as: 'panel', motif: 'hero', members: { blur: BLUR } } },
} as unknown as PrefLeaf;

const schema: PrefSection = {
  name: 'Thing',
  members: {
    look: { name: 'Look', as: 'panel', motif: 'hero', members: { 'data.blur': BLUR } },
    'data.shadow': SHADOW,
  },
};

it("draws a panel section, and an object's panel section, in the motif its schema names", () => {
  const scene = createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { blur: 4, shadow: { blur: 2 } } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema }];
  const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
  render(
    <DefaultMotif named={{ hero: tab() }}>
      <SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} />
    </DefaultMotif>,
  );
  expect(screen.getByRole('group', { name: 'Look' })).toHaveAttribute('data-motif', 'tab');
  expect(screen.getByRole('group', { name: 'Blur box' })).toHaveAttribute('data-motif', 'tab');
});
