import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createScene } from '@weasel-js/core';
import { DIAGRAM_THEME_KEY, DIAGRAM_THEMES, applyDiagramTheme, diagramScene, withDiagramRegistry, type DiagramTheme } from '@weasel-js/diagram';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import type { ChartScene } from '../chartDocument';
import { chartThemeOf } from './themeCommands';
import { ThemePanel } from './ThemePanel';

afterEach(cleanup);

const paper = DIAGRAM_THEMES.paper!;
const fillOf = (scene: ChartScene, id: string) =>
  (scene.get(id as never)!.data as { fill: { paint: { color: string } } }).fill.paint.color;

function setup() {
  const scene = createScene({
    systemLayers: [{ id: 'main' }],
    initial: diagramScene({ nodes: [{ id: 'a', lines: ['a'], style: 'accent' }, { id: 'b', lines: ['b'] }], edges: [] }, { theme: paper, layout: 'none' }) as never,
    registry: withDiagramRegistry(),
  }) as unknown as ChartScene;
  applyDiagramTheme(scene, paper);
  const depth = scene.historyIndex();
  const view = render(<ThemePanel scene={scene} onClose={() => {}} />, { wrapper: iconsWrapper() });
  const rerender = () => view.rerender(<ThemePanel scene={scene} onClose={() => {}} />);
  return { scene, depth, rerender };
}

/** Sets a color field the way its picker does, then lets it go. */
function pick(label: string, hex: string): void {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  act(() => {
    fireEvent.input(input, { target: { value: hex } });
    fireEvent.blur(input);
  });
}

describe('ThemePanel', () => {
  it('forks a shipped theme at the first edit, recolors the chart, and undoes in one step', () => {
    const { scene, depth } = setup();
    expect(screen.getByText('Paper. The first edit makes a copy kept in this chart.')).toBeTruthy();
    pick('Default fill', '#ff0000');
    expect(fillOf(scene, 'b')).toBe('#ff0000');
    const custom = scene.doc.get(DIAGRAM_THEME_KEY) as DiagramTheme;
    expect(custom.name).toBe('Paper (edited)');
    expect(custom.roles.default!.fill).toBe('#ff0000');
    expect(paper.roles.default!.fill).toBe('#ffffff');
    expect(scene.historyIndex()).toBe(depth + 1);
    scene.undo();
    expect(scene.doc.get(DIAGRAM_THEME_KEY)).toBe('paper');
    expect(fillOf(scene, 'b')).toBe(paper.roles.default!.fill);
  });

  it('edits a custom theme in place', () => {
    const { scene, rerender } = setup();
    pick('Default fill', '#ff0000');
    rerender();
    pick('Accent fill', '#00ff00');
    expect(chartThemeOf(scene).name).toBe('Paper (edited)');
    expect(chartThemeOf(scene).roles.default!.fill).toBe('#ff0000');
    expect(fillOf(scene, 'a')).toBe('#00ff00');
  });

  it('adds, renames, and removes a role, each one undo entry, and never offers to remove the default', () => {
    const { scene, depth, rerender } = setup();
    expect(screen.queryByRole('button', { name: 'Remove Default' })).toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Add role' })); });
    expect(chartThemeOf(scene).roles['new-role']).toEqual(paper.roles.default);
    rerender();
    const names = screen.getAllByRole('textbox', { name: 'Name' }) as HTMLInputElement[];
    act(() => {
      fireEvent.change(names[1]!, { target: { value: 'Highlight' } });
      fireEvent.blur(names[1]!);
    });
    expect(chartThemeOf(scene).roleLabels?.accent).toBe('Highlight');
    rerender();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Remove Role 1' })); });
    expect(chartThemeOf(scene).roles.accent).toBeUndefined();
    expect(fillOf(scene, 'a')).toBe(paper.roles.default!.fill);
    expect(scene.historyIndex()).toBe(depth + 3);
  });
});
