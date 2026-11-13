// The number leaf: its bounds, step, stops, scale, unit and display.

import type { Display, InfinityText } from '@weasel-js/quantity';
import type { PrefBoundAt } from './bounds';
import type { PrefValueBase } from './schema';
import type { PrefNumberUnit } from './unit';

/** How a schema-driven UI should present a number pref. */
export type PrefNumberControl = 'input' | 'slider';

/**
 * How a slider spaces values along its track: `'linear'`, the default;
 * `'log'`, even ratios at even distances, for a range above zero; `'sqrt'`,
 * which spreads out the low end less than a log does and takes zero and
 * negatives; or `to` and `from`, a warp the track is linear in and its inverse.
 */
export type PrefNumberScale =
  | 'linear'
  | 'log'
  | 'sqrt'
  | { to(value: number): number; from(warped: number): number };

/** What every number leaf carries; {@link PrefNumber} adds `clearable`. */
export interface PrefNumberBase extends PrefValueBase<'number', number | undefined> {
  min?: number;
  max?: number;
  /** A lower bound read from where the value is held — a scene node's own
   *  minimum — taken with `min`, the larger winning. A surface resolves it
   *  per holder with `prefNumberAt`. */
  minAt?: PrefBoundAt;
  /** The upper counterpart of `minAt`, taken with `max`, the smaller winning. */
  maxAt?: PrefBoundAt;
  step?: number;
  control?: PrefNumberControl;
  /** What an empty field shows: what an unset value stands for, on a `clearable` leaf. */
  placeholder?: string;
  /** How the value shows, speaks and reads back when typed — `compact()`
   *  reads `2.00M`. Presentation only: the stored value stays a number. */
  display?: Display;
  unit?: PrefNumberUnit;
  /** What the number measures. `'length'` is a length stored in world units: a
   *  surface showing a scene node's field gives it the unit of the unit scopes
   *  the node sits in (`prefLeafInScopes`). A `unit` of the leaf's own wins. */
  measure?: 'length';
  /** The values a slider's drag catches on, in the stored unit like `min` and
   *  `max`: each is drawn on the track, a drag passing near one lands on it
   *  (alt held passes it by), and a key step crossing one stops there. */
  stops?: readonly number[];
  /** How the slider spaces values along its track — `.range(1, 1000)` with
   *  `'log'` gives 1–10, 10–100 and 100–1000 a third each. It changes only
   *  where a value sits on the track: the typed value, `step`, `stops`, the
   *  arrow keys and the stored value stay in the value's own units. Under a
   *  `unit` the slider runs in the shown unit, so the scale spaces shown
   *  values. A `'log'` track over a range not above zero warns once in
   *  development and is drawn linear. */
  scale?: PrefNumberScale;
  /** Which end of a slider gets a stop for ±Infinity, one step beyond the range. */
  endless?: 'min' | 'max' | 'both';
  /** The word infinity shows as — `'never'`, `'uncapped'`. Default `∞`. */
  infinity?: InfinityText;
}

/**
 * A numeric pref, optionally bounded and stepped, and optionally stored in a
 * different unit from the one shown.
 *
 * `clearable` says the field may hold no number, which a person sets by
 * emptying it: the value is then `undefined`, which the owner reads as unset,
 * and its default may be too.
 */
export type PrefNumber = PrefNumberBase & ({ clearable?: false; default: number } | { clearable: true });
