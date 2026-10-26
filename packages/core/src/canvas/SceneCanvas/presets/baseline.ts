import { redoAction, undoAction } from 'interactions/actions/defaults/undoRedo';

/** Undo and redo, which every canvas registers whatever its presets. */
export const BASELINE_ACTIONS = [undoAction, redoAction] as const;
