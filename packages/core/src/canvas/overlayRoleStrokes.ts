import type { Stroke } from '@weasel-js/paint';

/** How each `polyline` overlay role reads. An action publishes the run and
 *  the word; this table is the whole of the paint, for the dispatcher overlay
 *  and for any tool previewing the same kind of run between gestures. */
export const OVERLAY_ROLE_STROKES: Readonly<Record<string, Stroke>> = {
  cut: { paint: { color: '#e23b3b' }, width: 1, dash: [6, 4] },
  connector: { paint: { color: '#7ba7c7' }, width: 2, dash: [4, 4] },
};
