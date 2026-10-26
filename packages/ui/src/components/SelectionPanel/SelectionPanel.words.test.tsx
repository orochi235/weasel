import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { prefFieldChoices } from '../Prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string }
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const members: Record<string, PrefLeaf> = {
  'pose.size': { kind: 'number', name: 'Size', description: '', default: 12 },
  note: { kind: 'label', name: 'Sizes are in world units.', description: 'Zoom does not change them.', default: undefined },
  rule: { kind: 'separator', name: '', description: '', default: undefined },
  'pose.turn': { kind: 'number', name: 'Turn', description: '', default: 0 },
};

function setup(section: Partial<PrefSection> = {}) {
  const scene = createScene<Data, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { size: 3, turn: 1 }, data: { kind: 'thing' } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members, ...section } }];
  return render(<SelectionPanel scene={scene} selection={{ current: ['a'] } as unknown as SelectionApi} properties={properties} routing={routing} />);
}

describe('a label and a separator in a selection panel', () => {
  it('draws the label as its text and its note, once, and the separator as a rule', () => {
    setup();
    expect(screen.getAllByText('Sizes are in world units.')).toHaveLength(1);
    expect(screen.getByText('Zoom does not change them.')).toBeInTheDocument();
    expect(screen.getByRole('separator').tagName).toBe('HR');
    expect(screen.queryByText(/no renderer/)).toBeNull();
  });

  it('draws them in schema order, between the rows around them', () => {
    const { container } = setup();
    const order = [...container.querySelectorAll('input, hr')].map((el) => el.getAttribute('aria-label') ?? el.tagName);
    expect(order).toEqual(['Size', 'HR', 'Turn']);
  });

  it('gives neither a heading under a section with no name', () => {
    setup({ name: '' });
    expect(screen.queryByRole('heading', { name: 'Sizes are in world units.' })).toBeNull();
  });

  it('offers neither as a field another leaf can name', () => {
    expect(prefFieldChoices({ name: '', members }).map((f) => f.path)).toEqual(['pose.size', 'pose.turn']);
  });
});
