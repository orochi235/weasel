import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false, control: 'checkbox' }) as PrefLeaf;

const phase = {
  kind: 'object', name: 'Phase', description: '', default: {},
  children: { length: num('Length'), ease: num('Ease', { showIf: { path: 'data.eased' } }), hold: num('Hold', { enableIf: { path: 'data.holds' } }) },
} as PrefLeaf;
const members: PrefSection['members'] = {
  'data.eased': flag('Eased'),
  'data.holds': flag('Holds'),
  'data.open': flag('Open'),
  'data.phases': { kind: 'list', name: 'Phases', description: '', default: [], item: phase } as PrefLeaf,
  'data.weights': { kind: 'map', name: 'Weights', description: '', default: {}, item: num('Weight', { enableIf: { path: 'data.open' } }) } as PrefLeaf,
};

function setup(flags: Record<string, boolean>) {
  const scene = createScene<Data, 'default', Record<string, number>>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'leaf', layer: 'default', pose: {}, data: { kind: 'thing', phases: [{ length: 1 }, { length: 2 }], weights: { left: 3 }, ...flags } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  render(<SelectionPanel scene={scene} selection={{ current: ['n'] } as unknown as SelectionApi} properties={properties} routing={routing} />);
}

describe("SelectionPanel conditions on a list's and a map's item", () => {
  it("hides a field of every entry while the item's showIf for it fails", () => {
    setup({ eased: false });
    expect(screen.getAllByRole('spinbutton', { name: 'Length' })).toHaveLength(2);
    expect(screen.queryByRole('spinbutton', { name: 'Ease' })).toBeNull();
    cleanup();
    setup({ eased: true });
    expect(screen.getAllByRole('spinbutton', { name: 'Ease' })).toHaveLength(2);
  });

  it("disables a field of every entry while the item's enableIf for it fails", () => {
    setup({ holds: false });
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' })) expect(hold).toBeDisabled();
    expect(screen.getAllByRole('spinbutton', { name: 'Length' })[0]).toBeEnabled();
    cleanup();
    setup({ holds: true });
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' })) expect(hold).toBeEnabled();
  });

  it("disables every entry's control while the item's own enableIf fails", () => {
    setup({ open: false });
    expect(screen.getByRole('spinbutton', { name: 'Weight left' })).toBeDisabled();
    cleanup();
    setup({ open: true });
    expect(screen.getByRole('spinbutton', { name: 'Weight left' })).toBeEnabled();
  });
});
