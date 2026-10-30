import { cleanup, render, screen } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { effectiveSections } from './model';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const flag = (name: string, pair?: { with: string; label: string }): PrefLeaf =>
  ({ kind: 'boolean', control: 'toggle', name, description: '', default: false, ...(pair ? { pair } : {}) }) as PrefLeaf;

const routing: NodeRoutingEntry[] = ['thing', 'other'].map((name) => ({ name, matches: (d) => (d as { kind: string }).kind === name }));

function panel(properties: NodePropertiesEntry[], kinds: string[]) {
  const scene = createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  for (const kind of kinds) scene.add({ id: asNodeId(kind), kind: 'mark', layer: 'default', pose: {}, data: { kind, style: {} } });
  return render(<SelectionPanel scene={scene} selection={{ current: kinds.map(asNodeId) }} properties={properties} routing={routing} />);
}

describe('a pair with one leaf left to draw', () => {
  const BOTH: PrefSection = {
    name: 'Thing',
    members: { 'data.bold': flag('Bold', { with: 'data.italic', label: 'Style' }), 'data.italic': flag('Italic') },
  };
  const HALF: PrefSection = { name: 'Other', members: { 'data.bold': flag('Bold') } };
  const entries: NodePropertiesEntry[] = [{ name: 'thing', schema: BOTH }, { name: 'other', schema: HALF }];

  it('is a row of its own under its own name when the kinds selected share only half of it', () => {
    const [section] = effectiveSections(['thing', 'other'], entries);
    expect(section!.items).toEqual([{ label: 'Bold', leaves: [expect.objectContaining({ path: 'data.bold' })] }]);
    const { container } = panel(entries, ['thing', 'other']);
    expect(container.querySelector('[data-pref-path="data.bold"]')?.textContent).toContain('Bold');
    expect(screen.queryByText('Style')).toBeNull();
    // A lone flag is a switch of its own, not a bar of one segment.
    expect(screen.queryByRole('group', { name: 'Style' })).toBeNull();
  });

  it('is a field under its own name inside an object leaf', () => {
    const STYLE: PrefLeaf = {
      kind: 'object', name: 'Type', description: '', default: {},
      children: { bold: flag('Bold', { with: 'data.style.gone', label: 'Style' }) },
    } as PrefLeaf;
    const { container } = panel([{ name: 'thing', schema: { name: 'Thing', members: { 'data.style': STYLE } } }], ['thing']);
    expect(container.querySelector('[data-pref-path="data.style.bold"]')?.textContent).toContain('Bold');
    expect(screen.queryByText('Style')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Style' })).toBeNull();
  });
});
