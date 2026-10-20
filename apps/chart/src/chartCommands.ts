import { useCommand } from '@weasel-js/core';
import { RELEASE_MEMBERS_ACTION_ID, RESET_ROUTE_ACTION_ID, SET_ROUTER_ACTION_IDS } from '@weasel-js/diagram';
import { pref } from '@weasel-js/prefs';
import { downloadBlob, pickFile } from '@editor/index';
import type { ChartScene } from './chartDocument';
import { CHART_FILE_EXTENSION, chartFromJson, chartToJson, emptyChart, replaceChart } from './chartPersistence';
import { EXPORT_MENU } from './exportCommands';
import { run, type ChartMenuContributions } from './menuBar';
import { PAGE_MENU } from './pages/pageCommands';
import { useChartPref } from './prefs';
import { THEME_MENU } from './theme/themeCommands';

export const CHART_ACTIONS = {
  new: 'chart.new', open: 'chart.open', save: 'chart.save', preferences: 'chart.preferences',
  grid: 'chart.view.grid', snapToGrid: 'chart.view.snapToGrid',
} as const;

/** Chart mode's File (Export included), Edit, View, Format, Arrange, and Page menus. Undo, Redo and Delete are the kit's own actions; the connector routers, Reset route, and Release members are the diagram package's. */
export const CHART_MENUS: ChartMenuContributions = {
  file: {
    open: run({ new: CHART_ACTIONS.new, open: CHART_ACTIONS.open }),
    save: run({ save: CHART_ACTIONS.save }),
    export: EXPORT_MENU,
  },
  edit: {
    history: run({ undo: 'undo', redo: 'redo' }),
    remove: run({ delete: 'delete' }),
  },
  view: {
    grid: run({ grid: CHART_ACTIONS.grid, snapToGrid: CHART_ACTIONS.snapToGrid }),
    prefs: run({ preferences: CHART_ACTIONS.preferences }),
  },
  format: {
    theme: THEME_MENU,
    connector: pref.group('', {
      connector: pref.group('Connector', {
        router: run(SET_ROUTER_ACTION_IDS),
        route: run({ resetRoute: RESET_ROUTE_ACTION_ID }),
      }, { as: 'menu' }),
    }),
  },
  arrange: {
    containers: run({ releaseMembers: RELEASE_MEMBERS_ACTION_ID }),
  },
  page: PAGE_MENU,
};

async function openChart(scene: ChartScene): Promise<void> {
  const file = await pickFile(`${CHART_FILE_EXTENSION},application/json`);
  if (file === null) return;
  replaceChart(scene, chartFromJson(await file.text()), 'Open chart');
}

/** Registers New, Open and Save, and View's Show grid and Snap to grid, on the nearest `<ActionsProvider>`. */
export function useChartCommands(scene: ChartScene): void {
  useCommand(CHART_ACTIONS.new, 'New', () => replaceChart(scene, emptyChart(), 'New chart'));
  useCommand(CHART_ACTIONS.open, 'Open…', () => {
    openChart(scene).catch((err: unknown) => console.warn('weaselchart: could not open the file', err));
  });
  useCommand(CHART_ACTIONS.save, 'Save', () => {
    downloadBlob(new Blob([chartToJson(scene)], { type: 'application/json' }), `chart${CHART_FILE_EXTENSION}`);
  }, { keys: { kind: 'key', key: 's', mods: { mod: true } } });
  const [gridVisible, setGridVisible] = useChartPref('view.gridVisible');
  const [snapToGrid, setSnapToGrid] = useChartPref('view.snapToGrid');
  useCommand(CHART_ACTIONS.grid, 'Show grid', () => setGridVisible(!gridVisible), { active: () => gridVisible });
  useCommand(CHART_ACTIONS.snapToGrid, 'Snap to grid', () => setSnapToGrid(!snapToGrid), { active: () => snapToGrid });
}
