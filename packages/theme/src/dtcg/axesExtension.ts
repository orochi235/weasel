import type { AxisDefs, Selection } from '../axes';

/** The `$extensions` key on a DTCG export's root that carries every axis besides mode. */
export const AXES_EXT = 'com.weasel.axes';

/** The token groups of one layer: plain values, and values per mode. */
export interface DtcgLayer {
  readonly primitives: Record<string, Record<string, unknown>>;
  readonly modes: Record<string, Record<string, Record<string, unknown>>>;
}

/**
 * What `toDTCG` writes under `$extensions["com.weasel.axes"]`.
 *
 * - `axes`: every axis the theme resolves with, mode included.
 * - `varies`: token name → the non-mode axes its value depends on.
 * - `overrides`: a layer per combination of non-default values, keyed like
 *   `selectionKey` but naming only the axes off their default
 *   (`density=compact`, `contrast=high,density=roomy` in axis order).
 */
export interface DtcgAxesExtension {
  readonly axes: AxisDefs;
  readonly varies: Record<string, readonly string[]>;
  readonly overrides: Record<string, DtcgLayer>;
}

/** The override key for a selection: its non-default values, axes in declaration order. `''` is the plain groups. */
export function overrideKey(axes: AxisDefs, selection: Selection): string {
  return Object.keys(axes)
    .filter((a) => selection[a] !== undefined && selection[a] !== axes[a].default)
    .map((a) => `${a}=${selection[a]}`)
    .join(',');
}
