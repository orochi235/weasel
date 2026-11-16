import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from '../../../testing/rectScene';
interface FlagData { kind: string; underline?: boolean; strikethrough?: boolean; overline?: boolean }
const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false, control: 'toggle', short: [name[0]!] }) as const;
const routing: NodeRoutingEntry[] = [{ name: 'text', matches: (d) => (d as FlagData)?.kind === 'text' }];
const properties: NodePropertiesEntry[] = [{ name: 'text', schema: { name: 'Properties', members: {
  'data.underline': { ...flag('Underline'), pair: { with: ['data.strikethrough', 'data.overline'], label: 'Decoration' } },
  'data.strikethrough': flag('Strikethrough'), 'data.overline': flag('Overline') } } }];
// One move can reach several segments; each step must report against the value the last one wrote.
afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

it('solos the flags an Alt-drag reaches, when one move reaches two of them', () => {
  const scene = createScene<FlagData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('t1'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'text', underline: true, strikethrough: true, overline: true } });
  render(<SelectionPanel scene={scene} selection={selectionOf(['t1'])} properties={properties} routing={routing} />);
  const flags = ['Underline', 'Strikethrough', 'Overline'].map((n) => screen.getByRole('button', { name: `Decoration ${n}` }));
  document.elementFromPoint = (x: number) => flags[Math.floor(x / 10)] ?? null;
  const data = () => (scene.get(asNodeId('t1')) as { data: FlagData }).data;
  const fire = (type: string, x: number) => act(() => { flags[Math.floor(x / 10)]!.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: 5, altKey: true })); });
  fire('pointerdown', 15);
  fire('pointermove', 25);
  fire('pointerup', 25);
  expect([data().underline, data().strikethrough, data().overline]).toEqual([false, true, true]);
});
