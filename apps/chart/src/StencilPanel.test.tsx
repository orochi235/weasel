import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { Tool, ToolsApi } from '@weasel-js/core';
import { CONTAINER_STENCILS, FLOWCHART_STENCILS, stencilTool } from '@weasel-js/diagram';
import { toIconRef, type IconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui/components/Icon';
import { StencilPanel } from './StencilPanel';
import { STENCIL_MIME } from './stencilDrop';
import { renderWithIcons } from './testIcons';

afterEach(cleanup);

function chartTools(active: string | null = null): ToolsApi {
  const list: Tool[] = [{ id: 'select', presentation: { label: 'Select' } } as Tool, ...[...FLOWCHART_STENCILS, ...CONTAINER_STENCILS].map(stencilTool)];
  // The palette reads only these three.
  return { active, setActive: vi.fn(), registry: Object.fromEntries(list.map((t) => [t.id, t])) } as unknown as ToolsApi;
}

describe('StencilPanel', () => {
  it('holds a button for every flowchart stencil, then the containers, and no other tool', () => {
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    expect(screen.getByText('Shapes')).toBeTruthy();
    const toolbar = screen.getByRole('toolbar', { name: 'Shapes' });
    expect([...toolbar.querySelectorAll('button')].map((b) => b.textContent)).toEqual([...FLOWCHART_STENCILS, ...CONTAINER_STENCILS].map((s) => s.label));
  });

  it('lays the stencils out three across', () => {
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    const group = screen.getByRole('toolbar', { name: 'Shapes' }).querySelector('[role="group"]') as HTMLElement;
    expect(group.style.getPropertyValue('--wzl-tool-columns')).toBe('3');
  });

  it("draws each stencil's own glyph, not the unknown-tool placeholder", () => {
    const drawn = (name: IconRef) => renderWithIcons(<Icon name={name} />).container.querySelector('svg')!.innerHTML;
    const placeholder = drawn(toIconRef('core:unknown')!);
    const stencils = [...FLOWCHART_STENCILS, ...CONTAINER_STENCILS];
    const glyphs = stencils.map((s) => drawn(s.icon!));
    renderWithIcons(<StencilPanel tools={chartTools()} />);
    const buttons = [...screen.getByRole('toolbar', { name: 'Shapes' }).querySelectorAll('button')];
    expect(buttons).toHaveLength(stencils.length);
    buttons.forEach((button, i) => {
      const svg = button.querySelector('svg')!.innerHTML;
      expect(svg, stencils[i]!.id).toBe(glyphs[i]);
      expect(svg, stencils[i]!.id).not.toBe(placeholder);
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
    expect(data.get(STENCIL_MIME)).toBe('data');
  });
});
