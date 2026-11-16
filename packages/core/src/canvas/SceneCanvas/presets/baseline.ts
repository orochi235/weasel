import { redoAction, undoAction } from 'interactions/actions/defaults/undoRedo';

/** Undo and redo, which every canvas registers whatever its presets. */
export const BASELINE_ACTIONS = [undoAction, redoAction] as const;

/** The kit-standard actions every canvas registers, preset or none: undo and redo. */
export const BASELINE_ACTION_IDS: readonly string[] = BASELINE_ACTIONS.map((a) => a.id);
