import type { PropertyControlProps } from '../Properties/PropertyField';

/** A surface that edits settings: a `PrefsForm`, a `SelectionPanel` or `Bar`, or labkit's `ControlPanel`. */
export type ParamsSurface = 'form' | 'panel' | 'lab';

/** The controls that write more than once in one edit: a number typed, a slider dragged, text typed, a color picked. */
export type LiveControl = 'number' | 'slider' | 'string' | 'color';

/**
 * Which controls write only the value an edit settles on, by surface; any other writes as it changes. A form
 * stores settings, so every typed field settles on blur or Enter. A panel edits a scene, where every write is
 * an undo step, so its typed fields settle too, and a slider is left live for the canvas to follow: its
 * moves are drafts ({@link withDrafts}), and the drag is one step. A lab follows every change.
 */
export const PARAMS_SETTLES: Record<ParamsSurface, Record<LiveControl, boolean>> = {
  form: { number: true, slider: true, string: true, color: true },
  panel: { number: true, slider: false, string: true, color: true },
  lab: { number: false, slider: false, string: false, color: false },
};

/**
 * How long text typed into a control that writes as it changes waits for the next keystroke before it is
 * written, by surface. A lab's text re-runs an instrument, so it waits; a leaf's own `debounceMs` says otherwise.
 */
export const PARAMS_TEXT_WAIT_MS: Record<ParamsSurface, number> = { form: 0, panel: 0, lab: 150 };

const settledOnly = (): void => {};

/** The live control `field` draws, or `null` for one that writes once per edit. */
export function liveControl(field: PropertyControlProps): LiveControl | null {
  if (field.kind === 'number') return field.control === 'slider' ? 'slider' : 'number';
  return field.kind === 'string' || field.kind === 'color' ? field.kind : null;
}

/**
 * `field` where `surface` leaves its control live, sending the values on the way through `drafts`' writer and
 * the one the edit settles on through its own. `drafts` is the same leaf's field built over a writer that keeps
 * its writes out of undo. A control the surface settles, and one that is not live, come back as they are.
 */
export function withDrafts(
  field: PropertyControlProps,
  drafts: PropertyControlProps | null,
  surface: ParamsSurface,
): PropertyControlProps {
  const live = liveControl(field);
  if (live === null || PARAMS_SETTLES[surface][live] || drafts === null) return field;
  if (field.kind === 'number' && drafts.kind === 'number') return { ...field, onInput: drafts.onChange };
  if (field.kind === 'string' && drafts.kind === 'string') return { ...field, onInput: drafts.onChange };
  if (field.kind === 'color' && drafts.kind === 'color') return { ...field, onInput: drafts.onChange };
  return field;
}

/**
 * `field` writing when `surface` writes it. A control given an `onInput` drafts through it and commits through
 * `onChange`, so one that swallows the drafts is what makes a control write settled values only. A typed number
 * or text field commits only once its edit settles, so one the surface leaves live writes through `onInput`.
 */
export function withCommitPolicy(field: PropertyControlProps, surface: ParamsSurface): PropertyControlProps {
  const live = liveControl(field);
  if (live === null) return field;
  if (PARAMS_SETTLES[surface][live]) {
    if (field.kind === 'number') return { ...field, onInput: settledOnly };
    return field.kind === 'string' || field.kind === 'color' ? { ...field, onInput: settledOnly } : field;
  }
  if (live === 'number' && field.kind === 'number' && field.onInput === undefined)
    return { ...field, onInput: field.onChange, onChange: settledOnly };
  if (field.kind === 'string' && field.onInput === undefined)
    return { ...field, onInput: field.onChange, onChange: settledOnly };
  return field;
}
