import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SelectionApi } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false, control: 'checkbox' }) as PrefLeaf;
const go: PrefLeaf = { kind: 'action', name: 'Go', description: '', default: undefined, run: () => {}, activeIf: { path: 'data.on' } } as PrefLeaf;
const style: PrefLeaf = { kind: 'object', name: 'Style', description: '', default: {}, block: true, children: { go } } as PrefLeaf;

function draw(members: PrefSection['members'], on: boolean, over?: PrefSection) {
  const scene = createScene<Record<string, unknown>, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { on, style: {} } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  render(<SelectionPanel scene={scene} selection={{ current: ['n'] } as unknown as SelectionApi} properties={properties} routing={routing} over={over} />);
}

describe("SelectionPanel an object leaf's action field", () => {
  it('draws pressed where its activeIf holds', () => {
    draw({ 'data.on': flag('On'), 'data.style': style }, true);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('aria-pressed', 'true');
    cleanup();
    draw({ 'data.on': flag('On'), 'data.style': style }, false);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("draws pressed inside an alias of the object leaf, by the target's activeIf", () => {
    draw({
      'data.on': flag('On'),
      main: { name: 'Main', members: { 'data.style': style } },
      more: { name: 'More', members: { look: { kind: 'alias', name: 'Look', description: '', default: undefined, of: 'data.style' } as PrefLeaf } },
    }, true);
    expect(screen.getAllByRole('button', { name: 'Go' }).map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true']);
  });

  it('draws pressed inside an alias into another schema, by that schema\'s activeIf', () => {
    const over: PrefSection = { name: 'Over', members: { 'data.on': flag('On'), 'data.style': style } };
    draw({ look: { kind: 'alias', name: 'Look', description: '', default: undefined, of: 'data.style' } as PrefLeaf }, true, over);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('aria-pressed', 'true');
  });
});
