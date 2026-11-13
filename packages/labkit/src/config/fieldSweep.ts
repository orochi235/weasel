import { resolvePrefUnit } from '@weasel-js/prefs';
import { withUnit } from '@weasel-js/quantity';
import { range, type Sweep, values } from '@weasel-js/ui/components/Sequence';
import type { ConfigNode } from './types';

/** How finely to walk a number field that declares neither `step` nor `stops`. */
export interface FieldSweepOptions {
  step?: number;
  count?: number;
}

/**
 * The values a config field's own control offers, as a sweep: a number's
 * `stops`, else its `range` by its `step` (or the `step` or `count` given
 * here); an enum's options; a boolean's off and on.
 */
export function fieldSweep<T>(node: ConfigNode<T>, options: FieldSweepOptions = {}): Sweep<T> {
  const ann = node.annotations;
  if (node.kind === 'boolean')
    return values([false, true], (v) => (v ? 'on' : 'off')) as Sweep<unknown> as Sweep<T>;
  if (node.kind === 'enum') {
    const opts = ann.options ?? [];
    const labels = new Map(opts.map((o) => [o.value, o.label]));
    return values(
      opts.map((o) => o.value),
      (v) => labels.get(v) ?? v,
    ) as Sweep<unknown> as Sweep<T>;
  }
  if (node.kind !== 'number')
    throw new TypeError(
      `a field sweeps when it is a number, an enum or a boolean, not ${node.kind ?? 'a value'}`,
    );
  const unit = ann.unit && resolvePrefUnit(ann.unit);
  const label = (v: number): string =>
    unit ? withUnit(String(unit.toDisplay(v)), unit.suffix, { space: true }) : String(v);
  if (ann.stops && options.step === undefined && options.count === undefined)
    return values(ann.stops, label) as Sweep<unknown> as Sweep<T>;
  const { min, max } = ann;
  if (min === undefined || max === undefined)
    throw new RangeError('a number field sweeps between its `range`; give it one');
  const step = options.step ?? (options.count === undefined ? ann.step : undefined);
  const sweep =
    step !== undefined
      ? range({ from: min, to: max, step, label })
      : options.count !== undefined
        ? range({ from: min, to: max, count: options.count, label })
        : null;
  if (!sweep)
    throw new RangeError(
      'a number field with no `step` or `stops` sweeps with a `step` or `count` given here',
    );
  return sweep as Sweep<unknown> as Sweep<T>;
}
