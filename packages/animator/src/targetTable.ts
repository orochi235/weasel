import { createHoldStore, type HoldStore } from './engine/holdStore';
import type { LaneColumns } from './engine/lanes';
import { createTarget, readTargetInto, stateOf, type RowTable, type Target, type TargetState } from './target';

/** The arrays a table can keep its rows' values on screen in. */
export type ShownArray = Float64Array | Float32Array;

/** What {@link createTargetTable} takes. */
export interface TargetTableOptions<S extends ShownArray = Float64Array> {
  /** How many numbers a row holds. */
  axes: number;
  /** The kind of array to keep `shown` in. Default `Float64Array`. Pass `Float32Array` for a
   *  painter that uploads it: the table then fills that each frame, and no copy is made. */
  shown?: new (length: number) => S;
  /** Rows to make room for at first. The table grows past it. Default 64. */
  capacity?: number;
  /** Called after `row` is committed: by `set`, by an animation starting on it, and by one
   *  canceled on it. */
  set?(row: number): void;
  /** Called once a frame, after the animator has filled `shown` for the rows it is moving. */
  show?(): void;
}

/**
 * Many like values an animator can move, kept as rows of numbers in flat arrays: for thousands
 * of particles, dots, or vertex colors, where a `Target` apiece costs a read apiece. Each row
 * is a target (`target(row)`), so it tweens, springs, coasts, and holds like any other, and
 * every row's value on screen is in `shown` after each frame, with no call per row.
 */
export interface TargetTable<S extends ShownArray = Float64Array> {
  readonly axes: number;
  /** How many rows are in use. */
  readonly size: number;
  /** Every row's committed value, row `r` at `r * axes`. A new array once the table grows, so
   *  read it from the table each time. Write a row through `set`. */
  readonly committed: Float64Array;
  /** Every row's value on screen, laid out as `committed`: current after each frame of the
   *  animator moving the rows, and whenever it is read between frames. A new array once the
   *  table grows. A `Float32Array` where the table was made with `shown: Float32Array`. */
  readonly shown: S;
  /** Adds a row at `value` and answers its index, which a removed row's index is reused for. */
  add(value: ArrayLike<number>): number;
  /** Stops whatever is moving `row` and frees it. Its target is dead from here: a row added
   *  later may take the index, and gets a target of its own. */
  remove(row: number): void;
  /** Commits `value` to `row`. A row that is moving keeps what its animations have left on top. */
  set(row: number, value: ArrayLike<number>): void;
  /** Row `row` as a target, the same one on every call. */
  target(row: number): Target<number[]>;
}

/** Writes `value` as row `row` of `into`, whose rows are `n` numbers. */
function put(into: ShownArray, n: number, row: number, value: ArrayLike<number>): void {
  if (value.length !== n) throw new Error(`target table: a row is ${n} numbers, and this value is ${value.length}`);
  for (let k = 0; k < n; k++) into[row * n + k] = value[k]!;
}

/** Row `row` of a table of `n`-number rows as a target. `committed` answers the table's
 *  committed values now, and throws once the row is no longer this target's. */
function rowTarget(
  n: number, row: number, rows: RowTable, committed: () => Float64Array,
  commit: (row: number, value: ArrayLike<number>) => void,
): Target<number[]> {
  const target = createTarget<number[]>({
    get: () => {
      const from = committed();
      // Array.from over a typed array's view measured several times this loop.
      const value = new Array<number>(n);
      for (let k = 0; k < n; k++) value[k] = from[row * n + k]!;
      return value;
    },
    set: (value) => {
      committed();
      commit(row, value);
    },
  });
  const state = stateOf(target);
  state.row = { table: rows, index: row };
  state.write = (out, at) => {
    const from = committed();
    for (let k = 0; k < n; k++) out[at + k] = from[row * n + k]!;
  };
  return target;
}

/** Make a {@link TargetTable} whose rows each hold `axes` numbers. */
export function createTargetTable<S extends ShownArray = Float64Array>(opts: TargetTableOptions<S>): TargetTable<S> {
  const n = opts.axes;
  const Shown = opts.shown ?? (Float64Array as unknown as new (length: number) => S);
  if (!Number.isInteger(n) || n < 1) throw new Error('createTargetTable: `axes` is a whole number of at least 1');
  let committed = new Float64Array(Math.max(opts.capacity ?? 64, 1) * n);
  let shown = new Shown(committed.length);
  /** One past the highest row ever used. */
  let high = 0;
  let size = 0;
  const free: number[] = [];
  const targets: (Target<number[]> | undefined)[] = [];
  const states: (TargetState<number[]> | undefined)[] = [];
  /** How many times each row has been removed: what tells a row's target from its last one's. */
  const removals: number[] = [];
  /** Rows whose value on screen the pass over the table's columns does not give: read apart. */
  const marks = new Set<number>();
  /** The holds on its rows, once any has been held. */
  let holds: HoldStore | null = null;

  const flush = (): void => {
    for (const row of marks) {
      const s = states[row];
      if (s) readTargetInto(s, shown, row * n);
    }
  };

  const commit = (row: number, value: ArrayLike<number>): void => {
    put(committed, n, row, value);
    const s = states[row];
    if (s && s.live > 0) marks.add(row);
    else put(shown, n, row, value);
    opts.set?.(row);
  };

  const rows: RowTable = {
    mark: (row) => { marks.add(row); },
    settle() {
      // What a mark stood for is on screen once it is read. A hold is a voice among the row's
      // columns; what waits beside one, and what a hold hides of a move behind it, are not.
      flush();
      for (const row of marks) {
        const s = states[row];
        if (!s || s.live === 0 || !(s.beside || s.dimmed || (s.held > 0 && s.behind.size > 0))) marks.delete(row);
      }
    },
    fill(columns: LaneColumns | null) {
      const delta = holds && holds.size > 0 ? holds.delta : null;
      if (delta) {
        const { held, size } = holds!;
        for (let j = 0; j < size; j++) {
          const at = held[j]! * n;
          for (let k = 0; k < n; k++) shown[at + k] = committed[at + k]! + delta[at + k]!;
        }
      }
      if (columns) {
        const { cols, tags, count } = columns;
        for (let j = 0; j < count; j++) {
          const at = tags[j]! * n;
          if (delta) for (let k = 0; k < n; k++) shown[at + k] = committed[at + k]! + cols[j * n + k]! + delta[at + k]!;
          else for (let k = 0; k < n; k++) shown[at + k] = committed[at + k]! + cols[j * n + k]!;
        }
      }
      flush();
      opts.show?.();
    },
    holds: () => (holds ??= createHoldStore(n, committed.length / n, (row, out, at) => {
      for (let k = 0; k < n; k++) out[at + k] = committed[row * n + k]!;
    })),
  };

  return {
    axes: n,
    get size() { return size; },
    get committed() { return committed; },
    get shown() {
      flush();
      return shown;
    },
    add(value) {
      const row = free.pop() ?? high++;
      if ((row + 1) * n > committed.length) {
        const grown = new Float64Array(Math.max(committed.length * 2, (row + 1) * n));
        grown.set(committed);
        committed = grown;
        const wider = new Shown(grown.length);
        wider.set(shown);
        shown = wider;
        holds?.grow(grown.length / n);
      }
      put(committed, n, row, value);
      put(shown, n, row, value);
      size += 1;
      return row;
    },
    remove(row) {
      targets[row]?.stop();
      targets[row] = undefined;
      removals[row] = (removals[row] ?? 0) + 1;
      states[row] = undefined;
      marks.delete(row);
      free.push(row);
      size -= 1;
    },
    set: commit,
    target(row) {
      const held = targets[row];
      if (held) return held;
      const made = (removals[row] ??= 0);
      const mine = (): void => {
        if (removals[row] !== made) throw new Error(`target table: row ${row} was removed, and this is its old target`);
      };
      const target = rowTarget(n, row, rows, () => { mine(); return committed; }, commit);
      targets[row] = target;
      states[row] = stateOf(target);
      return target;
    },
  };
}
