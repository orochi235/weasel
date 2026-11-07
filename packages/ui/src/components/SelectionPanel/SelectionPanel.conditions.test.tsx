import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefCondition, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel, type PropertyRenderContext } from './SelectionPanel';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number }
type Extra = Record<string, unknown>;

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const selectionOf = (ids: string[]): SelectionApi => ({ current: ids }) as unknown as SelectionApi;
const flag = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'checkbox', ...extra }) as PrefLeaf;
const num = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;

const locked: PrefCondition = { path: 'data.locked', is: false };
const rounded: PrefCondition = { path: 'data.rounded' };

/** A panel over one node per entry of `nodes`, all selected. */
function setup(members: PrefSection['members'], nodes: Extra[], renderers?: Parameters<typeof SelectionPanel>[0]['renderers']) {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  const ids = nodes.map((data, i) => {
    const id = `n${i}`;
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', ...data } });
    return id;
  });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members } }];
  render(<SelectionPanel scene={scene} selection={selectionOf(ids)} properties={properties} routing={routing} renderers={renderers} />);
}

/** The row marked disabled around a control: the marked ancestor that leads with `label`, which a field's own frame does not. */
function disabledRow(el: HTMLElement, label: string): Element | null {
  for (let at = el.closest('[data-disabled]'); at !== null; at = at.parentElement?.closest('[data-disabled]') ?? null) {
    if (at.firstElementChild?.textContent === label) return at;
  }
  return null;
}

describe('SelectionPanel showIf', () => {
  const members: PrefSection['members'] = {
    main: { name: 'Main', members: { 'data.rounded': flag('Rounded'), 'data.radius': num('Radius', { showIf: rounded }) } },
    corners: { name: 'Corners', showIf: rounded, members: { 'data.smooth': flag('Smooth') } },
  };

  it('draws no row for a leaf whose condition fails on the selected node, and no heading for a hidden section', () => {
    setup(members, [{ rounded: false }]);
    expect(screen.queryByRole('spinbutton', { name: 'Radius' })).toBeNull();
    expect(screen.queryByText('Radius')).toBeNull();
    expect(screen.queryByText('Corners')).toBeNull();
    expect(screen.queryByText('Smooth')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Rounded' })).toBeInTheDocument();
  });

  it('draws them once it holds', () => {
    setup(members, [{ rounded: true }]);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeInTheDocument();
    expect(screen.getByText('Corners')).toBeInTheDocument();
  });

  it('draws no tab for a hidden tab section', () => {
    setup({
      a: { name: 'Shape', as: 'tab', members: { 'data.rounded': flag('Rounded') } },
      b: { name: 'Corners', as: 'tab', showIf: rounded, members: { 'data.smooth': flag('Smooth') } },
    }, [{ rounded: false }]);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Shape']);
  });

  it('shows a row whose condition holds for any one of several selected nodes', () => {
    setup(members, [{ rounded: false }, { rounded: true }]);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeInTheDocument();
    cleanup();
    setup(members, [{ rounded: false }, { rounded: false }]);
    expect(screen.queryByRole('spinbutton', { name: 'Radius' })).toBeNull();
  });

  it('drops a hidden field of an object leaf', () => {
    const stroke = {
      kind: 'object', name: 'Stroke', description: '', default: {},
      children: { width: num('Width'), dash: num('Dash', { showIf: { path: 'data.stroke.width', above: 0 } }) },
    } as PrefLeaf;
    setup({ 'data.stroke': stroke }, [{ stroke: { width: 0, dash: 1 } }]);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Dash' })).toBeNull();
  });
});

describe('SelectionPanel enableIf', () => {
  const members: PrefSection['members'] = {
    main: { name: 'Main', members: { 'data.locked': flag('Locked'), 'data.radius': num('Radius', { enableIf: locked }) } },
    look: { name: 'Look', enableIf: locked, members: { 'data.smooth': flag('Smooth'), 'data.go': { kind: 'action', name: 'Go', description: '', default: undefined, run: () => {} } as PrefLeaf } },
  };

  it('disables a row whose condition fails, and every row of a section whose condition fails', () => {
    setup(members, [{ locked: true, radius: 2 }]);
    const radius = screen.getByRole('spinbutton', { name: 'Radius' });
    expect(radius).toBeDisabled();
    expect(disabledRow(radius, 'Radius')).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Smooth' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
    const lock = screen.getByRole('checkbox', { name: 'Locked' });
    expect(lock).toBeEnabled();
    expect(disabledRow(lock, 'Locked')).toBeNull();
  });

  it('leaves them enabled while it holds', () => {
    setup(members, [{ locked: false, radius: 2 }]);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeEnabled();
    expect(disabledRow(screen.getByRole('spinbutton', { name: 'Radius' }), 'Radius')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Smooth' })).toBeEnabled();
  });

  it('enables a row only when its condition holds for every selected node', () => {
    setup(members, [{ locked: false }, { locked: true }]);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeDisabled();
    cleanup();
    setup(members, [{ locked: false }, { locked: false }]);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeEnabled();
  });

  it('tells a custom renderer', () => {
    const seen: Array<boolean | undefined> = [];
    setup(members, [{ locked: true }], { 'data.radius': (ctx: PropertyRenderContext) => (seen.push(ctx.disabled), <span>own</span>) });
    expect(seen.at(-1)).toBe(true);
  });

  it('disables one field of an object leaf, and the segments of a run of paired flags', () => {
    const style = {
      kind: 'object', name: 'Style', description: '', default: {},
      children: {
        size: num('Size', { enableIf: locked }),
        bold: flag('Bold', { control: 'toggle', pair: { with: 'data.style.italic', label: 'Face' }, enableIf: locked }),
        italic: flag('Italic', { control: 'toggle', enableIf: locked }),
        leading: num('Leading'),
      },
    } as PrefLeaf;
    setup({ 'data.locked': flag('Locked'), 'data.style': style }, [{ locked: true, style: { size: 1, leading: 2 } }]);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Leading' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeDisabled();
  });

  it('disables the cells of a section drawn as a bar', () => {
    setup({ tools: { name: 'Tools', as: 'bar', enableIf: locked, members: { 'data.radius': num('Radius') } } }, [{ locked: true }]);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeDisabled();
  });
});
