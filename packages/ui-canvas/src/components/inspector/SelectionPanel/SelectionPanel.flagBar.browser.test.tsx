import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from '../../../testing/rectScene';

// Paired toggles share one bar; which flags a drag crosses is a hit test against its laid-out segments.

afterEach(cleanup);

interface FlagData { kind: string; underline?: boolean; strikethrough?: boolean; overline?: boolean }

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false, control: 'toggle', short: [name[0]!] }) as const;

const routing: NodeRoutingEntry[] = [{ name: 'text', matches: (d) => (d as FlagData)?.kind === 'text' }];
const properties: NodePropertiesEntry[] = [{
  name: 'text',
  schema: {
    name: 'Properties',
    members: {
      'data.underline': { ...flag('Underline'), pair: { with: ['data.strikethrough', 'data.overline'], label: 'Decoration' } },
      'data.strikethrough': flag('Strikethrough'),
      'data.overline': flag('Overline'),
    },
  },
}];

test('a drag across a flag bar turns on each flag it reaches, and an Alt-drag solos', () => {
  const scene = createScene<FlagData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('t1'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'text' } });
  render(<SelectionPanel scene={scene} selection={selectionOf(['t1'])} properties={properties} routing={routing} />);
  const flags = ['Underline', 'Strikethrough', 'Overline'].map((n) => screen.getByRole('button', { name: `Decoration ${n}` }));
  const data = () => (scene.get(asNodeId('t1')) as { data: FlagData }).data;
  sweepAcross(flags);
  expect([data().underline, data().strikethrough, data().overline]).toEqual([true, true, true]);
  sweepAcross(flags.slice(1), { altKey: true });
  expect([data().underline, data().strikethrough, data().overline]).toEqual([false, true, true]);
});
