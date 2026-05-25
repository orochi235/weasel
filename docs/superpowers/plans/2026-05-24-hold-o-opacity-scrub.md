# Hold-O Opacity Scrub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hold-`O` + mouse-wheel gesture in `apps/draw` that scrubs the opacity of the current selection, with a live HUD and a single undo entry per press-release.

**Architecture:** A new self-contained hook `useOpacityScrub` mounted in `App.tsx` listens for `KeyO` keydown/keyup globally, snapshots paints + history index at session start, applies live scene mutations on wheel ticks, and on release rewinds intermediate history and emits one final `scene.batch('Adjust opacity', ...)`. A sibling `OpacityHud` component renders a transient chip inside `.wd-canvas-host` while a session is active.

**Tech Stack:** React 18, `@orochi235/weasel` scene API (`scene.batch`, `scene.update`, `scene.historyIndex`, `scene.jumpToHistoryIndex`), existing hex8 helpers from `apps/draw/src/ActiveSwatches.tsx`.

**Reference spec:** `docs/superpowers/specs/2026-05-24-hold-o-opacity-scrub-design.md`

---

## File Structure

- **Create** `apps/draw/src/opacityScrub/useOpacityScrub.ts` — hook owning the keyboard + wheel session.
- **Create** `apps/draw/src/opacityScrub/computeScrubbedPaints.ts` — pure function: given snapshot `{fill, stroke}` + scrub multiplier, return new `{fill, stroke}`. Easy to unit-test.
- **Create** `apps/draw/src/opacityScrub/computeScrubbedPaints.test.ts` — vitest tests for the pure function.
- **Create** `apps/draw/src/opacityScrub/OpacityHud.tsx` — transient chip component.
- **Create** `apps/draw/src/opacityScrub/OpacityHud.module.css` — chip styles.
- **Modify** `apps/draw/src/App.tsx` — mount the hook, render the HUD inside `.wd-canvas-host`.

All new code lives under `apps/draw/src/opacityScrub/` to keep the spike co-located and easy to delete or promote later.

---

## Task 1: Pure scrub math (TDD)

**Files:**
- Create: `apps/draw/src/opacityScrub/computeScrubbedPaints.ts`
- Test:   `apps/draw/src/opacityScrub/computeScrubbedPaints.test.ts`

The function takes a snapshot paint and a scrub *target* alpha (the alpha the brighter paint should land on, 0..1), and returns new paints with both alphas scaled by the same multiplicative factor.

- [ ] **Step 1: Write the failing test file**

```ts
// apps/draw/src/opacityScrub/computeScrubbedPaints.test.ts
import { describe, it, expect } from 'vitest';
import { computeScrubbedPaints } from './computeScrubbedPaints';

describe('computeScrubbedPaints', () => {
  it('scales both alphas by the same factor, preserving ratio', () => {
    // fill α=0.8, stroke α=0.4 → ratio 2:1
    // target brightest = 0.4 → factor 0.5 → fill α=0.4, stroke α=0.2
    const out = computeScrubbedPaints(
      { fill: '#ff0000cc', stroke: '#00ff0066' }, // 0xcc=204≈0.8, 0x66=102≈0.4
      0.4,
    );
    expect(out.fill.slice(-2).toLowerCase()).toBe('66');   // ~0.4
    expect(out.stroke.slice(-2).toLowerCase()).toBe('33'); // ~0.2
  });

  it('clamps target to [0, 1]', () => {
    const out = computeScrubbedPaints(
      { fill: '#ff0000ff', stroke: '#00ff00ff' },
      1.5,
    );
    expect(out.fill.slice(-2).toLowerCase()).toBe('ff');
    expect(out.stroke.slice(-2).toLowerCase()).toBe('ff');
  });

  it('handles target = 0', () => {
    const out = computeScrubbedPaints(
      { fill: '#ff0000ff', stroke: '#00ff0080' },
      0,
    );
    expect(out.fill.slice(-2).toLowerCase()).toBe('00');
    expect(out.stroke.slice(-2).toLowerCase()).toBe('00');
  });

  it('passes through null paints unchanged', () => {
    const out = computeScrubbedPaints({ fill: null, stroke: '#000000ff' }, 0.5);
    expect(out.fill).toBeNull();
    expect(out.stroke.slice(-2).toLowerCase()).toBe('80');
  });

  it('returns snapshot unchanged when both alphas are 0 (no ratio to preserve)', () => {
    const out = computeScrubbedPaints(
      { fill: '#ff000000', stroke: '#00ff0000' },
      0.5,
    );
    expect(out.fill.slice(-2).toLowerCase()).toBe('00');
    expect(out.stroke.slice(-2).toLowerCase()).toBe('00');
  });

  it('skips non-hex string paints (gradients, named colors) by returning them unchanged', () => {
    const out = computeScrubbedPaints(
      { fill: 'url(#gradient)' as unknown as string, stroke: '#000000ff' },
      0.5,
    );
    expect(out.fill).toBe('url(#gradient)');
    expect(out.stroke.slice(-2).toLowerCase()).toBe('80');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/draw && npx vitest run src/opacityScrub/computeScrubbedPaints.test.ts
```

Expected: FAIL (`Cannot find module './computeScrubbedPaints'`).

- [ ] **Step 3: Implement the pure function**

```ts
// apps/draw/src/opacityScrub/computeScrubbedPaints.ts
import { toHex8, getAlpha01, withAlpha01 } from '../ActiveSwatches';

export interface PaintSnapshot {
  fill: string | null;
  stroke: string | null;
}

/** Returns true if `v` looks like a hex color string our helpers can parse. */
function isHexColor(v: string | null): v is string {
  return typeof v === 'string' && v.startsWith('#');
}

/**
 * Scale both fill and stroke alpha by the same factor so the brighter of
 * the two lands on `targetAlpha`. Preserves the ratio between fill α and
 * stroke α. Non-hex paints (null, gradients, etc.) pass through unchanged.
 *
 * targetAlpha is clamped to [0, 1].
 */
export function computeScrubbedPaints(
  snapshot: PaintSnapshot,
  targetAlpha: number,
): PaintSnapshot {
  const clamped = Math.max(0, Math.min(1, targetAlpha));

  const fillHex = isHexColor(snapshot.fill) ? toHex8(snapshot.fill) : null;
  const strokeHex = isHexColor(snapshot.stroke) ? toHex8(snapshot.stroke) : null;

  const fillA = fillHex ? getAlpha01(fillHex) : 0;
  const strokeA = strokeHex ? getAlpha01(strokeHex) : 0;
  const brightest = Math.max(fillA, strokeA);

  // No ratio to preserve when both are zero — just write clamped to whichever
  // is hex.
  const factor = brightest === 0 ? 0 : clamped / brightest;

  return {
    fill: fillHex ? withAlpha01(fillHex, fillA * factor) : snapshot.fill,
    stroke: strokeHex ? withAlpha01(strokeHex, strokeA * factor) : snapshot.stroke,
  };
}
```

- [ ] **Step 4: Run tests until green**

```
cd apps/draw && npx vitest run src/opacityScrub/computeScrubbedPaints.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```
git add apps/draw/src/opacityScrub/computeScrubbedPaints.ts apps/draw/src/opacityScrub/computeScrubbedPaints.test.ts
git commit -m "feat(apps/draw): add computeScrubbedPaints pure helper"
```

---

## Task 2: HUD chip component

**Files:**
- Create: `apps/draw/src/opacityScrub/OpacityHud.tsx`
- Create: `apps/draw/src/opacityScrub/OpacityHud.module.css`

The HUD is a presentational component: visible when `percent !== null`, rendered as an absolutely-positioned chip near the top of its parent. The parent (`.wd-canvas-host`) is already positioned, so absolute positioning will anchor inside the workspace.

- [ ] **Step 1: Create the CSS module**

```css
/* apps/draw/src/opacityScrub/OpacityHud.module.css */
.hud {
  position: absolute;
  top: 12px;
  left: 50%;
  translate: -50% 0;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(20, 20, 20, 0.78);
  color: #fff;
  font: 600 12px/1.2 system-ui, sans-serif;
  letter-spacing: 0.02em;
  pointer-events: none;
  z-index: 50;
  transition: opacity 200ms ease;
}

.hudHidden {
  opacity: 0;
}

.hudVisible {
  opacity: 1;
}
```

- [ ] **Step 2: Create the component**

```tsx
// apps/draw/src/opacityScrub/OpacityHud.tsx
import s from './OpacityHud.module.css';

export interface OpacityHudProps {
  /** Whole-number percent 0..100, or null to hide. */
  percent: number | null;
}

/**
 * Transient chip rendered inside `.wd-canvas-host` while the opacity-scrub
 * session is active. Fades out (200ms) when `percent` returns to null.
 */
export function OpacityHud({ percent }: OpacityHudProps) {
  // Keep the last shown value during the fade-out so the text doesn't blank
  // before opacity hits zero.
  const display = percent ?? 0;
  return (
    <div
      className={`${s.hud} ${percent === null ? s.hudHidden : s.hudVisible}`}
      aria-hidden={percent === null}
    >
      Opacity {display}%
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add apps/draw/src/opacityScrub/OpacityHud.tsx apps/draw/src/opacityScrub/OpacityHud.module.css
git commit -m "feat(apps/draw): add OpacityHud chip component"
```

---

## Task 3: The session hook

**Files:**
- Create: `apps/draw/src/opacityScrub/useOpacityScrub.ts`

This is the heart of the feature. It owns the keydown/keyup listeners, snapshots state at session start, applies live updates on wheel ticks, and coalesces history on release. It exposes `{ percent }` so the parent can render the HUD.

The hook depends on the same `scene` and `selection` instances `App.tsx` already constructs. It takes a `hostRef: RefObject<HTMLElement | null>` for the wheel listener target.

- [ ] **Step 1: Implement the hook**

```ts
// apps/draw/src/opacityScrub/useOpacityScrub.ts
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { asNodeId } from '@orochi235/weasel';
import type { WeaselDrawData } from '../weaselDrawData';
import {
  computeScrubbedPaints,
  type PaintSnapshot,
} from './computeScrubbedPaints';
import { toHex8, getAlpha01 } from '../ActiveSwatches';

interface ScrubSession {
  /** historyIndex captured at keydown, used to rewind on keyup. */
  startHistoryIndex: number;
  /** Per-node original paints. */
  snapshots: Map<string, PaintSnapshot>;
  /** Current target alpha (0..1), used as the brightest-paint target. */
  targetAlpha: number;
  /** Per-node max(originalFillAlpha, originalStrokeAlpha) — used to map
   *  brightness ratios so all selected nodes scrub together. */
  startBrightest: Map<string, number>;
}

const COARSE_STEP = 0.05;
const FINE_STEP = 0.01;

export interface UseOpacityScrubArgs {
  // Typed loosely to avoid pulling internal kit types into this spike.
  scene: {
    get: (id: ReturnType<typeof asNodeId>) => { data: unknown } | null;
    update: (
      id: ReturnType<typeof asNodeId>,
      patch: { data: unknown },
    ) => void;
    batch: (label: string, fn: () => void) => void;
    historyIndex: () => number;
    jumpToHistoryIndex: (n: number) => void;
  };
  selection: { current: ReadonlyArray<string> };
  hostRef: RefObject<HTMLElement | null>;
}

export function useOpacityScrub({ scene, selection, hostRef }: UseOpacityScrubArgs) {
  const sessionRef = useRef<ScrubSession | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  // Refs that always read the latest scene/selection without re-binding
  // window listeners on every render.
  const sceneRef = useRef(scene);
  const selectionRef = useRef(selection);
  sceneRef.current = scene;
  selectionRef.current = selection;

  useEffect(() => {
    function readSnapshot(id: string): PaintSnapshot | null {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const data = node.data as Partial<WeaselDrawData> | undefined;
      const fill = (data?.fill ?? null) as string | null;
      const stroke = (data?.stroke ?? null) as string | null;
      return { fill, stroke };
    }

    function brightestAlphaOf(snap: PaintSnapshot): number {
      const fillA = typeof snap.fill === 'string' && snap.fill.startsWith('#')
        ? getAlpha01(toHex8(snap.fill))
        : 0;
      const strokeA = typeof snap.stroke === 'string' && snap.stroke.startsWith('#')
        ? getAlpha01(toHex8(snap.stroke))
        : 0;
      return Math.max(fillA, strokeA);
    }

    /** Apply current targetAlpha to all snapshotted nodes via direct
     *  scene.update (each becomes its own history entry; rewound on keyup). */
    function applyLive(session: ScrubSession) {
      for (const [id, snap] of session.snapshots) {
        const currentNode = sceneRef.current.get(asNodeId(id));
        if (!currentNode) continue;
        const out = computeScrubbedPaints(snap, session.targetAlpha);
        sceneRef.current.update(asNodeId(id), {
          data: {
            ...(currentNode.data as object),
            fill: out.fill,
            stroke: out.stroke,
          },
        });
      }
    }

    function startSession(): boolean {
      const ids = selectionRef.current.current;
      if (ids.length === 0) return false;

      const snapshots = new Map<string, PaintSnapshot>();
      const startBrightest = new Map<string, number>();
      let sessionBrightest = 0;
      for (const id of ids) {
        const snap = readSnapshot(id);
        if (!snap) continue;
        snapshots.set(id, snap);
        const b = brightestAlphaOf(snap);
        startBrightest.set(id, b);
        if (b > sessionBrightest) sessionBrightest = b;
      }
      if (snapshots.size === 0) return false;

      sessionRef.current = {
        startHistoryIndex: sceneRef.current.historyIndex(),
        snapshots,
        startBrightest,
        targetAlpha: sessionBrightest,
      };
      setPercent(Math.round(sessionBrightest * 100));
      return true;
    }

    function endSession(commit: boolean) {
      const session = sessionRef.current;
      sessionRef.current = null;
      setPercent(null);
      if (!session) return;

      // Rewind every intermediate per-tick mutation.
      sceneRef.current.jumpToHistoryIndex(session.startHistoryIndex);

      if (!commit) return;

      // Emit exactly one history entry for the whole session.
      sceneRef.current.batch('Adjust opacity', () => {
        for (const [id, snap] of session.snapshots) {
          const currentNode = sceneRef.current.get(asNodeId(id));
          if (!currentNode) continue;
          const out = computeScrubbedPaints(snap, session.targetAlpha);
          sceneRef.current.update(asNodeId(id), {
            data: {
              ...(currentNode.data as object),
              fill: out.fill,
              stroke: out.stroke,
            },
          });
        }
      });
    }

    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (t.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'KeyO') return;
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      if (sessionRef.current) return;
      if (startSession()) {
        e.preventDefault();
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'KeyO') return;
      if (!sessionRef.current) return;
      endSession(true);
    }

    function onBlur() {
      if (sessionRef.current) endSession(true);
    }

    function onWheel(e: WheelEvent) {
      const session = sessionRef.current;
      if (!session) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? FINE_STEP : COARSE_STEP;
      // deltaY > 0 (scroll down) → decrease opacity.
      const delta = -Math.sign(e.deltaY) * step;
      session.targetAlpha = Math.max(0, Math.min(1, session.targetAlpha + delta));
      setPercent(Math.round(session.targetAlpha * 100));
      applyLive(session);
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);

    const host = hostRef.current;
    host?.addEventListener('wheel', onWheel, { capture: true, passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      host?.removeEventListener('wheel', onWheel, { capture: true });
      // If we unmount mid-session, rewind to avoid stranded history.
      if (sessionRef.current) endSession(false);
    };
  }, [hostRef]);

  return { percent };
}
```

- [ ] **Step 2: Verify TS compiles for this file**

```
cd apps/draw && npx tsc --noEmit
```

Expected: no errors introduced by the new file. If errors mention `weaselDrawData`, see Task 4 — the import resolves once the hook is mounted but the file itself should already compile. If `asNodeId` import path is wrong, fix to match what `App.tsx` uses.

- [ ] **Step 3: Commit**

```
git add apps/draw/src/opacityScrub/useOpacityScrub.ts
git commit -m "feat(apps/draw): add useOpacityScrub session hook"
```

---

## Task 4: Wire the hook + HUD into App.tsx

**Files:**
- Modify: `apps/draw/src/App.tsx` (imports near the top; hook call inside the component near other `useEffect`s; render the HUD inside `.wd-canvas-host`)

- [ ] **Step 1: Add imports**

At the top of `apps/draw/src/App.tsx`, near the other `apps/draw/src/...` imports, add:

```ts
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { OpacityHud } from './opacityScrub/OpacityHud';
```

- [ ] **Step 2: Mount the hook**

Inside the App component, after the existing `selection`/`scene`/`hostRef` are declared but before the return statement, add:

```ts
const { percent: opacityScrubPercent } = useOpacityScrub({
  scene,
  selection,
  hostRef,
});
```

If `scene` doesn't already expose `historyIndex` / `jumpToHistoryIndex` on the type `App.tsx` sees, narrow the cast at the call site rather than weakening the hook's typing:

```ts
const { percent: opacityScrubPercent } = useOpacityScrub({
  scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
  selection,
  hostRef,
});
```

- [ ] **Step 3: Render the HUD inside `.wd-canvas-host`**

Find the existing element `<div className="wd-canvas-host" ref={hostRef} ...>` (around line 1354). Inside it, as the *first* child (so it sits above subsequent canvas content but still inside the positioned host), add:

```tsx
<OpacityHud percent={opacityScrubPercent} />
```

- [ ] **Step 4: Typecheck and run the dev server**

```
cd apps/draw && npx tsc --noEmit
```

Expected: clean.

Then start the dev server in the background (per user preference, agent launches it):

```
cd apps/draw && npm run dev
```

Note the URL it prints.

- [ ] **Step 5: Manual verification**

Open the dev server URL. Then:

1. Draw two shapes with different fill/stroke alphas (use the swatches in the properties panel to set fill α=80%, stroke α=40% on one).
2. Select one shape. Press and hold `O`. The HUD should appear top-center of the workspace, showing the current opacity %.
3. Scroll the wheel: down → opacity decreases by 5%/notch; up → increases. Shift+wheel → 1%/notch.
4. Release `O`: HUD fades out (~200ms).
5. Open the History panel. Verify the entire scrub session collapsed into a single "Adjust opacity" entry. Undo it — the original paints come back.
6. Select both shapes, hold O, scrub: both shapes' opacities scale together; their internal fill:stroke α ratios remain (within rounding).
7. Click into a text input (e.g. a number field in the properties panel), press O — nothing happens, the letter "o" types normally.
8. With nothing selected, press O — nothing happens.

If any of these fail, fix before committing.

- [ ] **Step 6: Commit**

```
git add apps/draw/src/App.tsx
git commit -m "feat(apps/draw): wire hold-O opacity scrub + HUD"
```

---

## Self-Review (checked by author before handoff)

**Spec coverage:**
- Activation rules (KeyO, no modifiers, no typing target, requires selection ≥ 1) → Task 3 step 1, `onKeyDown`.
- 5%/notch + Shift = 1% → Task 3 step 1, `COARSE_STEP`/`FINE_STEP`.
- Scale both alphas, preserve ratio, clamp by brighter paint → Task 1 (`computeScrubbedPaints`).
- Skip unsupported paints silently → Task 1, `isHexColor` guard; covered by test "skips non-hex string paints".
- One undo entry per session → Task 3, `jumpToHistoryIndex` + final `scene.batch('Adjust opacity', ...)`.
- HUD chip in workspace → Task 2 + Task 4 step 3.
- Window blur ends session → Task 3, `onBlur` handler.

**Placeholders:** none — all code is concrete.

**Type consistency:** `PaintSnapshot` defined in Task 1, imported and reused in Task 3. `OpacityHudProps.percent` (Task 2) matches the `percent` returned by `useOpacityScrub` (Task 3).

**Known fragility (acceptable for a spike):**
- The cast in Task 4 step 2 is a spike escape hatch; if the published `scene` type already includes `historyIndex`/`jumpToHistoryIndex`, drop the cast.
- `WeaselDrawData` import path assumes a file at `apps/draw/src/weaselDrawData.ts`. If it actually lives elsewhere (e.g. inlined in `App.tsx`), either re-export it from there or inline the relevant fields in the hook.
