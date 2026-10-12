/** What {@link Wakes} keeps on each thing waiting in it. */
export interface Waiting {
  /** The time it is due at; kept by `Wakes`. */
  wakeAt: number;
  /** Its place in the heap; -1 while it is not waiting. */
  heapAt: number;
  /** Orders two due in one call: the lower first. */
  seq: number;
}

/** Things waiting for a clock to reach a time each, soonest first: a binary heap that knows
 *  each one's place, so one can leave or be given another time without a search. */
export interface Wakes<W extends Waiting> {
  /** Has `w` wait for `at`, in place of any time it was waiting for. */
  set(w: W, at: number): void;
  /** Stops `w` waiting. */
  remove(w: W): void;
  /** Takes out everything due at or before `now`, in `seq` order. */
  due(now: number): W[];
  clear(): void;
  readonly size: number;
}

export function createWakes<W extends Waiting>(): Wakes<W> {
  const heap: W[] = [];

  const place = (w: W, i: number): void => {
    heap[i] = w;
    w.heapAt = i;
  };
  const up = (w: W, i: number): void => {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = heap[parent]!;
      if (p.wakeAt <= w.wakeAt) break;
      place(p, i);
      i = parent;
    }
    place(w, i);
  };
  const down = (w: W, i: number): void => {
    const n = heap.length;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && heap[child + 1]!.wakeAt < heap[child]!.wakeAt) child += 1;
      const c = heap[child]!;
      if (c.wakeAt >= w.wakeAt) break;
      place(c, i);
      i = child;
    }
    place(w, i);
  };
  const remove = (w: W): void => {
    const i = w.heapAt;
    if (i < 0) return;
    w.heapAt = -1;
    const last = heap.pop()!;
    if (last === w) return;
    // The last one takes the gap, and may belong either way from there.
    if (i > 0 && last.wakeAt < heap[(i - 1) >> 1]!.wakeAt) up(last, i);
    else down(last, i);
  };

  return {
    set(w, at) {
      remove(w);
      w.wakeAt = at;
      heap.push(w);
      up(w, heap.length - 1);
    },
    remove,
    due(now) {
      const out: W[] = [];
      while (heap.length > 0 && heap[0]!.wakeAt <= now) {
        const w = heap[0]!;
        remove(w);
        out.push(w);
      }
      if (out.length > 1) out.sort((a, b) => a.seq - b.seq);
      return out;
    },
    clear() {
      for (const w of heap) w.heapAt = -1;
      heap.length = 0;
    },
    get size() { return heap.length; },
  };
}
