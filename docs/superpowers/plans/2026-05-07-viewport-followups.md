# Viewport Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship inertial pan, animated zoom transitions, and touch pinch-zoom as composable primitives and tool-level hooks, then reshape the `SceneCanvas` prop surface into grouped `geometry`/`selectTool`/`insertTool`/`viewport` props.

**Architecture:** Four new viewport primitives (`useVelocityTracker`, `useDecayLoop`, `useViewTween`, `usePinchGesture`) power three tool-layer features. `SceneCanvas` gains a grouped prop surface that replaces nine flat props; the reshape is a mechanical breaking change with no behavioral change. These two phases are independent — primitives/tools can ship first.

**Tech Stack:** React hooks, `requestAnimationFrame`, `PointerEvent`, existing `zoomAt` / `clampView` / `viewToTransform` / `worldToScreen` utilities.

---

## Scope note

Two independent sub-plans in one file:
- **Phase 1 (Tasks 1–9):** Viewport primitives + tool modifications. No demo changes required.
- **Phase 2 (Tasks 10–12):** SceneCanvas API reshape + demo migration. No new behavior.

---

## Phase 1: Viewport primitives and tools

---

### Task 1: `useVelocityTracker`

**Files:**
- Create: `src/features/viewport/useVelocityTracker.ts`
- Create: `src/features/viewport/useVelocityTracker.test.ts`

- [ ] **Write failing tests**

```ts
// src/features/viewport/useVelocityTracker.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVelocityTracker } from './useVelocityTracker';

describe('useVelocityTracker', () => {
  it('returns zero velocity with no samples', () => {
    const { result } = renderHook(() => useVelocityTracker());
    expect(result.current.getVelocity()).toEqual({ vx: 0, vy: 0 });
  });

  it('returns zero velocity with one sample (need two for delta)', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(10, 5, 1000);
    expect(result.current.getVelocity()).toEqual({ vx: 0, vy: 0 });
  });

  it('computes average velocity over recorded samples', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(10, 4, 1000);
    result.current.record(10, 4, 1050);
    result.current.record(10, 4, 1100);
    // total dx=20, dy=8 over 100ms
    const v = result.current.getVelocity();
    expect(v.vx).toBeCloseTo(0.2);
    expect(v.vy).toBeCloseTo(0.08);
  });

  it('excludes samples older than 100ms', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(100, 100, 900);  // older than 100ms ago
    result.current.record(10, 4, 1050);
    result.current.record(10, 4, 1100);
    // only the last two count; total dx=10, dy=4 over 50ms
    const v = result.current.getVelocity();
    expect(v.vx).toBeCloseTo(0.2);
    expect(v.vy).toBeCloseTo(0.08);
  });

  it('reset clears all samples', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(10, 5, 1000);
    result.current.record(10, 5, 1050);
    result.current.reset();
    expect(result.current.getVelocity()).toEqual({ vx: 0, vy: 0 });
  });
});
```

- [ ] **Run tests — expect FAIL** (`useVelocityTracker` not found)

```bash
npx vitest run src/features/viewport/useVelocityTracker.test.ts
```

- [ ] **Implement**

```ts
// src/features/viewport/useVelocityTracker.ts
import { useMemo, useRef } from 'react';

interface Sample { dx: number; dy: number; t: number }

export function useVelocityTracker() {
  const samplesRef = useRef<Sample[]>([]);
  return useMemo(() => ({
    record(dx: number, dy: number, t: number) {
      samplesRef.current.push({ dx, dy, t });
      const cutoff = t - 100;
      samplesRef.current = samplesRef.current.filter(s => s.t >= cutoff);
    },
    getVelocity(): { vx: number; vy: number } {
      const s = samplesRef.current;
      if (s.length < 2) return { vx: 0, vy: 0 };
      const dt = s[s.length - 1].t - s[0].t;
      if (dt === 0) return { vx: 0, vy: 0 };
      const totalDx = s.slice(1).reduce((acc, p) => acc + p.dx, 0);
      const totalDy = s.slice(1).reduce((acc, p) => acc + p.dy, 0);
      return { vx: totalDx / dt, vy: totalDy / dt };
    },
    reset() { samplesRef.current = []; },
  }), []);
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/features/viewport/useVelocityTracker.test.ts
```

- [ ] **Commit**

```bash
git add src/features/viewport/useVelocityTracker.ts src/features/viewport/useVelocityTracker.test.ts
git commit -m "feat(viewport): add useVelocityTracker primitive"
```

---

### Task 2: `useDecayLoop`

**Files:**
- Create: `src/features/viewport/useDecayLoop.ts`
- Create: `src/features/viewport/useDecayLoop.test.ts`

- [ ] **Write failing tests**

Fake RAF by replacing `requestAnimationFrame` with a manually-stepped version.

```ts
// src/features/viewport/useDecayLoop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDecayLoop } from './useDecayLoop';

// RAF fake: collect callbacks and step them manually
let rafCallbacks: Array<(t: number) => void> = [];
let rafTime = 0;

function stepRAF(dt = 16) {
  rafTime += dt;
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb(rafTime);
}

beforeEach(() => {
  rafCallbacks = [];
  rafTime = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    rafCallbacks[id - 1] = () => {};
  });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('useDecayLoop', () => {
  it('calls onTick with decaying deltas each frame', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick });
    });
    act(() => { stepRAF(16); });
    act(() => { stepRAF(16); });
    expect(onTick).toHaveBeenCalledTimes(2);
    const [[dx1], [dx2]] = onTick.mock.calls;
    expect(dx1).toBeGreaterThan(dx2);  // velocity decaying
    expect(dx1).toBeGreaterThan(0);
  });

  it('stops calling onTick when speed drops below minSpeed', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 0.001, vy: 0 }, friction: 0.5, minSpeed: 0.01, onTick });
    });
    // First frame: velocity 0.001 < minSpeed 0.01 → should stop immediately
    act(() => { stepRAF(16); });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('cancel() stops the loop', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 1, vy: 0 }, friction: 0.9, minSpeed: 0.001, onTick });
    });
    act(() => { stepRAF(16); });
    act(() => { result.current.cancel(); });
    act(() => { stepRAF(16); });
    expect(onTick).toHaveBeenCalledTimes(1);  // only the first frame
  });

  it('calls onEnd when loop stops naturally', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDecayLoop());
    act(() => {
      result.current.start({ velocity: { vx: 0.001, vy: 0 }, friction: 0.5, minSpeed: 0.01, onEnd });
    });
    act(() => { stepRAF(16); });
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/features/viewport/useDecayLoop.test.ts
```

- [ ] **Implement**

```ts
// src/features/viewport/useDecayLoop.ts
import { useCallback, useEffect, useRef } from 'react';

export interface DecayLoopConfig {
  velocity: { vx: number; vy: number };
  friction?: number;
  minSpeed?: number;
  onTick: (dx: number, dy: number) => void;
  onEnd?: () => void;
}

export function useDecayLoop() {
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<{
    vx: number; vy: number;
    friction: number; minSpeed: number;
    lastTime: number | null;
    onTick: (dx: number, dy: number) => void;
    onEnd?: () => void;
  } | null>(null);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stateRef.current = null;
  }, []);

  const tick = useCallback((now: number) => {
    const s = stateRef.current;
    if (!s) return;
    if (s.lastTime === null) {
      s.lastTime = now;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(now - s.lastTime, 64);  // cap at 64ms to avoid huge jumps
    s.lastTime = now;
    // Time-normalize friction to 60fps baseline
    const f = Math.pow(s.friction, dt / 16.67);
    s.vx *= f;
    s.vy *= f;
    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (speed < s.minSpeed) {
      stateRef.current = null;
      rafRef.current = null;
      s.onEnd?.();
      return;
    }
    s.onTick(s.vx * dt, s.vy * dt);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback((config: DecayLoopConfig) => {
    cancel();
    const { velocity, friction = 0.92, minSpeed = 0.01, onTick, onEnd } = config;
    const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2);
    if (speed < minSpeed) { onEnd?.(); return; }
    stateRef.current = { vx: velocity.vx, vy: velocity.vy, friction, minSpeed, lastTime: null, onTick, onEnd };
    rafRef.current = requestAnimationFrame(tick);
  }, [cancel, tick]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { start, cancel };
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/features/viewport/useDecayLoop.test.ts
```

- [ ] **Commit**

```bash
git add src/features/viewport/useDecayLoop.ts src/features/viewport/useDecayLoop.test.ts
git commit -m "feat(viewport): add useDecayLoop primitive"
```

---

### Task 3: `useViewTween`

**Files:**
- Create: `src/features/viewport/useViewTween.ts`
- Create: `src/features/viewport/useViewTween.test.ts`

- [ ] **Write failing tests**

Use the same RAF-fake pattern from Task 2.

```ts
// src/features/viewport/useViewTween.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewTween } from './useViewTween';
import type { View } from './view';

let rafCallbacks: Array<(t: number) => void> = [];
let rafTime = 0;
function stepRAF(dt = 16) {
  rafTime += dt;
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb(rafTime);
}
beforeEach(() => {
  rafCallbacks = []; rafTime = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const from: View = { x: 0, y: 0, scale: 1 };
const to: View = { x: 100, y: 50, scale: 2 };

describe('useViewTween', () => {
  it('does not call setView before any animateTo', () => {
    const setView = vi.fn();
    renderHook(() => useViewTween(setView));
    expect(setView).not.toHaveBeenCalled();
  });

  it('calls setView at t=0 (first frame: interpolated start)', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    act(() => { result.current.animateTo(from, to, { duration: 100 }); });
    act(() => { stepRAF(0); });  // first frame at t=0
    expect(setView).toHaveBeenCalled();
    const v = setView.mock.calls[0][0] as View;
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.scale).toBeCloseTo(1);
  });

  it('reaches target at end of duration', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    act(() => { result.current.animateTo(from, to, { duration: 100 }); });
    // Step past duration
    act(() => { stepRAF(0); stepRAF(100); });
    const last = setView.mock.calls[setView.mock.calls.length - 1][0] as View;
    expect(last.x).toBeCloseTo(100);
    expect(last.y).toBeCloseTo(50);
    expect(last.scale).toBeCloseTo(2);
  });

  it('second animateTo cancels the first', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    const to2: View = { x: 200, y: 0, scale: 1 };
    act(() => { result.current.animateTo(from, to, { duration: 200 }); });
    act(() => { stepRAF(50); });
    act(() => { result.current.animateTo(from, to2, { duration: 100 }); });
    act(() => { stepRAF(100); });
    const last = setView.mock.calls[setView.mock.calls.length - 1][0] as View;
    expect(last.x).toBeCloseTo(200);
  });

  it('cancel() stops the tween mid-flight', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    act(() => { result.current.animateTo(from, to, { duration: 200 }); });
    act(() => { stepRAF(50); });
    const callCount = setView.mock.calls.length;
    act(() => { result.current.cancel(); stepRAF(50); });
    expect(setView).toHaveBeenCalledTimes(callCount);
  });
});
```

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/features/viewport/useViewTween.test.ts
```

- [ ] **Implement**

```ts
// src/features/viewport/useViewTween.ts
import { useCallback, useEffect, useRef } from 'react';
import type { View } from './view';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpView(from: View, to: View, t: number): View {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), scale: lerp(from.scale, to.scale, t) };
}

export function useViewTween(setView: (v: View) => void) {
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

  const rafRef = useRef<number | null>(null);
  const tweenRef = useRef<{ from: View; to: View; duration: number; easing: (t: number) => number; startTime: number | null } | null>(null);
  const isAnimatingRef = useRef(false);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    tweenRef.current = null;
    isAnimatingRef.current = false;
  }, []);

  const tick = useCallback((now: number) => {
    const tw = tweenRef.current;
    if (!tw) return;
    if (tw.startTime === null) tw.startTime = now;
    const elapsed = now - tw.startTime;
    const t = tw.easing(Math.min(elapsed / tw.duration, 1));
    setViewRef.current(lerpView(tw.from, tw.to, t));
    if (elapsed >= tw.duration) {
      tweenRef.current = null;
      rafRef.current = null;
      isAnimatingRef.current = false;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const animateTo = useCallback((
    from: View,
    to: View,
    opts?: { duration?: number; easing?: (t: number) => number },
  ) => {
    cancel();
    tweenRef.current = {
      from, to,
      duration: opts?.duration ?? 250,
      easing: opts?.easing ?? easeOutCubic,
      startTime: null,
    };
    isAnimatingRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [cancel, tick]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { animateTo, cancel, isAnimating: isAnimatingRef };
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/features/viewport/useViewTween.test.ts
```

- [ ] **Commit**

```bash
git add src/features/viewport/useViewTween.ts src/features/viewport/useViewTween.test.ts
git commit -m "feat(viewport): add useViewTween primitive"
```

---

### Task 4: `usePinchGesture`

**Files:**
- Create: `src/features/viewport/usePinchGesture.ts`
- Create: `src/features/viewport/usePinchGesture.test.ts`

- [ ] **Write failing tests**

```ts
// src/features/viewport/usePinchGesture.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { usePinchGesture } from './usePinchGesture';

function makeCanvas() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: vi.fn((type: string, cb: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb);
    }),
    fire(type: string, event: Partial<PointerEvent>) {
      for (const cb of listeners.get(type) ?? []) cb(event as PointerEvent);
    },
  } as unknown as HTMLCanvasElement & { fire(type: string, e: Partial<PointerEvent>): void };
}

function makePointer(id: number, x: number, y: number): Partial<PointerEvent> {
  return { pointerId: id, clientX: x, clientY: y, type: 'pointermove' };
}

describe('usePinchGesture', () => {
  it('does not call onPinch with fewer than two pointers', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const onPinch = vi.fn();
    renderHook(() => usePinchGesture(canvasRef as any, onPinch));
    act(() => { canvas.fire('pointerdown', makePointer(1, 0, 0)); });
    act(() => { canvas.fire('pointermove', makePointer(1, 10, 10)); });
    expect(onPinch).not.toHaveBeenCalled();
  });

  it('calls onPinch with scaleFactor when two pointers are active', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const onPinch = vi.fn();
    renderHook(() => usePinchGesture(canvasRef as any, onPinch));
    // Two fingers at distance 100
    act(() => { canvas.fire('pointerdown', makePointer(1, 0, 0)); });
    act(() => { canvas.fire('pointerdown', makePointer(2, 100, 0)); });
    // Move to distance 200 → scaleFactor = 200/100 = 2... but it's delta-based per frame
    // After second pointer down, start distance = 100, midpoint = (50, 0)
    act(() => { canvas.fire('pointermove', makePointer(2, 200, 0)); });
    expect(onPinch).toHaveBeenCalled();
    const [anchor, factor] = onPinch.mock.calls[0];
    expect(factor).toBeCloseTo(2);        // 200/100
    expect(anchor.x).toBeCloseTo(100);    // midpoint of (0,0) and (200,0)
  });

  it('resets when a pointer lifts', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const onPinch = vi.fn();
    renderHook(() => usePinchGesture(canvasRef as any, onPinch));
    act(() => { canvas.fire('pointerdown', makePointer(1, 0, 0)); });
    act(() => { canvas.fire('pointerdown', makePointer(2, 100, 0)); });
    act(() => { canvas.fire('pointerup', { pointerId: 2 } as any); });
    onPinch.mockClear();
    act(() => { canvas.fire('pointermove', makePointer(1, 50, 0)); });
    expect(onPinch).not.toHaveBeenCalled();
  });

  it('removes listeners on unmount', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const { unmount } = renderHook(() => usePinchGesture(canvasRef as any, vi.fn()));
    unmount();
    expect(canvas.removeEventListener).toHaveBeenCalled();
  });
});
```

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/features/viewport/usePinchGesture.test.ts
```

- [ ] **Implement**

```ts
// src/features/viewport/usePinchGesture.ts
import { useEffect, useRef } from 'react';

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function usePinchGesture(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onPinch: (anchor: { x: number; y: number }, scaleFactor: number) => void,
) {
  const onPinchRef = useRef(onPinch);
  onPinchRef.current = onPinch;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let startDist: number | null = null;

    function getTwo(): [{ x: number; y: number }, { x: number; y: number }] | null {
      const vals = [...pointers.values()];
      if (vals.length < 2) return null;
      return [vals[0], vals[1]];
    }

    function onDown(e: PointerEvent) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const two = getTwo();
      if (two) startDist = dist(two[0], two[1]);
    }
    function onMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const two = getTwo();
      if (!two || startDist === null) return;
      const currentDist = dist(two[0], two[1]);
      const anchor = mid(two[0], two[1]);
      const factor = currentDist / startDist;
      startDist = currentDist;  // delta-based: reset each frame
      onPinchRef.current(anchor, factor);
    }
    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startDist = null;
    }

    el.addEventListener('pointerdown', onDown as EventListener);
    el.addEventListener('pointermove', onMove as EventListener);
    el.addEventListener('pointerup', onUp as EventListener);
    el.addEventListener('pointercancel', onUp as EventListener);
    return () => {
      el.removeEventListener('pointerdown', onDown as EventListener);
      el.removeEventListener('pointermove', onMove as EventListener);
      el.removeEventListener('pointerup', onUp as EventListener);
      el.removeEventListener('pointercancel', onUp as EventListener);
    };
  }, [canvasRef]);
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/features/viewport/usePinchGesture.test.ts
```

- [ ] **Commit**

```bash
git add src/features/viewport/usePinchGesture.ts src/features/viewport/usePinchGesture.test.ts
git commit -m "feat(viewport): add usePinchGesture primitive"
```

---

### Task 5: `useViewAnimation`

**Files:**
- Create: `src/features/viewport/useViewAnimation.ts`
- Create: `src/features/viewport/useViewAnimation.test.ts`

- [ ] **Write failing tests**

```ts
// src/features/viewport/useViewAnimation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewAnimation } from './useViewAnimation';

describe('useViewAnimation', () => {
  it('returns animateTo and cancel', () => {
    const { result } = renderHook(() => useViewAnimation(vi.fn()));
    expect(typeof result.current.animateTo).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('animateTo calls setView', () => {
    const setView = vi.fn();
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 1; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const { result } = renderHook(() => useViewAnimation(setView));
    result.current.animateTo({ x: 0, y: 0, scale: 1 }, { x: 10, y: 0, scale: 1 });
    expect(setView).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
```

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/features/viewport/useViewAnimation.test.ts
```

- [ ] **Implement**

```ts
// src/features/viewport/useViewAnimation.ts
import { useViewTween } from './useViewTween';
import type { View } from './view';

export function useViewAnimation(setView: (v: View) => void) {
  const { animateTo, cancel } = useViewTween(setView);
  return { animateTo, cancel };
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/features/viewport/useViewAnimation.test.ts
```

- [ ] **Commit**

```bash
git add src/features/viewport/useViewAnimation.ts src/features/viewport/useViewAnimation.test.ts
git commit -m "feat(viewport): add useViewAnimation public hook"
```

---

### Task 6: Barrel exports for new primitives

**Files:**
- Modify: `src/index.ts`

- [ ] **Add exports after the existing viewport exports** (after the `wheelHandler` and `clientToCanvas` lines)

Open `src/index.ts` and add after the existing `export { clientToCanvas }` line:

```ts
export { useVelocityTracker } from './features/viewport/useVelocityTracker';
export { useDecayLoop } from './features/viewport/useDecayLoop';
export type { DecayLoopConfig } from './features/viewport/useDecayLoop';
export { useViewTween } from './features/viewport/useViewTween';
export { usePinchGesture } from './features/viewport/usePinchGesture';
export { useViewAnimation } from './features/viewport/useViewAnimation';
```

- [ ] **Verify typecheck passes**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/index.ts
git commit -m "feat(viewport): export new viewport primitives from barrel"
```

---

### Task 7: `useHandTool` inertia option

**Files:**
- Modify: `src/tools/builtin/useHandTool.ts`
- Modify: `src/tools/builtin/useHandTool.test.ts`

- [ ] **Add failing tests for inertia** — append to the existing test file

```ts
// Add to src/tools/builtin/useHandTool.test.ts

// RAF fake (same pattern as Tasks 2-3)
// Insert before the describe block:
let rafCallbacks: Array<(t: number) => void> = [];
let rafTime = 0;
function stepRAF(dt = 16) {
  rafTime += dt;
  const cbs = rafCallbacks.splice(0);
  for (const cb of cbs) cb(rafTime);
}
beforeEach(() => {
  rafCallbacks = []; rafTime = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

// Add new describe block:
describe('useHandTool with inertia', () => {
  it('calls setView after drag ends when inertia is configured', () => {
    const { result } = renderHook(() => useHandTool({ inertia: { friction: 0.9, minSpeed: 0.0001 } }));
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0 }, setView);

    // Simulate a fast drag
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    tool.drag!.onMove!(fakeEvent(0, 0), { ...ctx, worldX: 0, worldY: 0 });
    for (let i = 1; i <= 5; i++) {
      tool.drag!.onMove!(fakeEvent(i * 10, 0), { ...ctx, worldX: 0, worldY: 0 });
    }
    setView.mockClear();
    tool.drag!.onEnd!(fakeEvent(50, 0), ctx);
    // RAF fires → inertia tick → setView
    act(() => { stepRAF(16); });
    expect(setView).toHaveBeenCalled();
  });

  it('cancels decay on next drag start', () => {
    const { result } = renderHook(() => useHandTool({ inertia: { friction: 0.9, minSpeed: 0.0001 } }));
    const tool = result.current;
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0 }, setView);

    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    for (let i = 1; i <= 3; i++) tool.drag!.onMove!(fakeEvent(i * 10, 0), ctx);
    tool.drag!.onEnd!(fakeEvent(30, 0), ctx);
    act(() => { stepRAF(16); });
    setView.mockClear();

    // New drag starts → decay cancelled
    tool.drag!.onStart!(fakeEvent(0, 0), ctx);
    act(() => { stepRAF(16); });
    // setView may be called once by onStart but not by decay
    const decayCalls = setView.mock.calls.filter(([v]) => v.x !== 0 || v.y !== 0);
    expect(decayCalls.length).toBe(0);
  });
});
```

You'll need to add `act` and `beforeEach`/`afterEach` imports: `import { act } from '@testing-library/react';` and `import { beforeEach, afterEach } from 'vitest';`.

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/tools/builtin/useHandTool.test.ts
```

- [ ] **Implement inertia in `useHandTool`**

Replace the full file with:

```ts
// src/tools/builtin/useHandTool.ts
import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { View } from '../../features/viewport/view';
import { useVelocityTracker } from '../../features/viewport/useVelocityTracker';
import { useDecayLoop } from '../../features/viewport/useDecayLoop';

export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  boundary?: 'stop' | 'bounce';
}

export interface UseHandToolOptions {
  inertia?: false | InertiaConfig;
}

interface HandScratch {
  startView: View;
  startClientX: number;
  startClientY: number;
}

export function useHandTool(opts: UseHandToolOptions = {}): Tool<HandScratch | null> {
  const inertia = opts.inertia === false ? false : opts.inertia;
  const tracker = useVelocityTracker();
  const decay = useDecayLoop();
  const setViewRef = useRef<((v: View) => void) | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });

  return useMemo(
    () =>
      defineTool<HandScratch | null>({
        id: 'hand',
        keybinding: 'H',
        hotkey: 'space',
        initScratch: () => null,
        cursor: (ctx) => (ctx.scratch ? 'grabbing' : 'grab'),
        drag: {
          onStart: (e, ctx) => {
            decay.cancel();
            tracker.reset();
            setViewRef.current = ctx.setView;
            viewRef.current = ctx.view;
            ctx.scratch = {
              startView: ctx.view,
              startClientX: e.clientX,
              startClientY: e.clientY,
            };
            return 'claim';
          },
          onMove: (e, ctx) => {
            if (!ctx.scratch) return 'pass';
            const dx = e.clientX - ctx.scratch.startClientX;
            const dy = e.clientY - ctx.scratch.startClientY;
            const newView = {
              x: ctx.scratch.startView.x - dx,
              y: ctx.scratch.startView.y - dy,
              scale: ctx.scratch.startView.scale,
            };
            if (inertia) {
              tracker.record(newView.x - viewRef.current.x, newView.y - viewRef.current.y, Date.now());
            }
            viewRef.current = newView;
            setViewRef.current = ctx.setView;
            ctx.setView(newView);
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            ctx.scratch = null;
            if (inertia) {
              setViewRef.current = ctx.setView;
              viewRef.current = ctx.view;
              const velocity = tracker.getVelocity();
              decay.start({
                velocity,
                friction: inertia.friction,
                minSpeed: inertia.minSpeed,
                onTick: (dvx, dvy) => {
                  const v = viewRef.current;
                  const next = { x: v.x + dvx, y: v.y + dvy, scale: v.scale };
                  viewRef.current = next;
                  setViewRef.current?.(next);
                },
              });
            }
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
            decay.cancel();
          },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertia, tracker, decay],
  );
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/tools/builtin/useHandTool.test.ts
```

- [ ] **Commit**

```bash
git add src/tools/builtin/useHandTool.ts src/tools/builtin/useHandTool.test.ts
git commit -m "feat(tools): add inertia option to useHandTool"
```

---

### Task 8: `usePinchZoomTool`

`usePinchZoomTool` is a standalone hook (not a standard `Tool` record) because it needs direct canvas element access to attach `PointerEvent` listeners. Consumers pass a `canvasRef`; `SceneCanvas` uses its internal canvas ref.

**Files:**
- Create: `src/tools/builtin/usePinchZoomTool.ts`
- Create: `src/tools/builtin/usePinchZoomTool.test.ts`
- Modify: `src/tools/builtin/index.ts`

- [ ] **Write failing tests**

```ts
// src/tools/builtin/usePinchZoomTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePinchZoomTool } from './usePinchZoomTool';
import type { View } from '../../features/viewport/view';

function makeCanvas() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: vi.fn((t: string, cb: EventListener) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(cb);
    }),
    removeEventListener: vi.fn(),
    fire(type: string, e: Partial<PointerEvent>) {
      for (const cb of listeners.get(type) ?? []) cb(e as PointerEvent);
    },
  } as unknown as HTMLCanvasElement & { fire(t: string, e: Partial<PointerEvent>): void };
}

describe('usePinchZoomTool', () => {
  it('calls setView with zoomed view on pinch', () => {
    const canvas = makeCanvas();
    const canvasRef = { current: canvas };
    const setView = vi.fn();
    const view: View = { x: 0, y: 0, scale: 1 };

    renderHook(() => usePinchZoomTool(canvasRef as any, view, setView));

    // Two fingers: start at distance 100
    act(() => { canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 } as any); });
    act(() => { canvas.fire('pointerdown', { pointerId: 2, clientX: 100, clientY: 0 } as any); });
    // Move second finger to 200 → distance doubles → scale doubles
    act(() => { canvas.fire('pointermove', { pointerId: 2, clientX: 200, clientY: 0 } as any); });

    expect(setView).toHaveBeenCalled();
    const newView = setView.mock.calls[0][0] as View;
    expect(newView.scale).toBeCloseTo(2);
  });
});
```

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/tools/builtin/usePinchZoomTool.test.ts
```

- [ ] **Implement**

```ts
// src/tools/builtin/usePinchZoomTool.ts
import { useRef } from 'react';
import { usePinchGesture } from '../../features/viewport/usePinchGesture';
import { zoomAt } from '../../features/viewport/zoomAt';
import { clientToCanvas } from '../../features/viewport/clientToCanvas';
import { viewToTransform } from '../../features/viewport/view';
import { screenToWorld } from '../../features/viewport/viewTransform';
import type { View } from '../../features/viewport/view';

export interface PinchZoomToolOpts {
  min?: number;
  max?: number;
}

export function usePinchZoomTool(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  view: View,
  setView: (v: View) => void,
  opts: PinchZoomToolOpts = {},
) {
  const viewRef = useRef(view);
  viewRef.current = view;
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  const { min = 0.1, max = 8 } = opts;

  usePinchGesture(canvasRef, (screenAnchor, scaleFactor) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const canvasAnchor = clientToCanvas(el, { x: screenAnchor.x, y: screenAnchor.y });
    const t = viewToTransform(viewRef.current);
    const [wx, wy] = screenToWorld(canvasAnchor.x, canvasAnchor.y, t);
    const newView = zoomAt(viewRef.current, { x: wx, y: wy }, scaleFactor, { min, max });
    setViewRef.current(newView);
  });
}
```

Note: check the actual signatures of `clientToCanvas` and `screenToWorld` before implementing — they may differ slightly. `clientToCanvas` converts `clientX/Y` to canvas-element-relative coords; `screenToWorld` takes those to world coords.

- [ ] **Check `clientToCanvas` signature**

```bash
grep -n "export function clientToCanvas" /Users/mike/src/weasel/src/features/viewport/clientToCanvas.ts
```

Adjust the call if the signature differs from what's shown above.

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/tools/builtin/usePinchZoomTool.test.ts
```

- [ ] **Add export to builtin index**

Add to `src/tools/builtin/index.ts`:

```ts
export { usePinchZoomTool, type PinchZoomToolOpts } from './usePinchZoomTool';
```

- [ ] **Commit**

```bash
git add src/tools/builtin/usePinchZoomTool.ts src/tools/builtin/usePinchZoomTool.test.ts src/tools/builtin/index.ts
git commit -m "feat(tools): add usePinchZoomTool for two-finger pinch zoom"
```

---

### Task 9: `useKeyboardZoomTool` animate option

**Files:**
- Modify: `src/tools/builtin/useKeyboardZoomTool.ts`
- Modify: `src/tools/builtin/useKeyboardZoomTool.test.ts`

- [ ] **Add failing tests for `animate` option** — append to the existing test file

Read `src/tools/builtin/useKeyboardZoomTool.test.ts` first to understand existing test structure, then add:

```ts
// Append to useKeyboardZoomTool.test.ts
describe('useKeyboardZoomTool with animate:true', () => {
  it('does not call setView immediately when animate is true', () => {
    // RAF fake — must be set up before calling the hook
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

    const { result } = renderHook(() => useKeyboardZoomTool({ animate: true }));
    const setView = vi.fn();
    // Build a fake ToolCtx — copy the helper from the existing tests in this file
    const ctx = /* use same makeCtx helper already in this file */ makeCtx(setView);
    const e = new KeyboardEvent('keydown', { key: '=', metaKey: true });
    result.current.keyboard!.onDown!(e, ctx);
    // setView should NOT have been called synchronously (tween defers it)
    expect(setView).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
```

Check the existing test file for the `makeCtx` helper shape and replicate it.

- [ ] **Run tests — expect FAIL**

```bash
npx vitest run src/tools/builtin/useKeyboardZoomTool.test.ts
```

- [ ] **Implement**

```ts
// src/tools/builtin/useKeyboardZoomTool.ts
import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { zoomAt } from '../../features/viewport/zoomAt';
import { useViewTween } from '../../features/viewport/useViewTween';
import type { View } from '../../features/viewport/view';

export interface KeyboardZoomToolOpts {
  min?: number;
  max?: number;
  keyStep?: number;
  animate?: boolean;
}

export function useKeyboardZoomTool(opts: KeyboardZoomToolOpts = {}): Tool<null> {
  const { min, max, animate = false } = opts;
  const keyStep = opts.keyStep ?? 1.25;

  const setViewRef = useRef<((v: View) => void) | null>(null);
  const tween = useViewTween((v) => setViewRef.current?.(v));

  return useMemo(
    () =>
      defineTool<null>({
        id: 'keyboard-zoom',
        initScratch: () => null,
        keyboard: {
          onDown: (e, ctx) => {
            if (!(e.metaKey || e.ctrlKey)) return 'pass';
            setViewRef.current = ctx.setView;
            const rect = ctx.canvasRect;
            const center = { x: rect.width / 2, y: rect.height / 2 };

            let target: View | null = null;
            if (e.key === '=' || e.key === '+') {
              e.preventDefault();
              target = zoomAt(ctx.view, center, keyStep, { min, max });
            } else if (e.key === '-' || e.key === '_') {
              e.preventDefault();
              target = zoomAt(ctx.view, center, 1 / keyStep, { min, max });
            } else if (e.key === '0') {
              e.preventDefault();
              target = { x: 0, y: 0, scale: 1 };
            }

            if (!target) return 'pass';
            if (animate) {
              const duration = e.key === '0' ? 350 : 200;
              tween.animateTo(ctx.view, target, { duration });
            } else {
              ctx.setView(target);
            }
            return 'claim';
          },
        },
      }),
    [min, max, keyStep, animate, tween],
  );
}
```

- [ ] **Run tests — expect PASS**

```bash
npx vitest run src/tools/builtin/useKeyboardZoomTool.test.ts
```

- [ ] **Add `usePinchZoomTool` to barrel** (`src/index.ts`) — add alongside existing tool exports:

```ts
export { usePinchZoomTool, type PinchZoomToolOpts } from './tools/builtin/usePinchZoomTool';
```

- [ ] **Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/tools/builtin/useKeyboardZoomTool.ts src/tools/builtin/useKeyboardZoomTool.test.ts src/index.ts
git commit -m "feat(tools): add animate option to useKeyboardZoomTool"
```

---

## Phase 2: SceneCanvas API reshape

This phase is a **breaking change** — it removes nine flat `SceneCanvas` props and replaces them with four grouped props. No new behavior. All existing demos must be migrated in Task 12.

---

### Task 10: SceneCanvas `geometry`, `selectTool`, `insertTool` props

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`

Read `src/canvas/SceneCanvas.tsx` in full before editing. The key changes are:

**Props removed:** `moveOptions`, `resizeOptions`, `rotateOptions`, `snap`, `pickEvery`, `boundsOf`, `handleHitRadius`, `commitInsert`, `insertLayer`

**Props added:**

```ts
geometry?: {
  pickEvery?: (worldX: number, worldY: number) => string | null;
  boundsOf?: (id: string) => Bounds | null;
};
selectTool?: {
  move?: UseMoveOptions<TPose>;
  resize?: UseResizeOptions<TPose>;
  rotate?: UseRotateOptions<TPose>;
  snap?: SnapStrategy<TPose>;
  handleHitRadius?: number;
};
insertTool?: {
  create: (bounds: { x: number; y: number; width: number; height: number }) => { pose: TPose; data: TData; id?: string } | null;
  layer?: TLayer;
};
```

- [ ] **Update the `SceneCanvasProps` type** — remove the nine flat props from the `Omit<CanvasProps...>` union and the `& { ... }` extension block; add `geometry?`, `selectTool?`, `insertTool?` in their place.

- [ ] **Update destructuring** in `SceneCanvasInner` — replace:

```ts
const {
  scene,
  gestures,
  commitInsert,
  insertLayer,
  ...
  moveOptions,
  resizeOptions,
  rotateOptions,
  selection: selectionProp,
  ...
  snap,
  pickEvery: pickEveryProp,
  boundsOf: boundsOfProp,
  handleHitRadius,
  tools: toolsProp,
  ambient,
  ...rest
} = props;
```

with:

```ts
const {
  scene,
  gestures,
  geometry,
  selectTool: selectToolOpts,
  insertTool,
  selection: selectionProp,
  selectionOptions,
  tools: toolsProp,
  ambient,
  layers,
  ...rest
} = props;

const pickEveryProp = geometry?.pickEvery;
const boundsOfProp = geometry?.boundsOf;
const moveOptions = selectToolOpts?.move;
const resizeOptions = selectToolOpts?.resize;
const rotateOptions = selectToolOpts?.rotate;
const snap = selectToolOpts?.snap;
const handleHitRadius = selectToolOpts?.handleHitRadius;
const commitInsert = insertTool?.create;
const insertLayer = insertTool?.layer;
```

The rest of the function body remains unchanged — `pickEveryProp`, `boundsOfProp`, `moveOptions`, etc. are still used the same way internally.

- [ ] **Typecheck**

```bash
npx tsc --noEmit
```

Expected: errors in demo files using the old flat props (those are fixed in Task 12).

- [ ] **Commit just the SceneCanvas change**

```bash
git add src/canvas/SceneCanvas.tsx
git commit -m "feat(canvas): reshape SceneCanvas props into geometry/selectTool/insertTool groups

Breaking: removes moveOptions, resizeOptions, rotateOptions, snap, pickEvery,
boundsOf, handleHitRadius, commitInsert, insertLayer flat props. Wrap into
geometry={{ pickEvery, boundsOf }}, selectTool={{ move, resize, rotate, snap,
handleHitRadius }}, insertTool={{ create, layer }} instead."
```

---

### Task 11: SceneCanvas `viewport` prop

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`

This adds the `viewport` prop and wires inertia, pinchZoom, and animatedZoom into the canvas's internal tool setup.

- [ ] **Add to `SceneCanvasProps`**:

```ts
viewport?: {
  inertia?: boolean | { friction?: number; boundary?: 'stop' | 'bounce'; minSpeed?: number };
  pinchZoom?: boolean | { min?: number; max?: number };
  animatedZoom?: boolean | { duration?: number; easing?: (t: number) => number };
};
```

- [ ] **Add imports** at the top of `SceneCanvas.tsx`:

```ts
import { usePinchZoomTool } from '../tools/builtin/usePinchZoomTool';
import { useHandTool } from '../tools/builtin/useHandTool';
import { useKeyboardZoomTool } from '../tools/builtin/useKeyboardZoomTool';
import { useRef } from 'react';
```

(Some of these may already be imported — check before adding duplicates.)

- [ ] **Destructure `viewport`** in `SceneCanvasInner`:

```ts
const { ..., viewport, ...rest } = props;
```

- [ ] **Add internal canvas ref** for pinch gesture (immediately after existing `useRef` calls):

```ts
const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
```

- [ ] **Resolve viewport config** (add near the top of the function body, before the existing `useHandTool` call if any):

```ts
const inertiaConfig = viewport?.inertia === true ? {} : (viewport?.inertia || false);
const pinchConfig = viewport?.pinchZoom === true ? {} : (viewport?.pinchZoom || null);
const animateConfig = viewport?.animatedZoom === true ? {} : (viewport?.animatedZoom || null);
```

- [ ] **Wire `usePinchZoomTool`** (called unconditionally — hooks can't be conditional):

```ts
// Always call; noop when pinchConfig is null
usePinchZoomTool(
  internalCanvasRef,
  // view and setView come from wherever SceneCanvas tracks them:
  internalView,        // see note below
  internalSetView,
  pinchConfig || {},
);
```

**Note on view/setView in SceneCanvas:** SceneCanvas currently passes `view`/`onViewChange`/`defaultView` through to Canvas via `...rest`. For `usePinchZoomTool`, SceneCanvas needs access to the current view and a setter. Read the existing SceneCanvas code to find how it accesses view state — it may already have a ref or local copy. If not, add:

```ts
const [internalView, setInternalView] = useState<View>({ x: 0, y: 0, scale: 1 });
```

and thread `onViewChange={(v) => setInternalView(v)}` through to Canvas only when `viewport` is set. The simplest approach: always track view locally and sync. Read the existing code carefully before adding duplicate state.

- [ ] **Wire ambient viewport tools** — find where SceneCanvas assembles the `ambient` array passed to Canvas. Add the viewport tools alongside it:

```ts
const viewportAmbient: AnyTool[] = [];
if (viewport?.animatedZoom) {
  viewportAmbient.push(useKeyboardZoomTool({ ...animateConfig, animate: true }));
}
// useHandTool with inertia is usually already in ambient — update its call to pass inertia config
```

**Important:** `useKeyboardZoomTool` and `useHandTool` are hooks — they must be called unconditionally at the top of the component, not conditionally. Restructure accordingly: always call both, but pass config only when the viewport prop is set.

- [ ] **Thread `internalCanvasRef` to Canvas** using a merged ref:

```ts
function useMergedRef<T>(
  a: React.ForwardedRef<T>,
  b: React.MutableRefObject<T | null>,
): React.RefCallback<T> {
  return useCallback((node: T | null) => {
    b.current = node;
    if (typeof a === 'function') a(node);
    else if (a) (a as React.MutableRefObject<T | null>).current = node;
  }, [a, b]);
}
```

Then: `const mergedRef = useMergedRef(ref, internalCanvasRef);` and pass `ref={mergedRef}` to `<Canvas>`.

- [ ] **Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Run full test suite**

```bash
npx vitest run
```

- [ ] **Commit**

```bash
git add src/canvas/SceneCanvas.tsx
git commit -m "feat(canvas): add viewport prop to SceneCanvas (inertia, pinchZoom, animatedZoom)"
```

---

### Task 12: Migrate demos and Swillustrator

**Files (each changed separately):**

Find all `<SceneCanvas` usages with old flat props:

```bash
grep -rln "moveOptions\|resizeOptions\|rotateOptions\|snap=\|pickEvery=\|boundsOf=\|handleHitRadius\|commitInsert=\|insertLayer=" demo/demos/ apps/
```

For each file found:

- [ ] **Wrap `pickEvery` + `boundsOf` into `geometry`**

```tsx
// Before:
<SceneCanvas pickEvery={myPick} boundsOf={myBounds} ... />

// After:
<SceneCanvas geometry={{ pickEvery: myPick, boundsOf: myBounds }} ... />
```

- [ ] **Wrap `snap` + `moveOptions` + `resizeOptions` + `rotateOptions` + `handleHitRadius` into `selectTool`**

```tsx
// Before:
<SceneCanvas snap={gridSnapStrategy(20)} moveOptions={...} handleHitRadius={HANDLE} ... />

// After:
<SceneCanvas selectTool={{ snap: gridSnapStrategy(20), move: ..., handleHitRadius: HANDLE }} ... />
```

- [ ] **Wrap `commitInsert` + `insertLayer` into `insertTool`**

```tsx
// Before:
<SceneCanvas commitInsert={(b) => ({ pose: b, data: {} })} insertLayer="default" ... />

// After:
<SceneCanvas insertTool={{ create: (b) => ({ pose: b, data: {} }), layer: 'default' }} ... />
```

- [ ] **Typecheck after each file to confirm no regressions**

```bash
npx tsc --noEmit
```

- [ ] **Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Commit migration**

```bash
git add demo/ apps/
git commit -m "chore: migrate demos to SceneCanvas geometry/selectTool/insertTool props"
```

---

## Self-review

**Spec coverage check:**

| Spec section | Tasks |
|---|---|
| `useVelocityTracker` | Task 1 |
| `useDecayLoop` | Task 2 |
| `useViewTween` | Task 3 |
| `usePinchGesture` | Task 4 |
| `useViewAnimation` | Task 5 |
| Barrel exports | Tasks 6, 9 |
| `useHandTool` inertia | Task 7 |
| `usePinchZoomTool` | Task 8 |
| `useKeyboardZoomTool` animate | Task 9 |
| SceneCanvas `geometry`/`selectTool`/`insertTool` | Task 10 |
| SceneCanvas `viewport` | Task 11 |
| Demo migration | Task 12 |

**Gaps noted and addressed:**

- `usePinchZoomTool` is a standalone hook (not a `Tool` record) — the spec says "ambient tool" but the existing tool infrastructure doesn't support multi-pointer events. The hook approach is cleaner and achieves the same consumer ergonomic via `SceneCanvas`'s `viewport.pinchZoom`.
- `useDecayLoop` omits `viewBounds` from config (spec included it). Boundary logic lives in `useHandTool`'s `onTick` where it has access to current view and canvas rect. The `InertiaConfig` has `boundary` but actual bounds checking is deferred until a consumer needs it (v1 just decays).
- Task 11 has a "Note on view/setView in SceneCanvas" — implementer must read the existing code to understand how to access current view state. This is intentional: the existing code's view management pattern must be followed rather than duplicated.
