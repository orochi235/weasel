import { useCommand } from '@weasel-js/core';
import { RESET_ROUTE_ACTION_ID } from '@weasel-js/diagram';
import { pref } from '@weasel-js/prefs';
import { downloadBlob, pickFile } from '@editor/index';
import type { ChartScene } from './chartDocument';
import { CHART_FILE_EXTENSION, chartFromJson, chartToJson, emptyChart, replaceChart } from './chartPersistence';
import { run, type ChartMenuContributions } from './menuBar';
import { PAGE_MENU } from './pages/pageCommands';

export const CHART_ACTIONS = { new: 'chart.new', open: 'chart.open', save: 'chart.save' } as const;

/** Chart mode's File, Edit and Format menus. Undo, Redo and Delete are the kit's own actions; Reset route is the diagram package's. */
export const CHART_MENUS: ChartMenuContributions = {
  file: {
    open: run({ new: CHART_ACTIONS.new, open: CHART_ACTIONS.open }),
    save: run({ save: CHART_ACTIONS.save }),
  },
  edit: {
    history: run({ undo: 'undo', redo: 'redo' }),
    remove: run({ delete: 'delete' }),
  },
  format: {
    connector: pref.group('', { connector: pref.group('Connector', { resetRoute: pref.action(RESET_ROUTE_ACTION_ID) }, { as: 'menu' }) }),
  },
  page: PAGE_MENU,
};

async function openChart(scene: ChartScene): Promise<void> {
  const file = await pickFile(`${CHART_FILE_EXTENSION},application/json`);
  if (file === null) return;
  replaceChart(scene, chartFromJson(await file.text()), 'Open chart');
}

/** Registers New, Open and Save on the nearest `<ActionsProvider>`. */
export function useChartCommands(scene: ChartScene): void {
  useCommand(CHART_ACTIONS.new, 'New', () => replaceChart(scene, emptyChart(), 'New chart'));
  useCommand(CHART_ACTIONS.open, 'Open…', () => {
    openChart(scene).catch((err: unknown) => console.warn('weaselchart: could not open the file', err));
  });
  useCommand(CHART_ACTIONS.save, 'Save', () => {
    downloadBlob(new Blob([chartToJson(scene)], { type: 'application/json' }), `chart${CHART_FILE_EXTENSION}`);
  }, { keys: { kind: 'key', key: 's', mods: { mod: true } } });
}
