# Hosting a Foreign Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give labkit the five things a lab needs in order to drive a renderer labkit does not own — a tiled surface scheduler, a device-rect converter, an opaque trial view, an orbit control, and a `job` capability for long-running work.

**Architecture:** labkit publishes rects, dirtiness, DPR and rAF coalescing; the consumer keeps the GL. Every new unit is split into a pure function plus a thin hook that wires the DOM to it, so the arithmetic is tested headlessly and no test needs WebGL. Nothing here touches `CanvasStack`, which a separate spec is replacing.

**Tech Stack:** TypeScript, React 19, zustand, windease, vitest + @testing-library/react, Biome.

**Spec:** `precioussss/docs/superpowers/specs/2026-08-22-gem-bench-lab-design.md`. Read it before starting — it explains *why* each boundary falls where it does, which this plan does not repeat.

---

## Orientation for someone new to this package

- **Instrument** — one self-contained interactive experiment. Owns `config` (what the control panel edits) and `state` (what it's doing). Optional *capability* fields (`canvas`, `layers`, `dragDrop`, `undo`) declare what it wants from the runtime; declaring one is what makes the trial render the matching chrome. Defined in `src/instrument/types.ts`.
- **Trial** — one tile in the workspace running one instrument, with its own config, state and view. `src/trial/Trial.tsx` is its runtime.
- **Workspace** — the grid the trials sit in, built on `windease`. `src/lab/Workspace.tsx`.
- **Lab store** — a zustand store holding every trial record and persisting them. `src/state/store.ts`, types in `src/state/types.ts`.
- Run one test file with `npx vitest run src/path/file.test.ts`. Run everything with `npm test`. Lint with `npm run lint` (Biome plus a check that every CSS class starts `lk-`).
- `jsdom` measures every element as zero. `src/test-setup.ts` already stubs `ResizeObserver` to report a 1024×768 box; tests that need real geometry stub `getBoundingClientRect` per element, as shown below.

## File structure

| File | Responsibility |
|---|---|
| `src/surface/rect.ts` | The `Rect` and `Box` types shared by everything below |
| `src/surface/deviceRect.ts` | `toDeviceRect` — DOM rect to GL viewport rect |
| `src/surface/composeRects.ts` | `composeRects`, `rectsEqual` — tile boxes into surface-relative rects |
| `src/surface/useTiledSurface.ts` | The hook: ResizeObserver, dirty set, rAF coalescing, DPR |
| `src/surface/SurfaceContext.ts` | Context carrying the handle down to tiles |
| `src/surface/useSurfaceTile.ts` | `useSurfaceTile(id)` — a ref callback that registers an element |
| `src/surface/index.ts` | The subpath's public surface |
| `src/canvas/useOrbit.ts` | `useOrbit` — pointer gestures to an orbit view |
| `src/job/types.ts` | `JobCapability`, `JobEvent`, `JobStatus` |
| `src/job/useJob.ts` | The runtime: start, abort, discard stale, count |
| `src/job/index.ts` | The subpath's public surface |

Modified: `src/state/types.ts`, `src/state/store.ts`, `src/instrument/types.ts`, `src/trial/Trial.tsx`, `src/trial/TrialChrome.tsx`, `src/lab/Workspace.tsx`, `src/index.ts`, `package.json`, `src/canvas/AGENTS.md`.

---

### Task 1: The shared rect types

**Files:**
- Create: `src/surface/rect.ts`

- [ ] **Step 1: Write the types**

```ts
// src/surface/rect.ts

/** A box in CSS pixels, measured from the surface's own top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The subset of `DOMRect` this package reads. Accepting the subset rather than
 *  `DOMRect` is what lets the pure functions be tested without a DOM. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/surface/rect.ts
git commit -m "add the surface rect types"
```

---

### Task 2: `toDeviceRect`

A DOM rect is top-origin; a GL viewport is bottom-origin. Both edges also have to land on the device-pixel grid — `setViewport` rounds where the framebuffer floors, so a fractional rect can shift a pixel between a scene draw and its composite and strand a hairline column between neighbouring tiles. The result stays in CSS pixels because three.js multiplies by its own pixel ratio.

**Files:**
- Create: `src/surface/deviceRect.ts`
- Test: `src/surface/deviceRect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/surface/deviceRect.test.ts
import { describe, expect, it } from 'vitest';
import { toDeviceRect } from './deviceRect';

const onGrid = (v: number, dpr: number) => Math.abs(v * dpr - Math.round(v * dpr)) < 1e-9;

describe('toDeviceRect', () => {
  it('measures y from the bottom of the surface', () => {
    const r = toDeviceRect({ x: 0, y: 0, w: 40, h: 10 }, 100, 1);
    expect(r.y).toBe(90);
    expect(r.h).toBe(10);
  });

  it('leaves x and width alone', () => {
    const r = toDeviceRect({ x: 5, y: 0, w: 40, h: 10 }, 100, 1);
    expect(r.x).toBe(5);
    expect(r.w).toBe(40);
  });

  it('puts every edge on the device grid', () => {
    const r = toDeviceRect({ x: 33.3, y: 7.7, w: 33.3, h: 21.4 }, 100, 2);
    expect(onGrid(r.x, 2)).toBe(true);
    expect(onGrid(r.x + r.w, 2)).toBe(true);
    expect(onGrid(r.y, 2)).toBe(true);
    expect(onGrid(r.y + r.h, 2)).toBe(true);
  });

  it('does not strand a column between neighbours', () => {
    // Three tiles across a 100pt surface land on thirds. Snapped independently,
    // a tile's far edge must still be its neighbour's near edge.
    const a = toDeviceRect({ x: 0, y: 0, w: 33.3333, h: 10 }, 100, 2);
    const b = toDeviceRect({ x: 33.3333, y: 0, w: 33.3333, h: 10 }, 100, 2);
    const c = toDeviceRect({ x: 66.6666, y: 0, w: 33.3334, h: 10 }, 100, 2);
    expect(a.x + a.w).toBe(b.x);
    expect(b.x + b.w).toBe(c.x);
  });

  it('snaps a stacked pair without overlapping them', () => {
    const top = toDeviceRect({ x: 0, y: 0, w: 10, h: 33.3333 }, 100, 3);
    const bottom = toDeviceRect({ x: 0, y: 33.3333, w: 10, h: 33.3333 }, 100, 3);
    expect(bottom.y + bottom.h).toBe(top.y);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/surface/deviceRect.test.ts`
Expected: FAIL — `Failed to resolve import "./deviceRect"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/surface/deviceRect.ts
import type { Rect } from './rect';

/**
 * A DOM rect as a GL viewport rect: origin at the bottom-left, every edge snapped
 * to the device-pixel grid. Still CSS pixels, because three.js applies its own
 * pixel ratio — snapping here is what stops a tile and its neighbour rounding
 * apart and leaving a hairline column between them.
 */
export function toDeviceRect(rect: Rect, surfaceHeight: number, dpr: number): Rect {
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const x = snap(rect.x);
  const y = snap(surfaceHeight - rect.y - rect.h);
  return {
    x,
    y,
    w: snap(rect.x + rect.w) - x,
    h: snap(surfaceHeight - rect.y) - y,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/surface/deviceRect.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/surface/deviceRect.ts src/surface/deviceRect.test.ts
git commit -m "convert a DOM rect to a snapped GL viewport rect"
```

---

### Task 3: `composeRects`

Every tile and the surface container are measured with `getBoundingClientRect`, so they share the viewport's coordinate space and composing them is a subtraction — which is why it works regardless of what nests between a tile and the surface.

**Files:**
- Create: `src/surface/composeRects.ts`
- Test: `src/surface/composeRects.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/surface/composeRects.test.ts
import { describe, expect, it } from 'vitest';
import { composeRects, rectsEqual } from './composeRects';
import type { Box } from './rect';

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height,
});

describe('composeRects', () => {
  it('reports tiles relative to the container origin', () => {
    const out = composeRects(box(100, 50, 800, 600), new Map([['a', box(140, 90, 200, 150)]]));
    expect(out.get('a')).toEqual({ x: 40, y: 40, w: 200, h: 150 });
  });

  it('works through a nested offset parent, because both are viewport-relative', () => {
    // A tile two levels deep still reports its own viewport box, so nothing
    // about the nesting reaches this function.
    const out = composeRects(box(0, 0, 800, 600), new Map([['deep', box(310, 220, 90, 40)]]));
    expect(out.get('deep')).toEqual({ x: 310, y: 220, w: 90, h: 40 });
  });

  it('handles a container scrolled off the top of the viewport', () => {
    const out = composeRects(box(0, -200, 800, 600), new Map([['a', box(0, -150, 100, 100)]]));
    expect(out.get('a')).toEqual({ x: 0, y: 50, w: 100, h: 100 });
  });

  it('returns one entry per tile', () => {
    const out = composeRects(
      box(0, 0, 800, 600),
      new Map([
        ['a', box(0, 0, 10, 10)],
        ['b', box(20, 0, 10, 10)],
      ]),
    );
    expect([...out.keys()]).toEqual(['a', 'b']);
  });
});

describe('rectsEqual', () => {
  it('is false when the previous rect is missing', () => {
    expect(rectsEqual(undefined, { x: 0, y: 0, w: 1, h: 1 })).toBe(false);
  });

  it('compares every field', () => {
    const r = { x: 1, y: 2, w: 3, h: 4 };
    expect(rectsEqual({ ...r }, r)).toBe(true);
    expect(rectsEqual({ ...r, h: 5 }, r)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/surface/composeRects.test.ts`
Expected: FAIL — `Failed to resolve import "./composeRects"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/surface/composeRects.ts
import type { Box, Rect } from './rect';

/** Every tile's box expressed against the container's origin. */
export function composeRects(
  container: Box,
  tiles: ReadonlyMap<string, Box>,
): Map<string, Rect> {
  const out = new Map<string, Rect>();
  for (const [id, tile] of tiles) {
    out.set(id, {
      x: tile.left - container.left,
      y: tile.top - container.top,
      w: tile.width,
      h: tile.height,
    });
  }
  return out;
}

export function rectsEqual(a: Rect | undefined, b: Rect): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/surface/composeRects.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/surface/composeRects.ts src/surface/composeRects.test.ts
git commit -m "compose tile boxes against the surface origin"
```

---

### Task 4: `useTiledSurface`

The hook that owns the ResizeObserver, the dirty set, the rAF loop and DPR delivery. `onFrame` fires at most once per animation frame, only when something is dirty, and carries *every* tile's rect — a scissored draw needs to know where it is drawing relative to a surface that may have resized under it.

**Files:**
- Create: `src/surface/useTiledSurface.ts`
- Test: `src/surface/useTiledSurface.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/surface/useTiledSurface.test.tsx
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SurfaceFrame, SurfaceHandle } from './useTiledSurface';
import { useTiledSurface } from './useTiledSurface';

/** jsdom measures everything as zero, so each element is given a box by hand. */
function stubBox(el: HTMLElement, left: number, top: number, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

interface HarnessProps {
  frames: SurfaceFrame[];
  onHandle: (h: SurfaceHandle) => void;
}

function Harness({ frames, onHandle }: HarnessProps) {
  const surface = useTiledSurface({
    onFrame: (f) => {
      frames.push(f);
    },
  });
  useEffect(() => {
    onHandle(surface);
  }, [surface, onHandle]);
  return (
    <div
      ref={(el) => {
        if (!el) return;
        stubBox(el, 0, 0, 800, 600);
        surface.containerRef(el);
      }}
    >
      <div
        ref={(el) => {
          if (!el) return;
          stubBox(el, 0, 0, 400, 600);
          surface.registerTile('a', el);
        }}
      />
      <div
        ref={(el) => {
          if (!el) return;
          stubBox(el, 400, 0, 400, 600);
          surface.registerTile('b', el);
        }}
      />
    </div>
  );
}

/** Runs every pending rAF callback. */
function flushFrames(): void {
  act(() => {
    vi.advanceTimersByTime(32);
  });
}

describe('useTiledSurface', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('coalesces three invalidations in one tick into a single frame', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(<Harness frames={frames} onHandle={(h) => { handle = h; }} />);
    flushFrames();
    frames.length = 0;

    act(() => {
      handle?.invalidate('a');
      handle?.invalidate('b');
      handle?.invalidate('a');
    });
    flushFrames();

    expect(frames).toHaveLength(1);
    expect([...(frames[0]?.dirty ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('fires nothing on a clean tick', () => {
    const frames: SurfaceFrame[] = [];
    render(<Harness frames={frames} onHandle={() => {}} />);
    flushFrames();
    frames.length = 0;
    flushFrames();
    expect(frames).toHaveLength(0);
  });

  it('carries every tile rect, not only the dirty ones', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(<Harness frames={frames} onHandle={(h) => { handle = h; }} />);
    flushFrames();
    frames.length = 0;

    act(() => handle?.invalidate('a'));
    flushFrames();

    expect([...(frames[0]?.dirty ?? [])]).toEqual(['a']);
    expect(frames[0]?.rects.get('b')).toEqual({ x: 400, y: 0, w: 400, h: 600 });
  });

  it('reports the surface size and dpr', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(<Harness frames={frames} onHandle={(h) => { handle = h; }} />);
    flushFrames();
    frames.length = 0;

    act(() => handle?.invalidateAll());
    flushFrames();

    expect(frames[0]?.dpr).toBe(3);
    expect(frames[0]?.size).toEqual({ width: 800, height: 600 });
  });

  it('marks every tile dirty when the dpr changes', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(<Harness frames={frames} onHandle={(h) => { handle = h; }} />);
    flushFrames();
    frames.length = 0;

    vi.stubGlobal('devicePixelRatio', 2);
    act(() => handle?.invalidateRects());
    flushFrames();

    expect([...(frames[0]?.dirty ?? [])].sort()).toEqual(['a', 'b']);
    expect(frames[0]?.dpr).toBe(2);
  });

  it('re-measures on invalidateRects, which is how a moved tile is caught', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    const { container } = render(<Harness frames={frames} onHandle={(h) => { handle = h; }} />);
    flushFrames();
    frames.length = 0;

    // A sibling reflow slides tile b left. ResizeObserver sees no size change.
    const b = container.querySelectorAll('div > div')[1] as HTMLElement;
    stubBox(b, 320, 0, 400, 600);

    act(() => handle?.invalidateRects());
    flushFrames();

    expect(frames[0]?.rects.get('b')).toEqual({ x: 320, y: 0, w: 400, h: 600 });
  });

  it('drops a tile that unregisters', () => {
    const frames: SurfaceFrame[] = [];
    let handle: SurfaceHandle | null = null;
    render(<Harness frames={frames} onHandle={(h) => { handle = h; }} />);
    flushFrames();
    frames.length = 0;

    act(() => {
      handle?.registerTile('b', null);
      handle?.invalidateRects();
    });
    flushFrames();

    expect(frames[0]?.rects.has('b')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/surface/useTiledSurface.test.tsx`
Expected: FAIL — `Failed to resolve import "./useTiledSurface"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/surface/useTiledSurface.ts
import { useCallback, useEffect, useRef } from 'react';
import { composeRects, rectsEqual } from './composeRects';
import type { Box, Rect } from './rect';

/** What a surface owner is handed once per animation frame. `rects` carries every
 *  tile, not only the dirty ones: a scissored draw has to know where it is drawing
 *  relative to a surface that may have resized under it. */
export interface SurfaceFrame {
  dirty: ReadonlySet<string>;
  rects: ReadonlyMap<string, Rect>;
  dpr: number;
  size: { width: number; height: number };
}

/** The invalidators and the two ref callbacks that publish geometry. */
export interface SurfaceHandle {
  /** Mark one tile for redraw. */
  invalidate: (id: string) => void;
  /** Mark every tile — what a resize or a tile-set change means. */
  invalidateAll: () => void;
  /** Re-measure before the next frame. The escape hatch for a host that knows it
   *  moved something a ResizeObserver cannot see. */
  invalidateRects: () => void;
  registerTile: (id: string, el: HTMLElement | null) => void;
  containerRef: (el: HTMLElement | null) => void;
}

export interface UseTiledSurfaceOptions {
  onFrame: (frame: SurfaceFrame) => void;
}

export function useTiledSurface({ onFrame }: UseTiledSurfaceOptions): SurfaceHandle {
  const container = useRef<HTMLElement | null>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, Rect>());
  const dirty = useRef(new Set<string>());
  const needsMeasure = useRef(true);
  const raf = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);
  const lastDpr = useRef(0);

  // Held in a ref so a caller passing an inline closure does not re-create every
  // callback below on each render.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const measure = useCallback((): boolean => {
    const el = container.current;
    if (!el) return false;
    const boxes = new Map<string, Box>();
    for (const [id, tile] of tiles.current) boxes.set(id, tile.getBoundingClientRect());
    const next = composeRects(el.getBoundingClientRect(), boxes);
    let changed = next.size !== rects.current.size;
    for (const [id, rect] of next) {
      if (!rectsEqual(rects.current.get(id), rect)) changed = true;
    }
    rects.current = next;
    return changed;
  }, []);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = container.current;
      if (!el) {
        dirty.current.clear();
        return;
      }
      if (needsMeasure.current) {
        needsMeasure.current = false;
        if (measure()) for (const id of rects.current.keys()) dirty.current.add(id);
      }
      const dpr = globalThis.devicePixelRatio ?? 1;
      if (dpr !== lastDpr.current) {
        lastDpr.current = dpr;
        for (const id of rects.current.keys()) dirty.current.add(id);
      }
      if (dirty.current.size === 0) return;
      const box = el.getBoundingClientRect();
      onFrameRef.current({
        dirty: new Set(dirty.current),
        rects: new Map(rects.current),
        dpr,
        size: { width: box.width, height: box.height },
      });
      dirty.current.clear();
    });
  }, [measure]);

  const invalidate = useCallback(
    (id: string) => {
      dirty.current.add(id);
      schedule();
    },
    [schedule],
  );

  const invalidateAll = useCallback(() => {
    for (const id of tiles.current.keys()) dirty.current.add(id);
    schedule();
  }, [schedule]);

  const invalidateRects = useCallback(() => {
    needsMeasure.current = true;
    schedule();
  }, [schedule]);

  const registerTile = useCallback(
    (id: string, el: HTMLElement | null) => {
      const known = tiles.current.get(id);
      if (known && known !== el) observer.current?.unobserve(known);
      if (el) {
        if (known === el) return;
        tiles.current.set(id, el);
        observer.current?.observe(el);
      } else {
        tiles.current.delete(id);
        rects.current.delete(id);
        dirty.current.delete(id);
      }
      needsMeasure.current = true;
      schedule();
    },
    [schedule],
  );

  const containerRef = useCallback(
    (el: HTMLElement | null) => {
      if (container.current === el) return;
      if (container.current) observer.current?.unobserve(container.current);
      container.current = el;
      if (el) observer.current?.observe(el);
      needsMeasure.current = true;
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      needsMeasure.current = true;
      schedule();
    });
    observer.current = ro;
    if (container.current) ro.observe(container.current);
    for (const el of tiles.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      observer.current = null;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [schedule]);

  return { invalidate, invalidateAll, invalidateRects, registerTile, containerRef };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/surface/useTiledSurface.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/surface/useTiledSurface.ts src/surface/useTiledSurface.test.tsx
git commit -m "schedule a tiled surface: rects, dirtiness, dpr and one frame"
```

---

### Task 5: The surface context and `useSurfaceTile`

A trial nested anywhere below the surface owner needs the invalidators, and a tile needs to register its own element. `useSurfaceOptional` returns `null` outside a provider — Task 6 depends on that, because `Workspace` must work in a lab that has no surface at all.

**Files:**
- Create: `src/surface/SurfaceContext.ts`
- Create: `src/surface/useSurfaceTile.ts`
- Test: `src/surface/useSurfaceTile.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/surface/useSurfaceTile.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceContext } from './SurfaceContext';
import type { SurfaceHandle } from './useTiledSurface';
import { useSurface, useSurfaceOptional, useSurfaceTile } from './useSurfaceTile';

function fakeHandle(): SurfaceHandle {
  return {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    invalidateRects: vi.fn(),
    registerTile: vi.fn(),
    containerRef: vi.fn(),
  };
}

function Tile({ id }: { id: string }) {
  const ref = useSurfaceTile(id);
  return <div ref={ref} data-testid={id} />;
}

describe('useSurfaceTile', () => {
  it('registers its element with the surface on mount', () => {
    const handle = fakeHandle();
    const { getByTestId } = render(
      <SurfaceContext.Provider value={handle}>
        <Tile id="a" />
      </SurfaceContext.Provider>,
    );
    expect(handle.registerTile).toHaveBeenCalledWith('a', getByTestId('a'));
  });

  it('unregisters on unmount', () => {
    const handle = fakeHandle();
    const { unmount } = render(
      <SurfaceContext.Provider value={handle}>
        <Tile id="a" />
      </SurfaceContext.Provider>,
    );
    unmount();
    expect(handle.registerTile).toHaveBeenCalledWith('a', null);
  });

  it('is inert with no surface above it, so a 2D lab is unaffected', () => {
    expect(() => render(<Tile id="a" />)).not.toThrow();
  });
});

describe('useSurface', () => {
  it('throws outside a provider, because a caller asking for it needs one', () => {
    function Consumer() {
      useSurface();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(/requires a surface/i);
  });

  it('returns null from the optional form outside a provider', () => {
    let seen: SurfaceHandle | null | undefined;
    function Consumer() {
      seen = useSurfaceOptional();
      return null;
    }
    render(<Consumer />);
    expect(seen).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/surface/useSurfaceTile.test.tsx`
Expected: FAIL — `Failed to resolve import "./SurfaceContext"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/surface/SurfaceContext.ts
import { createContext } from 'react';
import type { SurfaceHandle } from './useTiledSurface';

/** Null when no surface owner is above — a lab with no shared surface at all. */
export const SurfaceContext = createContext<SurfaceHandle | null>(null);
```

```tsx
// src/surface/useSurfaceTile.ts
import { useCallback, useContext } from 'react';
import { SurfaceContext } from './SurfaceContext';
import type { SurfaceHandle } from './useTiledSurface';

/** The surface above, or null. Use this where a surface is genuinely optional. */
export function useSurfaceOptional(): SurfaceHandle | null {
  return useContext(SurfaceContext);
}

/** The surface above. Throws where a caller cannot work without one. */
export function useSurface(): SurfaceHandle {
  const surface = useContext(SurfaceContext);
  if (!surface) throw new Error('[labkit] useSurface requires a surface owner above it');
  return surface;
}

/**
 * A ref callback that publishes this element's rect to the surface under `id`.
 *
 * Attach it to whichever element the surface should draw into — that is not
 * necessarily the trial's own element, since a trial may hold a drawn pane beside
 * an undrawn one, or none at all.
 */
export function useSurfaceTile(id: string): (el: HTMLElement | null) => void {
  const surface = useSurfaceOptional();
  return useCallback(
    (el: HTMLElement | null) => {
      surface?.registerTile(id, el);
    },
    [surface, id],
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/surface/useSurfaceTile.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/surface/SurfaceContext.ts src/surface/useSurfaceTile.ts src/surface/useSurfaceTile.test.tsx
git commit -m "publish a tile rect from anywhere below the surface"
```

---

### Task 6: Invalidate rects when the grid moves a tile

A `ResizeObserver` sees a box change size, not a box move, so a sibling's reflow slides a tile and reports nothing. klieg's tube lab works around this by re-measuring every frame until the rects hold still for two frames, capped at forty. `Workspace` already subscribes to windease's `node.placementChanged` to drive `onLayoutChange`; the same subscription can invalidate rects directly. Only labkit can do this — the host has no access to the grid's store.

**Files:**
- Modify: `src/lab/Workspace.tsx:139-151` (the `onLayoutChange` effect)
- Test: `src/lab/Workspace.surface.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/lab/Workspace.surface.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { Workspace } from './Workspace';

function fakeHandle(): SurfaceHandle {
  return {
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    invalidateRects: vi.fn(),
    registerTile: vi.fn(),
    containerRef: vi.fn(),
  };
}

describe('Workspace with a surface above it', () => {
  it('invalidates rects when the tile set changes, because a re-tile moves tiles', () => {
    const handle = fakeHandle();
    const { rerender } = render(
      <SurfaceContext.Provider value={handle}>
        <Workspace ids={['a']} viewport={{ w: 800, h: 600 }}>
          <div>a</div>
        </Workspace>
      </SurfaceContext.Provider>,
    );
    (handle.invalidateRects as ReturnType<typeof vi.fn>).mockClear();

    rerender(
      <SurfaceContext.Provider value={handle}>
        <Workspace ids={['a', 'b']} viewport={{ w: 800, h: 600 }}>
          <div>a</div>
          <div>b</div>
        </Workspace>
      </SurfaceContext.Provider>,
    );

    expect(handle.invalidateRects).toHaveBeenCalled();
  });

  it('renders unchanged with no surface above it', () => {
    const { getByText } = render(
      <Workspace ids={['a']} viewport={{ w: 800, h: 600 }}>
        <div>a</div>
      </Workspace>,
    );
    expect(getByText('a')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lab/Workspace.surface.test.tsx`
Expected: FAIL on the first test — `invalidateRects` was not called.

- [ ] **Step 3: Wire the subscription**

Add the import at the top of `src/lab/Workspace.tsx`:

```tsx
import { useSurfaceOptional } from '../surface/useSurfaceTile';
```

Inside `Workspace`, immediately after the `storeRef` block that creates the store, add:

```tsx
  // A tile that only moves reports nothing to a ResizeObserver, and only this
  // component knows the grid moved one. Optional: a lab may own no surface.
  const surface = useSurfaceOptional();
```

Then add this effect immediately after the existing `useLayoutEffect` that syncs `nodeIds`:

```tsx
  useEffect(() => {
    if (!surface) return;
    surface.invalidateRects();
    return store.events.on('node.placementChanged', () => surface.invalidateRects());
  }, [store, surface, nodeIds]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lab/Workspace.surface.test.tsx src/lab/Workspace.test.tsx`
Expected: PASS — 2 new tests, and the existing `Workspace` suite unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lab/Workspace.tsx src/lab/Workspace.surface.test.tsx
git commit -m "re-measure surface rects when the grid moves a tile"
```

---

### Task 7: The trial view goes opaque

`TrialRecord.view` is `{ zoom, pan }` — 2D, and the only camera state labkit persists, restores on Reset and exposes to chrome. A 3D lab keeps a parallel view in a ref and forfeits all three. Making it a type parameter costs labkit no 3D knowledge; it stops asserting 2D.

**Files:**
- Modify: `src/state/types.ts:9-17` (`TrialRecord`)
- Modify: `src/state/store.ts:31,111-114` (`updateTrialView`)
- Modify: `src/instrument/types.ts` (`RenderContext.trial`)
- Modify: `src/trial/Trial.tsx:88,105-109` (`setView` and `renderCtx.trial`)
- Test: `src/state/trialView.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/trialView.test.ts
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { createLabStore } from './store';

interface OrbitView {
  yaw: number;
  pitch: number;
  distance: number;
}

const options = () => ({ storageKey: 'view-test', storage: createMemoryAdapter() });

describe('a trial view labkit does not interpret', () => {
  it('stores and returns a view shape that is not zoom/pan', () => {
    const store = createLabStore(options());
    store.getState().addTrial('gem', { }, { }, { yaw: 0.4, pitch: 0.2, distance: 6 });
    const id = store.getState().trials[0]?.id as string;

    store.getState().updateTrialView(id, { yaw: 1.1, pitch: 0.3, distance: 9 });

    expect(store.getState().trials[0]?.view as OrbitView).toEqual({
      yaw: 1.1,
      pitch: 0.3,
      distance: 9,
    });
  });

  it('round-trips that view through persistence', () => {
    const storage = createMemoryAdapter();
    const first = createLabStore({ storageKey: 'view-test', storage });
    first.getState().addTrial('gem', {}, {}, { yaw: 1.1, pitch: 0.3, distance: 9 });
    first.getState().persist();

    const second = createLabStore({ storageKey: 'view-test', storage });
    second.getState().hydrate();

    expect(second.getState().trials[0]?.view as OrbitView).toEqual({
      yaw: 1.1,
      pitch: 0.3,
      distance: 9,
    });
  });

  it('still defaults to the 2D view when none is supplied', () => {
    const store = createLabStore(options());
    store.getState().addTrial('flat', {}, {});
    expect(store.getState().trials[0]?.view).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });
});
```

> **Before writing this test, read `src/state/store.ts` and `src/state/trialOps.ts`** and match the real `addTrial`, `persist` and `hydrate` signatures. If `addTrial` does not currently take an initial view, add that parameter as part of Step 3 — the third test above pins the default, so a missing argument must still produce `{ zoom: 1, pan: { x: 0, y: 0 } }`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/trialView.test.ts`
Expected: FAIL — a type error on the non-2D view, or `addTrial` rejecting the fourth argument.

- [ ] **Step 3: Widen the types**

In `src/state/types.ts`, replace the `TrialRecord` interface:

```ts
/** The 2D view labkit has always shipped, and the default when a trial does not
 *  name its own. */
export interface ViewTransform2D {
  zoom: number;
  pan: { x: number; y: number };
}

/** One trial as the store holds it: which instrument it runs, that instrument's
 *  config and state, the camera, and the undo history.
 *
 *  `view` is opaque to labkit. It is persisted, restored on Reset and handed to
 *  the instrument; nothing here reads inside it, so a 3D lab can put an orbit
 *  there and keep all three behaviours. */
export interface TrialRecord<TS = unknown, TC = unknown, TV = ViewTransform2D> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: TV;
  undoStack: UndoStack;
}

/** The view a trial gets when none is supplied. */
export const DEFAULT_VIEW: ViewTransform2D = { zoom: 1, pan: { x: 0, y: 0 } };
```

In `src/state/store.ts` line 31, widen the action:

```ts
  updateTrialView: (id: string, view: unknown) => void;
```

The body at line 111 needs no change — it already spreads `view` in without reading it.

In `src/instrument/types.ts`, replace the `trial` field of `RenderContext`:

```ts
  trial: {
    id: string;
    /** The trial's view, whatever shape this instrument chose. */
    view: unknown;
    setView: (next: unknown) => void;
    /** 2D convenience over `view`. Present only for the default view shape;
     *  reads `NaN` and writes nothing under a custom view. */
    zoom: number;
    setZoom: (z: number) => void;
  };
```

In `src/trial/Trial.tsx`, replace `setView` (line 88) and the `trial` block (lines 105–109):

```tsx
  const setView = (v: unknown): void => updateTrialView(record.id, v);

  const view2d =
    typeof record.view === 'object' && record.view !== null && 'zoom' in record.view
      ? (record.view as ViewTransform)
      : null;
```

and inside `renderCtx`:

```tsx
    trial: {
      id: record.id,
      view: record.view,
      setView,
      zoom: view2d ? view2d.zoom : Number.NaN,
      setZoom: (z) => {
        if (!view2d) return;
        updateTrialView(record.id, { ...view2d, zoom: z });
      },
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/ src/trial/ && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, and no type errors. The existing trial and state suites must be green — this change is meant to be invisible to a 2D instrument.

- [ ] **Step 5: Commit**

```bash
git add src/state/types.ts src/state/store.ts src/instrument/types.ts src/trial/Trial.tsx src/state/trialView.test.ts
git commit -m "let a trial hold a view labkit does not interpret"
```

---

### Task 8: `useOrbit`

The 3D peer of `usePanZoom`, and modelled on it directly — read `src/canvas/usePanZoom.ts` first. Trigonometry only: it imports no renderer and knows nothing about three.js.

**Files:**
- Create: `src/canvas/useOrbit.ts`
- Test: `src/canvas/useOrbit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/canvas/useOrbit.test.ts
import { describe, expect, it } from 'vitest';
import { clampPitch, orbitAfterDrag, orbitAfterWheel, PITCH_LIMIT, wrapYaw } from './useOrbit';

const view = { yaw: 0, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } };

describe('clampPitch', () => {
  it('stops just short of the poles, where azimuth becomes undefined', () => {
    expect(clampPitch(Math.PI)).toBeCloseTo(PITCH_LIMIT);
    expect(clampPitch(-Math.PI)).toBeCloseTo(-PITCH_LIMIT);
    expect(PITCH_LIMIT).toBeLessThan(Math.PI / 2);
  });

  it('leaves an in-range pitch alone', () => {
    expect(clampPitch(0.3)).toBe(0.3);
  });
});

describe('wrapYaw', () => {
  it('wraps into (-PI, PI] so a value cannot drift without bound', () => {
    expect(wrapYaw(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapYaw(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapYaw(0.5)).toBeCloseTo(0.5);
  });
});

describe('orbitAfterDrag', () => {
  it('turns horizontal movement into yaw and vertical into pitch', () => {
    const next = orbitAfterDrag(view, 100, 50);
    expect(next.yaw).not.toBe(view.yaw);
    expect(next.pitch).not.toBe(view.pitch);
  });

  it('is absolute against the drag start, so re-applying does not compound', () => {
    const once = orbitAfterDrag(view, 100, 50);
    const twice = orbitAfterDrag(view, 100, 50);
    expect(twice).toEqual(once);
  });

  it('clamps pitch rather than tumbling past the pole', () => {
    const next = orbitAfterDrag(view, 0, 100_000);
    expect(Math.abs(next.pitch)).toBeLessThanOrEqual(PITCH_LIMIT);
  });

  it('leaves distance and target untouched', () => {
    const next = orbitAfterDrag(view, 100, 50);
    expect(next.distance).toBe(view.distance);
    expect(next.target).toEqual(view.target);
  });
});

describe('orbitAfterWheel', () => {
  it('moves the camera in and out', () => {
    expect(orbitAfterWheel(view, 100, 0.5, 50).distance).toBeGreaterThan(view.distance);
    expect(orbitAfterWheel(view, -100, 0.5, 50).distance).toBeLessThan(view.distance);
  });

  it('is multiplicative, so a step feels the same at every distance', () => {
    const near = orbitAfterWheel({ ...view, distance: 2 }, 100, 0.5, 50);
    const far = orbitAfterWheel({ ...view, distance: 20 }, 100, 0.5, 50);
    expect(far.distance / 20).toBeCloseTo(near.distance / 2);
  });

  it('honours its bounds', () => {
    expect(orbitAfterWheel(view, 100_000, 0.5, 50).distance).toBe(50);
    expect(orbitAfterWheel(view, -100_000, 0.5, 50).distance).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/canvas/useOrbit.test.ts`
Expected: FAIL — `Failed to resolve import "./useOrbit"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/canvas/useOrbit.ts
import { type PointerEvent, useCallback, useRef, type WheelEvent } from 'react';

/** A point in the space the instrument works in. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** An orbit camera as a trial view: where it looks from, and what it looks at.
 *  labkit does not turn this into a matrix — the host's renderer does. */
export interface OrbitView {
  yaw: number;
  pitch: number;
  distance: number;
  target: Vec3;
}

/** Just short of the pole. At exactly ±PI/2 the azimuth is undefined and the
 *  camera flips, which reads as the model jumping rather than as a limit. */
export const PITCH_LIMIT = Math.PI / 2 - 0.01;

const YAW_PER_PX = 0.008;
const PITCH_PER_PX = 0.008;
const DISTANCE_PER_NOTCH = 0.0015;
const DRAG_THRESHOLD = 3;

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}

export function wrapYaw(yaw: number): number {
  const wrapped = ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** The view a drag of (dx, dy) from `start` produces. Absolute against the drag
 *  start, so it can be re-applied any number of times without compounding. */
export function orbitAfterDrag(start: OrbitView, dx: number, dy: number): OrbitView {
  return {
    ...start,
    yaw: wrapYaw(start.yaw + dx * YAW_PER_PX),
    pitch: clampPitch(start.pitch + dy * PITCH_PER_PX),
  };
}

/** Multiplicative, so one notch covers the same proportion of the distance
 *  whether the camera is near or far. */
export function orbitAfterWheel(
  view: OrbitView,
  deltaY: number,
  minDistance: number,
  maxDistance: number,
): OrbitView {
  const factor = Math.exp(deltaY * DISTANCE_PER_NOTCH);
  return {
    ...view,
    distance: Math.min(maxDistance, Math.max(minDistance, view.distance * factor)),
  };
}

export interface UseOrbitOptions {
  view: OrbitView;
  onViewChange: (v: OrbitView) => void;
  /** Restored on double-click. Defaults to the view the hook first saw. */
  home?: OrbitView;
  minDistance?: number;
  maxDistance?: number;
}

export interface OrbitHandlers {
  onWheel: (e: WheelEvent<HTMLElement>) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  isDragging: () => boolean;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startView: OrbitView;
  moved: boolean;
}

/** Pointer gestures over an orbit view: drag to turn, wheel or pinch to dolly,
 *  double-click to go home. The 3D peer of `usePanZoom`. */
export function useOrbit({
  view,
  onViewChange,
  home,
  minDistance = 0.1,
  maxDistance = 1000,
}: UseOrbitOptions): OrbitHandlers {
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const homeRef = useRef(home ?? view);
  if (home) homeRef.current = home;

  const onWheel = useCallback(
    (e: WheelEvent<HTMLElement>) => {
      e.preventDefault();
      onViewChange(orbitAfterWheel(viewRef.current, e.deltaY, minDistance, maxDistance));
    },
    [onViewChange, minDistance, maxDistance],
  );

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startView: viewRef.current,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      onViewChange(orbitAfterDrag(drag.startView, dx, dy));
    },
    [onViewChange],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => onViewChange(homeRef.current), [onViewChange]);
  const isDragging = useCallback(() => dragRef.current?.moved === true, []);

  return { onWheel, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, isDragging };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/canvas/useOrbit.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/useOrbit.ts src/canvas/useOrbit.test.ts
git commit -m "orbit a trial view with pointer gestures"
```

---

### Task 9: The `job` capability types

**Files:**
- Create: `src/job/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/job/types.ts

/** What a running job reports as it goes. `total` may arrive at any point and may
 *  arrive more than once; a job that cannot count up front simply never sends it.
 *
 *  `failed` is a first-class event rather than a thrown error because these
 *  failures are per item: a run with two failed items is a partial success, and
 *  its other items are worth showing. */
export type JobEvent<T> =
  | { kind: 'total'; total: number }
  | { kind: 'item'; item: T }
  | { kind: 'failed'; index: number; error: string };

/** Where a job is. `idle` before its first run and after a cancel; `done` when the
 *  iterable finished, whether or not items failed. */
export type JobStatus = 'idle' | 'running' | 'done' | 'error';

/** Declares that an instrument has work too slow to do during a render: what to
 *  run, when to re-run it, and how each result folds into state. */
export interface JobCapability<TS = unknown, TC = unknown, TItem = unknown> {
  /** Re-run whenever this value changes, compared shallowly. A job with no `key`
   *  runs only when something calls `start()`. */
  key?: (config: TC, state: TS) => readonly unknown[];
  /** Start on mount and on every `key` change. Default false. */
  auto?: boolean;
  run: (args: {
    config: TC;
    state: TS;
    signal: AbortSignal;
  }) => AsyncIterable<JobEvent<TItem>>;
  /** Fold one result into state. Called once per `item` event, in arrival order. */
  onItem: (item: TItem, state: TS) => TS;
}

/** What `RenderContext.job` exposes. Present only when the instrument declares the
 *  capability; `undefined` otherwise. */
export interface JobHandle {
  status: JobStatus;
  done: number;
  /** Null until the job reports a total, or if it never does. */
  total: number | null;
  failures: readonly { index: number; error: string }[];
  /** The error that ended the run, when `status` is `'error'`. */
  error: string | null;
  start: () => void;
  cancel: () => void;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/job/types.ts
git commit -m "type a job: progress, per-item failure, and a handle"
```

---

### Task 10: The job runtime

Owns starting, aborting on unmount and on a `key` change, discarding results from a superseded run, and counting. A run is identified by a monotonic token; every result checks its token before touching state, which is what makes a superseded run harmless rather than a race.

**Files:**
- Create: `src/job/useJob.ts`
- Test: `src/job/useJob.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/job/useJob.test.tsx
import { act, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { JobCapability, JobHandle } from './types';
import { useJob } from './useJob';

interface State {
  items: number[];
}

/** Yields 1..n, pausing between each so a test can cancel mid-run. */
async function* counter(n: number, signal: AbortSignal, failAt?: number) {
  yield { kind: 'total' as const, total: n };
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setTimeout(r, 1));
    if (signal.aborted) return;
    if (i === failAt) {
      yield { kind: 'failed' as const, index: i, error: 'frame died' };
      continue;
    }
    yield { kind: 'item' as const, item: i };
  }
}

interface HarnessProps {
  capability: JobCapability<State, { n: number }, number>;
  config: { n: number };
  onHandle: (h: JobHandle, s: State) => void;
}

function Harness({ capability, config, onHandle }: HarnessProps) {
  const [state, setState] = useState<State>({ items: [] });
  const job = useJob({ capability, config, state, setState });
  onHandle(job, state);
  return null;
}

const capability = (failAt?: number): JobCapability<State, { n: number }, number> => ({
  run: ({ config, signal }) => counter(config.n, signal, failAt),
  onItem: (item, state) => ({ items: [...state.items, item] }),
});

describe('useJob', () => {
  it('folds each item into state and counts progress', async () => {
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={capability()}
        config={{ n: 3 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('done'));
    expect(state.items).toEqual([0, 1, 2]);
    expect(handle?.done).toBe(3);
    expect(handle?.total).toBe(3);
  });

  it('counts a failed item without ending the run', async () => {
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={capability(1)}
        config={{ n: 3 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('done'));
    expect(state.items).toEqual([0, 2]);
    expect(handle?.failures).toEqual([{ index: 1, error: 'frame died' }]);
  });

  it('stops folding results once cancelled', async () => {
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={capability()}
        config={{ n: 50 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('running'));
    act(() => handle?.cancel());
    const atCancel = state.items.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(state.items.length).toBe(atCancel);
    expect(handle?.status).toBe('idle');
  });

  it('discards results from a run its key superseded', async () => {
    const withKey: JobCapability<State, { n: number }, number> = {
      ...capability(),
      key: (config) => [config.n],
      auto: true,
    };
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    const { rerender } = render(
      <Harness
        capability={withKey}
        config={{ n: 40 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    await waitFor(() => expect(handle?.status).toBe('running'));

    rerender(
      <Harness
        capability={withKey}
        config={{ n: 2 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    await waitFor(() => expect(handle?.status).toBe('done'));

    // The superseded 40-item run cannot have contributed: the winner yields two.
    expect(state.items).toEqual([0, 1]);
  });

  it('aborts on unmount', async () => {
    const aborted = vi.fn();
    const watching: JobCapability<State, { n: number }, number> = {
      run: ({ signal }) => {
        signal.addEventListener('abort', aborted);
        return counter(50, signal);
      },
      onItem: (item, state) => ({ items: [...state.items, item] }),
    };
    let handle: JobHandle | null = null;
    const { unmount } = render(
      <Harness
        capability={watching}
        config={{ n: 50 }}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('running'));
    unmount();
    expect(aborted).toHaveBeenCalled();
  });

  it('reports a thrown error without losing the items already folded', async () => {
    const throwing: JobCapability<State, { n: number }, number> = {
      run: async function* () {
        yield { kind: 'item', item: 7 };
        throw new Error('the baker died');
      },
      onItem: (item, state) => ({ items: [...state.items, item] }),
    };
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={throwing}
        config={{ n: 1 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('error'));
    expect(handle?.error).toMatch(/the baker died/);
    expect(state.items).toEqual([7]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/job/useJob.test.tsx`
Expected: FAIL — `Failed to resolve import "./useJob"`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/job/useJob.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobCapability, JobHandle, JobStatus } from './types';

export interface UseJobOptions<TS, TC, TItem> {
  capability: JobCapability<TS, TC, TItem>;
  config: TC;
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
}

interface Progress {
  status: JobStatus;
  done: number;
  total: number | null;
  failures: { index: number; error: string }[];
  error: string | null;
}

const IDLE: Progress = { status: 'idle', done: 0, total: null, failures: [], error: null };

function sameKey(a: readonly unknown[] | null, b: readonly unknown[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

export function useJob<TS, TC, TItem>({
  capability,
  config,
  state,
  setState,
}: UseJobOptions<TS, TC, TItem>): JobHandle {
  const [progress, setProgress] = useState<Progress>(IDLE);

  // A run is identified by a token. Every result checks its token before touching
  // state, so a superseded run finishes harmlessly instead of racing the winner.
  const token = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // Read through refs: `run` is called once per run and must see the values as of
  // that moment, not re-subscribe every render.
  const capRef = useRef(capability);
  capRef.current = capability;
  const configRef = useRef(config);
  configRef.current = config;
  const stateRef = useRef(state);
  stateRef.current = state;
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  const cancel = useCallback(() => {
    token.current += 1;
    abort.current?.abort();
    abort.current = null;
    setProgress(IDLE);
  }, []);

  const start = useCallback(() => {
    token.current += 1;
    const mine = token.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ ...IDLE, status: 'running' });

    void (async () => {
      try {
        const iterable = capRef.current.run({
          config: configRef.current,
          state: stateRef.current,
          signal: controller.signal,
        });
        for await (const event of iterable) {
          if (token.current !== mine) return;
          if (event.kind === 'total') {
            setProgress((p) => ({ ...p, total: event.total }));
          } else if (event.kind === 'failed') {
            setProgress((p) => ({
              ...p,
              failures: [...p.failures, { index: event.index, error: event.error }],
            }));
          } else {
            const fold = capRef.current.onItem;
            setStateRef.current((prev) => fold(event.item, prev));
            setProgress((p) => ({ ...p, done: p.done + 1 }));
          }
        }
        if (token.current !== mine) return;
        setProgress((p) => ({ ...p, status: 'done' }));
      } catch (err) {
        if (token.current !== mine) return;
        setProgress((p) => ({
          ...p,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
  }, []);

  // Re-run when the declared key changes. `auto` also covers the first mount.
  const lastKey = useRef<readonly unknown[] | null>(null);
  const auto = capability.auto === true;
  const key = capability.key ? capability.key(config, state) : null;
  useEffect(() => {
    if (!auto) return;
    if (sameKey(lastKey.current, key) && lastKey.current !== null) return;
    lastKey.current = key;
    start();
    // `key` is compared by value above; depending on the array identity would
    // restart the job on every render.
  }, [auto, key, start]);

  useEffect(
    () => () => {
      token.current += 1;
      abort.current?.abort();
      abort.current = null;
    },
    [],
  );

  return {
    status: progress.status,
    done: progress.done,
    total: progress.total,
    failures: progress.failures,
    error: progress.error,
    start,
    cancel,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/job/useJob.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/job/useJob.ts src/job/useJob.test.tsx
git commit -m "run an instrument's long work with progress and per-item failure"
```

---

### Task 11: Wire the job into the trial

Declaring the capability is what earns the chrome — a progress readout and a cancel control in the trial's status area, so a lab does not rewrite them.

**Files:**
- Modify: `src/instrument/types.ts` (add `job` to `Instrument`, `job` to `RenderContext`)
- Modify: `src/trial/Trial.tsx` (call `useJob`, put the handle on `renderCtx`)
- Modify: `src/trial/TrialChrome.tsx` (render the readout)
- Modify: `src/trial/Trial.less` (the readout's styles)
- Test: `src/trial/Trial.job.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/trial/Trial.job.test.tsx
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

interface S { items: number[] }
interface C { n: number }

const slow = defineInstrument<S, C>({
  name: 'slow',
  defaultConfig: () => ({ n: 3 }),
  initialState: () => ({ items: [] }),
  render: () => null,
  job: {
    run: async function* ({ config, signal }) {
      yield { kind: 'total', total: config.n };
      for (let i = 0; i < config.n; i++) {
        await new Promise((r) => setTimeout(r, 5));
        if (signal.aborted) return;
        yield { kind: 'item', item: i };
      }
    },
    onItem: (item: number, state: S) => ({ items: [...state.items, item] }),
    auto: true,
  },
});

describe('a trial whose instrument declares a job', () => {
  it('shows progress in the trial chrome', async () => {
    render(<Lab title="t" instruments={[slow]} storageKey="job-test" />);
    await waitFor(() => {
      expect(document.querySelector('.lk-trial__job')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.querySelector('.lk-trial__job')?.textContent).toMatch(/3\s*\/\s*3/);
    });
  });

  it('offers a cancel control while running', async () => {
    render(<Lab title="t" instruments={[slow]} storageKey="job-test-2" />);
    const cancel = await waitFor(() => {
      const el = document.querySelector('.lk-trial__job-cancel');
      expect(el).toBeInTheDocument();
      return el as HTMLElement;
    });
    await userEvent.click(cancel);
    await waitFor(() => {
      expect(document.querySelector('.lk-trial__job-cancel')).not.toBeInTheDocument();
    });
  });

  it('renders no job chrome for an instrument that declares none', async () => {
    const plain = defineInstrument<S, C>({
      name: 'plain',
      defaultConfig: () => ({ n: 0 }),
      initialState: () => ({ items: [] }),
      render: () => null,
    });
    render(<Lab title="t" instruments={[plain]} storageKey="job-test-3" />);
    await waitFor(() => {
      expect(document.querySelector('.lk-trial')).toBeInTheDocument();
    });
    expect(document.querySelector('.lk-trial__job')).not.toBeInTheDocument();
  });
});
```

> **Before writing this test, read `src/trial/Trial.test.tsx` and `src/lab/Lab.tsx`** and match how the existing suite mounts a lab. If `<Lab>` needs props this test omits, copy them from the existing tests rather than inventing them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/trial/Trial.job.test.tsx`
Expected: FAIL — `job` is not a known property of an instrument.

- [ ] **Step 3: Wire it up**

In `src/instrument/types.ts`, add the import and the two fields:

```ts
import type { JobCapability, JobHandle } from '../job/types';
```

On `RenderContext`, after `emit`:

```ts
  /** Present only when the instrument declares a `job`. */
  job?: JobHandle;
```

On `Instrument`, after `undo`:

```ts
  job?: JobCapability<TS, TC, never>;
```

> `never` as the item parameter keeps `Instrument` assignable to `Instrument<any, any>` in `InstrumentList`. An instrument written with `defineInstrument<TS, TC>` keeps its own item type; only the erased list form widens.

In `src/trial/Trial.tsx`, add the import:

```tsx
import { useJob } from '../job/useJob';
```

Inside `TrialRuntime`, before `renderCtx` is built:

```tsx
  const jobCap = instrument.job;
  const job = useJob({
    // A trial without the capability still calls the hook — hooks cannot be
    // conditional — with a runner that yields nothing.
    capability: jobCap ?? { run: async function* () {}, onItem: (_i, s) => s },
    config: record.config,
    state: record.state,
    setState: (next) => updateTrialState(record.id, next as never),
  });
```

Add to `renderCtx`, after `emit`:

```tsx
    job: jobCap ? job : undefined,
```

Pass it to the chrome where `<TrialChrome>` is rendered:

```tsx
      job={jobCap ? job : undefined}
```

In `src/trial/TrialChrome.tsx`, add to its props interface:

```tsx
import type { JobHandle } from '../job/types';
```

```tsx
  job?: JobHandle;
```

and render it in the chrome's footer area:

```tsx
      {job ? (
        <div className="lk-trial__job">
          <span className="lk-trial__job-count">
            {job.done}
            {job.total === null ? '' : ` / ${job.total}`}
          </span>
          {job.failures.length > 0 ? (
            <span className="lk-trial__job-failures">{job.failures.length} failed</span>
          ) : null}
          {job.error ? <span className="lk-trial__job-error">{job.error}</span> : null}
          {job.status === 'running' ? (
            <button type="button" className="lk-trial__job-cancel" onClick={job.cancel}>
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
```

Append to `src/trial/Trial.less`:

```less
.lk-trial__job {
  display: flex;
  gap: var(--lk-space-2, 8px);
  align-items: center;
  font-size: 0.75rem;
}

.lk-trial__job-failures,
.lk-trial__job-error {
  color: var(--lk-color-danger, #c0392b);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/trial/ && npm run lint`
Expected: PASS — the 3 new tests plus the existing trial suite, and the class-prefix check clean.

- [ ] **Step 5: Commit**

```bash
git add src/instrument/types.ts src/trial/Trial.tsx src/trial/TrialChrome.tsx src/trial/Trial.less src/trial/Trial.job.test.tsx
git commit -m "give a trial the chrome its job capability earns"
```

---

### Task 12: Export the new surface

**Files:**
- Create: `src/surface/index.ts`
- Create: `src/job/index.ts`
- Modify: `src/index.ts`
- Modify: `package.json` (`exports`)
- Modify: `src/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/index.test.ts`, inside its existing top-level `describe`:

```ts
  it('exports the surface and job entry points', async () => {
    const kit = await import('./index');
    expect(typeof kit.useTiledSurface).toBe('function');
    expect(typeof kit.useSurfaceTile).toBe('function');
    expect(typeof kit.useSurface).toBe('function');
    expect(typeof kit.toDeviceRect).toBe('function');
    expect(typeof kit.useOrbit).toBe('function');
    expect(typeof kit.useJob).toBe('function');
    expect(kit.SurfaceContext).toBeDefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL — `useTiledSurface` is undefined.

- [ ] **Step 3: Add the barrels and exports**

```ts
// src/surface/index.ts
export { composeRects, rectsEqual } from './composeRects';
export { toDeviceRect } from './deviceRect';
export type { Box, Rect } from './rect';
export { SurfaceContext } from './SurfaceContext';
export { useSurface, useSurfaceOptional, useSurfaceTile } from './useSurfaceTile';
export type { SurfaceFrame, SurfaceHandle, UseTiledSurfaceOptions } from './useTiledSurface';
export { useTiledSurface } from './useTiledSurface';
```

```ts
// src/job/index.ts
export type { JobCapability, JobEvent, JobHandle, JobStatus } from './types';
export type { UseJobOptions } from './useJob';
export { useJob } from './useJob';
```

Add to `src/index.ts`, keeping the file's alphabetical ordering:

```ts
export type { OrbitHandlers, OrbitView, UseOrbitOptions, Vec3 } from './canvas/useOrbit';
export { clampPitch, orbitAfterDrag, orbitAfterWheel, PITCH_LIMIT, useOrbit, wrapYaw } from './canvas/useOrbit';
export * from './job';
export * from './surface';
```

Also export the new state type from the existing `./state/types` block:

```ts
export type { ViewTransform2D } from './state/types';
export { DEFAULT_VIEW } from './state/types';
```

Add two subpaths to `package.json` `exports`, matching the shape of the entries already there:

```json
    "./surface": {
      "types": "./dist/surface/index.d.ts",
      "import": "./dist/surface/index.js"
    },
    "./job": {
      "types": "./dist/job/index.d.ts",
      "import": "./dist/job/index.js"
    },
```

- [ ] **Step 4: Run the tests and the build to verify**

Run: `npx vitest run src/index.test.ts && npm run build && npm run test:smoke:consumer`
Expected: PASS, a clean build, and the consumer smoke test green — that last one is what proves the new subpaths resolve from outside the package.

- [ ] **Step 5: Commit**

```bash
git add src/surface/index.ts src/job/index.ts src/index.ts src/index.test.ts package.json
git commit -m "export the surface, job and orbit entry points"
```

---

### Task 13: Document it and cut a changeset

**Files:**
- Create: `src/surface/AGENTS.md`
- Modify: `src/canvas/AGENTS.md`
- Modify: `README.md`
- Create: `.changeset/hosting-a-foreign-renderer.md`

- [ ] **Step 1: Write the surface agent guide**

```markdown
<!-- src/surface/AGENTS.md -->
# Surface — Agent Guide

`src/surface/` lets a lab drive a renderer labkit does not own. labkit publishes
rects, dirtiness, DPR and one rAF; the consumer keeps the GL.

Use this rather than the `canvas` capability when the renderer is not labkit's —
three.js, a raw WebGL context, anything with its own render loop. One
`SceneCanvas` per trial is one WebGL context per trial, and browsers cap those
around 8–16, so more than a few 3D tiles have to share one surface.

## Files

| File | Role |
|---|---|
| `rect.ts` | The `Rect` and `Box` types |
| `composeRects.ts` | Tile boxes into surface-relative rects; both are viewport-relative, so it is a subtraction |
| `deviceRect.ts` | `toDeviceRect` — y-flip and device-grid snapping for a GL viewport |
| `useTiledSurface.ts` | ResizeObserver, dirty set, rAF coalescing, DPR |
| `SurfaceContext.ts` | Carries the handle down |
| `useSurfaceTile.ts` | `useSurfaceTile(id)`, `useSurface()`, `useSurfaceOptional()` |

## Shape of a consumer

```tsx
const surface = useTiledSurface({
  onFrame: ({ dirty, rects, dpr, size }) => {
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.setSize(size.width, size.height, false);
    for (const id of dirty) {
      const rect = rects.get(id);
      if (!rect) continue;
      const v = toDeviceRect(rect, size.height, dpr);
      // ... setViewport / setScissor / render
    }
  },
});
```

`onFrame` carries **every** tile's rect, not only the dirty ones — a scissored
draw has to know where it is drawing relative to a surface that may have resized.

## The unit is a rect, not a trial

`useSurfaceTile(id)` attaches to whatever element the surface should draw into.
A trial may register one, or none: a trial holding a drawn pane beside an undrawn
one contributes a single rect, and a trial with nothing to draw contributes none.

## Traps

- **`preserveDrawingBuffer` is the consumer's job and is usually required.** A
  partial redraw touches one tile; without it the default framebuffer's contents
  are undefined after the page composites and every other tile goes black.
- **Gutters lie outside every scissor.** Clear the whole surface when the tile set
  changes, or a re-tile strands the old tiles' pixels between the new ones.
- **A tile that moves without resizing** is handled — `Workspace` invalidates rects
  off the grid's own placement event. A host that moves something the grid does not
  know about calls `invalidateRects()` itself.

## Testing

No WebGL in the suite. The arithmetic is pure and tested directly; the hook is
tested with `getBoundingClientRect` stubbed per element, because jsdom measures
everything as zero.
```

- [ ] **Step 2: Point the canvas guide at it**

Add to the top of `src/canvas/AGENTS.md`, immediately after the first paragraph:

```markdown
For a renderer labkit does not own — three.js, raw WebGL, anything with its own
render loop — see `src/surface/AGENTS.md` instead. `CanvasStack` is 2D and
schedules its own layers; a foreign renderer wants rects and dirtiness only.

`useOrbit` lives in this directory as the 3D peer of `usePanZoom`, and produces a
trial view rather than a matrix.
```

- [ ] **Step 3: Add a README section**

Add after the existing "Theming" section:

```markdown
## Driving your own renderer

`CanvasStack` is 2D. For three.js or raw WebGL, take rects and dirtiness from
labkit and keep the GL yourself:

```tsx
import { toDeviceRect, useTiledSurface, useSurfaceTile } from '@weasel-js/labkit/surface';
```

See `src/surface/AGENTS.md` for the contract and the traps.

## Long-running work

An instrument with work too slow for a render declares a `job`: labkit starts it,
aborts it on unmount and on a key change, discards superseded results, and renders
progress and a cancel control into the trial chrome.

```tsx
import type { JobCapability } from '@weasel-js/labkit/job';
```
```

- [ ] **Step 4: Write the changeset**

```markdown
<!-- .changeset/hosting-a-foreign-renderer.md -->
---
'@weasel-js/labkit': minor
---

A lab can drive a renderer labkit does not own

`CanvasStack` paints into a 2D context and schedules its own layers, so a
three.js viewer — which brings its own `WebGLRenderer`, its own context and its
own render loop — had nowhere to go. Five additions, from two labs that each
hand-wrote all of it.

**`useTiledSurface`** publishes every tile's rect, marks tiles dirty, delivers
DPR and container size, and coalesces a burst into one `onFrame`. The consumer
keeps the GL: `preserveDrawingBuffer`, the scissor loop and the scene graph stay
outside the package, because a scheduler that knew about them would stop working
for a shared 2D surface. The unit is a **rect**, not a trial — a trial holding a
drawn pane beside an undrawn one registers one, and a trial with nothing to draw
registers none.

A tile that only *moves* reports nothing to a `ResizeObserver`, so `Workspace`
now invalidates rects off the grid's own placement event. Only labkit can see
that; a host was left polling until the rects held still.

**`toDeviceRect`** flips a DOM rect to a GL viewport's bottom-left origin and
snaps both edges to the device-pixel grid. Unsnapped, a tile and its neighbour
round apart and strand a hairline column between them.

**A trial's `view` is now opaque to labkit.** It was `{ zoom, pan }`, and it is
the only camera state labkit persists, restores on Reset and shows in the
sidebar — so a 3D lab kept a parallel view and forfeited all three. `view` is now
a type parameter with the 2D shape as its default; labkit persists it and never
reads inside it. Nothing written against the 2D view changes. `initialView.fit`
and `fitTo()` are 2D operations and remain available only for the default shape.

**`useOrbit`** is the 3D peer of `usePanZoom`: drag to turn, wheel or pinch to
dolly, double-click to go home. Trigonometry only — it imports no renderer.

**A `job` capability** for work too slow to do during a render. The runtime
starts it, aborts on unmount and on a `key` change, discards results from a
superseded run, counts progress, and renders a readout and a cancel control into
the trial chrome. Per-item failure is a first-class event rather than a thrown
error, because a run with two failed items is a partial success and its other
items are worth showing.
```

- [ ] **Step 5: Run everything and commit**

Run: `npm test && npm run lint && npm run build`
Expected: the full suite green, Biome and the class-prefix check clean, a successful build.

```bash
git add src/surface/AGENTS.md src/canvas/AGENTS.md README.md .changeset/hosting-a-foreign-renderer.md
git commit -m "document driving your own renderer, and cut a changeset"
```

---

## Self-review notes

**Spec coverage.** Every numbered addition in the spec has a task: `useTiledSurface` (4–6, including all three corrections — rect-not-trial in Task 5, placement invalidation in Task 6, the name throughout), `toDeviceRect` (2), the opaque view (7), `useOrbit` (8), the `job` capability (9–11). Exports and docs are 12–13.

**Not covered here, deliberately.** The `apps/lab` half of the spec is a separate plan, written once this one lands so it targets the API that actually shipped rather than the API this plan predicts.

**Known risk in Task 7.** The plan shows the type changes but cannot show every call site that breaks, because `TrialRecord['view']` is read in files this plan does not enumerate. Step 4 runs `tsc` across the package for exactly that reason — treat any error it reports as part of the task, and prefer widening the reader to `unknown` over re-asserting the 2D shape.

**Known risk in Task 11.** `useJob` is called unconditionally with a no-op runner for instruments that declare no job, because hooks cannot be conditional. If that reads badly in review, the alternative is splitting `TrialRuntime` into a job-bearing and a plain variant — more code, clearer contract.
