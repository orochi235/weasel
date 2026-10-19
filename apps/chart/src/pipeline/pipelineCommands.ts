import { ActionDisabledReason, useCommand } from '@weasel-js/core';
import { run, type ChartMenuContributions } from '../menuBar';
import type { PipelineDoc } from './usePipelineDoc';

export const PIPELINE_ACTIONS = { undo: 'pipeline.undo', redo: 'pipeline.redo' } as const;

/** Pipeline mode's Edit menu. Delete is the kit action the editor's canvas registers, which removes stages and wires alike. */
export const PIPELINE_MENUS: ChartMenuContributions = {
  edit: {
    history: run({ undo: PIPELINE_ACTIONS.undo, redo: PIPELINE_ACTIONS.redo }),
    remove: run({ delete: 'delete' }),
  },
};

const can = (yes: boolean): true | ActionDisabledReason => (yes ? true : ActionDisabledReason.NotApplicable);

/** Registers Undo and Redo over the pipeline doc's own history. */
export function usePipelineCommands(pipeline: PipelineDoc): void {
  useCommand(PIPELINE_ACTIONS.undo, 'Undo', () => pipeline.undo(), {
    enabled: () => can(pipeline.canUndo),
    keys: { kind: 'key', key: 'z', mods: { mod: true } },
  });
  useCommand(PIPELINE_ACTIONS.redo, 'Redo', () => pipeline.redo(), {
    enabled: () => can(pipeline.canRedo),
    keys: { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
  });
}
