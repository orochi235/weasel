import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, test } from 'vitest';
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
  scene.add({ id: asNodeId('n'), kind: 'leaf', layer: 'default', pose: {}, data: {} });
  render(<SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} selected={['data.tint']} />);
  const outlined = (name: string): boolean => getComputedStyle(screen.getByText(name).closest('[data-pref-path]')!).outlineStyle === 'solid';
  expect([outlined('Name'), outlined('Tint')]).toEqual([false, true]);
});
