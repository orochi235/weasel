import { textOf, type Part } from './kind';
import type { UnitTable } from './number';
import { parseAs, partsOf, partsToHtml, present, type PresentOptions } from './present';
import { amount, displayOf, retag, tag, unitOf, type Display, type Quantity, type Tagged } from './quantity';
import { toneOf, type ValueTone } from './tones';
import { entryScale, unitScale, type UnitScale, type Unit, type UnitSystem } from './units';

/**
 * A short-lived view of a quantity with its presentation as methods. Nothing
 * about it is stored — keep the quantity, and wrap it where it is shown.
 */
export class QuantityView<Q extends Quantity = Quantity> {
  constructor(
    /** The quantity as given. */
    readonly raw: Q,
    private readonly fallback?: Display,
    private readonly options?: PresentOptions,
  ) {}

  get value(): number {
    return amount(this.raw);
  }
  get unit(): Unit | undefined {
    return unitOf(this.raw);
  }
  /** The display in effect: the value's own, else the fallback. */
  get display(): Display | undefined {
    return displayOf(this.raw, this.fallback);
  }
  get parts(): Part[] {
    return partsOf(this.raw, this.fallback, this.options);
  }
  get text(): string {
    return textOf(this.parts);
  }
  get spoken(): string {
    return present(this.raw, this.fallback, this.options).spoken;
  }
  get html(): string {
    return partsToHtml(this.value, this.parts, this.tone);
  }
  /** The value's tone, when its display has `tones`. */
  get tone(): ValueTone | undefined {
    return toneOf(this.raw, this.fallback);
  }
  get mathml(): string | undefined {
    return present(this.raw, this.fallback, this.options).mathml;
  }
  /** `next` in this quantity's shape — see {@link retag}. */
  with(next: number): QuantityView<Q> {
    return new QuantityView(retag(this.raw, next), this.fallback, this.options);
  }
  /** Typed text read through this quantity's display; NaN when it does not read. */
  parse(text: string): number {
    const unit = this.unit;
    return parseAs(text, this.display, unit === undefined ? this.options : { ...this.options, unit });
  }
  /** The same amount in `target`, converted through `system`, tagged with it. */
  to(target: Unit, system: UnitSystem): QuantityView {
    const from = unitScale(system, this.unit ?? system.base);
    const to = unitScale(system, target);
    const base = this.value * from.factor + from.offset;
    const value = (base - to.offset) / to.factor;
    const shown = (d: Display | undefined): Display | undefined => {
      if (d?.kind !== 'unit') return d;
      const accepts = d['accepts'] as UnitTable | undefined;
      return {
        ...d,
        ...(d['unit'] === undefined ? {} : { unit: target }),
        ...(accepts === undefined ? {} : { accepts: rescaled(accepts, from, to) }),
      };
    };
    const own = typeof this.raw === 'number' ? undefined : this.raw.display;
    const raw = typeof this.raw === 'number'
      ? tag(value, undefined, target)
      : { ...(this.raw as Tagged), value, unit: target, ...(own === undefined ? {} : { display: shown(own) }) };
    return new QuantityView(raw, shown(this.fallback), this.options);
  }
  toJSON(): Q {
    return this.raw;
  }
}

/** `accepts`, whose entries convert into a unit at `from`, converting into the one at `to` instead. */
function rescaled(accepts: UnitTable, from: Required<UnitScale>, to: Required<UnitScale>): UnitTable {
  return Object.fromEntries(Object.entries(accepts).map(([name, entry]) => {
    const { factor, offset } = entryScale(entry);
    return [name, {
      factor: (factor * from.factor) / to.factor,
      offset: (offset * from.factor + from.offset - to.offset) / to.factor,
    }];
  }));
}

/** Wraps `q` for display: `qty(band.from, fraction()).text`. `fallback` is the
 *  display for a value that carries none of its own. */
export function qty<Q extends Quantity>(q: Q, fallback?: Display, options?: PresentOptions): QuantityView<Q> {
  return new QuantityView(q, fallback, options);
}
