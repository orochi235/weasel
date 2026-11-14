import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const selectionOf = (ids: string[]): SelectionApi => ({ current: ids }) as unknown as SelectionApi;
const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'checkbox', ...extra }) as PrefLeaf;
const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const alias = (of: string, name = ''): PrefLeaf => ({ kind: 'alias', name, description: '', default: undefined, of });

// The schema the settings live in, which the panel is not drawn from: a section's keys are whole node paths.
const whole: PrefSection = {
  name: 'Everything',
  members: {
    'data.shown': flag('Shown'),
    'data.open': flag('Open'),
    lock: { name: 'Lock', showIf: { path: 'data.shown' }, members: { 'data.locked': flag('Locked', { enableIf: { path: 'data.open' } }) } },
    'data.stroke': {
      kind: 'object', name: 'Stroke', description: '', default: { width: 0, dash: 0, cap: 0 },
      children: {
        width: num('Width'),
        dash: num('Dash', { showIf: { path: 'data.stroke.width', above: 0 } }),
        cap: num('Cap', { enableIf: { path: 'data.stroke.width', above: 0 } }),
      },
    } as PrefLeaf,
  },
};
// A layout of pointers into it.
const layout: PrefSection = {
  name: 'Layout',
  members: { rows: { name: 'Rows', members: { 'layout.locked': alias('data.locked'), 'layout.stroke': alias('data.stroke') } } },
};

function setup(data: Record<string, unknown>, over?: PrefGroup | PrefSection, ids = ['a']) {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  for (const id of ids) {
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', ...data } });
  }
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: layout }];
  render(<SelectionPanel scene={scene} selection={selectionOf(ids)} properties={properties} routing={routing} over={over} />);
  return (id = 'a') => scene.get(asNodeId(id))?.data;
}

describe('SelectionPanel over another schema', () => {
  it('draws an alias as the leaf of that schema at its path, where the panel\'s own holds none', () => {
    setup({ shown: true, open: true, locked: true });
    expect(screen.getByText('(alias: no pref at data.locked)')).toBeInTheDocument();
    cleanup();
    setup({ shown: true, open: true, locked: true }, whole);
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeChecked();
  });

  it('reads the leaf\'s value from each node at its path, and writes it there', () => {
    const data = setup({ shown: true, open: true, locked: false }, whole, ['a', 'b']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Locked' }));
    expect(data('a')).toMatchObject({ locked: true });
    expect(data('b')).toMatchObject({ locked: true });
    expect(data('a')).not.toHaveProperty('layout');
  });

  it('finds the leaf in a group schema, whose keys are steps of the path', () => {
    const grouped: PrefGroup = { name: 'Everything', children: { data: { name: 'Data', children: { locked: flag('Locked') } } } };
    setup({ locked: true }, grouped);
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeChecked();
  });

  it('leaves the alias out while a section above its leaf in that schema is not shown, and disables it while the leaf is', () => {
    setup({ shown: false, open: true }, whole);
    expect(screen.queryByRole('checkbox', { name: 'Locked' })).toBeNull();
    cleanup();
    setup({ shown: true, open: false }, whole);
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeDisabled();
    cleanup();
    setup({ shown: true, open: true }, whole);
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeEnabled();
  });

  it('hides and disables the fields of an object leaf an alias shows, by that schema\'s conditions', () => {
    setup({ stroke: { width: 0, dash: 0, cap: 0 } }, whole);
    expect(screen.getByRole('spinbutton', { name: /Width/ })).toBeEnabled();
    expect(screen.queryByRole('spinbutton', { name: /Dash/ })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: /Cap/ })).toBeDisabled();
    cleanup();
    setup({ stroke: { width: 2, dash: 0, cap: 0 } }, whole);
    expect(screen.getByRole('spinbutton', { name: /Dash/ })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Cap/ })).toBeEnabled();
  });
});

describe('a condition of a SelectionPanel\'s own node that reads a pref of `over`', () => {
  const settings: PrefSection = {
    name: 'Everything',
    members: {
      'data.slant': flag('Italic', { default: 'normal', encoding: { read: (held: unknown) => held === 'italic', write: (on: boolean) => (on ? 'italic' : 'normal') } }),
      'data.snap': flag('Snap', { default: true, absentIsDefault: true }),
    },
  };
  const gated: PrefSection = {
    name: 'Layout',
    members: {
      'data.tight': flag('Tight', { enableIf: { path: 'data.slant' } }),
      'data.fine': flag('Fine', { showIf: { path: 'data.snap' } }),
    },
  };
  const draw = (data: Record<string, unknown>, over?: PrefSection) => {
    const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', ...data } });
    render(<SelectionPanel scene={scene} selection={selectionOf(['a'])} properties={[{ name: 'thing', schema: gated }]} routing={routing} over={over} />);
  };

  it('compares the value as that pref\'s control shows it', () => {
    draw({ slant: 'normal' });
    expect(screen.getByRole('checkbox', { name: 'Tight' })).toBeEnabled();
    cleanup();
    draw({ slant: 'normal' }, settings);
    expect(screen.getByRole('checkbox', { name: 'Tight' })).toBeDisabled();
    cleanup();
    draw({ slant: 'italic' }, settings);
    expect(screen.getByRole('checkbox', { name: 'Tight' })).toBeEnabled();
  });

  it('reads a node holding nothing there as that pref says absence reads', () => {
    draw({});
    expect(screen.queryByRole('checkbox', { name: 'Fine' })).toBeNull();
    cleanup();
    draw({}, settings);
    expect(screen.getByRole('checkbox', { name: 'Fine' })).toBeInTheDocument();
  });
});
