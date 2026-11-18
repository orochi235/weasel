import { rectsOverlap } from '@weasel-js/geom';
import { createEmitter } from '@weasel-js/registry';
import { flushSync } from 'react-dom';
import { measureTiles, type SurfaceScope, sameRects, sameScope, scopeHolds } from './measureTiles';
import type { Box, Rect } from './rect';

/** What a surface owner is handed once per animation frame. `rects` carries every
 *  tile, not only the dirty ones: a scissored draw has to know where it is drawing
 *  relative to a surface that may have resized under it.
 *
 *  Its keys are what `useTileId` returns — `<trial>/<id>` for a tile registered
 *  inside a trial — not the bare id the tile was named with. */
export interface SurfaceFrame {
  dirty: ReadonlySet<string>;
  rects: ReadonlyMap<string, Rect>;
  /** The part of each tile's rect its clipping ancestors leave showing: the
   *  rect a tile confines its drawing and its input to, where `rects` is the
   *  one it places them against. Zero-sized for a tile wholly out of sight. */
  visible: ReadonlyMap<string, Rect>;
  dpr: number;
  size: { width: number; height: number };
  /** The tile geometry changed this frame — a tile moved, resized, appeared or
   *  went away, or the dpr did. Every tile is dirty on such a frame, but the
   *  pixels a tile vacated are in no tile's scissor now, so the owner clears
   *  the whole buffer. `<Lab>` does; a host owning its own surface must too. */
  retiled: boolean;
}

/** What a tile's painter is handed: where it sits on the surface now, and the
 *  frame that dirtied it, whose `visible` says how much of that shows.
 *
 *  Every painter of a frame runs inside one `flushSync`, so the state they set commits once, together. A painter
 *  that has to draw against that committed state returns a function, which runs after the commit. */
// biome-ignore lint/suspicious/noConfusingVoidType: a painter that returns nothing is the common case
export type TilePainter = (rect: Rect, frame: SurfaceFrame) => void | (() => void);

/** Erase the whole shared buffer. Device pixels, because that is what a GL
 *  viewport takes. */
export type SurfaceClear = (size: { width: number; height: number }, dpr: number) => void;

/** Every dirty tile's painter, in one commit, then what each asked to run after it. A `flushSync` per tile would
 *  count each as a nested update while any other work is pending, and React gives up past 50. */
function paintTiles(frame: SurfaceFrame, painters: ReadonlyMap<string, TilePainter>): void {
  const after: (() => void)[] = [];
  flushSync(() => {
    for (const id of frame.dirty) {
      const rect = frame.rects.get(id);
      const then = rect ? painters.get(id)?.(rect, frame) : undefined;
      if (typeof then === 'function') after.push(then);
    }
  });
  for (const then of after) then();
}

/** `box`, a client rect, measured from `origin`'s top-left corner. */
const toLocalRect = (box: Box, origin: Box): Rect => ({
  x: box.left - origin.left,
  y: box.top - origin.top,
  width: box.width,
  height: box.height,
});

/** Put `value` in `held` under `id`, throwing if something already is there; returns its release. */
function hold<T>(
  held: Map<string, T>,
  kind: 'painter' | 'clear',
  id: string,
  value: T,
): () => void {
  if (held.has(id)) throw takenError(kind, id);
  held.set(id, value);
  return () => {
    if (held.get(id) === value) held.delete(id);
  };
}

function takenError(kind: 'tile' | 'painter' | 'clear', id: string): Error {
  return new Error(
    `[labkit] surface ${kind} ${JSON.stringify(id)} is already registered and still live. Give each ${kind} its own id, or release the first before registering another.`,
  );
}

/**
 * One drawing buffer's worth of tiles, apart from React: which tiles are registered and where each was last
 * measured, which need painting, the painters and clears that paint them, and the scope narrowing them. Its writes
 * only record work; {@link TiledSurface.step} does it, once a frame.
 */
export class TiledSurface {
  private container: HTMLElement | null = null;
  private readonly tiles = new Map<string, HTMLElement>();
  private rects = new Map<string, Rect>();
  private visible = new Map<string, Rect>();
  private readonly dirty = new Set<string>();
  private readonly painters = new Map<string, TilePainter>();
  private readonly clears = new Map<string, SurfaceClear>();
  private stale = true;
  private tileLeft = false;
  private lastDpr = 0;
  private scopeEl: SurfaceScope = null;
  private readonly scopeChanged = createEmitter();

  getContainer(): HTMLElement | null {
    return this.container;
  }

  /** Measure tiles against `el` from now on. Returns whether that changed anything. */
  setContainer(el: HTMLElement | null): boolean {
    if (this.container === el) return false;
    this.container = el;
    this.stale = true;
    return true;
  }

  invalidate(id: string): void {
    this.dirty.add(id);
  }

  invalidateAll(): void {
    for (const id of this.tiles.keys()) this.dirty.add(id);
  }

  /** Mark every tile overlapping `box`, a client rect. Returns whether any did. */
  invalidateBox(box: Box): boolean {
    const el = this.container;
    if (!el) return false;
    const local = toLocalRect(box, el.getBoundingClientRect());
    let hit = false;
    for (const [id, r] of this.rects) {
      if (rectsOverlap(r, local)) {
        this.dirty.add(id);
        hit = true;
      }
    }
    return hit;
  }

  invalidateRects(): void {
    this.stale = true;
  }

  /** Publish `el` under `id`, or with `null` drop it. Returns whether that changed anything; throws when another
   *  element still in the document holds `id`. */
  placeTile(id: string, el: HTMLElement | null): boolean {
    const known = this.tiles.get(id);
    if (known === el) return false;
    if (el && known?.isConnected) throw takenError('tile', id);
    if (el) {
      this.tiles.set(id, el);
    } else {
      this.tiles.delete(id);
      // Its rect goes now, so the next measurement cannot see that it left.
      if (this.rects.delete(id)) this.tileLeft = true;
      this.visible.delete(id);
      this.dirty.delete(id);
    }
    this.stale = true;
    return true;
  }

  holdClear(id: string, clear: SurfaceClear): () => void {
    return hold(this.clears, 'clear', id, clear);
  }

  holdPainter(id: string, paint: TilePainter): () => void {
    return hold(this.painters, 'painter', id, paint);
  }

  /** Narrow to the tiles inside `el`, telling every scope listener. Returns whether that changed anything. */
  setScope(el: SurfaceScope): boolean {
    if (sameScope(this.scopeEl, el)) return false;
    this.scopeEl = el;
    this.stale = true;
    this.scopeChanged.emit();
    return true;
  }

  inScope(id: string): boolean {
    const tile = this.tiles.get(id);
    return !this.scopeEl || (tile !== undefined && scopeHolds(this.scopeEl, tile));
  }

  subscribeScope(listener: () => void): () => void {
    return this.scopeChanged.subscribe(listener);
  }

  /**
   * Run one frame: re-measure if anything asked, then hand `onFrame` the frame, run the clears on a retiled one, and
   * paint every dirty tile. Returns whether to run another frame, which a change in geometry asks for.
   */
  step(onFrame: (frame: SurfaceFrame) => void): boolean {
    const el = this.container;
    if (!el) {
      this.dirty.clear();
      return false;
    }
    const { moved, left } = this.remeasure(el);
    let retiled = moved;
    const dpr = globalThis.devicePixelRatio ?? 1;
    if (dpr !== this.lastDpr) {
      this.lastDpr = dpr;
      retiled = true;
      this.markMeasured();
    }
    // The last tile leaving dirties nothing, and still has pixels to clear.
    if (this.dirty.size === 0 && !left) return moved;
    const box = el.getBoundingClientRect();
    this.deliver(
      {
        dirty: new Set(this.dirty),
        rects: new Map(this.rects),
        visible: new Map(this.visible),
        dpr,
        size: { width: box.width, height: box.height },
        retiled,
      },
      onFrame,
    );
    return moved;
  }

  /** Measure every tile if anything asked; `moved` when the geometry changed or a tile left. */
  private remeasure(el: HTMLElement): { moved: boolean; left: boolean } {
    if (!this.stale) return { moved: false, left: false };
    this.stale = false;
    const next = measureTiles(el, this.tiles, this.scopeEl);
    const changed = !sameRects(this.rects, next.rects) || !sameRects(this.visible, next.visible);
    this.rects = next.rects;
    this.visible = next.visible;
    const left = this.tileLeft;
    this.tileLeft = false;
    if (!changed && !left) return { moved: false, left };
    this.markMeasured();
    // Geometry that changed may still be moving: a panel whose size has
    // settled while its position animates gives `ResizeObserver` nothing
    // more to report, and the tile would hold the frame it was caught
    // mid-flight at. Measure again next frame, and keep going until a
    // measurement finds nothing moved.
    this.stale = true;
    return { moved: true, left };
  }

  private markMeasured(): void {
    for (const id of this.rects.keys()) this.dirty.add(id);
  }

  private deliver(frame: SurfaceFrame, onFrame: (frame: SurfaceFrame) => void): void {
    // Cleared before the owner runs, not after the painters: sizing the
    // buffer blanks every tile, so the owner answers with `invalidateAll`,
    // and a set cleared at the end of the frame would swallow it.
    this.dirty.clear();
    onFrame(frame);
    // After the owner sized the buffer, before anything paints into it.
    if (frame.retiled) {
      for (const clear of this.clears.values()) clear(frame.size, frame.dpr);
    }
    // After the owner, which is what resized the buffer this frame — and
    // whatever it just dirtied paints now rather than a frame later.
    const painting = new Set(frame.dirty);
    for (const id of this.dirty) painting.add(id);
    this.dirty.clear();
    paintTiles({ ...frame, dirty: painting }, this.painters);
  }
}
