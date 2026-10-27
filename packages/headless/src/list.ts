/** How a list's items are read: which ones the highlight can land on, and which way its arrows run. */
export interface ListShape<T> {
  /** Whether the highlight can land on `item`. A separator or a heading can't. Default: every item. */
  canStop?(item: T): boolean;
  /** Which arrow keys move the highlight. Default `'vertical'`. */
  orientation?: 'vertical' | 'horizontal';
  /** An arrow past either end comes round to the other. Default true. */
  wrap?: boolean;
}

const always = () => true;

/** Index of the first item the highlight can land on, or null for a list with none. */
export function firstStop<T>(items: readonly T[], shape: ListShape<T> = {}): number | null {
  const i = items.findIndex(shape.canStop ?? always);
  return i < 0 ? null : i;
}

/** The next item the highlight can land on from `from` in direction `dir`; from `null`, the first or last.
 *  Without wrap, an end stays where it is. Null for a list with no such item. */
export function stepStop<T>(
  items: readonly T[], from: number | null, dir: 1 | -1, shape: ListShape<T> = {},
): number | null {
  const canStop = shape.canStop ?? always;
  const wrap = shape.wrap ?? true;
  const n = items.length;
  let i = from ?? (dir === 1 ? -1 : n);
  for (let k = 0; k < n; k++) {
    i += dir;
    if (i < 0 || i >= n) {
      if (!wrap) break;
      i = (i + n) % n;
    }
    if (canStop(items[i]!)) return i;
  }
  return !wrap && from !== null && canStop(items[from]!) ? from : null;
}

/** What one key does to a list's highlight. `handled` false for a key that is not the list's to move. */
export type RovingResult = { handled: false } | { handled: true; at: number | null };

/** Move the highlight `at` by one key: the arrows along the list's orientation, Home and End. */
export function rovingKey<T>(items: readonly T[], at: number | null, key: string, shape: ListShape<T> = {}): RovingResult {
  const [back, forward] = shape.orientation === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  switch (key) {
    case forward: return { handled: true, at: stepStop(items, at, 1, shape) };
    case back: return { handled: true, at: stepStop(items, at, -1, shape) };
    case 'Home': return { handled: true, at: stepStop(items, null, 1, shape) };
    case 'End': return { handled: true, at: stepStop(items, null, -1, shape) };
    default: return { handled: false };
  }
}
