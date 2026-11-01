// The number leaf: its bounds, step, stops, unit and display.

import type { Display, InfinityText } from '@weasel-js/quantity';
import type { PrefBoundAt } from './bounds';
import type { PrefValueBase } from './schema';
import type { PrefNumberUnit } from './unit';

/** How a schema-driven UI should present a number pref. */
export type PrefNumberControl = 'input' | 'slider';

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
