import { useCommand } from '@weasel-js/core';
import { DIAGRAM_THEMES, applyDiagramTheme, diagramThemeOf, type DiagramTheme } from '@weasel-js/diagram';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import type { ReactElement } from 'react';
import type { ChartScene } from '../chartDocument';

/** What a chart that names no theme is drawn in: ink on white, as charts were before themes. */
export const CHART_DEFAULT_THEME: DiagramTheme = DIAGRAM_THEMES.paper!;

/** The chart's theme, from its `diagram:theme` document value. */
export const chartThemeOf = (scene: ChartScene): DiagramTheme => diagramThemeOf(scene, CHART_DEFAULT_THEME);

/** The command that applies the shipped theme `id`. */
export const themeActionId = (id: string): string => `chart.theme.${id}`;

/** Format › Theme: one item per shipped theme. */
export const THEME_MENU: PrefGroup = pref.group('', {
  theme: pref.group(
    'Theme',
    Object.fromEntries(Object.keys(DIAGRAM_THEMES).map((id) => [id, pref.action(themeActionId(id))])),
    { as: 'menu' },
  ),
});

function ThemeCommand({ scene, theme }: { scene: ChartScene; theme: DiagramTheme }): null {
  useCommand(themeActionId(theme.id), theme.name, () => applyDiagramTheme(scene, theme), {
    active: () => chartThemeOf(scene) === theme,
  });
  return null;
}

/** Registers Format › Theme's commands, each applying its theme as one undo entry and reading as
 *  held while the chart is in it. */
export function ThemeCommands({ scene }: { scene: ChartScene }): ReactElement {
  return <>{Object.values(DIAGRAM_THEMES).map((theme) => <ThemeCommand key={theme.id} scene={scene} theme={theme} />)}</>;
}
