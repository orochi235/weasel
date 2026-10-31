import { useVisibleRaf } from '@weasel-js/core';
import {
  editableTheme, rendererMeasure, setThemeValue, themeValue, type DiagramTheme, type ThemePath,
} from '@weasel-js/diagram';
import { useRef } from 'react';
import type { ChartScene } from '../chartDocument';
import { applyChartTheme } from './applyChartTheme';
import { chartThemeOf } from './themeCommands';

/** The label every theme value edit is undone under. */
export const EDIT_THEME_LABEL = 'Edit theme';

/** What the Theme panel edits the chart's theme through. Every edit starts from the chart's own
 *  theme, forked first when that is a shipped one. */
export interface ThemeEdit {
  theme: DiagramTheme;
  /** A value moving under a gesture: applied at most once a frame, the whole gesture one undo entry. */
  input(path: ThemePath, value: string | number): void;
  /** The value a gesture settles on, or a single edit: applied now, and ends the gesture's entry. */
  commit(path: ThemePath, value: string | number): void;
  /** A whole-theme edit, such as a role added, as an undo entry of its own. */
  change(edit: (theme: DiagramTheme) => DiagramTheme, label: string): void;
}

const keyOf = (path: ThemePath): string => `theme:${path.join('.')}`;

/** The Theme panel's edits to `scene`'s theme. */
export function useThemeEdit(scene: ChartScene): ThemeEdit {
  const pending = useRef<{ path: ThemePath; value: string | number } | null>(null);
  const apply = (path: ThemePath, value: string | number) => {
    const current = chartThemeOf(scene);
    if (themeValue(current, path) === value) return;
    applyChartTheme(scene, setThemeValue(editableTheme(current), path, value), EDIT_THEME_LABEL, { coalesceKey: keyOf(path), from: current, measure: rendererMeasure });
  };
  const flush = () => {
    const next = pending.current;
    pending.current = null;
    if (next !== null) apply(next.path, next.value);
  };
  const frame = useVisibleRaf(flush);
  return {
    theme: chartThemeOf(scene),
    input(path, value) {
      if (pending.current !== null && keyOf(pending.current.path) !== keyOf(path)) flush();
      pending.current = { path, value };
      frame.request();
    },
    commit(path, value) {
      frame.cancel();
      pending.current = null;
      apply(path, value);
      scene.history.seal();
    },
    change(edit, label) {
      const current = chartThemeOf(scene);
      const base = editableTheme(current);
      const next = edit(base);
      if (next !== base) applyChartTheme(scene, next, label, { from: current, measure: rendererMeasure });
    },
  };
}
