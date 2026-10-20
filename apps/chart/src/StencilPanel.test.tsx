import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { Tool, ToolsApi } from '@weasel-js/core';
import { FLOWCHART_STENCILS, stencilTool } from '@weasel-js/diagram';
import { toIconRef, type IconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui/components/Icon';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { StencilPanel } from './StencilPanel';
import { stencilIdOfDragText } from './stencilDrop';

afterEach(cleanup);

function chartTools(active: string | null = null): ToolsApi {
  const list: Tool[] = [{ id: 'select', presentation: { label: 'Select' } } as Tool, ...FLOWCHART_STENCILS.map(stencilTool)];
  // The palette reads only these three.
  return { active, setActive: vi.fn(), registry: Object.fromEntries(list.map((t) => [t.id, t])) } as unknown as ToolsApi;
}

describe('StencilPanel', () => {
  it('holds a button for every flowchart stencil and no other tool', () => {
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    expect(screen.getByText('Shapes')).toBeTruthy();
    const toolbar = screen.getByRole('toolbar', { name: 'Shapes' });
    expect([...toolbar.querySelectorAll('button')].map((b) => b.textContent)).toEqual(FLOWCHART_STENCILS.map((s) => s.label));
  });

  it('lays the stencils out three across', () => {
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    const group = screen.getByRole('toolbar', { name: 'Shapes' }).querySelector('[role="group"]') as HTMLElement;
    expect(group.style.getPropertyValue('--wzl-tool-columns')).toBe('3');
  });

  it("draws each stencil's own glyph, not the unknown-tool placeholder", () => {
    const drawn = (name: IconRef) => renderWithIcons(<Icon name={name} />).container.querySelector('svg')!.innerHTML;
    const placeholder = drawn(toIconRef('core:unknown')!);
    const glyphs = FLOWCHART_STENCILS.map((s) => drawn(s.icon!));
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    const buttons = [...screen.getByRole('toolbar', { name: 'Shapes' }).querySelectorAll('button')];
    buttons.forEach((button, i) => {
      const svg = button.querySelector('svg')!.innerHTML;
      expect(svg, FLOWCHART_STENCILS[i]!.id).toBe(glyphs[i]);
      expect(svg, FLOWCHART_STENCILS[i]!.id).not.toBe(placeholder);
    });
  });

  it("activates a button's stencil tool", () => {
    const tools = chartTools();
    renderWithIcons(<StencilPanel tools={tools} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decision' }));
    expect(tools.setActive).toHaveBeenCalledWith('stencil:decision');
  });

  it('marks the active stencil', () => {
    renderWithIcons(<StencilPanel tools={chartTools('stencil:terminal')} />);
    expect(screen.getByRole('button', { name: 'Terminal' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Process' }).getAttribute('aria-current')).toBeNull();
  });

  it('carries the stencil id on a drag', () => {
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    const button = screen.getByRole('button', { name: 'Data' });
    expect(button.getAttribute('draggable')).toBe('true');
    const data = new Map<string, string>();
    fireEvent.dragStart(button, { dataTransfer: { setData: (t: string, v: string) => data.set(t, v), effectAllowed: '' } });
    expect(stencilIdOfDragText(data.get('text/plain') ?? '')).toBe('data');
  });
});
