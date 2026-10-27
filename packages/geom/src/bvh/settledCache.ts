/**
 * A value built from a source only once the source has held still. Each read
 * passes the source's key, a tuple of whatever its value is a function of
 * (versions, generations, the identity of an input). A read at a key that
 * differs from the last one records it and answers null, so the caller works
 * without the value; the `reads`-th read in a row at one key builds it, and
 * later reads at that key return the same value. A source whose key changes
 * before every read never pays for a build.
 *
 * Keys match element by element under `Object.is`.
 */
export interface SettledCache<T> {
  /** The value for `key`, built by `build` on the read that settles it; null before that. */
  read(key: readonly unknown[], build: () => T): T | null;
  /** Forget the recorded key and any value, as if never read. */
  clear(): void;
}

/** Options for {@link createSettledCache}. */
export interface SettledCacheOptions {
  /** Which read in a row at one key builds the value. Default 2: a source must
   *  be read once unchanged before it is worth building over. 1 builds on the
   *  first read, which makes the cache a plain memo keyed the same way. */
  reads?: number;
}

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

/** A {@link SettledCache} that builds on the `reads`-th read in a row at one key. */
export function createSettledCache<T>({ reads = 2 }: SettledCacheOptions = {}): SettledCache<T> {
  if (!(reads >= 1) || !Number.isInteger(reads)) throw new RangeError(`createSettledCache: reads must be a positive integer, got ${reads}`);
  let seen: readonly unknown[] | undefined;
  let count = 0;
  let built: { value: T } | null = null;
  return {
    read(key, build) {
      if (seen === undefined || !sameKey(seen, key)) {
        seen = key.slice();
        count = 0;
        built = null;
      }
      if (built !== null) return built.value;
      if (++count < reads) return null;
      built = { value: build() };
      return built.value;
    },
    clear() {
      seen = undefined;
      count = 0;
      built = null;
    },
  };
}
