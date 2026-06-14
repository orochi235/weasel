import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolPalette } from './ToolPalette';
import type { AnyTool, ToolsApi } from '@weasel-js/core';
import { createModeRegistry } from '@weasel-js/modes';
import { DEFAULT_MODES } from '@weasel-js/modes/presets/default';

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

describe('ToolPalette — keyboard nav', () => {
  function fiveTools() {
    return fakeTools(['a', 'b', 'c', 'd', 'e'].map((id) => fakeTool(id, 'select', id.toUpperCase())));
  }

  it('only the active tool has tabIndex=0 initially; others tabIndex=-1', () => {
    const tools = fakeTools([fakeTool('a', 'select'), fakeTool('b', 'select')], 'b');
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^a/i }) as HTMLButtonElement;
    const b = screen.getByRole('button', { name: /^b/i }) as HTMLButtonElement;
    expect(a.tabIndex).toBe(-1);
    expect(b.tabIndex).toBe(0);
  });

  it('falls back to the first tool when no active tool', () => {
    const tools = fakeTools([fakeTool('a', 'select'), fakeTool('b', 'select')], null);
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^a/i }) as HTMLButtonElement;
    const b = screen.getByRole('button', { name: /^b/i }) as HTMLButtonElement;
    expect(a.tabIndex).toBe(0);
    expect(b.tabIndex).toBe(-1);
  });

  it('ArrowDown / ArrowRight moves focus to the next tool', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const b = screen.getByRole('button', { name: /^B/ });
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(b);
  });

  it('ArrowUp / ArrowLeft moves focus to the previous tool', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const b = screen.getByRole('button', { name: /^B/ });
    b.focus();
    fireEvent.keyDown(b, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(a);
  });

  it('Home focuses the first tool, End focuses the last', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const c = screen.getByRole('button', { name: /^C/ });
    const e = screen.getByRole('button', { name: /^E/ });
    c.focus();
    fireEvent.keyDown(c, { key: 'End' });
    expect(document.activeElement).toBe(e);
    fireEvent.keyDown(e, { key: 'Home' });
    expect(document.activeElement).toBe(a);
  });

  it('focus wraps from last to first on ArrowDown, first to last on ArrowUp', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const e = screen.getByRole('button', { name: /^E/ });
    e.focus();
    fireEvent.keyDown(e, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(a);
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(e);
  });
});

describe('ToolPalette — mode eligibility', () => {
  /**
   * Builds a fake AnyTool with capability tags so eligibility works.
   * The 'creates-selection' tag is allowed in NORMAL but not PATH_EDIT;
   * 'edits-anchors' is allowed in PATH_EDIT.
   * 'navigation' (the hand tool) is always allowed.
   */
  function toolWithCaps(id: string, capabilities: string[], group = 'select'): AnyTool {
    return { id, capabilities, presentation: { label: id, group } } as AnyTool;
  }

  const selectTool = toolWithCaps('select', ['creates-selection']);
  const anchorTool = toolWithCaps('anchor-edit', ['edits-anchors'], 'draw');
  const handTool   = toolWithCaps('hand', ['navigation'], 'view');

  function makeTools(...list: AnyTool[]): ToolsApi {
    const registry: Record<string, AnyTool> = {};
    for (const t of list) registry[t.id] = t;
    return { active: list[0]?.id ?? '', registry, setActive: vi.fn() } as unknown as ToolsApi;
  }

  it('when mode is "normal", select and hand tools are not aria-disabled', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    // selectTool ('creates-selection') and handTool ('navigation') are both eligible in normal mode.
    const tools = makeTools(selectTool, handTool);
    render(<ToolPalette tools={tools} modeRegistry={reg} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-disabled')).toBeNull();
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('when mode is "path-edit", select tool is aria-disabled and ineligible; anchor-edit is not', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const tools = makeTools(selectTool, anchorTool, handTool);
    render(<ToolPalette tools={tools} modeRegistry={reg} />);

    const selectBtn = screen.getByRole('button', { name: /select/i });
    expect(selectBtn.getAttribute('aria-disabled')).toBe('true');
    expect(selectBtn.className).toMatch(/ineligible/i);

    const anchorBtn = screen.getByRole('button', { name: /anchor/i });
    expect(anchorBtn.getAttribute('aria-disabled')).toBeNull();
    expect(anchorBtn.className).not.toMatch(/ineligible/i);
  });

  it('ineligible button does not invoke setActive when clicked', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const tools = makeTools(selectTool, anchorTool, handTool);
    render(<ToolPalette tools={tools} modeRegistry={reg} />);

    const selectBtn = screen.getByRole('button', { name: /select/i });
    fireEvent.click(selectBtn);
    expect(tools.setActive).not.toHaveBeenCalledWith('select');
  });

  it('when modeRegistry is omitted, all tools are eligible (fallback behaviour)', () => {
    // PATH_EDIT would normally disable 'select', but no registry means all eligible.
    const tools = makeTools(selectTool, anchorTool, handTool);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-disabled')).toBeNull();
    }
  });
});
