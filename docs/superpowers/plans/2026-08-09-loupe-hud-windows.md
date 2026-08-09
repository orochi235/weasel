# Loupe + hud window primitive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a draggable, resizable window primitive in `@weasel-js/hud`, and a loupe (magnifier) on top of it that shows either a re-rendered scene at N× or the actual framebuffer at 1:1 device pixels.

**Architecture:** A hud `window` widget owns the frame — titlebar, eight grab zones, close box, move/resize drags — and paints *no* interior, leaving a hole. Content is supplied by an optional `content()` painter on the widget, which the hud layer draws beneath all widget frames in the same layer (order guaranteed, desync impossible). The loupe is a window whose painter is either a `createViewportLayer` lens (vector mode) or a framebuffer readback drawn as an image (pixel mode).

**Tech Stack:** TypeScript, WebGL2, React 19, vitest, `@weasel-js/core` (renderer + viewports), `@weasel-js/hud`, `@weasel-js/theme`.

**Spec:** `docs/superpowers/specs/2026-08-09-loupe-hud-windows-design.md`

---

## File Structure

**Create:**
- `packages/hud/src/widgets/window/zones.ts` — pure zone geometry: which grab zone a point is in, what a drag does to bounds, where the content rect is. No GL, no widget state.
- `packages/hud/src/widgets/window/zones.test.ts`
- `packages/hud/src/widgets/window/window.ts` — the `WindowWidget`: draw, hit-test, pointer/drag state.
- `packages/hud/src/widgets/window/window.test.ts`
- `packages/hud/src/loupe/innerView.ts` — pure inner-view derivation for vector mode.
- `packages/hud/src/loupe/innerView.test.ts`
- `packages/hud/src/loupe/readback.ts` — framebuffer → `ImageBitmap` for pixel mode.
- `packages/hud/src/loupe/createLoupe.ts` — assembly: window + painter + pointer feed.
- `packages/hud/src/loupe/createLoupe.test.ts`

**Modify:**
- `packages/core/src/renderer/DrawCommand.ts` — `sampling` on `ImageDrawCommand`.
- `packages/core/src/renderer/draw.ts` — honor it at bind time.
- `packages/hud/src/widget.ts` — optional `contentRect` / `content` on `Widget`; fix the stale hover comment.
- `packages/hud/src/attach.ts` — two-pass layer draw (content, then frames).
- `packages/hud/src/hud.ts` — `window()` factory.
- `packages/hud/src/index.ts` — exports.
- `packages/hud/src/widgets/image.ts` — `sampling` passthrough.
- `apps/draw/src/` — loupe toggle + DOM controls.

Zone geometry is split from the widget because it is the part with real edge cases (corner precedence, min-size clamping on west/north drags) and it tests without any GL or widget scaffolding.

---

### Task 1: `sampling` on image draws

Pixel mode is blurry without this. `GLImageCache` hardcodes `TEXTURE_MAG_FILTER` to `LINEAR` at upload; the texture is cached by bitmap identity, so the filter must be set at *bind* time instead, per draw.

**Files:**
- Modify: `packages/core/src/renderer/DrawCommand.ts:104-112`
- Modify: `packages/core/src/renderer/draw.ts:1257`
- Test: `packages/core/src/renderer/draw.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the existing top-level `describe` in `packages/core/src/renderer/draw.test.ts` (the one holding `r` and `recorder` — the same scope as the `uploads identity u_colorMatrix on image draws` test at the end of the file):

```ts
  it('sets NEAREST mag filter for sampling:"nearest" image draws', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = {
      kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64, sampling: 'nearest',
    };
    r.render([cmd]);
    const magCalls = recorder.calls.filter(
      (c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER,
    );
    expect(magCalls.at(-1)?.args[2]).toBe(recorder.gl.NEAREST);
  });

  it('defaults to LINEAR mag filter when sampling is omitted', () => {
    const fakeBitmap = { width: 16, height: 16, close: () => {} } as unknown as ImageBitmap;
    const cmd: DrawCommand = { kind: 'image', image: fakeBitmap, x: 0, y: 0, w: 64, h: 64 };
    r.render([cmd]);
    const magCalls = recorder.calls.filter(
      (c) => c.name === 'texParameteri' && c.args[1] === recorder.gl.TEXTURE_MAG_FILTER,
    );
    expect(magCalls.at(-1)?.args[2]).toBe(recorder.gl.LINEAR);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/renderer/draw.test.ts -t 'NEAREST mag filter'`
Expected: FAIL — TypeScript rejects `sampling` on `ImageDrawCommand`, or the assertion sees `LINEAR`.

If the failure is instead `expected undefined to be undefined` on both filters, `makeGLRecorder` is not exposing `NEAREST` / `TEXTURE_MAG_FILTER`. Add them to the constant table in `packages/core/src/renderer/test-utils/glRecorder.ts` (`NEAREST: 0x2600`, `LINEAR: 0x2601`, `TEXTURE_MAG_FILTER: 0x2800`) before continuing.

- [ ] **Step 3: Add the field**

In `packages/core/src/renderer/DrawCommand.ts`, replace the `ImageDrawCommand` interface:

```ts
export interface ImageDrawCommand {
  kind: 'image';
  image: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  /** Magnification filter. `'linear'` (default) smooths; `'nearest'` shows
   *  device pixels as hard squares — required by anything magnifying a
   *  framebuffer readback, where blur destroys the point of the readback. */
  sampling?: 'linear' | 'nearest';
}
```

- [ ] **Step 4: Honor it at bind time**

In `packages/core/src/renderer/draw.ts`, in `drawImage`, replace the single line at 1257:

```ts
  ctx.imageCache.bind(cmd.image, 0);
```

with:

```ts
  ctx.imageCache.bind(cmd.image, 0);
  // Set per-draw, not at upload: GLImageCache keys textures by bitmap
  // identity, so the same bitmap can be drawn at both filters in one frame.
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    cmd.sampling === 'nearest' ? gl.NEAREST : gl.LINEAR,
  );
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/core/src/renderer/draw.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/DrawCommand.ts packages/core/src/renderer/draw.ts packages/core/src/renderer/draw.test.ts
git commit -m "feat(renderer): per-command magnification filter on image draws"
```

---

### Task 2: `sampling` passthrough on the hud image widget

**Files:**
- Modify: `packages/hud/src/widgets/image.ts`
- Test: `packages/hud/src/widgets/image.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/hud/src/widgets/image.test.ts`:

```ts
  it('forwards sampling to the image draw command', () => {
    const bmp = { width: 4, height: 4, close: () => {} } as unknown as ImageBitmap;
    const w = createImage({ id: 'i', x: 0, y: 0, w: 40, h: 40, image: bmp, sampling: 'nearest' });
    const cmd = w.draw(ctx)[0];
    expect(cmd).toMatchObject({ kind: 'image', sampling: 'nearest' });
  });
```

If `ctx` is not already defined in that file, add at the top, after the imports:

```ts
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'D', tokens: resolveTheme(weaselTheme, 'dark') };
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/widgets/image.test.ts -t 'forwards sampling'`
Expected: FAIL — `sampling` not accepted in `ImageOptions`.

- [ ] **Step 3: Add the option and emit it**

In `packages/hud/src/widgets/image.ts`, add to `ImageOptions` after `opacity?: number;`:

```ts
  /** Magnification filter for the drawn bitmap. See `ImageDrawCommand.sampling`. */
  sampling?: 'linear' | 'nearest';
```

and add `sampling: opts.sampling,` to the `ImageDrawCommand` literal in `draw`, after `opacity: opts.opacity,`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/hud/src/widgets/image.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hud/src/widgets/image.ts packages/hud/src/widgets/image.test.ts
git commit -m "feat(hud): sampling option on the image widget"
```

---

### Task 3: Window zone geometry

Pure functions. `zoneAt` resolves corners before edges (a corner point is inside two edge bands and the corner must win), the close box before the titlebar, and everything before content.

**Files:**
- Create: `packages/hud/src/widgets/window/zones.ts`
- Test: `packages/hud/src/widgets/window/zones.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/hud/src/widgets/window/zones.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { zoneAt, windowContentRect, applyWindowDrag, DEFAULT_WINDOW_METRICS as M } from './zones';

const B = { x: 100, y: 100, w: 200, h: 150 };

describe('zoneAt', () => {
  it('returns null outside the bounds', () => {
    expect(zoneAt(B, M, 99, 100)).toBe(null);
    expect(zoneAt(B, M, 300, 250)).toBe(null);
  });

  it('resolves corners before edges', () => {
    expect(zoneAt(B, M, 101, 101)).toBe('nw');
    expect(zoneAt(B, M, 299, 101)).toBe('ne');
    expect(zoneAt(B, M, 101, 249)).toBe('sw');
    expect(zoneAt(B, M, 299, 249)).toBe('se');
  });

  it('resolves the four edges away from corners', () => {
    expect(zoneAt(B, M, 200, 101)).toBe('n');
    expect(zoneAt(B, M, 200, 249)).toBe('s');
    expect(zoneAt(B, M, 101, 175)).toBe('w');
    expect(zoneAt(B, M, 299, 175)).toBe('e');
  });

  it('resolves the close box inside the titlebar, at the right', () => {
    // close box is right-aligned in the titlebar with `edge` padding
    expect(zoneAt(B, M, 300 - M.edge - M.closeSize / 2, 100 + M.titleH / 2)).toBe('close');
  });

  it('resolves the titlebar left of the close box', () => {
    expect(zoneAt(B, M, 150, 100 + M.titleH / 2)).toBe('title');
  });

  it('resolves everything else as content', () => {
    expect(zoneAt(B, M, 200, 200)).toBe('content');
  });
});

describe('windowContentRect', () => {
  it('insets by the border on three sides and the titlebar on top', () => {
    expect(windowContentRect(B, M)).toEqual({
      x: 100 + M.edge,
      y: 100 + M.titleH,
      w: 200 - M.edge * 2,
      h: 150 - M.titleH - M.edge,
    });
  });
});

describe('applyWindowDrag', () => {
  it('title translates without resizing', () => {
    expect(applyWindowDrag(B, 'title', 10, -5, 80, 60)).toEqual({ x: 110, y: 95, w: 200, h: 150 });
  });

  it('east grows width only', () => {
    expect(applyWindowDrag(B, 'e', 20, 99, 80, 60)).toEqual({ x: 100, y: 100, w: 220, h: 150 });
  });

  it('west moves the left edge and keeps the right edge fixed', () => {
    expect(applyWindowDrag(B, 'w', 20, 0, 80, 60)).toEqual({ x: 120, y: 100, w: 180, h: 150 });
  });

  it('west clamps at min width without moving the right edge', () => {
    const r = applyWindowDrag(B, 'w', 500, 0, 80, 60);
    expect(r).toEqual({ x: 220, y: 100, w: 80, h: 150 });
    expect(r.x + r.w).toBe(B.x + B.w);
  });

  it('north clamps at min height without moving the bottom edge', () => {
    const r = applyWindowDrag(B, 'n', 0, 500, 80, 60);
    expect(r).toEqual({ x: 100, y: 190, w: 200, h: 60 });
    expect(r.y + r.h).toBe(B.y + B.h);
  });

  it('south-east grows both axes and clamps both at the minimum', () => {
    expect(applyWindowDrag(B, 'se', 10, 10, 80, 60)).toEqual({ x: 100, y: 100, w: 210, h: 160 });
    expect(applyWindowDrag(B, 'se', -500, -500, 80, 60)).toEqual({ x: 100, y: 100, w: 80, h: 60 });
  });

  it('content and close never change bounds', () => {
    expect(applyWindowDrag(B, 'content', 40, 40, 80, 60)).toEqual(B);
    expect(applyWindowDrag(B, 'close', 40, 40, 80, 60)).toEqual(B);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/widgets/window/zones.test.ts`
Expected: FAIL — `Failed to resolve import "./zones"`.

- [ ] **Step 3: Implement**

Create `packages/hud/src/widgets/window/zones.ts`:

```ts
import type { WidgetBounds } from '../../widget';

export type WindowZone =
  | 'title' | 'close' | 'content'
  | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface WindowMetrics {
  /** Titlebar height in CSS px. */
  titleH: number;
  /** Grab-zone thickness on each side, and the frame inset, in CSS px. */
  edge: number;
  /** Side length of the square close box. */
  closeSize: number;
}

export const DEFAULT_WINDOW_METRICS: WindowMetrics = { titleH: 24, edge: 6, closeSize: 14 };

/** The eight resize zones a drag can start in, plus title/close/content. */
export function zoneAt(
  b: WidgetBounds,
  m: WindowMetrics,
  x: number,
  y: number,
): WindowZone | null {
  if (x < b.x || x >= b.x + b.w || y < b.y || y >= b.y + b.h) return null;

  const west  = x < b.x + m.edge;
  const east  = x >= b.x + b.w - m.edge;
  const north = y < b.y + m.edge;
  const south = y >= b.y + b.h - m.edge;

  if (north && west) return 'nw';
  if (north && east) return 'ne';
  if (south && west) return 'sw';
  if (south && east) return 'se';
  if (north) return 'n';
  if (south) return 's';
  if (west) return 'w';
  if (east) return 'e';

  if (y < b.y + m.titleH) {
    const cx = b.x + b.w - m.edge - m.closeSize;
    return x >= cx ? 'close' : 'title';
  }
  return 'content';
}

/** Interior rect: below the titlebar, inside the frame on the other three sides. */
export function windowContentRect(b: WidgetBounds, m: WindowMetrics): WidgetBounds {
  return {
    x: b.x + m.edge,
    y: b.y + m.titleH,
    w: b.w - m.edge * 2,
    h: b.h - m.titleH - m.edge,
  };
}

/**
 * Bounds after dragging `zone` by `(dx, dy)` from `start`.
 *
 * West and north drags move an edge while the opposite edge stays put, so
 * clamping to the minimum has to hold that opposite edge — clamping width
 * alone would walk the window sideways once it bottoms out.
 */
export function applyWindowDrag(
  start: WidgetBounds,
  zone: WindowZone,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
): WidgetBounds {
  if (zone === 'title') return { ...start, x: start.x + dx, y: start.y + dy };
  if (zone === 'content' || zone === 'close') return { ...start };

  let { x, y, w, h } = start;
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  if (zone === 'w' || zone === 'nw' || zone === 'sw') {
    w = Math.max(minW, start.w - dx);
    x = right - w;
  } else if (zone === 'e' || zone === 'ne' || zone === 'se') {
    w = Math.max(minW, start.w + dx);
  }

  if (zone === 'n' || zone === 'nw' || zone === 'ne') {
    h = Math.max(minH, start.h - dy);
    y = bottom - h;
  } else if (zone === 's' || zone === 'sw' || zone === 'se') {
    h = Math.max(minH, start.h + dy);
  }

  return { x, y, w, h };
}

/** CSS cursor for a zone, for the host to apply on hover. */
export function cursorForZone(zone: WindowZone): string {
  switch (zone) {
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'nw': case 'se': return 'nwse-resize';
    case 'title': return 'move';
    default: return 'default';
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/hud/src/widgets/window/zones.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/hud/src/widgets/window/zones.ts packages/hud/src/widgets/window/zones.test.ts
git commit -m "feat(hud): window zone geometry"
```

---

### Task 4: The window widget

The frame paints the titlebar, a border ring, the title, and the close glyph — **and deliberately does not fill the interior.** The interior is a hole so the content painter (drawn earlier in the same layer, Task 6) shows through. A content source that needs opacity paints its own background.

**Files:**
- Create: `packages/hud/src/widgets/window/window.ts`
- Test: `packages/hud/src/widgets/window/window.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/hud/src/widgets/window/window.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createWindow } from './window';
import { DEFAULT_WINDOW_METRICS as M } from './zones';

const ctx = {
  dims: { width: 800, height: 600 },
  defaultFont: 'D',
  tokens: resolveTheme(weaselTheme, 'dark'),
};

const opts = { id: 'w', x: 100, y: 100, w: 200, h: 150, title: 'Loupe' };

describe('window widget', () => {
  it('draws a titlebar, a border ring, a title and a close glyph', () => {
    const win = createWindow(opts);
    const cmds = win.draw(ctx);
    expect(cmds.filter((c) => c.kind === 'path').length).toBeGreaterThanOrEqual(3);
    expect(cmds.some((c) => c.kind === 'text')).toBe(true);
  });

  it('does not fill the interior — the content hole stays open', () => {
    const win = createWindow(opts);
    const filledRects = win.draw(ctx).filter(
      (c) => c.kind === 'path' && c.path.kind === 'rect' && c.fill !== undefined,
    );
    // No filled rect may cover the content rect's center.
    const cr = win.contentRect;
    const cx = cr.x + cr.w / 2, cy = cr.y + cr.h / 2;
    const covers = filledRects.some((c) => {
      const p = (c as { path: { x: number; y: number; width: number; height: number } }).path;
      return cx >= p.x && cx < p.x + p.width && cy >= p.y && cy < p.y + p.height;
    });
    expect(covers).toBe(false);
  });

  it('hitTest covers the whole window including the interior', () => {
    const win = createWindow(opts);
    expect(win.hitTest(200, 200)).toBe(true);
    expect(win.hitTest(99, 100)).toBe(false);
  });

  it('claims every press so nothing falls through to the scene', () => {
    const win = createWindow(opts);
    expect(win.onPointer({ type: 'down', x: 200, y: 200, native: null })).toBe('claim');
  });

  it('drags the titlebar to move, and reports via onMove', () => {
    const onMove = vi.fn();
    const win = createWindow({ ...opts, onMove });
    win.onPointer({ type: 'down', x: 150, y: 100 + M.titleH / 2, native: null });
    win.onPointer({ type: 'move', x: 170, y: 100 + M.titleH / 2 + 10, native: null });
    expect(win.bounds).toMatchObject({ x: 120, y: 110, w: 200, h: 150 });
    expect(onMove).toHaveBeenCalled();
  });

  it('drags the east edge to resize, and reports via onResize', () => {
    const onResize = vi.fn();
    const win = createWindow({ ...opts, onResize });
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'move', x: 329, y: 175, native: null });
    expect(win.bounds).toMatchObject({ x: 100, y: 100, w: 230, h: 150 });
    expect(onResize).toHaveBeenCalled();
  });

  it('cancel restores the bounds the drag started from', () => {
    const win = createWindow(opts);
    win.onPointer({ type: 'down', x: 150, y: 100 + M.titleH / 2, native: null });
    win.onPointer({ type: 'move', x: 250, y: 300, native: null });
    win.onPointer({ type: 'cancel', native: null });
    expect(win.bounds).toMatchObject({ x: 100, y: 100, w: 200, h: 150 });
  });

  it('a press-and-release on the close box fires onClose; a drag off it does not', () => {
    const onClose = vi.fn();
    const win = createWindow({ ...opts, onClose });
    const cx = 300 - M.edge - M.closeSize / 2, cy = 100 + M.titleH / 2;
    win.onPointer({ type: 'down', x: cx, y: cy, native: null });
    win.onPointer({ type: 'up', x: cx, y: cy, native: null });
    expect(onClose).toHaveBeenCalledTimes(1);

    win.onPointer({ type: 'down', x: cx, y: cy, native: null });
    win.onPointer({ type: 'up', x: 150, y: 200, native: null });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('contentRect tracks a resize', () => {
    const win = createWindow(opts);
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'move', x: 329, y: 175, native: null });
    expect(win.contentRect.w).toBe(230 - M.edge * 2);
  });

  it('setBounds clamps to the minimum size', () => {
    const win = createWindow({ ...opts, minW: 80, minH: 60 });
    win.setBounds({ x: 0, y: 0, w: 10, h: 10 });
    expect(win.bounds).toMatchObject({ w: 80, h: 60 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/widgets/window/window.test.ts`
Expected: FAIL — `Failed to resolve import "./window"`.

- [ ] **Step 3: Implement**

Create `packages/hud/src/widgets/window/window.ts`:

```ts
import type {
  Widget, WidgetBounds, HudDrawCtx, HudContentCtx, HudPointerEvent, PointerClaim,
} from '../../widget';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { textCommand, pathFromD } from '@weasel-js/core';
import {
  zoneAt, windowContentRect, applyWindowDrag, cursorForZone,
  DEFAULT_WINDOW_METRICS, type WindowMetrics, type WindowZone,
} from './zones';

export interface WindowOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  title: string;
  minW?: number;
  minH?: number;
  metrics?: Partial<WindowMetrics>;
  /** Paints the interior. Drawn beneath every widget frame, clipped to
   *  `contentRect`. Receives the scene data and view the hud layer was
   *  handed — the one place hud sees either. */
  content?: (ctx: HudContentCtx) => DrawCommand[];
  onMove?: (b: WidgetBounds) => void;
  onResize?: (b: WidgetBounds) => void;
  onClose?: () => void;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose(). */
  removeFromHud?: () => void;
}

export interface WindowWidget extends Widget {
  readonly contentRect: WidgetBounds;
  /** CSS cursor for the last hovered zone; `'default'` when not hovered. */
  readonly cursor: string;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  setTitle(title: string): void;
  dispose(): void;
}

export function createWindow(opts: WindowOptions): WindowWidget {
  const m: WindowMetrics = { ...DEFAULT_WINDOW_METRICS, ...opts.metrics };
  const minW = opts.minW ?? 80;
  const minH = opts.minH ?? m.titleH + m.edge + 40;

  const clamp = (b: WidgetBounds): WidgetBounds => ({
    x: b.x, y: b.y, w: Math.max(minW, b.w), h: Math.max(minH, b.h),
  });

  let disposed = false;
  let hidden = false;
  let title = opts.title;
  let bounds = clamp({ x: opts.x, y: opts.y, w: opts.w, h: opts.h });
  let dragZone: WindowZone | null = null;
  let dragStart: WidgetBounds = bounds;
  let dragOrigin = { x: 0, y: 0 };
  let hoverZone: WindowZone | null = null;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  const closeBox = (): WidgetBounds => ({
    x: bounds.x + bounds.w - m.edge - m.closeSize,
    y: bounds.y + (m.titleH - m.closeSize) / 2,
    w: m.closeSize,
    h: m.closeSize,
  });

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get contentRect() { return windowContentRect(bounds, m); },
    get cursor() { return hoverZone ? cursorForZone(hoverZone) : 'default'; },
    content: opts.content,

    setBounds(b) { assertNotDisposed(); bounds = clamp(b); opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setTitle(t) { assertNotDisposed(); title = t; opts.onChange?.(); },

    draw(ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const out: DrawCommand[] = [];

      const titlebar: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: m.titleH },
        fill: { fill: 'solid', color: ctx.tokens['--wzl-surface-raised'] },
      };
      out.push(titlebar);

      // Border ring: a stroked rect, no fill, so the interior stays a hole
      // for the content painter drawn beneath this widget.
      const ring: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: h },
        stroke: { paint: { fill: 'solid', color: ctx.tokens['--wzl-border'] }, width: 1 },
      };
      out.push(ring);

      out.push(textCommand(x + m.edge + 2, y + m.titleH / 2 + 4, title, {
        fontFamily: ctx.defaultFont,
        fontSize: 12,
        fill: { fill: 'solid', color: ctx.tokens['--wzl-fg-muted'] },
      }));

      const c = closeBox();
      const inset = 3;
      const x0 = c.x + inset, y0 = c.y + inset;
      const x1 = c.x + c.w - inset, y1 = c.y + c.h - inset;
      out.push({
        kind: 'path',
        path: pathFromD(`M ${x0} ${y0} L ${x1} ${y1} M ${x1} ${y0} L ${x0} ${y1}`),
        stroke: { paint: { fill: 'solid', color: ctx.tokens['--wzl-fg-muted'] }, width: 1.5, cap: 'round' },
      });

      return out;
    },

    hitTest(px, py) {
      if (hidden) return false;
      return zoneAt(bounds, m, px, py) !== null;
    },

    onPointer(evt: HudPointerEvent): PointerClaim {
      switch (evt.type) {
        case 'down': {
          dragZone = zoneAt(bounds, m, evt.x, evt.y);
          dragStart = bounds;
          dragOrigin = { x: evt.x, y: evt.y };
          // Claim unconditionally: an unclaimed press inside the window
          // reaches the scene beneath it and acts on the wrong thing.
          return 'claim';
        }
        case 'move': {
          if (!dragZone) return 'claim';
          const next = applyWindowDrag(
            dragStart, dragZone, evt.x - dragOrigin.x, evt.y - dragOrigin.y, minW, minH,
          );
          if (next.x !== bounds.x || next.y !== bounds.y || next.w !== bounds.w || next.h !== bounds.h) {
            bounds = next;
            (dragZone === 'title' ? opts.onMove : opts.onResize)?.(bounds);
            opts.onChange?.();
          }
          return 'claim';
        }
        case 'up': {
          if (dragZone === 'close' && zoneAt(bounds, m, evt.x, evt.y) === 'close') {
            opts.onClose?.();
          }
          dragZone = null;
          return 'claim';
        }
        case 'cancel': {
          if (dragZone) {
            bounds = dragStart;
            dragZone = null;
            opts.onChange?.();
          }
          return 'claim';
        }
        case 'hovermove': {
          const z = zoneAt(bounds, m, evt.x, evt.y);
          if (z !== hoverZone) { hoverZone = z; opts.onChange?.(); }
          return 'pass';
        }
        case 'hoverleave': {
          if (hoverZone) { hoverZone = null; opts.onChange?.(); }
          return 'pass';
        }
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
```

- [ ] **Step 3b: This will not compile yet**

`HudContentCtx` and `Widget.content` land in Task 5. Do Task 5 before running the tests, then return here.

- [ ] **Step 4: Run tests (after Task 5)**

Run: `npx vitest run packages/hud/src/widgets/window/window.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit (after Task 5)**

```bash
git add packages/hud/src/widgets/window/window.ts packages/hud/src/widgets/window/window.test.ts
git commit -m "feat(hud): draggable, resizable window widget"
```

---

### Task 5: Content painters on the `Widget` protocol

Two optional members, so every existing widget is unaffected.

**Files:**
- Modify: `packages/hud/src/widget.ts`

- [ ] **Step 1: Add the types**

In `packages/hud/src/widget.ts`, add after the `HudDrawCtx` interface:

```ts
/**
 * Input to a widget's optional `content` painter — the one place hud sees
 * the scene. `HudDrawCtx` stays data-free so widgets stay renderable
 * headlessly; this is an explicit opt-in on the composite instead.
 */
export interface HudContentCtx {
  /** Scene data the hud layer was handed. Opaque here; painters that need
   *  it cast to a known shape, as tools do with `ToolCtx.adapter`. */
  data: unknown;
  /** The outer view. A painter deriving an inner view starts from this. */
  view: View;
  dims: { width: number; height: number };
  /** Where the content is painted, in screen-space CSS px. */
  rect: WidgetBounds;
  defaultFont: string;
  tokens: ResolvedTheme;
}
```

Add the import at the top of the file:

```ts
import type { View } from '@weasel-js/core';
```

Then add to the `Widget` interface, after `draw`:

```ts
  /** Optional interior painter, drawn beneath every widget frame and
   *  clipped to `contentRect`. See {@link HudContentCtx}. */
  content?(ctx: HudContentCtx): DrawCommand[];
  /** Region `content` is clipped to. Required when `content` is set. */
  readonly contentRect?: WidgetBounds;
```

- [ ] **Step 2: Fix the stale hover comment**

In the same file, in the `HudPointerEvent` doc block, replace:

```
 * `native` is the originating DOM event when there is one, and `null`
 * otherwise — it is **not** guaranteed. Hover is driven by a direct DOM
 * listener in `attachHud`, so `hovermove` carries the real `PointerEvent`.
 * Press / move / release arrive through the gesture dispatcher, which hands
```

with:

```
 * `native` is the originating DOM event when there is one, and `null`
 * otherwise — it is **not** guaranteed. Hover arrives through the layer's
 * `onUncapturedMove`, so `hovermove` carries the real `PointerEvent` — and,
 * being uncaptured-only, stops for the duration of any drag.
 * Press / move / release arrive through the gesture dispatcher, which hands
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p packages/hud/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/hud/src/widget.ts
git commit -m "feat(hud): optional content painter on the widget protocol"
```

- [ ] **Step 5: Return to Task 4 steps 4-5**

Run the window tests and commit the widget.

---

### Task 6: Two-pass layer draw in `attachHud`

Content for all widgets, then frames for all widgets — so a window frame is never covered by another window's content.

**Files:**
- Modify: `packages/hud/src/attach.ts:51-59`
- Test: `packages/hud/src/attach.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/hud/src/attach.test.ts` (reuse whatever `CanvasExtensionApi` stub the file already defines; if it captures the registered layer, reuse that capture — the assertion below assumes a `layer` variable holding the registered `RenderLayer`):

```ts
  it('draws content beneath frames, clipped to contentRect', () => {
    const hud = createHud();
    const api = makeApi();               // existing helper in this file
    attachHud(api, hud);
    const layer = api.registeredLayer!;  // existing capture in this file

    const win = hud.window({
      id: 'w', x: 10, y: 10, w: 100, h: 80, title: 'T',
      content: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 5, height: 5 }, fill: { fill: 'solid', color: '#f00' } }],
    });

    const cmds = layer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });
    const groupIdx = cmds.findIndex((c) => c.kind === 'group');
    expect(groupIdx).toBe(0);
    const group = cmds[0] as { clip?: { x: number; y: number; width: number; height: number } };
    expect(group.clip).toMatchObject({
      x: win.contentRect.x, y: win.contentRect.y,
      width: win.contentRect.w, height: win.contentRect.h,
    });
    // Frame commands follow the content group.
    expect(cmds.length).toBeGreaterThan(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/attach.test.ts -t 'draws content beneath frames'`
Expected: FAIL — `hud.window is not a function` (added in Task 7), or no group emitted.

- [ ] **Step 3: Implement the two-pass draw**

In `packages/hud/src/attach.ts`, replace the layer's `draw` (lines 51-59):

```ts
    draw: (data, view, dims): DrawCommand[] => {
      const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY, tokens: theme };
      const out: DrawCommand[] = [];
      // Pass 1: interiors. All content precedes all frames so one window's
      // content can never paint over another window's border.
      for (const w of hud.widgets()) {
        if (w.hidden || !w.content || !w.contentRect) continue;
        const rect = w.contentRect;
        if (rect.w <= 0 || rect.h <= 0) continue;
        const children = w.content({
          data, view, dims, rect, defaultFont: DEFAULT_FONT_FAMILY, tokens: theme,
        });
        if (children.length === 0) continue;
        out.push({
          kind: 'group',
          clip: { kind: 'rect', x: rect.x, y: rect.y, width: rect.w, height: rect.h },
          children,
        });
      }
      // Pass 2: frames.
      for (const w of hud.widgets()) {
        if (w.hidden) continue;
        for (const cmd of w.draw(ctx)) out.push(cmd);
      }
      return out;
    },
```

- [ ] **Step 4: Run tests (after Task 7)**

Run: `npx vitest run packages/hud/src/attach.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (after Task 7)**

```bash
git add packages/hud/src/attach.ts packages/hud/src/attach.test.ts
git commit -m "feat(hud): draw content painters beneath widget frames"
```

---

### Task 7: `hud.window()` factory and exports

**Files:**
- Modify: `packages/hud/src/hud.ts`
- Modify: `packages/hud/src/index.ts`
- Test: `packages/hud/src/hud.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/hud/src/hud.test.ts`:

```ts
  it('window() adds the widget and wires onChange to markDirty', () => {
    const hud = createHud();
    const redraw = vi.fn();
    hud.bind({ requestRedraw: redraw, registerLayer: () => () => {} });
    const win = hud.window({ id: 'w', x: 0, y: 0, w: 200, h: 150, title: 'T' });
    expect(hud.widgets()).toContain(win);
    redraw.mockClear();
    win.setTitle('U');
    expect(redraw).toHaveBeenCalled();
  });

  it('a disposed window removes itself from the hud', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const win = hud.window({ id: 'w', x: 0, y: 0, w: 200, h: 150, title: 'T' });
    win.dispose();
    expect(hud.widgets()).not.toContain(win);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/hud.test.ts -t 'window()'`
Expected: FAIL — `hud.window is not a function`.

- [ ] **Step 3: Add the factory**

In `packages/hud/src/hud.ts`, add the import:

```ts
import { createWindow, type WindowOptions, type WindowWidget } from './widgets/window/window';
```

add to the `Hud` interface after `button`:

```ts
  /** Create a window widget, add it to the HUD, and wire onChange → markDirty. */
  window(opts: WindowOptions): WindowWidget;
```

and add to the returned object after `button`:

```ts
    window(opts) {
      let w: WindowWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createWindow({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      list.push(w);
      requestRedraw();
      return w;
    },
```

- [ ] **Step 4: Export from the barrel**

In `packages/hud/src/index.ts`, add:

```ts
export type { WindowOptions, WindowWidget } from './widgets/window/window';
export {
  DEFAULT_WINDOW_METRICS, cursorForZone,
  type WindowZone, type WindowMetrics,
} from './widgets/window/zones';
export type { HudContentCtx } from './widget';
```

- [ ] **Step 5: Run the whole hud suite**

Run: `npx vitest run packages/hud`
Expected: PASS — including the Task 4 and Task 6 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/hud/src/hud.ts packages/hud/src/index.ts packages/hud/src/hud.test.ts
git commit -m "feat(hud): hud.window() factory and exports"
```

Then complete Task 6 steps 4-5.

---

### Task 8: Loupe inner-view math

`View.x/y` is the world point at the canvas top-left and `scale` is px per world unit (`packages/core/src/core/viewport/view.ts`). The inner view must put the aimed world point at the center of a `rect.w × rect.h` viewport at `outer.scale × factor`.

**Files:**
- Create: `packages/hud/src/loupe/innerView.ts`
- Test: `packages/hud/src/loupe/innerView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/hud/src/loupe/innerView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loupeInnerView } from './innerView';

const outer = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const rect = { x: 500, y: 400, w: 200, h: 100 };

describe('loupeInnerView', () => {
  it('multiplies the outer scale by the factor on both axes', () => {
    const v = loupeInnerView({ x: 50, y: 25 }, outer, rect, 8);
    expect(v.scale).toEqual({ x: 16, y: 16 });
  });

  it('centers the aimed world point in the content rect', () => {
    const v = loupeInnerView({ x: 50, y: 25 }, outer, rect, 8);
    // world → inner screen: (w - v.x) * v.scale.x should land at rect.w / 2
    expect((50 - v.x) * v.scale.x).toBeCloseTo(rect.w / 2);
    expect((25 - v.y) * v.scale.y).toBeCloseTo(rect.h / 2);
  });

  it('respects a non-uniform outer scale', () => {
    const v = loupeInnerView({ x: 0, y: 0 }, { x: 0, y: 0, scale: { x: 1, y: 4 } }, rect, 2);
    expect(v.scale).toEqual({ x: 2, y: 8 });
  });

  it('a factor of 1 shows the same magnification as the outer view', () => {
    const v = loupeInnerView({ x: 10, y: 10 }, outer, rect, 1);
    expect(v.scale).toEqual(outer.scale);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/loupe/innerView.test.ts`
Expected: FAIL — `Failed to resolve import "./innerView"`.

- [ ] **Step 3: Implement**

Create `packages/hud/src/loupe/innerView.ts`:

```ts
import type { View } from '@weasel-js/core';
import type { WidgetBounds } from '../widget';

/**
 * The inner `View` a loupe renders its content through: the outer view's
 * magnification times `factor`, positioned so `target` sits at the center of
 * a viewport the size of `rect`.
 */
export function loupeInnerView(
  target: { x: number; y: number },
  outer: View,
  rect: WidgetBounds,
  factor: number,
): View {
  const scale = { x: outer.scale.x * factor, y: outer.scale.y * factor };
  return {
    x: target.x - rect.w / 2 / scale.x,
    y: target.y - rect.h / 2 / scale.y,
    scale,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/hud/src/loupe/innerView.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/hud/src/loupe/innerView.ts packages/hud/src/loupe/innerView.test.ts
git commit -m "feat(hud): loupe inner-view derivation"
```

---

### Task 9: Framebuffer readback for pixel mode

GL's origin is bottom-left and the canvas's is top-left, so the read row must be flipped going in and the resulting rows flipped coming out. `preserveDrawingBuffer: true` is already set on the live canvas (`packages/core/src/canvas/Canvas.tsx:1418`), so this reads the last rendered frame without forcing a redraw.

**Files:**
- Create: `packages/hud/src/loupe/readback.ts`
- Test: `packages/hud/src/loupe/readback.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/hud/src/loupe/readback.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readbackRegion } from './readback';

function fakeGl(calls: unknown[][]) {
  return {
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    readPixels: (...args: unknown[]) => { calls.push(args); },
  } as unknown as WebGL2RenderingContext;
}

describe('readbackRegion', () => {
  it('centers the read on the pointer, in device pixels, y-flipped', () => {
    const calls: unknown[][] = [];
    readbackRegion(fakeGl(calls), { width: 800, height: 600 }, { x: 100, y: 50 }, 2, 40, 20);
    // device center = (200, 100); region = 40x20; gx = 200 - 20 = 180
    // gy = 600 - 100 - 10 = 490
    expect(calls[0].slice(0, 4)).toEqual([180, 490, 40, 20]);
  });

  it('clamps the region to the drawing buffer', () => {
    const calls: unknown[][] = [];
    readbackRegion(fakeGl(calls), { width: 800, height: 600 }, { x: 0, y: 0 }, 1, 40, 20);
    expect(calls[0][0]).toBe(0);
    expect(calls[0][1]).toBe(590);
  });

  it('returns ImageData whose rows are flipped back to top-down', () => {
    const gl = {
      RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
      readPixels: (_x: number, _y: number, w: number, h: number, _f: number, _t: number, buf: Uint8Array) => {
        // Bottom row (GL row 0) red, top row (GL row h-1) blue.
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const i = (row * w + col) * 4;
            buf[i] = row === 0 ? 255 : 0;
            buf[i + 2] = row === h - 1 ? 255 : 0;
            buf[i + 3] = 255;
          }
        }
      },
    } as unknown as WebGL2RenderingContext;
    const img = readbackRegion(gl, { width: 8, height: 8 }, { x: 4, y: 4 }, 1, 2, 2);
    // After the flip, ImageData row 0 is GL row h-1 → blue.
    expect(img.data[2]).toBe(255);
    expect(img.data[0]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/loupe/readback.test.ts`
Expected: FAIL — `Failed to resolve import "./readback"`.

- [ ] **Step 3: Implement**

Create `packages/hud/src/loupe/readback.ts`:

```ts
/**
 * Read a `rw × rh` device-pixel region of the drawing buffer centered on
 * `pointer` (CSS px relative to the canvas), returned top-down.
 *
 * GL reports rows bottom-up; every consumer here wants top-down, so both the
 * read origin and the returned rows are flipped.
 */
export function readbackRegion(
  gl: WebGL2RenderingContext,
  buffer: { width: number; height: number },
  pointer: { x: number; y: number },
  dpr: number,
  rw: number,
  rh: number,
): ImageData {
  const cx = Math.round(pointer.x * dpr);
  const cy = Math.round(pointer.y * dpr);
  const gx = clamp(cx - Math.floor(rw / 2), 0, Math.max(0, buffer.width - rw));
  const gyTop = clamp(cy - Math.floor(rh / 2), 0, Math.max(0, buffer.height - rh));
  const gy = buffer.height - gyTop - rh;

  const raw = new Uint8Array(rw * rh * 4);
  gl.readPixels(gx, gy, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, raw);

  const flipped = new Uint8ClampedArray(rw * rh * 4);
  const stride = rw * 4;
  for (let row = 0; row < rh; row++) {
    const src = (rh - 1 - row) * stride;
    flipped.set(raw.subarray(src, src + stride), row * stride);
  }
  return new ImageData(flipped, rw, rh);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/hud/src/loupe/readback.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/hud/src/loupe/readback.ts packages/hud/src/loupe/readback.test.ts
git commit -m "feat(hud): framebuffer readback for the loupe's pixel mode"
```

---

### Task 10: `createLoupe` — assembly

Owns the window, the pointer feed, the freeze rule, and the two content sources.

The pointer feed is a direct `pointermove` listener on the canvas element rather than hud's hover path, because hud hover comes from the layer's `onUncapturedMove` and stops during any captured drag — exactly when the loupe is most wanted.

**Files:**
- Create: `packages/hud/src/loupe/createLoupe.ts`
- Test: `packages/hud/src/loupe/createLoupe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/hud/src/loupe/createLoupe.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createHud } from '../hud';
import { createLoupe } from './createLoupe';
import type { RenderLayer } from '@weasel-js/core';

const tokens = resolveTheme(weaselTheme, 'dark');
const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const dims = { width: 800, height: 600 };

function makeElement() {
  const el = document.createElement('canvas');
  el.width = 800; el.height = 600;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  return el;
}

const source: RenderLayer<unknown>[] = [{
  id: 'src', label: 'src', space: 'world',
  draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { fill: 'solid', color: '#0f0' } }],
}];

describe('createLoupe', () => {
  it('creates a window widget on the hud', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw: () => {} });
    expect(hud.widgets()).toContain(loupe.window);
  });

  it('vector mode paints the source through a magnified inner view', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw: () => {}, factor: 4 });
    loupe.aimAt({ x: 120, y: 90 });
    const rect = loupe.window.contentRect;
    const cmds = loupe.window.content!({ data: null, view, dims, rect, defaultFont: 'D', tokens });
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds[0].kind).toBe('group');
  });

  it('freezes the aim while the pointer is over the window', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw: () => {} });
    loupe.window.setBounds({ x: 0, y: 0, w: 200, h: 150 });
    loupe.aimAt({ x: 400, y: 300 });
    const before = loupe.aim;
    loupe.aimAt({ x: 50, y: 50 });        // inside the window
    expect(loupe.aim).toEqual(before);
  });

  it('setMode switches the painter and requests a redraw', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const requestRedraw = vi.fn();
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw });
    requestRedraw.mockClear();
    loupe.setMode('pixel');
    expect(loupe.mode).toBe('pixel');
    expect(requestRedraw).toHaveBeenCalled();
  });

  it('reports the hex color under the aim point', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const el = makeElement();
    vi.spyOn(el, 'getContext').mockReturnValue({
      RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
      readPixels: (_x, _y, _w, _h, _f, _t, buf: Uint8Array) => {
        buf[0] = 0x3a; buf[1] = 0x7b; buf[2] = 0xd5; buf[3] = 255;
      },
    } as unknown as WebGL2RenderingContext);
    const onColorChange = vi.fn();
    const loupe = createLoupe({ hud, element: el, source, requestRedraw: () => {}, onColorChange });
    loupe.aimAt({ x: 400, y: 300 });
    expect(loupe.color).toBe('#3a7bd5');
    expect(onColorChange).toHaveBeenCalledWith('#3a7bd5');
  });

  it('dispose removes the window and detaches the pointer listener', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const el = makeElement();
    const remove = vi.spyOn(el, 'removeEventListener');
    const loupe = createLoupe({ hud, element: el, source, requestRedraw: () => {} });
    loupe.dispose();
    expect(hud.widgets()).not.toContain(loupe.window);
    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/loupe/createLoupe.test.ts`
Expected: FAIL — `Failed to resolve import "./createLoupe"`.

- [ ] **Step 3: Implement**

Create `packages/hud/src/loupe/createLoupe.ts`:

```ts
import {
  createViewportLayer, screenToWorld, viewToTransform,
  type RenderLayer, type View,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { Hud } from '../hud';
import type { WindowWidget } from '../widgets/window/window';
import type { HudContentCtx, WidgetBounds } from '../widget';
import { loupeInnerView } from './innerView';
import { readbackRegion } from './readback';

export type LoupeMode = 'vector' | 'pixel';

export interface LoupeOptions {
  hud: Hud;
  /** The live canvas. Supplies the GL context for pixel mode and the pointer
   *  feed for aiming. */
  element: HTMLCanvasElement;
  /** Layers re-rendered through the magnified inner view in vector mode. */
  source: RenderLayer<unknown>[];
  requestRedraw: () => void;
  mode?: LoupeMode;
  factor?: number;
  bounds?: WidgetBounds;
  title?: string;
  /** Called with the hex color under the aim point whenever it changes.
   *  Sampled from the framebuffer in both modes — vector content is a
   *  re-render whose edge colors differ from the screen's, so reading the
   *  color off it would report something the user cannot see. */
  onColorChange?: (hex: string) => void;
  /** Opaque backdrop behind vector content, so the outer canvas does not
   *  show through where the inner view is empty. */
  background?: string;
}

export interface LoupeHandle {
  readonly window: WindowWidget;
  readonly mode: LoupeMode;
  readonly factor: number;
  /** Last aimed point, in screen-space CSS px relative to the canvas. */
  readonly aim: { x: number; y: number };
  /** Hex color under the aim point, read off the framebuffer. `null` before
   *  the first aim, or when the GL context is unavailable. */
  readonly color: string | null;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
  /** Aim at a screen point. Ignored while the point is over the window —
   *  that is the freeze rule that makes the borders reachable. */
  aimAt(p: { x: number; y: number }): void;
  dispose(): void;
}

export function createLoupe(opts: LoupeOptions): LoupeHandle {
  const { hud, element, source, requestRedraw } = opts;
  let mode: LoupeMode = opts.mode ?? 'vector';
  let factor = opts.factor ?? 8;
  let aim = { x: 0, y: 0 };
  let color: string | null = null;
  let pixels: ImageBitmap | null = null;
  let pixelsPending = false;

  const b = opts.bounds ?? { x: 24, y: 24, w: 220, h: 200 };

  const content = (ctx: HudContentCtx): DrawCommand[] =>
    mode === 'vector' ? drawVector(ctx) : drawPixels(ctx);

  const drawVector = (ctx: HudContentCtx): DrawCommand[] => {
    const world = screenToWorld(aim.x, aim.y, viewToTransform(ctx.view));
    const inner: View = loupeInnerView(
      { x: world[0], y: world[1] }, ctx.view, ctx.rect, factor,
    );
    // A fresh lens per frame: CreateViewportLayerOpts.view is static, and the
    // inner view moves with the pointer.
    const lens = createViewportLayer<unknown>({
      id: `${win.id}:lens`,
      label: 'Loupe content',
      source,
      view: inner,
      bounds: () => ctx.rect,
      background: opts.background ?? ctx.tokens['--wzl-surface'],
    });
    return lens.draw(ctx.data, ctx.view, ctx.dims);
  };

  const drawPixels = (ctx: HudContentCtx): DrawCommand[] => {
    if (!pixels) return [];
    return [{
      kind: 'image',
      image: pixels,
      x: ctx.rect.x, y: ctx.rect.y, w: ctx.rect.w, h: ctx.rect.h,
      sampling: 'nearest',
    }];
  };

  const refreshPixels = () => {
    if (mode !== 'pixel' || pixelsPending) return;
    const gl = element.getContext('webgl2');
    if (!gl) return;
    const cssRect = element.getBoundingClientRect();
    if (cssRect.width === 0) return;
    const dpr = element.width / cssRect.width;
    const rect = win.contentRect;
    const rw = Math.max(1, Math.round((rect.w * dpr) / factor));
    const rh = Math.max(1, Math.round((rect.h * dpr) / factor));
    const data = readbackRegion(
      gl, { width: element.width, height: element.height }, aim, dpr, rw, rh,
    );
    pixelsPending = true;
    createImageBitmap(data)
      .then((bmp) => {
        pixels?.close();
        pixels = bmp;
        pixelsPending = false;
        requestRedraw();
      })
      .catch(() => { pixelsPending = false; });
  };

  const sampleColor = () => {
    const gl = element.getContext('webgl2');
    if (!gl) return;
    const cssRect = element.getBoundingClientRect();
    if (cssRect.width === 0) return;
    const dpr = element.width / cssRect.width;
    const px = readbackRegion(
      gl, { width: element.width, height: element.height }, aim, dpr, 1, 1,
    );
    const hex = '#' + [px.data[0], px.data[1], px.data[2]]
      .map((c) => c.toString(16).padStart(2, '0')).join('');
    if (hex !== color) {
      color = hex;
      opts.onColorChange?.(hex);
    }
  };

  const win = hud.window({
    id: 'weasel-loupe',
    x: b.x, y: b.y, w: b.w, h: b.h,
    title: opts.title ?? 'Loupe',
    content,
    onResize: () => { refreshPixels(); },
  });

  const onPointerMove = (evt: PointerEvent) => {
    const r = element.getBoundingClientRect();
    handleAim({ x: evt.clientX - r.left, y: evt.clientY - r.top });
  };

  const handleAim = (p: { x: number; y: number }) => {
    if (win.hidden) return;
    if (win.hitTest(p.x, p.y)) return;   // freeze rule
    aim = p;
    sampleColor();
    if (mode === 'pixel') refreshPixels();
    requestRedraw();
  };

  element.addEventListener('pointermove', onPointerMove);

  return {
    window: win,
    get mode() { return mode; },
    get factor() { return factor; },
    get aim() { return aim; },
    get color() { return color; },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (mode === 'pixel') refreshPixels();
      requestRedraw();
    },
    setFactor(next) {
      factor = next;
      if (mode === 'pixel') refreshPixels();
      requestRedraw();
    },
    aimAt: handleAim,
    dispose() {
      element.removeEventListener('pointermove', onPointerMove);
      pixels?.close();
      pixels = null;
      win.dispose();
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/hud/src/loupe/createLoupe.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Export from the barrel**

In `packages/hud/src/index.ts`, add:

```ts
export { createLoupe, type LoupeOptions, type LoupeHandle, type LoupeMode } from './loupe/createLoupe';
export { loupeInnerView } from './loupe/innerView';
```

- [ ] **Step 6: Typecheck and run the package suite**

Run: `npx tsc --noEmit -p packages/hud/tsconfig.json && npx vitest run packages/hud`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/hud/src/loupe packages/hud/src/index.ts
git commit -m "feat(hud): loupe — window plus vector and pixel content sources"
```

---

### Task 11: Demo card in apps/site

Proves the whole thing outside a test, and covers the "HUD widget gallery" gap noted in `docs/TODO.md:571` for the window widget.

**Files:**
- Create: `apps/site/demos/LoupeDemo.tsx`
- Modify: `apps/site/registry.ts`

- [ ] **Step 1: Check the house pattern for demo props**

Run: `sed -n 1,60p apps/site/demos/ViewportLayerDemo.tsx`
Confirm the `<SceneCanvas>` props this repo's demos pass (scene, selection, kinds). The demo below is self-contained apart from those.

- [ ] **Step 2: Write the demo**

Create `apps/site/demos/LoupeDemo.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, type SceneCanvasApi, type RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { useHud, useHudTool } from '@weasel-js/hud/react';
import { createLoupe, type LoupeHandle, type LoupeMode } from '@weasel-js/hud';

/** Fine detail worth magnifying: a hairline grid plus a few small wedges,
 *  so vector-vs-pixel is visible at a glance. */
function detailLayer(): RenderLayer<unknown> {
  return {
    id: 'loupe-demo-scene',
    label: 'Detail',
    space: 'world',
    draw: (): DrawCommand[] => {
      const out: DrawCommand[] = [];
      for (let i = 0; i <= 40; i++) {
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: i * 20, y: 0, width: 1, height: 800 },
          fill: { fill: 'solid', color: '#3a3f4a' },
        });
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: 0, y: i * 20, width: 800, height: 1 },
          fill: { fill: 'solid', color: '#3a3f4a' },
        });
      }
      const swatches = ['#e0533d', '#4ea6ff', '#7fd67f', '#e8c33d'];
      swatches.forEach((color, i) => {
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: 120 + i * 90, y: 160, width: 60, height: 60 },
          fill: { fill: 'solid', color },
        });
      });
      return out;
    },
  };
}

export function LoupeDemo() {
  const ref = useRef<SceneCanvasApi>(null);
  const hud = useHud(ref);
  const hudTool = useHudTool();
  const loupeRef = useRef<LoupeHandle | null>(null);
  const [mode, setMode] = useState<LoupeMode>('vector');
  const [factor, setFactor] = useState(8);

  const source = useMemo(() => [detailLayer()], []);

  useEffect(() => {
    const api = ref.current;
    if (!api?.element) return;
    const detachSource = api.registerLayer(source[0]);
    const loupe = createLoupe({
      hud, element: api.element, source, requestRedraw: api.requestRedraw,
    });
    loupeRef.current = loupe;
    return () => { loupe.dispose(); loupeRef.current = null; detachSource(); };
  }, [hud, source]);

  return (
    <>
      <div className="demo-controls">
        <label>
          <input type="radio" name="loupe-mode" checked={mode === 'vector'}
            onChange={() => { setMode('vector'); loupeRef.current?.setMode('vector'); }} />
          vector
        </label>
        <label>
          <input type="radio" name="loupe-mode" checked={mode === 'pixel'}
            onChange={() => { setMode('pixel'); loupeRef.current?.setMode('pixel'); }} />
          pixel
        </label>
        <label>
          scale
          <input type="range" min={2} max={16} step={1} value={factor}
            onChange={(e) => {
              const f = Number(e.target.value);
              setFactor(f); loupeRef.current?.setFactor(f);
            }} />
          {factor}×
        </label>
      </div>
      <SceneCanvas ref={ref} ambient={[hudTool]} />
    </>
  );
}
```

If step 1 showed that this repo's `<SceneCanvas>` requires scene/kind props, copy those from `ViewportLayerDemo` — the loupe itself needs none of them, since its source layer is registered directly.

- [ ] **Step 3: Register the card**

In `apps/site/registry.ts`, add an entry alongside the `createViewportLayer` one:

```ts
  {
    id: 'loupe',
    title: 'Loupe',
    component: LoupeDemo,
    description: 'A hud window — drag the titlebar to move it, drag any edge or corner to resize. Vector mode re-renders the scene through a magnified inner view (crisp at any zoom, but the colors along antialiased edges are not the colors on screen). Pixel mode reads the framebuffer back at 1:1 device pixels with NEAREST magnification, which is the honest source for color. The content freezes while the pointer is over the window so the borders stay reachable.',
  },
```

with the matching import at the top of the file.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev:kit`
Open the printed URL, select the Loupe card. Check: the window moves and resizes by drag; vector content stays crisp at 16×; pixel mode shows hard-edged device pixels, not blur; content freezes when the pointer enters the window.

- [ ] **Step 5: Pin the NEAREST claim with a visual spec**

No draw-command assertion can catch blurry-vs-crisp — the command is identical, only the GL filter differs. But a committed PNG is the wrong instrument too: it would encode this machine's rasterizer. Assert the *structure* instead, the way `tests/visual/text-outlines.spec.ts` does.

Create `tests/visual/loupe.spec.ts`:

```ts
/**
 * Pixel mode must magnify with NEAREST, not LINEAR.
 *
 * No committed baseline: the claim is structural, and structure is portable
 * where a PNG is not. Magnifying an 8×8 readback into a ~200px box at NEAREST
 * produces long runs of identical pixels separated by hard steps; at LINEAR
 * every pixel differs slightly from its neighbour. Counting distinct colors
 * along a scanline separates the two cleanly and depends on no rasterizer.
 */
import { test, expect, type Page } from '@playwright/test';

const DEMO_ID = 'loupe';

async function distinctColorsAcrossLoupe(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    o.getContext('2d')!.drawImage(c, 0, 0);
    // The loupe's default bounds are { x: 24, y: 24, w: 220, h: 200 } in CSS
    // px; sample a scanline through its middle in device px.
    const dpr = c.width / c.getBoundingClientRect().width;
    const y = Math.round(124 * dpr);
    const { data } = o.getContext('2d')!.getImageData(Math.round(34 * dpr), y, Math.round(200 * dpr), 1);
    const seen = new Set<string>();
    for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return seen.size;
  });
}

test(`${DEMO_ID} — pixel mode magnifies with hard edges`, async ({ page }) => {
  await page.goto(`/#${DEMO_ID}`);
  await page.waitForTimeout(500);
  await page.mouse.move(500, 300);          // aim somewhere with detail
  await page.getByLabel('pixel').check();
  await page.waitForTimeout(300);
  const colors = await distinctColorsAcrossLoupe(page);
  // A 200px-wide scanline over a readback magnified 8× can show at most ~25
  // source texels. LINEAR interpolation would push this into the hundreds.
  expect(colors).toBeLessThan(60);
});
```

- [ ] **Step 6: Run the visual spec**

Run: `npx playwright test tests/visual/loupe.spec.ts`
Expected: PASS. Sanity-check the spec itself by temporarily reverting `sampling: 'nearest'` to `'linear'` in `drawPixels` — it must FAIL. A probe that passes on a known-broken case is worse than no probe.

- [ ] **Step 7: Commit**

```bash
git add apps/site/demos/LoupeDemo.tsx apps/site/registry.ts tests/visual/loupe.spec.ts
git commit -m "docs(site): loupe demo card; pin NEAREST magnification"
```

---

### Task 12: Wire the loupe into apps/draw

**Files:**
- Modify: `apps/draw/src/` (locate the exact sites in step 1)

- [ ] **Step 1: Find the wiring sites**

Run: `grep -rn "useHud\|useHudTool\|ToolOptionsBar" apps/draw/src`
This gives you the app's existing hud instance (if any) and where the options bar is rendered. If `apps/draw` has no hud yet, add `useHud(ref)` and pass `useHudTool()` into the canvas's `ambient` array — see `createHudTool`'s doc block in `packages/hud/src/tool.ts` for why it must be ambient.

- [ ] **Step 2: Create the loupe hook**

Create `apps/draw/src/useLoupe.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import type { RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import type { Hud } from '@weasel-js/hud';
import { createLoupe, type LoupeHandle, type LoupeMode } from '@weasel-js/hud';

export interface LoupeController {
  visible: boolean;
  mode: LoupeMode;
  factor: number;
  toggle(): void;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
}

export function useLoupe(
  ref: { current: SceneCanvasApi | null },
  hud: Hud,
  source: RenderLayer<unknown>[],
): LoupeController {
  const handle = useRef<LoupeHandle | null>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setModeState] = useState<LoupeMode>('vector');
  const [factor, setFactorState] = useState(8);

  useEffect(() => {
    const api = ref.current;
    if (!api?.element) return;
    const loupe = createLoupe({
      hud, element: api.element, source, requestRedraw: api.requestRedraw,
    });
    loupe.window.setHidden(true);
    handle.current = loupe;
    return () => { loupe.dispose(); handle.current = null; };
  }, [hud, ref, source]);

  return {
    visible, mode, factor,
    toggle() {
      const loupe = handle.current;
      if (!loupe) return;
      const next = !visible;
      loupe.window.setHidden(!next);
      setVisible(next);
    },
    setMode(next) { handle.current?.setMode(next); setModeState(next); },
    setFactor(next) { handle.current?.setFactor(next); setFactorState(next); },
  };
}
```

- [ ] **Step 3: Add the toggle**

`ToolPalette` renders from the tool registry (`packages/ui/src/components/ToolPalette/ToolPalette.tsx:55`) and the loupe is not a tool, so it cannot take a palette slot. Put the toggle wherever step 1 found the app's non-tool chrome:

```tsx
<Button onPress={loupe.toggle} aria-pressed={loupe.visible}>Loupe</Button>
```

- [ ] **Step 4: Add the DOM controls**

Render these next to the toggle, visible only while `loupe.visible`:

```tsx
{loupe.visible && (
  <>
    <RadioGroup
      aria-label="Loupe mode"
      value={loupe.mode}
      onChange={(v) => loupe.setMode(v as LoupeMode)}
      options={[{ value: 'vector', label: 'Vector' }, { value: 'pixel', label: 'Pixel' }]}
    />
    <NumberField
      aria-label="Magnification"
      value={loupe.factor}
      minValue={2}
      maxValue={16}
      step={1}
      onChange={loupe.setFactor}
    />
  </>
)}
```

Confirm the prop names before writing this — run `sed -n 1,40p packages/ui/src/components/RadioGroup/RadioGroup.tsx packages/ui/src/components/NumberField/NumberField.tsx` and adjust (these are React Aria-based, so `value`/`onChange` may be `selectedKey`/`onSelectionChange`).

- [ ] **Step 4b: Add the hex readout**

`useLoupe` needs to surface the color. Add to `LoupeController`:

```ts
  color: string | null;
```

add the state in the hook body:

```ts
  const [color, setColor] = useState<string | null>(null);
```

pass `onColorChange: setColor` into the `createLoupe` call, and return `color` from the hook.

Then render it beside the other controls:

```tsx
<span className="wd-loupe-readout">
  <span className="wd-loupe-swatch" data-color={loupe.color ?? undefined} />
  <code>{loupe.color ?? '—'}</code>
  <Button
    isDisabled={!loupe.color}
    onPress={() => loupe.color && navigator.clipboard.writeText(loupe.color)}
  >
    Copy
  </Button>
</span>
```

The swatch takes its color from a CSS custom property set on the element, not an inline `style` — add to the app's stylesheet:

```css
.wd-loupe-swatch {
  inline-size: var(--wzl-space-md);
  block-size: var(--wzl-space-md);
  border: var(--wzl-border-w) solid var(--wzl-border);
  border-radius: var(--wzl-radius-sm);
  background: var(--wd-loupe-swatch-color, transparent);
}
```

and set `--wd-loupe-swatch-color` from the `data-color` attribute via the app's existing pattern for dynamic swatch colors — check how `PropertiesPanel` does it (`grep -rn "swatch" apps/draw/src/ui/PropertiesPanel`) and follow that, rather than introducing an inline style.

- [ ] **Step 5: Verify**

Run: `npm run dev` in `apps/draw` (check the script name with `grep '"dev' apps/draw/package.json`).
Toggle the loupe on, draw a path with the pen tool while watching it — the loupe must keep tracking during the drag, which is the whole reason for the direct `pointermove` listener.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src
git commit -m "feat(draw): loupe toggle and controls"
```

---

### Task 13: Docs and close-out

**Files:**
- Create: `packages/hud/src/widgets/window/README.md`
- Modify: `docs/TODO.md:113-121`
- Modify: `packages/hud/README.md`

- [ ] **Step 1: Write the window README**

Create `packages/hud/src/widgets/window/README.md`:

```markdown
# window

A draggable, resizable frame drawn in WebGL over a weasel canvas.

The frame paints a titlebar, a border ring, and a close box — and deliberately
leaves the interior unfilled. Interiors come from the widget's optional
`content` painter, which the hud layer draws beneath every widget frame and
clips to `contentRect`. That painter is the only place hud sees scene data;
`HudDrawCtx` stays data-free so widgets remain renderable headlessly.

The frame must be GL, not DOM. A DOM border over GL content moves on the
browser's paint schedule while the content moves on the rAF schedule, so the
two separate by a frame and the content visibly slides inside its own border
during a resize.

## Related

- `../../loupe` — the first consumer: window + a magnified lens.
- [`@weasel-js/core` viewports](../../../../core/src/features/viewports/README.md) —
  the lens itself.
```

- [ ] **Step 2: Retire the TODO entry**

Delete the `**Loupe tool.**` block at `docs/TODO.md:113-121`. Per the repo's retention policy, a completed item with no open follow-ups is deleted rather than marked done — git log is the archive.

If hit-test re-projection into viewports is still unwired at this point, add a new P3 entry in its place:

```markdown
- **(P3) Interacting through a loupe.** `createViewportLayer` has no hit-test
  re-projection, so a press inside a loupe would target the outer view. The
  window widget swallows interior presses to prevent acting on the wrong thing.
  Wiring re-projection would let anchor placement happen *in* the magnified
  view, which is the point of a loupe for precision work.
```

- [ ] **Step 3: Note the window in the package README**

In `packages/hud/README.md`, under Usage, list the widget set including `window`, and link `src/widgets/window/README.md`.

- [ ] **Step 4: Run the release gate**

Run: `npx tsc --noEmit && npx vitest run && npx tsup build`
Expected: clean. (`vitest` alone does not typecheck production code — this is the combination CI's release gate runs.)

- [ ] **Step 5: Commit**

```bash
git add packages/hud/src/widgets/window/README.md packages/hud/README.md docs/TODO.md
git commit -m "docs(hud): window primitive README; retire the loupe TODO"
```

---

## Verification checklist

- [ ] `npx vitest run packages/hud packages/core/src/renderer` — all pass
- [ ] `npx tsc --noEmit` — clean
- [ ] Loupe demo: window moves and resizes by drag; min size holds; west/north drags keep the opposite edge fixed
- [ ] Vector mode crisp at 16×; pixel mode shows hard device-pixel squares, not blur
- [ ] Content freezes while the pointer is over the window
- [ ] Loupe keeps tracking during a captured drag (pen tool mid-stroke)
- [ ] A press inside the loupe does nothing to the scene beneath it
- [ ] Hex readout matches the on-screen color (check against a screenshot's picked pixel, not against the fill you set — antialiased edges are the case that matters)
- [ ] `npx playwright test tests/visual/loupe.spec.ts` passes, and fails when `sampling` is reverted to `'linear'`
