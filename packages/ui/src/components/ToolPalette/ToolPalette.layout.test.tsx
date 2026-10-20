import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { Tool, ToolsApi } from '@weasel-js/core';
import { renderWithIcons } from '../../testing/withIcons';
import { ToolPalette } from './ToolPalette';

const tool = (id: string, group?: string): Tool => ({ id, presentation: { label: id, group } }) as Tool;

function fakeTools(list: Tool[]): ToolsApi {
  // The palette reads only these three.
  return { active: null, setActive: vi.fn(), registry: Object.fromEntries(list.map((t) => [t.id, t])) } as unknown as ToolsApi;
}

const groups = () => [...document.querySelectorAll<HTMLElement>('[role="toolbar"] [role="group"]')];

describe('ToolPalette columns', () => {
  it('lays every group out as a grid that many across', () => {
    renderWithIcons(<ToolPalette tools={fakeTools([tool('a', 'one'), tool('b', 'one'), tool('c', 'two')])} columns={3} />);
    expect(groups().map((g) => g.style.getPropertyValue('--wzl-tool-columns'))).toEqual(['3', '3']);
  });

  it('stacks the groups, with horizontal separators, whatever the orientation', () => {
    renderWithIcons(<ToolPalette tools={fakeTools([tool('a', 'one'), tool('b', 'two')])} columns={2} orientation="horizontal" />);
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('moves Up and Down a row of its group, each group starting a row of its own', () => {
    // a b c
    // d
    // e f
    const list = ['a', 'b', 'c', 'd'].map((id) => tool(id, 'one')).concat(['e', 'f'].map((id) => tool(id, 'two')));
    renderWithIcons(<ToolPalette tools={fakeTools(list)} columns={3} groupOrder={['one', 'two']} />);
    const btn = (name: string) => screen.getByRole('button', { name });
    fireEvent.keyDown(btn('a'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(btn('d'));
    fireEvent.keyDown(btn('d'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(btn('e'));
    fireEvent.keyDown(btn('e'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btn('f'));
    fireEvent.keyDown(btn('f'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(btn('d'));
  });

  it('leaves the groups a single line without columns', () => {
    renderWithIcons(<ToolPalette tools={fakeTools([tool('a'), tool('b')])} />);
    expect(groups()[0]!.style.getPropertyValue('--wzl-tool-columns')).toBe('');
  });
});

describe('ToolPalette onToolDragStart', () => {
  it('makes each button a drag source that names its tool', () => {
    const onToolDragStart = vi.fn();
    renderWithIcons(<ToolPalette tools={fakeTools([tool('a'), tool('b')])} onToolDragStart={onToolDragStart} />);
    const b = screen.getByRole('button', { name: 'b' });
    expect(b.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(b);
    expect(onToolDragStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), expect.anything());
  });

  it('leaves the buttons undraggable without it', () => {
    renderWithIcons(<ToolPalette tools={fakeTools([tool('a')])} />);
    expect(screen.getByRole('button', { name: 'a' }).getAttribute('draggable')).toBeNull();
  });
});
