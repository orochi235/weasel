import { useCommand } from '@weasel-js/core';
import { RESET_ROUTE_ACTION_ID } from '@weasel-js/diagram';
import { pref } from '@weasel-js/prefs';
import { downloadBlob, pickFile } from '@editor/index';
import { CHART_ACTIONS } from '../chartCommands';
import { can, run, type ChartMenuContributions } from '../menuBar';
import { ARRANGE_MENU } from './pipelineGroups';
import { LOOK_MENU } from './pipelineLook';
import { RUN_MENU, SHOW_MENU } from './pipelineRun';
import { PIPELINE_FILE_EXTENSION, emptyPipeline, pipelineFromJson, type PipelineDoc } from './usePipelineDoc';

export const PIPELINE_ACTIONS = {
  new: 'pipeline.new', open: 'pipeline.open', save: 'pipeline.save', undo: 'pipeline.undo', redo: 'pipeline.redo',
} as const;

/** Pipeline mode's File, Edit, View, Format, Arrange, and Run menus. Delete and Reset route are kit actions the editor's canvas registers: Delete removes stages and wires alike, and Reset route gives a wire back to its look. */
export const PIPELINE_MENUS: ChartMenuContributions = {
  file: {
    open: run({ new: PIPELINE_ACTIONS.new, open: PIPELINE_ACTIONS.open }),
    save: run({ save: PIPELINE_ACTIONS.save }),
  },
  edit: {
    history: run({ undo: PIPELINE_ACTIONS.undo, redo: PIPELINE_ACTIONS.redo }),
    remove: run({ delete: 'delete' }),
  },
  view: { ...LOOK_MENU, ...SHOW_MENU, prefs: run({ preferences: CHART_ACTIONS.preferences }) },
  format: {
    connector: pref.group('', {
      connector: pref.group('Connector', { route: run({ resetRoute: RESET_ROUTE_ACTION_ID }) }, { as: 'menu' }),
    }),
  },
  arrange: ARRANGE_MENU,
  run: RUN_MENU,
};

async function openPipeline(pipeline: PipelineDoc): Promise<void> {
  const file = await pickFile(`${PIPELINE_FILE_EXTENSION},application/json`);
  if (file === null) return;
  pipeline.change(pipelineFromJson(await file.text()), 'Open pipeline');
}

/** Registers New, Open and Save, and Undo and Redo over the pipeline doc's own history. */
export function usePipelineCommands(pipeline: PipelineDoc): void {
  useCommand(PIPELINE_ACTIONS.new, 'New', () => pipeline.change(emptyPipeline(), 'New pipeline'));
  useCommand(PIPELINE_ACTIONS.open, 'Open…', () => {
    openPipeline(pipeline).catch((err: unknown) => console.warn('weaselchart: could not open the file', err));
  });
  useCommand(PIPELINE_ACTIONS.save, 'Save', () => {
    downloadBlob(new Blob([JSON.stringify(pipeline.doc)], { type: 'application/json' }), `pipeline${PIPELINE_FILE_EXTENSION}`);
  }, { keys: { kind: 'key', key: 's', mods: { mod: true } } });
  useCommand(PIPELINE_ACTIONS.undo, 'Undo', () => pipeline.undo(), {
    enabled: () => can(pipeline.canUndo),
    keys: { kind: 'key', key: 'z', mods: { mod: true } },
  });
  useCommand(PIPELINE_ACTIONS.redo, 'Redo', () => pipeline.redo(), {
    enabled: () => can(pipeline.canRedo),
    keys: { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
  });
}
