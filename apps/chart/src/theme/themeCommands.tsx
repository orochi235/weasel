import { useCommand } from '@weasel-js/core';
import {
  DIAGRAM_THEME_EXTENSION, DIAGRAM_THEMES, applyDiagramTheme, diagramThemeOf, parseDiagramTheme, themeToJson,
  type DiagramTheme,
} from '@weasel-js/diagram';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { downloadBlob, pickFile } from '@editor/index';
import type { ReactElement } from 'react';
import type { ChartScene } from '../chartDocument';
import { run } from '../menuBar';

/** What a chart that names no theme is drawn in: ink on white, as charts were before themes. */
export const CHART_DEFAULT_THEME: DiagramTheme = DIAGRAM_THEMES.paper!;

/** The chart's theme, from its `diagram:theme` document value. */
export const chartThemeOf = (scene: ChartScene): DiagramTheme => diagramThemeOf(scene, CHART_DEFAULT_THEME);

/** The command that applies the shipped theme `id`. */
export const themeActionId = (id: string): string => `chart.theme.${id}`;

export const THEME_ACTIONS = { edit: 'chart.editTheme', import: 'chart.importTheme', export: 'chart.exportTheme' } as const;

/** Format › Theme: one item per shipped theme, then editing the theme and moving it between charts. */
export const THEME_MENU: PrefGroup = pref.group('', {
  theme: pref.group('Theme', {
    shipped: run(Object.fromEntries(Object.keys(DIAGRAM_THEMES).map((id) => [id, themeActionId(id)]))),
    edit: run({ edit: THEME_ACTIONS.edit }),
    file: run({ import: THEME_ACTIONS.import, export: THEME_ACTIONS.export }),
  }, { as: 'menu' }),
});

function ThemeCommand({ scene, theme }: { scene: ChartScene; theme: DiagramTheme }): null {
  useCommand(themeActionId(theme.id), theme.name, () => applyDiagramTheme(scene, theme, undefined, { from: chartThemeOf(scene) }), {
    active: () => chartThemeOf(scene) === theme,
  });
  return null;
}

/** The file name a theme is exported under. */
export const themeFileName = (theme: DiagramTheme): string =>
  `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}${DIAGRAM_THEME_EXTENSION}`;

async function importTheme(scene: ChartScene): Promise<void> {
  const file = await pickFile(`${DIAGRAM_THEME_EXTENSION},application/json`);
  if (file === null) return;
  const result = parseDiagramTheme(await file.text());
  if ('errors' in result) throw new Error(result.errors.join('; '));
  applyDiagramTheme(scene, result.theme, `Import theme: ${result.theme.name}`, { from: chartThemeOf(scene) });
}

/** Registers Format › Theme's commands. Each shipped theme applies as one undo entry and reads as
 *  held while the chart is in it; Edit Theme… calls `onEdit`, to show the Theme panel. */
export function ThemeCommands({ scene, onEdit }: { scene: ChartScene; onEdit: () => void }): ReactElement {
  useCommand(THEME_ACTIONS.edit, 'Edit Theme…', onEdit);
  useCommand(THEME_ACTIONS.import, 'Import Theme…', () => {
    importTheme(scene).catch((err: unknown) => console.warn('weaselchart: could not import the theme', err));
  });
  useCommand(THEME_ACTIONS.export, 'Export Theme…', () => {
    const theme = chartThemeOf(scene);
    downloadBlob(new Blob([themeToJson(theme)], { type: 'application/json' }), themeFileName(theme));
  });
  return <>{Object.values(DIAGRAM_THEMES).map((theme) => <ThemeCommand key={theme.id} scene={scene} theme={theme} />)}</>;
}
