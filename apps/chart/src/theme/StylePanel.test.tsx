import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createScene } from '@weasel-js/core';
import { DIAGRAM_THEMES, diagramScene, withDiagramRegistry } from '@weasel-js/diagram';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import type { ChartScene } from '../chartDocument';
import { StylePanel } from './StylePanel';

afterEach(cleanup);

const theme = DIAGRAM_THEMES.paper!;
const fillOf = (scene: ChartScene, id: string) =>
  (scene.get(id as never)!.data as { fill: { paint: { color: string } } }).fill.paint.color;

function setup(selected: readonly string[]) {
  const scene = createScene({
    systemLayers: [{ id: 'main' }],
    initial: diagramScene({ nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }], edges: [] }, { theme, layout: 'none' }) as never,
    registry: withDiagramRegistry(),
  }) as unknown as ChartScene;
  const view = render(<StylePanel scene={scene} selected={selected} theme={theme} />, { wrapper: iconsWrapper() });
  return { scene, rerender: () => view.rerender(<StylePanel scene={scene} selected={selected} theme={theme} />) };
}

describe('StylePanel', () => {
  it('asks for a selection when nothing styleable is selected', () => {
    setup([]);
    expect(screen.getByText('Select shapes or connectors to style them.')).toBeTruthy();
  });

  it("lists the theme's roles as swatches, the shapes' own held", () => {
    setup(['a']);
    const roles = screen.getAllByRole('radio');
    expect(roles.map((r) => r.getAttribute('aria-label') ?? r.textContent)).toEqual(['Default', 'Accent', 'Muted', 'Positive', 'Warning', 'Negative']);
    expect(roles[0]!.getAttribute('aria-checked')).toBe('true');
  });

  it('sets the role of every selected shape in one undo entry', () => {
    const { scene } = setup(['a', 'b']);
    act(() => { fireEvent.click(screen.getAllByRole('radio')[1]!); });
    expect(fillOf(scene, 'a')).toBe(theme.roles.accent!.fill);
    expect(fillOf(scene, 'b')).toBe(theme.roles.accent!.fill);
    scene.undo();
    expect(fillOf(scene, 'a')).toBe(theme.roles.default!.fill);
    expect(fillOf(scene, 'b')).toBe(theme.roles.default!.fill);
  });
  it("sets the selected shapes' text size by hand, marking it the author's", () => {
    const { scene } = setup(['a']);
    const size = screen.getByRole('spinbutton', { name: 'Text size' }) as HTMLInputElement;
    expect(size.value).toBe('12');
    act(() => {
      fireEvent.change(size, { target: { value: '18' } });
      fireEvent.blur(size);
    });
    const row = scene.childrenOf('a' as never)[0]!;
    expect((scene.get(row)!.data as { style: { fontSize: number } }).style.fontSize).toBe(18);
    expect((scene.get('a' as never)!.data as { diagram: { ownFont?: string[] } }).diagram.ownFont).toEqual(['size']);
  });
});
