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

const nums = new Map<number, number[][]>();
const refs = new Map<number, unknown[][]>();
let held = 0;

function take<T>(pool: Map<number, T[][]>, n: number): T[] | undefined {
  const list = pool.get(n);
  if (list === undefined || list.length === 0) return undefined;
  held -= n;
  return list.pop();
}

function give<T>(pool: Map<number, T[][]>, a: T[]): void {
  const n = a.length;
  if (n === 0 || held + n > ARRAY_POOL_LIMIT) return;
  let list = pool.get(n);
  if (list === undefined) pool.set(n, (list = []));
  list.push(a);
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

/** Test helper. Do not call from product code. */
export function _resetArrayPoolForTests(): void {
  nums.clear();
  refs.clear();
  held = 0;
}
