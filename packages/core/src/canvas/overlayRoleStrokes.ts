import type { CommandPaint, CommandStroke } from '@weasel-js/paint';

/** How each `polyline` overlay role reads. An action publishes the run and
 *  the word; this table is the whole of the paint, for the dispatcher overlay
 *  and for any tool previewing the same kind of run between gestures. */
export const OVERLAY_ROLE_STROKES: Readonly<Record<string, CommandStroke & { paint: CommandPaint }>> = {
  cut: { paint: { color: '#e23b3b' }, width: 1, dash: [6, 4] },
  connector: { paint: { color: '#7ba7c7' }, width: 2, dash: [4, 4] },
  falloff: { paint: { color: 'rgba(52, 120, 246, 0.28)' }, width: 10, cap: 'round', join: 'round' },
  measure: { paint: { color: '#1f8fff' }, width: 1 },
  lock: { paint: { color: '#d9480f' }, width: 1.5 },
  /** Where a dragged item would land. */
  insert: { paint: { color: '#1f8fff' }, width: 3, cap: 'round' },
  /** Where a dragged item is over but cannot land. */
  refused: { paint: { color: '#ff5d5d' }, width: 3, cap: 'round' },
};
