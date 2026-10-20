/** A binary min-heap of integer ids keyed by a priority and a tie-break. */
export class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  private ties: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  private less(a: number, b: number): boolean {
    const ka = this.keys[a]!;
    const kb = this.keys[b]!;
    return ka < kb || (ka === kb && this.ties[a]! < this.ties[b]!);
  }

  private swap(a: number, b: number): void {
    const id = this.ids[a]!;
    this.ids[a] = this.ids[b]!;
    this.ids[b] = id;
    const key = this.keys[a]!;
    this.keys[a] = this.keys[b]!;
    this.keys[b] = key;
    const tie = this.ties[a]!;
    this.ties[a] = this.ties[b]!;
    this.ties[b] = tie;
  }

  push(id: number, key: number, tie: number): void {
    this.ids.push(id);
    this.keys.push(key);
    this.ties.push(tie);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** The id with the least key, removed. Undefined when empty. */
  pop(): number | undefined {
    const n = this.ids.length;
    if (n === 0) return undefined;
    const top = this.ids[0]!;
    this.swap(0, n - 1);
    this.ids.pop();
    this.keys.pop();
    this.ties.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n - 1 && this.less(l, m)) m = l;
      if (r < n - 1 && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}
