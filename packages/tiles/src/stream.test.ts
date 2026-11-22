import { describe, expect, it } from 'vitest';
import { createPlaneScheme, type PlaneTileKey, type PlaneTileView } from './scheme';
import { TileStream } from './stream';

const scheme = createPlaneScheme(100);
const view = (x: number, y: number, w = 300, h = 200): PlaneTileView => ({ box: [x, y, x + w, y + h], pxPerUnit: 1 });
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** A stream over loads the test resolves by hand. */
function setup(maxConcurrent = 2, maxHeld = 20) {
  const pending = new Map<string, { resolve: (p: string) => void; signal: AbortSignal }>();
  const started: string[] = [];
  const released: string[] = [];
  const stream = new TileStream<PlaneTileKey, PlaneTileView, string>({
    scheme, level: 0, maxConcurrent, maxHeld,
    load: (k, signal) => new Promise((resolve) => {
      const id = scheme.idOf(k);
      started.push(id);
      pending.set(id, { resolve, signal });
    }),
    release: (k) => { released.push(scheme.idOf(k)); },
  });
  const resolveAll = async () => {
    for (const [id, p] of [...pending]) {
      pending.delete(id);
      p.resolve(id);
    }
    await flush();
  };
  return { stream, pending, started, released, resolveAll };
}

describe('TileStream', () => {
  it('loads the tile nearest the view\'s center first, and no more at once than the cap', () => {
    const { stream, started } = setup(2);
    stream.update(view(0, 0));
    expect(stream.inFlight).toBe(2);
    // The view's center is 150, 100: tile 1/1's center is 150, 150 and 1/0's 150, 50.
    expect(started.every((id) => id.startsWith('0/1/'))).toBe(true);
  });

  it('loads the screen before its ring, and the ring before where a fling lands', async () => {
    const { stream, started, resolveAll } = setup(1, 1000);
    stream.update(view(0, 0), view(2000, 0));
    for (let i = 0; i < 40 && stream.inFlight > 0; i++) await resolveAll();
    const onScreen = new Set(scheme.wanted(view(0, 0), 0).filter((w) => !w.ring).map((w) => scheme.idOf(w.key)));
    const firstOff = started.findIndex((id) => !onScreen.has(id));
    expect(started.slice(0, firstOff).length).toBe(onScreen.size);
    const ahead = new Set(scheme.wanted(view(2000, 0), 0).map((w) => scheme.idOf(w.key)));
    expect(started.findIndex((id) => ahead.has(id))).toBeGreaterThan(firstOff);
  });

  it('aborts a load the view stops wanting, and frees what it returns', async () => {
    const { stream, pending, released } = setup(2);
    stream.update(view(0, 0));
    const first = [...pending.values()];
    stream.update(view(5000, 5000));
    expect(first.every((p) => p.signal.aborted)).toBe(true);
    // Still busy at the source, so nothing new starts until they settle.
    expect(stream.inFlight).toBe(2);
    first[0]!.resolve('late');
    await flush();
    expect(released).toHaveLength(1);
    expect(stream.count).toBe(0);
  });

  it('holds no more than its bound once the view moves on', async () => {
    const { stream, resolveAll, released } = setup(8, 20);
    for (let s = 0; s < 30; s++) {
      stream.update(view(s * 300, 0));
      for (let i = 0; i < 10 && stream.inFlight + stream.waiting > 0; i++) {
        await resolveAll();
        stream.update(view(s * 300, 0));
      }
      expect(stream.count).toBeLessThanOrEqual(20);
    }
    expect(released.length).toBeGreaterThan(0);
    stream.dispose();
    expect(stream.count).toBe(0);
  });
});

describe('TileStream loads that fail', () => {
  it('treats a load that throws at once as a failed load, freeing its slot', async () => {
    const errors: string[] = [];
    const started: string[] = [];
    const stream = new TileStream<PlaneTileKey, PlaneTileView, string>({
      scheme, level: 0, maxConcurrent: 1,
      load: (k) => {
        started.push(scheme.idOf(k));
        throw new Error('bad key');
      },
      release: () => {},
      onError: (k) => { errors.push(scheme.idOf(k)); },
    });
    expect(() => stream.update(view(0, 0))).not.toThrow();
    for (let i = 0; i < 40 && stream.inFlight > 0; i++) await flush();
    expect(stream.inFlight).toBe(0);
    expect(errors).toEqual(started);
    expect(started).toHaveLength(scheme.wanted(view(0, 0), 0).length);
  });
});

describe('TileStream views that come back', () => {
  const keyOf = (id: string): PlaneTileKey => {
    const [z, x, y] = id.split('/').map(Number);
    return { z: z!, x: x!, y: y! };
  };

  it('loads a tile wanted again while its aborted load was settling, the source honoring the abort', async () => {
    const pending = new Map<string, { resolve: (p: string) => void }>();
    const stream = new TileStream<PlaneTileKey, PlaneTileView, string>({
      scheme, level: 0, maxConcurrent: 2,
      load: (k, signal) => new Promise((resolve, reject) => {
        const id = scheme.idOf(k);
        pending.set(id, { resolve });
        signal.addEventListener('abort', () => queueMicrotask(() => reject(new Error('aborted'))));
      }),
      release: () => {},
    });
    stream.update(view(0, 0));
    const first = [...pending.keys()];
    pending.clear();
    stream.update(view(5000, 5000));
    stream.update(view(0, 0));
    await flush();
    for (let i = 0; i < 40 && stream.inFlight + stream.waiting > 0; i++) {
      for (const [id, p] of [...pending]) { pending.delete(id); p.resolve(id); }
      await flush();
    }
    for (const id of first) expect(stream.payloadOf(keyOf(id))).toBe(id);
  });

  it('keeps what an aborted load returns when the view wants it again', async () => {
    const { stream, pending, released } = setup(2);
    stream.update(view(0, 0));
    const first = [...pending.entries()];
    stream.update(view(5000, 5000));
    stream.update(view(0, 0));
    for (const [id, p] of first) p.resolve(id);
    await flush();
    for (const [id] of first) expect(stream.payloadOf(keyOf(id))).toBe(id);
    expect(released).toHaveLength(0);
  });
});
