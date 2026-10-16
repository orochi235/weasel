import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { asset, Live, WITH_LOCKED } from './AssetEditor.fixture';
import type { PaletteDrag } from './Palette';
import { SettingsTree } from './SettingsTree';
import { removeNode } from './schemaEdit';
import type { Workspace } from './workspace';
import { CODE, pointer, SETTINGS, WORKSPACE } from './workspace.fixtures';

afterEach(cleanup);

const settings = () => screen.getByRole('tree', { name: 'Settings' });
const hasSettings = () => screen.queryByRole('tree', { name: 'Settings' }) !== null;

describe('the settings of a layout\'s dialog', () => {
  it('are listed under a layout\'s tree, and not under a dialog\'s or a read-only layout\'s', () => {
    render(<Live start={WITH_LOCKED} />);
    expect(hasSettings()).toBe(false);
    fireEvent.click(asset('Code'));
    expect(within(settings()).getByText('view')).toBeInTheDocument();
    expect(within(settings()).getByText('grid')).toBeInTheDocument();
    expect(within(settings()).getByText('snap')).toBeInTheDocument();
    fireEvent.click(asset('Layout'));
    expect(hasSettings()).toBe(false);
  });

  it('mutes a setting the layout points at, and not one it does not', () => {
    const start: Workspace = { assets: [WORKSPACE.assets[0]!, { ...WORKSPACE.assets[1]!, root: removeNode(CODE, 'snap') }] };
    render(<Live start={start} />);
    fireEvent.click(asset('Code'));
    const muted = (key: string) => within(settings()).getByText(key).parentElement!.className.includes('pointed');
    expect(muted('grid')).toBe(true);
    expect(muted('snap')).toBe(false);
  });

  it('lists only what the structure\'s filter holds', () => {
    render(<Live />);
    fireEvent.click(asset('Code'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter structure' }), { target: { value: 'snap' } });
    expect(within(settings()).queryByText('grid')).toBeNull();
    expect(within(settings()).getByText('snap')).toBeInTheDocument();
  });

  it('lists a setting a tag of its own finds', () => {
    const over = { name: '', children: { look: { name: 'Look', children: { glow: { kind: 'boolean', name: 'Glow', description: '', default: false, tags: ['halo'] } } } } } as const;
    render(<SettingsTree over={over as never} layout={{ name: '', children: {} }} sought="halo" onDrag={() => {}} onDrop={() => {}} />);
    expect(within(settings()).getByText('glow')).toBeInTheDocument();
  });

  it('carries a pointer to the setting dragged out, and a heading of pointers for a group', () => {
    const dropped: PaletteDrag[] = [];
    render(<SettingsTree over={SETTINGS} layout={CODE} sought="" onDrag={() => {}} onDrop={(drag) => dropped.push(drag)} />);
    const tree = settings();
    tree.setPointerCapture = vi.fn();
    tree.releasePointerCapture = vi.fn();
    for (const key of ['snap', 'view']) {
      const row = within(tree).getByText(key).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;
      fireEvent.pointerDown(row, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 400, clientY: 200 });
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 400, clientY: 200 });
    }
    expect(dropped.map((d) => [d.item.key, d.node, d.from])).toEqual([
      ['snap', pointer('view.snap'), undefined],
      ['view', { name: 'View', as: 'section', children: { grid: pointer('view.grid'), snap: pointer('view.snap') } }, undefined],
    ]);
  });
});
