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
