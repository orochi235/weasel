/**
 * Number and reference arrays handed back by layouts and paintings the caches
 * proved nobody holds, kept for the next layout or painting of the same size.
 * Text whose content changes every frame then lays out into the arrays its
 * previous frame used, rather than allocating them again.
 *
 * Pooled by exact length: the readers take an array's `length` as its count.
 * Bounded by the elements held, so a paragraph handed back cannot pin memory.
 */

/** Longest array {@link doubles} copies from its template rather than builds. */
const TEMPLATE_LIMIT = 1 << 16;
/** All fractions, so V8 holds its elements as unboxed doubles, and `slice`
 *  hands a copy that kind. An array that starts out empty or holding integers
 *  is copied again the first time a fraction lands in it. */
let template: number[] = [0.5];

/** A new array of `n` numbers, held as unboxed doubles from the start. Its
 *  contents are placeholders for the caller to overwrite. */
export function doubles(n: number): number[] {
  if (n > TEMPLATE_LIMIT) return new Array<number>(n).fill(0.5);
  while (template.length < n) template = template.concat(template);
  return template.slice(0, n);
}

/** Most elements held across both pools: 2 MB of numbers. */
export const ARRAY_POOL_LIMIT = 1 << 18;

/** Arrays of one length. `n` counts the live ones, so emptying the bucket
 *  never shrinks `items`: popping did, and refilling it reallocated every
 *  frame. */
interface Bucket<T> { items: (T[] | undefined)[]; n: number }

const nums = new Map<number, Bucket<number>>();
const refs = new Map<number, Bucket<unknown>>();
let held = 0;

function take<T>(pool: Map<number, Bucket<T>>, n: number): T[] | undefined {
  const b = pool.get(n);
  if (b === undefined || b.n === 0) return undefined;
  held -= n;
  const a = b.items[--b.n];
  b.items[b.n] = undefined;
  return a;
}

function give<T>(pool: Map<number, Bucket<T>>, a: T[]): void {
  const n = a.length;
  if (n === 0 || held + n > ARRAY_POOL_LIMIT) return;
  let b = pool.get(n);
  if (b === undefined) pool.set(n, (b = { items: [], n: 0 }));
  b.items[b.n++] = a;
  held += n;
}

/** `n` numbers held as unboxed doubles, their contents placeholders: a pooled
 *  array of that length when there is one. */
export function takeDoubles(n: number): number[] {
  return take(nums, n) ?? doubles(n);
}

/** `n` references, their contents placeholders. */
export function takeRefs(n: number): unknown[] {
  return take(refs, n) ?? new Array<unknown>(n);
}

/** Hand back an array from {@link takeDoubles}. The caller keeps no reference. */
export function giveDoubles(a: number[]): void {
  give(nums, a);
}

/** Hand back an array from {@link takeRefs}. The caller keeps no reference. */
export function giveRefs(a: unknown[]): void {
  give(refs, a);
}

/** Elements the pools hold now. */
export function pooledElements(): number {
  return held;
}

/** Cut `a` to `n` elements, keeping its backing store for the next refill:
 *  `length = 0` drops V8's store, so refilling a list emptied that way
 *  reallocates it every time, and `pop` keeps it. */
export function truncate(a: unknown[], n: number): void {
  while (a.length > n) a.pop();
}

/** Test helper. Do not call from product code. */
export function _resetArrayPoolForTests(): void {
  nums.clear();
  refs.clear();
  held = 0;
}
