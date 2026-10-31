/** Options for {@link ordinalScale}. */
export interface OrdinalScaleOptions<T> {
  /** The keys, in order. */
  domain: readonly string[];
  /** What each key maps to, in domain order, wrapping when there are fewer than keys. */
  range: readonly T[];
}

/** A scale from keys to values in turn, as a series' colors are chosen. */
export interface OrdinalScale<T> {
  readonly kind: 'ordinal';
  readonly domain: readonly string[];
  readonly range: readonly T[];
  /** `key`'s value; a key not in the domain takes the next value after the last, and joins the domain. */
  map(key: string): T;
  /** The keys a legend lists. */
  ticks(): string[];
  format(key: string): string;
}

/** An ordinal scale from `domain` to `range`. Throws on an empty range. */
export function ordinalScale<T>(opts: OrdinalScaleOptions<T>): OrdinalScale<T> {
  if (opts.range.length === 0) throw new Error('ordinalScale: an empty range');
  const domain = [...opts.domain];
  const index = new Map(domain.map((key, i) => [key, i]));
  const range = [...opts.range];
  return {
    kind: 'ordinal',
    domain,
    range,
    map: (key) => {
      let i = index.get(key);
      if (i === undefined) {
        i = domain.length;
        domain.push(key);
        index.set(key, i);
      }
      return range[i % range.length]!;
    },
    ticks: () => [...domain],
    format: (key) => key,
  };
}
