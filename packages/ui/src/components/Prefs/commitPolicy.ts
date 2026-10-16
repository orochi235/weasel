import type { PropertyControlProps } from '../Properties/PropertyField';

/** A surface that edits settings: a `PrefsForm`, a `SelectionPanel` or `Bar`, or labkit's `ControlPanel`. */
export type ParamsSurface = 'form' | 'panel' | 'lab';

/** The controls that write more than once in one edit: a number typed, a slider dragged, text typed, a color picked. */
export type LiveControl = 'number' | 'slider' | 'string' | 'color';

/**
 * Which controls write only the value an edit settles on, by surface; any other writes as it changes. A form
 * stores settings, so only text, which has no gesture to end, writes as it goes. A panel edits a scene, where
 * every write is an undo step, so text settles too, and a slider is left live for the canvas to follow: its
 * moves are drafts ({@link withDrafts}), and the drag is one step. A lab follows every change.
 */
export const PARAMS_SETTLES: Record<ParamsSurface, Record<LiveControl, boolean>> = {
  form: { number: true, slider: true, string: false, color: true },
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
 * `settles` stands in for the surface's defaults: what `useParamsPolicy` resolves from the kit settings.
 */
export function withDrafts(
  field: PropertyControlProps,
  drafts: PropertyControlProps | null,
  surface: ParamsSurface,
  settles: Readonly<Record<LiveControl, boolean>> = PARAMS_SETTLES[surface],
): PropertyControlProps {
  const live = liveControl(field);
  if (live === null || settles[live] || drafts === null) return field;
  if (field.kind === 'number' && drafts.kind === 'number') return { ...field, onInput: drafts.onChange };
  if (field.kind === 'string' && drafts.kind === 'string') return { ...field, onInput: drafts.onChange };
  if (field.kind === 'color' && drafts.kind === 'color') return { ...field, onInput: drafts.onChange };
  return field;
}

/** `field` writing when `surface` writes it, or as `settles` says. A control given an `onInput` drafts through it
 *  and commits through `onChange`, so one that swallows the drafts is what makes a control write settled values only. */
export function withCommitPolicy(
  field: PropertyControlProps,
  surface: ParamsSurface,
  settles: Readonly<Record<LiveControl, boolean>> = PARAMS_SETTLES[surface],
): PropertyControlProps {
  const live = liveControl(field);
  if (live === null || !settles[live]) return field;
  if (field.kind === 'number') return { ...field, onInput: settledOnly };
  return field.kind === 'string' || field.kind === 'color' ? { ...field, onInput: settledOnly } : field;
}
