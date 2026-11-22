import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SelectionApi } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];

const stroke = {
  kind: 'object',
  name: 'Stroke',
  description: '',
  default: { on: false, width: 1 },
  enableIf: { path: 'data.stroke.on' },
  children: {
    on: { kind: 'boolean', name: 'Stroke on', description: '', default: false },
    width: { kind: 'number', name: 'Width', description: '', default: 1 },
  },
} as PrefLeaf;

describe("an object leaf its own enableIf turns off, in SelectionPanel", () => {
  it('turns back on from its own switch, with its other fields held', () => {
    const scene = createScene<Data, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: {}, data: { kind: 'thing', stroke: { on: false, width: 1 } } });
    const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members: { 'data.stroke': stroke } } }];
    render(<SelectionPanel scene={scene} selection={{ current: ['a'] } as unknown as SelectionApi} properties={properties} routing={routing} />);
    const on = screen.getByRole('switch', { name: 'Stroke on' });
    expect(on).toBeEnabled();
    expect(screen.getByLabelText('Width')).toBeDisabled();
    fireEvent.click(on);
    expect(scene.get(asNodeId('a'))?.data.stroke).toEqual({ on: true, width: 1 });
  });
});
