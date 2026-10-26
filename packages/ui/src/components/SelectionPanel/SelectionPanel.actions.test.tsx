import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActionsProvider, asNodeId, createScene, type Action, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import { pref, type PrefLeaf } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';
import { RegisterAction } from '@weasel-js/routing/testing/registerAction';

afterEach(cleanup);

interface Data { kind: string }
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];

const act = (id: string, label: string): Action => ({ id, label, group: 'arrange', invoker: { timing: 'immediate', run: () => {} } });

function setup(members: Record<string, PrefLeaf>) {
  const scene = createScene<Data, 'default', Record<string, number>>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { size: 3 }, data: { kind: 'thing' } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  return render(
    <ActionsProvider>
      <RegisterAction action={act('front', 'Bring to front')} />
      <RegisterAction action={act('back', 'Send to back')} />
      <SelectionPanel scene={scene} selection={{ current: ['a'] } as unknown as SelectionApi} properties={properties} routing={routing} />
    </ActionsProvider>,
  );
}

describe('actions in a selection panel', () => {
  it('reads an action leaf’s label once, on its button', () => {
    setup({ go: pref.action('front', { name: 'To front' }) });
    expect(screen.getAllByText('To front')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'To front' })).toBeDefined();
  });

  it('draws an actions leaf as one row per action, with no row label', () => {
    setup({ arrange: pref.actions('arrange', { name: 'Arrange' }) });
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Bring to front', 'Send to back']);
    expect(screen.queryByText('Arrange')).toBeNull();
  });

  it('draws a readout leaf as its value', () => {
    setup({ 'pose.size': { ...pref.number('Size', 0), readout: true } });
    expect(screen.getByRole('status', { name: 'Size' }).textContent).toBe('3');
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});
