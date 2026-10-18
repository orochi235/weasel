import type { LaneColumns } from './engine/lanes';
import { showing, type RowMove } from './target';
import type { ShownArray } from './targetTable';

/**
 * What a table's pass adds to its rows besides their own voices: the moves of animations with a
 * destination, which the rows' holds cover, and what waits beside those holds. A move's voices
 * run in a lane of their own, `group`, each tagged with the move's id, and the share of them
 * that is the move and what holds released over it kept of it are kept here, one row a move.
 */
export interface TableMoves {
  /** The lane group a move's voices run in. */
  readonly group: object;
  move(row: number, share: readonly number[]): RowMove;
  beside(row: number, value: readonly number[] | null): void;
  /** Adds the moves in `columns` to their rows, by how much `cover` of the rows' holds leaves
   *  of them, and what waits beside the holds. A row whose `stamp` is not `pass` has nothing
   *  in `shown` from this pass yet, and is put at its committed value and `delta` first. */
  add(
    shown: ShownArray, committed: Float64Array, delta: Float64Array | null, cover: Float64Array | null,
    columns: LaneColumns | null, stamp: Int32Array, pass: number,
  ): void;
}

export function createTableMoves(n: number): TableMoves {
  const group = {};
  let cap = 16;
  let rowOf = new Int32Array(cap);
  let share = new Float64Array(cap * n);
  let kept = new Float64Array(cap * n);
  const free: number[] = [];
  let high = 0;
  const besides = new Map<number, readonly number[]>();
  /** How many moves have had some of them taken by a hold released over them. */
  let dimmed = 0;
  let dims = new Uint8Array(cap);

  const grow = (): void => {
    cap *= 2;
    const r = new Int32Array(cap);
    r.set(rowOf);
    rowOf = r;
    const s = new Float64Array(cap * n);
    s.set(share);
    share = s;
    const k = new Float64Array(cap * n);
    k.set(kept);
    kept = k;
    const d = new Uint8Array(cap);
    d.set(dims);
    dims = d;
  };

  return {
    group,
    move(row, of) {
      const id = free.pop() ?? high++;
      if (id >= cap) grow();
      rowOf[id] = row;
      share.set(of, id * n);
      kept.fill(1, id * n, (id + 1) * n);
      let gone = false;
      return {
        place: { group, tag: id },
        kept: (k) => {
          kept.set(k, id * n);
          if (!dims[id]) { dims[id] = 1; dimmed += 1; }
        },
        leave() {
          if (gone) return;
          gone = true;
          if (dims[id]) { dims[id] = 0; dimmed -= 1; }
          free.push(id);
        },
      };
    },
    beside(row, value) {
      if (value) besides.set(row, value);
      else besides.delete(row);
    },
    add(shown, committed, delta, cover, columns, stamp, pass) {
      if (columns) {
        const { cols, tags, count } = columns;
        const whole = !cover && dimmed === 0;
        for (let j = 0; j < count; j++) {
          const id = tags[j]!;
          const row = rowOf[id]!;
          const at = row * n;
          // The first this pass to reach its row starts it from its committed value.
          const fresh = stamp[row] !== pass;
          stamp[row] = pass;
          if (whole && fresh && !delta) {
            for (let k = 0; k < n; k++) shown[at + k] = committed[at + k]! + cols[j * n + k]!;
            continue;
          }
          for (let k = 0; k < n; k++) {
            const f = whole ? 1 : showing(share[id * n + k]!, cover ? cover[at + k]! : 0, kept[id * n + k]!);
            const from = fresh ? committed[at + k]! + (delta ? delta[at + k]! : 0) : shown[at + k]!;
            shown[at + k] = from + cols[j * n + k]! * f;
          }
        }
      }
      for (const [row, value] of besides) {
        for (let k = 0; k < n; k++) shown[row * n + k] = shown[row * n + k]! + value[k]!;
      }
    },
  };
}
