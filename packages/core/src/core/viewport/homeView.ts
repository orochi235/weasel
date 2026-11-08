import type { View } from './view';

/** The kit's initial view: the world origin at the canvas's top-left, at 100%. What a canvas opens
 *  on with no `defaultView`, and what Cmd-0 resets to when nothing supplies a `recenter`. */
export const HOME_VIEW: View = Object.freeze({ x: 0, y: 0, scale: Object.freeze({ x: 1, y: 1 }) });

/**
 * The view Cmd-0 gives: the owner's `recenter`, else {@link HOME_VIEW}. `undefined` when the
 * `recenter` set the view itself. Also where a fit with nothing to fit lands.
 */
export function resetView(source: { recenter?(): View | void }): View | undefined {
  if (!source.recenter) return HOME_VIEW;
  return source.recenter() ?? undefined;
}
