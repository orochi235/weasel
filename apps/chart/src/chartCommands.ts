import { useCommand } from '@weasel-js/core';
import {
  RELEASE_MEMBERS_ACTION_ID, RESET_LABEL_ACTION_ID, RESET_ROUTE_ACTION_ID, SET_HOPS_ACTION_ID, SET_ROUTER_ACTION_IDS,
} from '@weasel-js/diagram';
import { pref } from '@weasel-js/prefs';
import { downloadBlob, pickFile } from '@editor/index';
import type { ChartScene } from './chartDocument';
import { CHART_FILE_EXTENSION, chartFromJson, chartToJson, replaceChart } from './chartPersistence';
import { EXPORT_MENU } from './exportCommands';
import { icon } from './icons.gen';
import { IMPORT_ACTION } from './importExport';
import { run, type ChartMenuContributions } from './menuBar';
import { PAGE_MENU } from './pages/pageCommands';
import { useChartPref } from './prefs';
import { THEME_MENU } from './theme/themeCommands';

export const CHART_ACTIONS = {
  new: 'chart.new', open: 'chart.open', save: 'chart.save', preferences: 'chart.preferences',
  grid: 'chart.view.grid', snapToGrid: 'chart.view.snapToGrid', snapToShapes: 'chart.view.snapToShapes',
  snapToGaps: 'chart.view.snapToGaps', autoLayout: 'chart.arrange.autoLayout',
} as const;

/** Chart mode's File (Import and Export included), Edit, View, Format, Arrange, and Page menus. Undo, Redo and Delete are the kit's own actions; the connector routers, Reset route, Reset label, Line jumps, and Release members are the diagram package's. */
export const CHART_MENUS: ChartMenuContributions = {
  file: {
    open: run({ new: CHART_ACTIONS.new, open: CHART_ACTIONS.open, import: IMPORT_ACTION }),
    save: run({ save: CHART_ACTIONS.save }),
    export: EXPORT_MENU,
  },
  edit: {
    history: run({ undo: 'undo', redo: 'redo' }),
    remove: run({ delete: 'delete' }),
  },
  view: {
    grid: run({ grid: CHART_ACTIONS.grid, snapToGrid: CHART_ACTIONS.snapToGrid }),
    snap: run({ snapToShapes: CHART_ACTIONS.snapToShapes, snapToGaps: CHART_ACTIONS.snapToGaps }),
    prefs: run({ preferences: CHART_ACTIONS.preferences }),
  },
  format: {
    theme: THEME_MENU,
    connector: pref.group('', {
      connector: pref.group('Connector', {
        router: run(SET_ROUTER_ACTION_IDS),
        route: run({ resetRoute: RESET_ROUTE_ACTION_ID }),
        label: run({ resetLabel: RESET_LABEL_ACTION_ID }),
        hops: run({ hops: SET_HOPS_ACTION_ID }),
      }, { as: 'menu' }),
    }),
  },
  arrange: {
    layout: run({ autoLayout: CHART_ACTIONS.autoLayout }),
    containers: run({ releaseMembers: RELEASE_MEMBERS_ACTION_ID }),
  },
  page: PAGE_MENU,
};

async function openChart(scene: ChartScene): Promise<void> {
  const file = await pickFile(`${CHART_FILE_EXTENSION},application/json`);
  if (file === null) return;
  replaceChart(scene, chartFromJson(await file.text()), 'Open chart');
}

/** Registers Open and Save, and View's grid and snapping toggles, on the nearest `<ActionsProvider>`. New… is
 *  `NewChart`'s, which owns its dialog. */
export function useChartCommands(scene: ChartScene): void {
  useCommand(CHART_ACTIONS.open, 'Open…', () => {
    openChart(scene).catch((err: unknown) => console.warn('weaselchart: could not open the file', err));
  });
  useCommand(CHART_ACTIONS.save, 'Save', () => {
    downloadBlob(new Blob([chartToJson(scene)], { type: 'application/json' }), `chart${CHART_FILE_EXTENSION}`);
  }, { keys: { kind: 'key', key: 's', mods: { mod: true } } });
  const [gridVisible, setGridVisible] = useChartPref('view.gridVisible');
  const [snapToGrid, setSnapToGrid] = useChartPref('view.snapToGrid');
  // Photoshop's View › Show › Grid and View › Snap. Shift turns ; into :, so Snap names both and the physical key.
  useCommand(CHART_ACTIONS.grid, 'Show grid', () => setGridVisible(!gridVisible), {
    icon: icon('ui:grid'),
    active: () => gridVisible,
    keys: { kind: 'key', key: "'", code: 'Quote', mods: { mod: true } },
  });
  useCommand(CHART_ACTIONS.snapToGrid, 'Snap to grid', () => setSnapToGrid(!snapToGrid), {
    icon: icon('ui:snap'),
    active: () => snapToGrid,
    keys: { kind: 'key', key: [';', ':'], code: 'Semicolon', mods: { mod: true, shift: true } },
  });
  const [snapToShapes, setSnapToShapes] = useChartPref('view.alignmentSnap');
  const [snapToGaps, setSnapToGaps] = useChartPref('view.spacingSnap');
  useCommand(CHART_ACTIONS.snapToShapes, 'Snap to other shapes', () => setSnapToShapes(!snapToShapes), {
    icon: icon('snapShapes'),
    active: () => snapToShapes,
  });
  useCommand(CHART_ACTIONS.snapToGaps, 'Snap to equal gaps', () => setSnapToGaps(!snapToGaps), {
    icon: icon('snapGaps'),
    active: () => snapToGaps,
  });
}
