import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel, type PropertyRenderer } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const selectionOf = (ids: string[]): SelectionApi => ({ current: ids }) as unknown as SelectionApi;
const locked: PrefLeaf = { kind: 'boolean', name: 'Locked', description: '', default: false, control: 'checkbox' };
const alias = (of: string, name = ''): PrefLeaf => ({ kind: 'alias', name, description: '', default: undefined, of });

function setup(members: PrefSection['members'], renderers?: Record<string, PropertyRenderer>) {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', locked: false } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  render(<SelectionPanel scene={scene} selection={selectionOf(['a'])} properties={properties} routing={routing} renderers={renderers} />);
  return () => scene.get(asNodeId('a'))?.data;
}

describe('SelectionPanel alias leaves', () => {
  it('draws an alias as its target\'s row, under the alias\'s own name, and writes the target\'s path', () => {
    const data = setup({
      main: { name: 'Main', members: { 'data.locked': locked } },
      more: { name: 'More', members: { 'data.lockedToo': alias('data.locked', 'Pinned') } },
    });
    expect(screen.queryByText(/no renderer/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pinned' }));
    expect(data()).toMatchObject({ locked: true });
    expect(data()).not.toHaveProperty('lockedToo');
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeChecked();
  });

  it('takes the target\'s name where the alias gives none', () => {
    setup({
      main: { name: 'Main', members: { 'data.locked': locked } },
      more: { name: 'More', members: { 'data.lockedToo': alias('data.locked') } },
    });
    expect(screen.getAllByRole('checkbox', { name: 'Locked' })).toHaveLength(2);
  });

  it('says so where an alias points at nothing', () => {
    setup({ main: { name: 'Main', members: { 'data.lockedToo': alias('data.gone', 'Pinned') } } });
    expect(screen.getByText('(alias: no pref at data.gone)')).toBeInTheDocument();
  });

  it('hides an alias while a section above its target is hidden, and disables it while its target is', () => {
    const gated = (extra: object): PrefSection['members'] => ({
      main: { name: 'Main', ...extra, members: { 'data.locked': locked } },
      more: { name: 'More', members: { 'data.lockedToo': alias('data.locked', 'Pinned') } },
    });
    setup(gated({ showIf: { path: 'data.kind', is: 'other' } }));
    expect(screen.queryByRole('checkbox', { name: 'Pinned' })).toBeNull();
    cleanup();
    setup(gated({ enableIf: { path: 'data.kind', is: 'other' } }));
    expect(screen.getByRole('checkbox', { name: 'Pinned' })).toBeDisabled();
    cleanup();
    setup(gated({ enableIf: { path: 'data.kind', is: 'thing' } }));
    expect(screen.getByRole('checkbox', { name: 'Pinned' })).toBeEnabled();
  });

  it('leaves an alias to a renderer given for the kind', () => {
    setup(
      { main: { name: 'Main', members: { 'data.locked': locked, 'data.lockedToo': alias('data.locked', 'Pinned') } } },
      { alias: (ctx) => <span>own alias at {ctx.path}</span> },
    );
    expect(screen.getByText('own alias at data.lockedToo')).toBeInTheDocument();
  });
});
