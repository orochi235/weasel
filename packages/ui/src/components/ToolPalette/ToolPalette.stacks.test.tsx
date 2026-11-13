import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { ToolPalette, type ToolPaletteProps } from './ToolPalette';
import { declaredToolShortcuts, toolSet, type Tool, type ToolsApi } from '@weasel-js/core';

const tool = (id: string, group = 'shape'): Tool =>
  ({ id, keybinding: { key: id[0] }, presentation: { label: id, group } }) as Tool;

const LIST = [tool('select', 'select'), tool('rect'), tool('ellipse'), tool('star'), tool('pen', 'draw')];
const SHAPES = ['rect', 'ellipse', 'star'];

function Palette(props: Partial<ToolPaletteProps> & { start?: string }) {
  const [active, setActive] = useState(props.start ?? 'select');
  const registry = Object.fromEntries(LIST.map((t) => [t.id, t]));
  const tools = { registry, shortcuts: declaredToolShortcuts(registry), active, setActive } as unknown as ToolsApi;
  return <ToolPalette stacks={[SHAPES]} {...props} tools={tools} />;
}

/** A click with a pointer under it; `fireEvent.click` alone has `detail` 0, which is what Enter sends. */
const press = (el: HTMLElement, init: MouseEventInit = {}) => fireEvent.click(el, { detail: 1, ...init });
const stack = () => screen.getByRole('button', { name: /rect|ellipse|star/ });

describe('ToolPalette stacks', () => {
  it('gives a stack one button, marked as opening a menu', () => {
    renderWithIcons(<Palette />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['selectS', 'rectR', 'penP']);
    expect(stack()).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('opens a menu of the stack on a click, and makes the row chosen active', () => {
    renderWithIcons(<Palette />);
    press(stack());
    expect(screen.getAllByRole('menuitem').map((r) => r.textContent)).toEqual(['rectR', 'ellipseE', 'starS']);
    fireEvent.click(screen.getByRole('menuitem', { name: /ellipse/ }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(stack()).toHaveTextContent('ellipse');
    expect(stack()).toHaveAttribute('aria-current', 'true');
  });

  it('steps to the next tool on an alt-click without opening the menu, wrapping at the end', () => {
    renderWithIcons(<Palette start="star" />);
    press(stack(), { altKey: true });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(stack()).toHaveTextContent('rect');
    expect(stack()).toHaveAttribute('aria-current', 'true');
  });

  it('cycles on the modifier stackCycle names', () => {
    renderWithIcons(<Palette stackCycle="shift" />);
    press(stack(), { altKey: true });
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('keeps showing the tool last used from it once another tool is active', () => {
    renderWithIcons(<Palette />);
    press(stack());
    fireEvent.click(screen.getByRole('menuitem', { name: /star/ }));
    press(screen.getByRole('button', { name: /pen/ }));
    expect(stack()).toHaveTextContent('star');
    expect(stack()).not.toHaveAttribute('aria-current');
  });

  it('draws a stack left with one shown tool as a plain button', () => {
    renderWithIcons(<Palette include={(t) => t.id !== 'ellipse' && t.id !== 'star'} />);
    expect(screen.getByRole('button', { name: /rect/ })).not.toHaveAttribute('aria-haspopup');
  });

  it('puts the stack where its first shown tool sits, showing its first listed one', () => {
    renderWithIcons(<Palette stacks={[['pen', 'rect']]} />);
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['selectS', 'penP', 'ellipseE', 'starS']);
  });

  it('stacks a set given in stacks, its ids opened', () => {
    renderWithIcons(<Palette stacks={[toolSet('shapes', ['rect', toolSet('round', ['ellipse'])])]} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['selectS', 'rectR', 'starS', 'penP']);
  });

  it('stacks the sets an include set marks stack, unless stacks is given', () => {
    const shown = toolSet('all', ['select', toolSet('shapes', SHAPES, { stack: true }), 'pen']);
    const { unmount } = renderWithIcons(<Palette stacks={undefined} include={shown} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['selectS', 'rectR', 'penP']);
    unmount();
    renderWithIcons(<Palette stacks={[]} include={shown} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('reads a stack face\'s description in its tooltip', () => {
    const described = { ...LIST[1], presentation: { label: 'rect', group: 'shape', description: 'Drag out a rectangle' } } as Tool;
    const registry = { rect: described, ellipse: LIST[2] };
    const tools = { registry, shortcuts: declaredToolShortcuts(registry), active: null, setActive: () => {} } as unknown as ToolsApi;
    renderWithIcons(<ToolPalette tools={tools} stacks={[['rect', 'ellipse']]} />);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => screen.getByRole('button', { name: /rect/ }).focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Drag out a rectangle (R)');
  });

  it('gives a stacked tool\'s menu row its description', () => {
    const described = { ...LIST[1], presentation: { label: 'rect', group: 'shape', description: 'Drag out a rectangle' } } as Tool;
    const registry = { rect: described, ellipse: LIST[2] };
    const tools = { registry, shortcuts: declaredToolShortcuts(registry), active: null, setActive: () => {} } as unknown as ToolsApi;
    renderWithIcons(<ToolPalette tools={tools} stacks={[['rect', 'ellipse']]} />);
    press(screen.getByRole('button', { name: /rect/ }));
    expect(screen.getByRole('menuitem', { name: /rect/ })).toHaveAccessibleDescription(expect.stringContaining('Drag out a rectangle'));
  });
});
