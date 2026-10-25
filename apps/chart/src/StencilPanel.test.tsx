import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { createScene, type Tool, type ToolsApi } from '@weasel-js/core';
import { CONTAINER_STENCILS, DIAGRAM_TYPE_DOC_KEY, FLOWCHART_STENCILS, STENCIL_GROUPS, stencilTool } from '@weasel-js/diagram';
import { toIconRef, type IconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui/components/Icon';
import { CHART_LAYERS, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { StencilPanel } from './StencilPanel';
import { STENCIL_MIME } from './stencilDrop';
import { renderWithIcons } from './testIcons';

afterEach(cleanup);

function chartTools(active: string | null = null): ToolsApi {
  const list: Tool[] = [{ id: 'select', presentation: { label: 'Select' } } as Tool, ...[...FLOWCHART_STENCILS, ...CONTAINER_STENCILS].map(stencilTool)];
  // The palette reads only these three.
  return { active, setActive: vi.fn(), registry: Object.fromEntries(list.map((t) => [t.id, t])) } as unknown as ToolsApi;
}

const newScene = () => createScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY });
const labelsIn = (name: string) => [...screen.getByRole('toolbar', { name }).querySelectorAll('button')].map((b) => b.textContent);
const titles = () => [...document.querySelectorAll('[role="toolbar"]')].map((t) => t.getAttribute('aria-label'));

function panel(tools = chartTools(), scene = newScene()) {
  const view = renderWithIcons(<StencilPanel tools={tools} scene={scene} />);
  scene.subscribe(() => view.rerender(<StencilPanel tools={tools} scene={scene} />));
  return { scene, tools, view };
}

describe('StencilPanel', () => {
  it('shows a chart naming no type the flowchart symbols, then the containers, each in a panel of its own', () => {
    panel();
    expect(titles()).toEqual(['Flowchart', 'Containers']);
    expect(labelsIn('Flowchart')).toEqual(FLOWCHART_STENCILS.map((s) => s.label));
    expect(labelsIn('Containers')).toEqual(CONTAINER_STENCILS.map((s) => s.label));
  });

  it('shows the groups the chart names, in its order', () => {
    const scene = newScene();
    scene.doc.set(DIAGRAM_TYPE_DOC_KEY, { type: 'flowchart', groups: ['containers'] });
    panel(chartTools(), scene);
    expect(titles()).toEqual(['Containers']);
  });

  it('folds a group away from its title', () => {
    panel();
    fireEvent.click(screen.getByRole('button', { name: /Flowchart/ }));
    expect(titles()).toEqual(['Containers']);
  });

  it('lists every group in More shapes, checking the shown ones, and hides one picked, undoably', () => {
    const { scene } = panel();
    fireEvent.click(screen.getByRole('button', { name: /More shapes/ }), { detail: 1 });
    expect(screen.getAllByRole('menuitemcheckbox').map((r) => [r.textContent?.replace('✓', ''), r.getAttribute('aria-checked')]))
      .toEqual(Object.values(STENCIL_GROUPS).map((g) => [g.label, String(g.id === 'flowchart' || g.id === 'containers')]));
    act(() => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Flowchart/ })); });
    expect(titles()).toEqual(['Containers']);
    act(() => { scene.undo(); });
    expect(titles()).toEqual(['Flowchart', 'Containers']);
  });

  it('lays the stencils out three across', () => {
    panel();
    const group = screen.getByRole('toolbar', { name: 'Flowchart' }).querySelector('[role="group"]') as HTMLElement;
    expect(group.style.getPropertyValue('--wzl-tool-columns')).toBe('3');
  });

  it("draws each stencil's own glyph, not the unknown-tool placeholder", () => {
    const drawn = (name: IconRef) => renderWithIcons(<Icon name={name} />).container.querySelector('svg')!.innerHTML;
    const placeholder = drawn(toIconRef('core:unknown')!);
    const stencils = [...FLOWCHART_STENCILS, ...CONTAINER_STENCILS];
    const glyphs = stencils.map((s) => drawn(s.icon!));
    panel();
    const buttons = ['Flowchart', 'Containers'].flatMap((name) => [...screen.getByRole('toolbar', { name }).querySelectorAll('button')]);
    expect(buttons).toHaveLength(stencils.length);
    buttons.forEach((button, i) => {
      const svg = button.querySelector('svg')!.innerHTML;
      expect(svg, stencils[i]!.id).toBe(glyphs[i]);
      expect(svg, stencils[i]!.id).not.toBe(placeholder);
    });
  });

  it("activates a button's stencil tool", () => {
    const { tools } = panel();
    fireEvent.click(screen.getByRole('button', { name: 'Decision' }));
    expect(tools.setActive).toHaveBeenCalledWith('stencil:decision');
  });

  it('marks the active stencil', () => {
    panel(chartTools('stencil:terminal'));
    expect(screen.getByRole('button', { name: 'Terminal' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Process' }).getAttribute('aria-current')).toBeNull();
  });

  it('carries the stencil id on a drag', () => {
    panel();
    const button = screen.getByRole('button', { name: 'Data' });
    expect(button.getAttribute('draggable')).toBe('true');
    const data = new Map<string, string>();
    fireEvent.dragStart(button, { dataTransfer: { setData: (t: string, v: string) => data.set(t, v), effectAllowed: '' } });
    expect(data.get(STENCIL_MIME)).toBe('data');
  });
});
