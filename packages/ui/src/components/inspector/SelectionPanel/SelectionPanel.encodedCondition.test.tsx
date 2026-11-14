import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
interface Pose { x: number; y: number; width: number; height: number }

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const italic = { read: (stored: unknown) => stored === 'italic', write: (on: boolean) => (on ? 'italic' : 'normal') };
/** A dash array read as a style: lengths equal to the stroke's width are dots. */
const dash = {
  read: (stored: unknown, siblings: Record<string, unknown> | undefined) =>
    !Array.isArray(stored) || stored.length === 0 ? 'solid' : stored[0] === siblings?.width ? 'dotted' : 'dashed',
  write: () => undefined,
};
const members: PrefSection['members'] = {
  'data.slant': { kind: 'boolean', name: 'Italic', description: '', default: false, control: 'checkbox', encoding: italic } as PrefLeaf,
  'data.angle': { kind: 'number', name: 'Angle', description: '', default: 12, showIf: { path: 'data.slant', is: true } } as PrefLeaf,
  'data.stroke': {
    kind: 'object', name: 'Stroke', description: '', default: { width: 1 },
    children: {
      width: { kind: 'number', name: 'Width', description: '', default: 1 },
      dash: { kind: 'enum', name: 'Style', description: '', default: 'solid', encoding: dash, options: ['solid', 'dashed', 'dotted'].map((value) => ({ value, label: value })) },
    },
  } as PrefLeaf,
  'data.gap': { kind: 'number', name: 'Gap', description: '', default: 2, enableIf: { path: 'data.stroke.dash', is: 'dotted' } } as PrefLeaf,
};

function setup(data: Record<string, unknown>) {
  const scene = createScene<Data, 'default', Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', ...data } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  render(<SelectionPanel scene={scene} selection={{ current: ['n'] } as unknown as SelectionApi} properties={properties} routing={routing} />);
}

describe('SelectionPanel conditions over encoded leaves', () => {
  it('compare an encoded boolean as on or off', () => {
    setup({ slant: 'italic', angle: 3 });
    expect(screen.getByRole('spinbutton', { name: 'Angle' })).toBeInTheDocument();
    cleanup();
    setup({ slant: 'normal', angle: 3 });
    expect(screen.queryByRole('spinbutton', { name: 'Angle' })).toBeNull();
  });

  it("compare an encoded enum as the option it reads as, against its object's other fields", () => {
    setup({ gap: 2, stroke: { width: 3, dash: [3, 3] } });
    expect(screen.getByRole('spinbutton', { name: 'Gap' })).toBeEnabled();
    cleanup();
    setup({ gap: 2, stroke: { width: 3, dash: [9, 3] } });
    expect(screen.getByRole('spinbutton', { name: 'Gap' })).toBeDisabled();
  });
});
