import type { PropertyControlProps } from '../Properties/PropertyField';

/** A surface that edits settings: a `PrefsForm`, a `SelectionPanel` or `Bar`, or labkit's `ControlPanel`. */
export type ParamsSurface = 'form' | 'panel' | 'lab';

/** The controls that write more than once in one edit: a number typed, a slider dragged, text typed, a color picked. */
export type LiveControl = 'number' | 'slider' | 'string' | 'color';

/**
 * Which controls write only the value an edit settles on, by surface; any other writes as it changes. A form
 * stores settings, so only text, which has no gesture to end, writes as it goes. A panel edits a scene, where
 * every write is an undo step, so text settles too, and a slider is left live for the canvas to follow. A lab
 * follows every change.
 */
export const PARAMS_SETTLES: Record<ParamsSurface, Record<LiveControl, boolean>> = {
  form: { number: true, slider: true, string: false, color: true },
  panel: { number: true, slider: false, string: true, color: true },
  lab: { number: false, slider: false, string: false, color: false },
};

const settledOnly = (): void => {};

/** `field` writing when `surface` writes it. A control given an `onInput` drafts through it and commits through
 *  `onChange`, so one that swallows the drafts is what makes a control write settled values only. */
export function withCommitPolicy(field: PropertyControlProps, surface: ParamsSurface): PropertyControlProps {
  const settles = PARAMS_SETTLES[surface];
  if (field.kind === 'number') {
    return settles[field.control === 'slider' ? 'slider' : 'number'] ? { ...field, onInput: settledOnly } : field;
  }
  if (field.kind === 'string' || field.kind === 'color') {
    return settles[field.kind] ? { ...field, onInput: settledOnly } : field;
  }
  return field;
}
