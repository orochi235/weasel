import type { PrefNumberScale, PrefNumberUnit } from '@weasel-js/prefs';
import type { Display, InfinityText } from '@weasel-js/quantity';
import { BaseNode } from './baseNode';

/** A numeric leaf, built by `f.number`. `T` takes `undefined` once the leaf is {@link NumberNode.clearable}. */
export class NumberNode<T extends number | undefined = number> extends BaseNode<T> {
  readonly kind = 'number';

  /** Bound the value. A number with both bounds renders as a slider. */
  range(min: number, max: number): this {
    return this.ann({ min, max });
  }

  /** Bound the value from below only. The row stays a typed field. */
  min(min: number): this {
    return this.ann({ min });
  }

  /** Bound the value from above only. The row stays a typed field. */
  max(max: number): this {
    return this.ann({ max });
  }

  /** Let the value be unset: emptying the field writes `undefined`, and an unset value draws as an empty field
   *  showing the {@link NumberNode.placeholder}. Without it an emptied field puts its value back. */
  clearable(): NumberNode<T | undefined> {
    return this.ann({ clearable: true }) as NumberNode<T | undefined>;
  }

  /** What an empty field shows: what an unset value stands for. */
  placeholder(placeholder: string): this {
    return this.ann({ placeholder });
  }

  step(step: number): this {
    return this.ann({ step });
  }

  /** The unit shown after the value, as the unit catalog writes it — `'px'`, `'ms'`, `'°'`. Presentation only:
   *  it is never parsed, and the stored value stays a plain number. */
  suffix(suffix: string): this {
    return this.ann({ suffix });
  }

  /** Show, speak and read the value through a display — `compact()` reads
   *  `2.00M`. Presentation only: the stored value stays a plain number. */
  display(display: Display): this {
    return this.ann({ display });
  }

  /**
   * Store the value in one unit and edit it in another — radians stored,
   * degrees typed. `min`, `max` and `step` are declared in the stored unit
   * alongside the value, and convert with it. A unit is data where the
   * conversion is linear, `{ suffix: '°', scale: Math.PI / 180 }`, which
   * `prefUnit` builds from a `UnitSystem`, and a pair of functions where it
   * is not.
   */
  unit(unit: PrefNumberUnit): this {
    return this.ann({ unit });
  }

  /**
   * Add a stop for infinity one step past the top of the range: it stores
   * `Infinity` and reads `word` — `.range(0, 5000).endless('never')` — and
   * every value up to `max` stays reachable. `at: 'min'` adds it below the
   * bottom instead, as `-Infinity`; `'both'` does both.
   */
  endless(word?: InfinityText, at: 'min' | 'max' | 'both' = 'max'): this {
    return this.ann(word === undefined ? { endless: at } : { endless: at, infinity: word });
  }

  /** Values the slider's drag catches on, declared in the stored unit like
   *  `range` — `.range(-1, 1).stops([0])`. Each is drawn on the track; a drag
   *  passing near one lands on it unless alt is held, and a key step crossing
   *  one stops there. */
  stops(stops: readonly number[]): this {
    return this.ann({ stops });
  }

  /**
   * Space the slider's track some other way than linearly: `'log'` for a
   * range above zero, `'sqrt'`, or a `{ to, from }` pair. A segment count
   * where 1–100 matters most, `f.number(16).range(1, 1000).step(1).scale('log')`,
   * gives 1–10, 10–100 and 100–1000 a third of the track each. Only the track
   * moves: the typed value, `step`, `stops`, the arrow keys and the stored
   * value stay in the value's own units, where `.unit` changes them.
   */
  scale(scale: PrefNumberScale): this {
    return this.ann({ scale });
  }

  /** Force a slider even without both bounds. */
  slider(): this {
    return this.ann({ control: 'slider' });
  }

  /** Force a typed input even when both bounds are set. */
  input(): this {
    return this.ann({ control: 'input' });
  }
}

/** A true/false leaf, built by `f.boolean`; a checkbox unless `.toggle()`. */
