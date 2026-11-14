import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
type Extra = Record<string, unknown>;
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const num = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'checkbox', ...extra }) as PrefLeaf;
const on = { path: 'data.on' };

const members: PrefSection['members'] = {
  'data.on': flag('On'),
  'data.size': num('Size', { showIf: on }),
  'data.lock': num('Lock', { enableIf: on }),
  'data.stroke': {
    kind: 'object', name: 'Stroke', description: '', default: {},
    children: { width: num('Width'), miter: num('Miter', { showIf: on }) },
  } as PrefLeaf,
  corners: { name: 'Corners', showIf: on, members: { 'data.radius': num('Radius'), 'data.bevel': flag('Bevel') } },
  edges: { name: 'Edges', members: { 'data.soft': flag('Soft'), 'data.feather': num('Feather', { showIf: on }) } },
};

function setup(data: Extra, extra: Extra = {}) {
  const scene = createScene<Data, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { kind: 'thing', stroke: { width: 1 }, ...data } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  return render(
    <SelectionPanel scene={scene} selection={{ current: ['n'] } as unknown as SelectionApi} properties={properties} routing={routing} {...extra} />,
  ).container;
}

const at = (container: HTMLElement, path: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-pref-path="${path}"]`);
  if (el === null) throw new Error(`nothing drawn at ${path}`);
  return el;
};

describe('SelectionPanel markHidden', () => {
  it('draws a row whose showIf fails, marked as hidden and badged, where it is otherwise left out', () => {
    setup({ on: false });
    expect(screen.queryByRole('spinbutton', { name: 'Size' })).toBeNull();
    cleanup();
    const container = setup({ on: false }, { markHidden: true });
    const row = at(container, 'data.size');
    expect(within(row).getByRole('spinbutton', { name: 'Size' })).toBeEnabled();
    expect(row).toHaveAttribute('data-pref-hidden');
    expect(within(row).getByText('hidden')).toBeInTheDocument();
  });

  it('marks a hidden cell of a bar section with the badge, and no cell that is shown', () => {
    const scene = createScene<Data, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { kind: 'thing', on: false } });
    const bar: PrefSection['members'] = { tools: { name: 'Tools', as: 'bar', members: { 'data.on': flag('On'), 'data.size': num('Size', { showIf: on }) } } };
    const { container } = render(
      <SelectionPanel scene={scene} selection={{ current: ['n'] } as unknown as SelectionApi}
        properties={[{ name: 'thing', schema: { name: 'Properties', members: bar } }]} routing={routing} markHidden />,
    );
    expect(at(container, 'data.size')).toHaveAttribute('data-pref-hidden');
    expect(within(at(container, 'data.size')).getByText('hidden')).toBeInTheDocument();
    expect(within(at(container, 'data.on')).queryByText('hidden')).toBeNull();
  });

  it('marks nothing that is shown', () => {
    const container = setup({ on: true }, { markHidden: true });
    expect(container.querySelector('[data-pref-hidden]')).toBeNull();
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('keeps a hidden row one to pick, as any other', () => {
    const onSelect = vi.fn();
    const container = setup({ on: false }, { markHidden: true, onSelect });
    const row = at(container, 'data.size');
    expect(row).toHaveAttribute('data-pref-leaf');
    fireEvent.pointerDown(row);
    expect(onSelect).toHaveBeenCalledWith('data.size', { toggle: false });
  });

  it('keeps drawing a disabled row disabled, and does not mark it', () => {
    const container = setup({ on: false }, { markHidden: true });
    expect(screen.getByRole('spinbutton', { name: 'Lock' })).toBeDisabled();
    expect(at(container, 'data.lock')).not.toHaveAttribute('data-pref-hidden');
  });

  it("marks a hidden field of an object leaf on the field's own row", () => {
    const container = setup({ on: false }, { markHidden: true });
    const row = at(container, 'data.stroke.miter');
    expect(row).toHaveAttribute('data-pref-hidden');
    expect(within(row).getByText('hidden')).toBeInTheDocument();
    expect(at(container, 'data.stroke.width')).not.toHaveAttribute('data-pref-hidden');
    expect(at(container, 'data.stroke')).not.toHaveAttribute('data-pref-hidden');
  });

  it('marks a hidden section once, on its heading, and not each row in it', () => {
    const container = setup({ on: false }, { markHidden: true });
    const section = screen.getByRole('heading', { name: /Corners/ }).closest('section')!;
    expect(section).toHaveAttribute('data-pref-hidden');
    expect(within(section).getAllByText('hidden')).toHaveLength(1);
    expect(within(screen.getByRole('heading', { name: /Corners/ })).getByText('hidden')).toBeInTheDocument();
    expect(at(container, 'data.radius')).not.toHaveAttribute('data-pref-hidden');
    expect(within(section).getByRole('spinbutton', { name: 'Radius' })).toBeInTheDocument();
  });

  it('marks a row hidden on its own inside a section that is shown', () => {
    const container = setup({ on: false }, { markHidden: true });
    expect(screen.getByRole('heading', { name: 'Edges' }).closest('section')).not.toHaveAttribute('data-pref-hidden');
    expect(at(container, 'data.feather')).toHaveAttribute('data-pref-hidden');
  });
});
