import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createScene, type RectPose } from '@weasel-js/core';
import { DIAGRAM_THEMES, applyDiagramTheme, diagramScene, withDiagramRegistry, type ThemePath } from '@weasel-js/diagram';
import type { ChartScene } from '../chartDocument';
import { chartThemeOf } from './themeCommands';
import { useThemeEdit } from './useThemeEdit';

afterEach(cleanup);

const paper = DIAGRAM_THEMES.paper!;
const DEFAULT_FILL = ['roles', 'default', 'fill'] as unknown as ThemePath;
const ACCENT_FILL = ['roles', 'accent', 'fill'] as unknown as ThemePath;

function setup() {
  const scene = createScene({
    systemLayers: [{ id: 'main' }],
    initial: diagramScene({ nodes: [{ id: 'a', lines: ['a'], style: 'accent' }, { id: 'b', lines: ['b'] }], edges: [] }, { theme: paper, layout: 'none' }) as never,
    registry: withDiagramRegistry<RectPose>(),
  }) as unknown as ChartScene;
  applyDiagramTheme(scene, paper);
  const depth = scene.historyIndex();
  const hook = renderHook(() => useThemeEdit(scene));
  return { scene, depth, hook };
}

describe('useThemeEdit', () => {
  it('applies a pending input on another path before a commit', () => {
    const { scene, hook } = setup();
    act(() => {
      hook.result.current.input(DEFAULT_FILL, '#ff0000');
      hook.result.current.commit(ACCENT_FILL, '#00ff00');
    });
    expect(chartThemeOf(scene).roles.default!.fill).toBe('#ff0000');
    expect(chartThemeOf(scene).roles.accent!.fill).toBe('#00ff00');
  });

  it('applies the pending value and ends the entry when unmounted mid-gesture', () => {
    const { scene, depth, hook } = setup();
    act(() => {
      hook.result.current.commit(DEFAULT_FILL, '#110000');
      hook.result.current.input(DEFAULT_FILL, '#220000');
    });
    hook.unmount();
    expect(chartThemeOf(scene).roles.default!.fill).toBe('#220000');
    const again = renderHook(() => useThemeEdit(scene));
    act(() => { again.result.current.input(DEFAULT_FILL, '#330000'); again.result.current.commit(DEFAULT_FILL, '#330000'); });
    expect(scene.historyIndex()).toBe(depth + 3);
    scene.undo();
    expect(chartThemeOf(scene).roles.default!.fill).toBe('#220000');
  });
});
