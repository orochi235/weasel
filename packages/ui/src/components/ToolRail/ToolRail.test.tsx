import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { icon } from '../../icons.gen';
import { ToolRail } from './ToolRail';
import type { ToolRailButton, ToolRailItem } from './items';

const Glyph = icon('ui:add');
const btn = (id: string, extra: Partial<ToolRailButton> = {}): ToolRailButton =>
  ({ id, icon: Glyph, label: id, onPress: vi.fn(), ...extra });
const labels = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
const runs = () => [...document.querySelectorAll('[role="toolbar"] > [role="group"]')]
  .map((g) => [...g.querySelectorAll('button')].map((b) => b.textContent));

describe('ToolRail', () => {
  it('gathers a group where it first appears, runs ungrouped items together, and rules off each run', () => {
    renderWithIcons(<ToolRail items={[
      btn('a'), btn('b'), btn('brush', { group: 'paint' }), btn('c'), btn('fill', { group: 'paint' }),
    ]} />);
    expect(runs()).toEqual([['a', 'b'], ['brush', 'fill'], ['c']]);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'paint' })).toBeTruthy();
  });

  it('presses the item clicked and marks the active one current', () => {
    const pen = btn('pen', { active: true });
    const eraser = btn('eraser');
    renderWithIcons(<ToolRail items={[pen, eraser]} />);
    screen.getByRole('button', { name: 'eraser' }).click();
    expect(eraser.onPress).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'pen' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'eraser' })).not.toHaveAttribute('aria-current');
  });

  it('puts the tab stop on the active item', () => {
    renderWithIcons(<ToolRail items={[btn('a'), btn('b', { active: true })]} />);
    expect(screen.getByRole('button', { name: 'a' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'b' })).toHaveAttribute('tabindex', '0');
  });

  it('walks a vertical rail with ArrowDown and leaves ArrowRight to the page', () => {
    renderWithIcons(<ToolRail items={[btn('a'), btn('b', { group: 'g' })]} />);
    const a = screen.getByRole('button', { name: 'a' });
    const b = screen.getByRole('button', { name: 'b' });
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(b, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(b);
  });

  it('keeps a disabled item with a reason reachable, says why, and ignores its press', () => {
    const pen = btn('pen', { disabled: true, disabledReason: 'Locked' });
    renderWithIcons(<ToolRail items={[pen]} />);
    const button = screen.getByRole('button', { name: 'pen' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'Locked');
    fireEvent.click(button);
    expect(pen.onPress).not.toHaveBeenCalled();
  });

  it('draws a slot in place, outside the arrow keys', () => {
    const items: ToolRailItem[] = [btn('a'), { id: 'readout', render: () => <span>3 trials</span> }, btn('b')];
    renderWithIcons(<ToolRail items={items} />);
    expect(screen.getByText('3 trials')).toBeTruthy();
    expect(labels()).toEqual(['a', 'b']);
  });

  it('gives a stack one button showing its active member, and presses a member from its menu', () => {
    const rect = btn('rect');
    const star = btn('star', { active: true });
    renderWithIcons(<ToolRail items={[{ id: 'shapes', members: [rect, star] }]} />);
    const face = screen.getByRole('button', { name: 'star' });
    expect(face).toHaveAttribute('aria-haspopup', 'menu');
    expect(face).toHaveAttribute('aria-current', 'true');
    fireEvent.click(face, { detail: 1 });
    fireEvent.click(screen.getByRole('menuitem', { name: /rect/ }));
    expect(rect.onPress).toHaveBeenCalledOnce();
  });
});
