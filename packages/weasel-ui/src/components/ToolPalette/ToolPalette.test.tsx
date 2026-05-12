import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolPalette } from './ToolPalette';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';

function fakeTool(id: string, group?: string, label?: string): AnyTool {
  return {
    id,
    presentation: { label: label ?? id, group },
  } as AnyTool;
}

function fakeTools(list: AnyTool[], active: string | null = null): ToolsApi {
  const registry: Record<string, AnyTool> = {};
  for (const t of list) registry[t.id] = t;
  return {
    active: active ?? (list[0]?.id ?? ''),
    registry,
    setActive: vi.fn(),
    // ToolsApi has more members; component only reads active/registry/setActive.
  } as unknown as ToolsApi;
}

describe('ToolPalette', () => {
  it('renders one button per tool', () => {
    const tools = fakeTools([fakeTool('select'), fakeTool('hand')]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the tool label from presentation', () => {
    const tools = fakeTools([fakeTool('select', undefined, 'Select')]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('Select')).toBeTruthy();
  });

  it('falls back to id when presentation.label is absent', () => {
    const tools = fakeTools([{ id: 'mystery' } as AnyTool]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('mystery')).toBeTruthy();
  });

  it('marks the active tool with aria-current', () => {
    const tools = fakeTools([fakeTool('a'), fakeTool('b')], 'b');
    render(<ToolPalette tools={tools} />);
    const aBtn = screen.getByRole('button', { name: /^a/ });
    const bBtn = screen.getByRole('button', { name: /^b/ });
    expect(aBtn.getAttribute('aria-current')).toBeNull();
    expect(bBtn.getAttribute('aria-current')).toBe('true');
  });

  it('clicking a button dispatches tools.setActive(id)', () => {
    const tools = fakeTools([fakeTool('select'), fakeTool('hand')], 'select');
    render(<ToolPalette tools={tools} />);
    fireEvent.click(screen.getByRole('button', { name: /^hand/ }));
    expect(tools.setActive).toHaveBeenCalledWith('hand');
  });

  it('root has role="toolbar" with an accessible name', () => {
    const tools = fakeTools([fakeTool('select')]);
    const { container } = render(<ToolPalette tools={tools} />);
    const root = container.querySelector('[role="toolbar"]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('ToolPalette — grouping', () => {
  it('renders groups in default order (select, shape, draw, type, view)', () => {
    const tools = fakeTools([
      fakeTool('text', 'type'),
      fakeTool('select', 'select'),
      fakeTool('hand', 'view'),
      fakeTool('rect', 'shape'),
      fakeTool('pen', 'draw'),
    ]);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    // select first, hand last
    expect(buttons[0].textContent).toContain('select');
    expect(buttons[buttons.length - 1].textContent).toContain('hand');
  });

  it('puts tools with unknown groups after known ones but before misc', () => {
    const tools = fakeTools([
      fakeTool('select', 'select'),
      fakeTool('weird', 'experimental'),
      fakeTool('hand', 'view'),
    ]);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    // weird (unknown group) is last because there's no misc bucket here
    expect(buttons[buttons.length - 1].textContent).toContain('weird');
  });

  it('tools without presentation.group go into the implicit misc bucket (last)', () => {
    const tools = fakeTools([
      fakeTool('select', 'select'),
      { id: 'orphan', presentation: { label: 'Orphan' } } as AnyTool,
    ]);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1].textContent).toContain('Orphan');
  });

  it('separates groups with a visible divider', () => {
    const tools = fakeTools([
      fakeTool('select', 'select'),
      fakeTool('rect', 'shape'),
    ]);
    const { container } = render(<ToolPalette tools={tools} />);
    const separators = container.querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ToolPalette — shortcuts', () => {
  function withKeybinding(id: string, keybinding: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }): AnyTool {
    return { id, keybinding, presentation: { label: id, group: 'select' } } as AnyTool;
  }

  it('shows shortcut derived from keybinding', () => {
    const tools = fakeTools([withKeybinding('select', { key: 'v' })]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('shows the override from presentation.shortcut when set', () => {
    const tool = {
      id: 'select',
      keybinding: { key: 'v' },
      presentation: { label: 'Select', group: 'select', shortcut: 'Sel' },
    } as AnyTool;
    const tools = fakeTools([tool]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('Sel')).toBeTruthy();
    expect(screen.queryByText('V')).toBeNull();
  });

  it('button title combines label and shortcut', () => {
    const tools = fakeTools([withKeybinding('select', { key: 'v' })]);
    render(<ToolPalette tools={tools} />);
    const btn = screen.getByRole('button', { name: /select/i });
    const title = btn.getAttribute('title') ?? '';
    expect(title).toMatch(/select/i);
    expect(title).toMatch(/V/);
  });

  it('button title is just the label when no shortcut is available', () => {
    const tool = { id: 'select', presentation: { label: 'Select', group: 'select' } } as AnyTool;
    const tools = fakeTools([tool]);
    render(<ToolPalette tools={tools} />);
    const btn = screen.getByRole('button', { name: /select/i });
    expect(btn.getAttribute('title')).toBe('Select');
  });
});
