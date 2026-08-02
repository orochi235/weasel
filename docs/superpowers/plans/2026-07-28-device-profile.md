# DeviceProfile + long-press Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the kit one source of truth for device facts (pointer coarseness, hover capability, pixel density), make the rule layer and the handle-sizing constants read it, and add `longPress` as a real gesture kind so touch can reach a context menu.

**Architecture:** A new `core/device/` module resolves a `DeviceProfile` from `matchMedia` and exposes it via hook + React context. Two consumers read it: `chrome-caps` (two new boolean selectors on `RuleCtx`) and the handle/hit-radius constants (a `targetScale` multiplier applied at each use site). Separately, `longPress` joins the `GestureSpec` union with dispatcher synthesis and a fallback that re-dispatches as `contextmenu` when unbound.

**Tech Stack:** TypeScript, React 19, Vitest (`--project=kit`), React Testing Library. Monorepo with npm workspaces; `@weasel-js/core` and `@weasel-js/gestures` are the two packages touched.

**Spec:** `docs/superpowers/specs/2026-07-28-device-profile-design.md`

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `packages/core/src/core/device/types.ts` | `DeviceProfile` interface, `COARSE_TARGET_SCALE`, `DEFAULT_DEVICE_PROFILE`, pure `resolveDeviceProfile()` |
| `packages/core/src/core/device/targets.ts` | Base pixel constants: `HANDLE_BASE_PX`, `ANCHOR_HIT_BASE_PX`, `ROTATION_HANDLE_BASE_PX` |
| `packages/core/src/core/device/useDeviceProfile.ts` | `matchMedia` detection hook + `DeviceProfileProvider` + context |
| `packages/core/src/core/device/index.ts` | Barrel for the module |
| `packages/core/src/core/device/types.test.ts` | Unit tests for the pure resolver |
| `packages/core/src/core/device/useDeviceProfile.test.tsx` | Hook/provider tests with stubbed `matchMedia` |
| `packages/core/src/canvas/deviceSizing.test.tsx` | The paint/hit-agreement regression guard |
| `packages/core/src/interactions/dispatcher/longPress.integration.test.tsx` | Long-press synthesis + contextmenu fallback |

**Modified:** `features/chrome-caps/ruleCtx.ts`, `rule.ts`, `conditions.ts` (+ their tests); `canvas/SceneCanvas.tsx`; `canvas/affordanceAt.ts`; `affordances/cornerResize.ts`; `features/selection/overlay.ts`; `interactions/actions/rotate/handle.ts`; `core/viewport/useCanvasSize.ts`; `packages/gestures/src/ui/spec.ts`, `inputEvent.ts`, `match.ts`, `grammar/gestures.ts`; `interactions/dispatcher/useGestureDispatcher.tsx`; `tools/routing/reflection/registry.ts`; `packages/core/src/index.ts`.

**Note on a spec inaccuracy:** the spec says `8` is written five times. It is written **six** times — `affordances/cornerResize.ts` has *both* `handleHitRadius = 8` and `handleSize = 8` as parameter defaults (lines 43-44). Task 6 covers both. Task 12 corrects the spec.

---

## Task 0: Prepare the worktree

**Files:** none (environment only)

- [ ] **Step 1: Install dependencies**

The worktree has no `node_modules`. Run from the worktree root:

```bash
cd /Users/mike/src/weasel-device && npm install
```

Expected: completes without error. A fresh weasel worktree installs cleanly — no rsync workaround needed.

- [ ] **Step 2: Confirm the baseline is green**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit
```

Expected: PASS. If anything fails here it is pre-existing — record it and do not attempt to fix it as part of this plan.

---

## Task 1: The `DeviceProfile` type and pure resolver

Pure data and one pure function, so it is testable with no DOM at all.

**Files:**
- Create: `packages/core/src/core/device/types.ts`
- Test: `packages/core/src/core/device/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/device/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveDeviceProfile,
  DEFAULT_DEVICE_PROFILE,
  COARSE_TARGET_SCALE,
} from './types';

describe('resolveDeviceProfile', () => {
  const fine = { coarsePointer: false, canHover: true, dpr: 1 };
  const coarse = { coarsePointer: true, canHover: false, dpr: 3 };

  it('derives targetScale 1 for a fine pointer', () => {
    expect(resolveDeviceProfile(fine)).toEqual({ ...fine, targetScale: 1 });
  });

  it('derives targetScale COARSE_TARGET_SCALE for a coarse pointer', () => {
    expect(resolveDeviceProfile(coarse)).toEqual({
      ...coarse,
      targetScale: COARSE_TARGET_SCALE,
    });
  });

  it('lets an override flip coarsePointer and re-derives targetScale', () => {
    const r = resolveDeviceProfile(fine, { coarsePointer: true });
    expect(r.coarsePointer).toBe(true);
    expect(r.targetScale).toBe(COARSE_TARGET_SCALE);
  });

  it('honors an explicit targetScale override instead of re-deriving', () => {
    const r = resolveDeviceProfile(fine, { coarsePointer: true, targetScale: 4 });
    expect(r.targetScale).toBe(4);
  });

  it('leaves unspecified fields alone', () => {
    const r = resolveDeviceProfile(coarse, { canHover: true });
    expect(r.canHover).toBe(true);
    expect(r.dpr).toBe(3);
    expect(r.coarsePointer).toBe(true);
  });

  it('DEFAULT_DEVICE_PROFILE is a fine-pointer, hover-capable, density-1 device', () => {
    expect(DEFAULT_DEVICE_PROFILE).toEqual({
      coarsePointer: false,
      canHover: true,
      dpr: 1,
      targetScale: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/core/device/types.test.ts
```

Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/core/device/types.ts`:

```ts
/**
 * Facts about the device the canvas is running on.
 *
 * One object, recomputed when the underlying media queries change, read by
 * two consumers: the chrome-caps rule layer (via `RuleCtx.device`) and the
 * handle-sizing constants (via `targetScale`).
 *
 * Deliberately NOT a form-factor concept. There is no `isPhone` here and
 * there should never be one: chrome layout is the consuming app's decision.
 * The kit's job is to stop assuming a mouse.
 */
export interface DeviceProfile {
  /** `matchMedia('(pointer: coarse)')` — the primary pointer is imprecise. */
  readonly coarsePointer: boolean;
  /** `matchMedia('(hover: hover)')` — the primary pointer can hover. */
  readonly canHover: boolean;
  /** Live device pixel ratio. */
  readonly dpr: number;
  /** Multiplier for handle sizes and hit radii. Derived from
   *  `coarsePointer` unless explicitly overridden. */
  readonly targetScale: number;
}

/**
 * Handle/hit multiplier applied on a coarse pointer.
 *
 * 8px handle → 14px; 24px rotation distance → 42px. Counting the
 * surrounding grab zone, that lands in the Apple HIG 44pt / Material 48dp
 * minimum-touch-target band. One constant so it is tunable in one place.
 */
export const COARSE_TARGET_SCALE = 1.75;

/**
 * Assumed when `matchMedia` is unavailable (SSR, jsdom) and used as the
 * absent-means value for `RuleCtx.device`.
 *
 * A mouse-like device is the safe default: it is what the kit has always
 * assumed, so an absent profile changes nothing for existing consumers.
 */
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = {
  coarsePointer: false,
  canHover: true,
  dpr: 1,
  targetScale: 1,
};

/** The detected half of a profile — everything except the derived scale. */
export type DetectedDeviceFacts = Omit<DeviceProfile, 'targetScale'>;

/**
 * Fold consumer overrides over detected facts and derive `targetScale`.
 *
 * `targetScale` is re-derived AFTER the merge, so an override of
 * `coarsePointer` alone scales the chrome as expected. An explicit
 * `targetScale` override wins over the derivation.
 */
export function resolveDeviceProfile(
  detected: DetectedDeviceFacts,
  overrides?: Partial<DeviceProfile>,
): DeviceProfile {
  const coarsePointer = overrides?.coarsePointer ?? detected.coarsePointer;
  const canHover = overrides?.canHover ?? detected.canHover;
  const dpr = overrides?.dpr ?? detected.dpr;
  const targetScale =
    overrides?.targetScale ?? (coarsePointer ? COARSE_TARGET_SCALE : 1);
  return { coarsePointer, canHover, dpr, targetScale };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/core/device/types.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/core/device/types.ts packages/core/src/core/device/types.test.ts
git commit -m "feat(device): DeviceProfile type and pure resolver"
```

---

## Task 2: Base sizing constants

Tiny task, but it must land before Task 6 so every use site has one place to import from.

**Files:**
- Create: `packages/core/src/core/device/targets.ts`

- [ ] **Step 1: Write the implementation**

No test — this file is three constants with no behavior. Task 6's paint/hit-agreement test covers their use.

Create `packages/core/src/core/device/targets.ts`:

```ts
/**
 * Base sizes for grabbable chrome, in CSS pixels at `targetScale = 1`.
 *
 * These were six separate literal `8`s and one `24` scattered across
 * `SceneCanvas`, `features/selection/overlay`, `affordances/cornerResize`,
 * `canvas/affordanceAt`, and `interactions/actions/rotate/handle`. They are
 * consolidated here because paint and hit-test MUST scale together: chrome
 * you can see but cannot grab is the exact failure `chrome-caps` exists to
 * make impossible, and duplicated literals in five files is how that failure
 * gets reintroduced.
 *
 * Multiply by `DeviceProfile.targetScale` at the point of use — the profile
 * is a runtime value, these are not.
 */

/** Selection corner-handle visual size and hit radius. */
export const HANDLE_BASE_PX = 8;

/** Path anchor / control-point hit radius. */
export const ANCHOR_HIT_BASE_PX = 8;

/** Distance from a selection's top edge to the rotation handle's center. */
export const ROTATION_HANDLE_BASE_PX = 24;
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd /Users/mike/src/weasel-device && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/core/device/targets.ts
git commit -m "feat(device): consolidate handle/hit base sizes into one module"
```

---

## Task 3: `useDeviceProfile` hook and provider

**Files:**
- Create: `packages/core/src/core/device/useDeviceProfile.ts`
- Create: `packages/core/src/core/device/index.ts`
- Test: `packages/core/src/core/device/useDeviceProfile.test.tsx`

Background on the DPR listener: `matchMedia('(resolution: 2dppx)')` stops matching the moment DPR changes, so a single listener would fire once and go dead. The hook re-arms a fresh query at the new DPR on each change. That is the whole reason this is not a one-liner.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/device/useDeviceProfile.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useDeviceProfile, DeviceProfileProvider } from './useDeviceProfile';
import { COARSE_TARGET_SCALE } from './types';

/** Minimal MediaQueryList double with a manual `fire()`. */
function makeMatchMedia(matches: Record<string, boolean>) {
  const listeners = new Map<string, Set<(e: { matches: boolean }) => void>>();
  const state = { ...matches };
  const mm = (query: string) => ({
    matches: state[query] ?? false,
    media: query,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.get(query)?.delete(cb);
    },
  });
  return {
    mm,
    fire(query: string, matches: boolean) {
      state[query] = matches;
      for (const cb of listeners.get(query) ?? []) cb({ matches });
    },
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
  };
}

function Probe() {
  const d = useDeviceProfile();
  return (
    <div data-testid="out">
      {`${d.coarsePointer}|${d.canHover}|${d.dpr}|${d.targetScale}`}
    </div>
  );
}

const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
});

describe('useDeviceProfile', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1, configurable: true, writable: true,
    });
  });

  it('falls back to the default profile when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe('false|true|1|1');
  });

  it('reads pointer coarseness and hover capability from matchMedia', () => {
    const { mm } = makeMatchMedia({
      '(pointer: coarse)': true,
      '(hover: hover)': false,
    });
    vi.stubGlobal('matchMedia', mm);
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe(
      `true|false|1|${COARSE_TARGET_SCALE}`,
    );
  });

  it('updates when the pointer-coarseness query changes', () => {
    const h = makeMatchMedia({ '(pointer: coarse)': false, '(hover: hover)': true });
    vi.stubGlobal('matchMedia', h.mm);
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe('false|true|1|1');

    act(() => { h.fire('(pointer: coarse)', true); });
    expect(screen.getByTestId('out').textContent).toBe(
      `true|true|1|${COARSE_TARGET_SCALE}`,
    );
  });

  it('re-arms the resolution query so a second DPR change is still observed', () => {
    const h = makeMatchMedia({
      '(pointer: coarse)': false,
      '(hover: hover)': true,
      '(resolution: 1dppx)': true,
    });
    vi.stubGlobal('matchMedia', h.mm);
    render(<Probe />);

    // First change: DPR moves to 2. The 1dppx query stops matching.
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2, configurable: true, writable: true,
    });
    act(() => { h.fire('(resolution: 1dppx)', false); });
    expect(screen.getByTestId('out').textContent).toBe('false|true|2|1');

    // Second change: a listener must now exist on the RE-ARMED 2dppx query.
    expect(h.listenerCount('(resolution: 2dppx)')).toBe(1);
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 3, configurable: true, writable: true,
    });
    act(() => { h.fire('(resolution: 2dppx)', false); });
    expect(screen.getByTestId('out').textContent).toBe('false|true|3|1');
  });

  it('DeviceProfileProvider overrides detected facts', () => {
    const { mm } = makeMatchMedia({ '(pointer: coarse)': false, '(hover: hover)': true });
    vi.stubGlobal('matchMedia', mm);
    render(
      <DeviceProfileProvider value={{ coarsePointer: true }}>
        <Probe />
      </DeviceProfileProvider>,
    );
    expect(screen.getByTestId('out').textContent).toBe(
      `true|true|1|${COARSE_TARGET_SCALE}`,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/core/device/useDeviceProfile.test.tsx
```

Expected: FAIL — cannot resolve `./useDeviceProfile`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/core/device/useDeviceProfile.ts`:

```ts
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_DEVICE_PROFILE,
  resolveDeviceProfile,
  type DetectedDeviceFacts,
  type DeviceProfile,
} from './types';

const COARSE_QUERY = '(pointer: coarse)';
const HOVER_QUERY = '(hover: hover)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function detectOnce(): DetectedDeviceFacts {
  // Density is read unconditionally: `devicePixelRatio` does not depend on
  // `matchMedia` existing. Only *watching* density needs a media query.
  // Gating this read behind `hasMatchMedia()` would report density 1 under
  // any environment without matchMedia — including jsdom, which would
  // silently break `useCanvasSize`'s existing DPR assertions.
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  if (!hasMatchMedia()) {
    return {
      coarsePointer: DEFAULT_DEVICE_PROFILE.coarsePointer,
      canHover: DEFAULT_DEVICE_PROFILE.canHover,
      dpr,
    };
  }
  return {
    coarsePointer: window.matchMedia(COARSE_QUERY).matches,
    canHover: window.matchMedia(HOVER_QUERY).matches,
    dpr,
  };
}

/**
 * Detect device facts and keep them live.
 *
 * Three subscriptions: pointer coarseness, hover capability, and pixel
 * density. The density one is special — `(resolution: Ndppx)` stops matching
 * as soon as density changes, so a single listener fires once and goes dead.
 * We re-arm a fresh query at the new density on every change.
 */
function useDetectedFacts(): DetectedDeviceFacts {
  const [facts, setFacts] = useState<DetectedDeviceFacts>(detectOnce);

  useEffect(() => {
    if (!hasMatchMedia()) return;

    const coarseMq = window.matchMedia(COARSE_QUERY);
    const hoverMq = window.matchMedia(HOVER_QUERY);

    const onCoarse = (e: MediaQueryListEvent | { matches: boolean }) =>
      setFacts((f) => ({ ...f, coarsePointer: e.matches }));
    const onHover = (e: MediaQueryListEvent | { matches: boolean }) =>
      setFacts((f) => ({ ...f, canHover: e.matches }));

    coarseMq.addEventListener('change', onCoarse as EventListener);
    hoverMq.addEventListener('change', onHover as EventListener);

    // Re-arming density watcher.
    let disposed = false;
    let densityMq: MediaQueryList | null = null;
    const onDensity = () => {
      if (disposed) return;
      const next = window.devicePixelRatio || 1;
      setFacts((f) => (f.dpr === next ? f : { ...f, dpr: next }));
      arm();
    };
    function arm(): void {
      if (disposed) return;
      densityMq?.removeEventListener('change', onDensity as EventListener);
      densityMq = window.matchMedia(
        `(resolution: ${window.devicePixelRatio || 1}dppx)`,
      );
      densityMq.addEventListener('change', onDensity as EventListener);
    }
    arm();

    // Re-sync once on mount: a query could have changed between the
    // useState initializer and the effect running.
    setFacts({
      coarsePointer: coarseMq.matches,
      canHover: hoverMq.matches,
      dpr: window.devicePixelRatio || 1,
    });

    return () => {
      disposed = true;
      coarseMq.removeEventListener('change', onCoarse as EventListener);
      hoverMq.removeEventListener('change', onHover as EventListener);
      densityMq?.removeEventListener('change', onDensity as EventListener);
    };
  }, []);

  return facts;
}

const DeviceProfileContext = createContext<DeviceProfile | null>(null);

/**
 * Read the ambient device profile.
 *
 * Uses the nearest {@link DeviceProfileProvider} when one exists, and
 * otherwise detects for itself — so a standalone overlay or a labkit panel
 * rendered outside a `<SceneCanvas>` still gets correct facts.
 *
 * `overrides` always wins over both, which is what makes tests and
 * force-touch-chrome demos possible without stubbing `matchMedia`.
 */
export function useDeviceProfile(overrides?: Partial<DeviceProfile>): DeviceProfile {
  const provided = useContext(DeviceProfileContext);
  const detected = useDetectedFacts();
  const base: DetectedDeviceFacts = provided ?? detected;
  const { coarsePointer, canHover, dpr, targetScale } = overrides ?? {};
  return useMemo(
    () =>
      resolveDeviceProfile(base, {
        ...(coarsePointer !== undefined ? { coarsePointer } : {}),
        ...(canHover !== undefined ? { canHover } : {}),
        ...(dpr !== undefined ? { dpr } : {}),
        ...(targetScale !== undefined ? { targetScale } : {}),
      }),
    [base.coarsePointer, base.canHover, base.dpr, coarsePointer, canHover, dpr, targetScale],
  );
}

export interface DeviceProfileProviderProps {
  /** Partial override folded over detected facts. */
  value?: Partial<DeviceProfile>;
  children: ReactNode;
}

/**
 * Publish one resolved profile to a subtree. `<SceneCanvas>` renders this so
 * overlays, affordances, and consumer chrome all read the same object.
 */
export function DeviceProfileProvider({ value, children }: DeviceProfileProviderProps) {
  const profile = useDeviceProfile(value);
  return createElement(DeviceProfileContext.Provider, { value: profile }, children);
}
```

Note the `createElement` calls rather than JSX: this is a `.ts` file, matching how the rest of `core/` is organized (JSX lives in `.tsx` files).

Create `packages/core/src/core/device/index.ts`:

```ts
export {
  COARSE_TARGET_SCALE,
  DEFAULT_DEVICE_PROFILE,
  resolveDeviceProfile,
  type DetectedDeviceFacts,
  type DeviceProfile,
} from './types';
export {
  HANDLE_BASE_PX,
  ANCHOR_HIT_BASE_PX,
  ROTATION_HANDLE_BASE_PX,
} from './targets';
export {
  DeviceProfileProvider,
  useDeviceProfile,
  type DeviceProfileProviderProps,
} from './useDeviceProfile';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/core/device/useDeviceProfile.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/core/device/
git commit -m "feat(device): useDeviceProfile hook and provider"
```

---

## Task 4: `RuleCtx.device` and the two new selectors

**Files:**
- Modify: `packages/core/src/features/chrome-caps/ruleCtx.ts`
- Modify: `packages/core/src/features/chrome-caps/rule.ts`
- Modify: `packages/core/src/features/chrome-caps/conditions.ts`
- Test: `packages/core/src/features/chrome-caps/rule.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/features/chrome-caps/rule.test.ts`. It already imports `evaluate` and builds contexts; add this block at the end of the file, adjusting the existing test file's context helper name if it differs (read the file first — if it has a local `ctx()` factory, reuse it and pass `device` through rather than writing a new one):

```ts
describe('device selectors', () => {
  const base = {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { offset: { x: 0, y: 0 }, scale: { x: 1, y: 1 } },
    mode: 'normal',
    allowedCapabilities: new Set<never>(),
  } as unknown as RuleCtx;

  const coarse = {
    ...base,
    device: { coarsePointer: true, canHover: false, dpr: 3, targetScale: 1.75 },
  } as RuleCtx;

  const fine = {
    ...base,
    device: { coarsePointer: false, canHover: true, dpr: 1, targetScale: 1 },
  } as RuleCtx;

  it('coarsePointer matches a coarse device', () => {
    expect(evaluate({ coarsePointer: true }, coarse)).toBe(true);
    expect(evaluate({ coarsePointer: true }, fine)).toBe(false);
  });

  it('canHover matches a hover-capable device', () => {
    expect(evaluate({ canHover: true }, fine)).toBe(true);
    expect(evaluate({ canHover: true }, coarse)).toBe(false);
  });

  it('absent device is treated as fine-pointer and hover-capable', () => {
    expect(evaluate({ coarsePointer: false }, base)).toBe(true);
    expect(evaluate({ canHover: true }, base)).toBe(true);
  });

  it('describeRule renders the new selectors', () => {
    expect(describeRule({ coarsePointer: true })).toBe('coarsePointer:true');
  });
});
```

Ensure `describeRule` and `RuleCtx` are imported at the top of the file (add to the existing import statements if absent).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/features/chrome-caps/rule.test.ts
```

Expected: FAIL — `coarsePointer` is not a known `Selector` key (type error), and the assertions return `true` for every context because unknown keys are ignored by `evaluateSelector`.

- [ ] **Step 3: Add the ctx field**

In `packages/core/src/features/chrome-caps/ruleCtx.ts`, add the import and the field.

At the top, alongside the existing imports:

```ts
import { DEFAULT_DEVICE_PROFILE, type DeviceProfile } from '../../core/device/types';
```

Inside `interface RuleCtx`, after `editingAnchors`:

```ts
  /** Device facts — pointer coarseness, hover capability, density.
   *
   *  Absent (legacy ctx builders) is treated as
   *  {@link DEFAULT_DEVICE_PROFILE}: a fine pointer that can hover, at
   *  density 1. That is what the kit assumed before this field existed, so
   *  an absent profile is behavior-preserving by construction. */
  readonly device?: DeviceProfile;
```

Inside `interface BuildRuleCtxArgs`, after `editingAnchors`:

```ts
  /** Optional — omitted means {@link DEFAULT_DEVICE_PROFILE}. */
  device?: DeviceProfile;
```

Inside `buildRuleCtx`'s returned object, after `editingAnchors: args.editingAnchors,`:

```ts
    device: args.device,
```

Do **not** re-export `DEFAULT_DEVICE_PROFILE` from `ruleCtx.ts`. `rule.ts`
imports it straight from `core/device/types`, and adding a second export path
risks a duplicate-export collision once `index.ts` exports the device barrel
in Task 10.

- [ ] **Step 4: Add the selector keys and evaluation**

In `packages/core/src/features/chrome-caps/rule.ts`, add to `interface Selector` after `resizable`:

```ts
  /** Matches `ctx.device.coarsePointer` — the primary pointer is imprecise
   *  (touch, most styluses). Absent device is treated as `false`. */
  coarsePointer?: boolean;
  /** Matches `ctx.device.canHover` — the primary pointer can hover. Absent
   *  device is treated as `true`. */
  canHover?: boolean;
```

Add the import at the top:

```ts
import { DEFAULT_DEVICE_PROFILE } from '../../core/device/types';
```

And in `evaluateSelector`, immediately before the closing `return true;`:

```ts
  if (s.coarsePointer !== undefined) {
    const device = ctx.device ?? DEFAULT_DEVICE_PROFILE;
    if (device.coarsePointer !== s.coarsePointer) return false;
  }
  if (s.canHover !== undefined) {
    const device = ctx.device ?? DEFAULT_DEVICE_PROFILE;
    if (device.canHover !== s.canHover) return false;
  }
```

`describeRule` needs no change — it enumerates `Object.keys(selector)` generically.

- [ ] **Step 5: Add the fluent atoms**

In `packages/core/src/features/chrome-caps/conditions.ts`, append a new section at the end:

```ts
// ─── Device atoms ───────────────────────────────────────────────────

/** Primary pointer is imprecise (touch, most styluses). Absent device
 *  profile → false, so a rule written with this atom is inert on the
 *  mouse-shaped default rather than silently flipping. */
export const coarsePointer: Condition = cond({ coarsePointer: true });

/** Primary pointer can hover. Absent device profile → true. Pair with
 *  `not(...)` to gate chrome that only makes sense with a hovering
 *  pointer: `not(canHover)` is "this device cannot hover". */
export const canHover: Condition = cond({ canHover: true });
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/features/chrome-caps/
```

Expected: PASS — the new block plus all pre-existing chrome-caps tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/features/chrome-caps/
git commit -m "feat(chrome-caps): coarsePointer and canHover selectors on RuleCtx"
```

---

## Task 5: Wire the profile into `SceneCanvas`

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/SceneCanvas.device.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useDeviceProfile } from '../core/device/useDeviceProfile';
import { COARSE_TARGET_SCALE } from '../core/device/types';
import { SceneCanvas } from './SceneCanvas';

function Probe({ onRead }: { onRead: (s: number) => void }) {
  const d = useDeviceProfile();
  onRead(d.targetScale);
  return null;
}

describe('SceneCanvas device prop', () => {
  it('publishes the resolved profile to its subtree', () => {
    let seen = 0;
    render(
      <SceneCanvas device={{ coarsePointer: true }}>
        <Probe onRead={(s) => { seen = s; }} />
      </SceneCanvas>,
    );
    expect(seen).toBe(COARSE_TARGET_SCALE);
  });

  it('defaults to a fine-pointer profile with no prop', () => {
    let seen = 0;
    render(
      <SceneCanvas>
        <Probe onRead={(s) => { seen = s; }} />
      </SceneCanvas>,
    );
    expect(seen).toBe(1);
  });
});
```

**Before writing this test, read `packages/core/src/canvas/SceneCanvas.smoke.test.tsx`** to see the minimal prop set `SceneCanvas` needs to render in jsdom (it may require a `scene` or adapter prop). Mirror that setup here rather than guessing — the test above shows only the device-specific assertions.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.device.test.tsx
```

Expected: FAIL — `device` is not a known prop (type error).

- [ ] **Step 3: Add the prop**

In `packages/core/src/canvas/SceneCanvas.tsx`, add the import:

```ts
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import type { DeviceProfile } from '../core/device/types';
```

Add to `SceneCanvasProps` (near `getActiveMode`, which is the closest analogue — both are "ambient environment" props):

```ts
  /**
   * Override detected device facts. Merged over what `matchMedia` reports;
   * `targetScale` is re-derived from the merged `coarsePointer` unless you
   * override it explicitly.
   *
   * Reach for this in three cases: tests that need a coarse profile without
   * stubbing `matchMedia`, demos that want to show touch-sized chrome on a
   * desktop, and hybrid devices where the media query guesses wrong.
   */
  device?: Partial<DeviceProfile>;
```

- [ ] **Step 4: Resolve the profile and provide it**

Inside the component body, near the top (before `buildCurrentRuleCtx` is defined):

```ts
  const deviceProfile = useDeviceProfile(device);
```

Add `device` to the props destructuring alongside `getActiveMode`.

In `buildCurrentRuleCtx`, add `device` to the returned object alongside `editingAnchors`:

```ts
      editingAnchors: effectivePathEditingId() !== '',
      device: deviceProfileRef.current,
```

`buildCurrentRuleCtx` is a `useCallback` that reads live state through refs to stay stable. Follow that pattern — add a ref beside the existing ones:

```ts
  const deviceProfileRef = useRef(deviceProfile);
  deviceProfileRef.current = deviceProfile;
```

Do NOT add `deviceProfile` to `buildCurrentRuleCtx`'s dependency array; that would rebuild the callback on every profile change and defeat the ref indirection the surrounding code deliberately uses.

Finally, wrap the component's returned tree in the provider so the subtree reads the same object:

```tsx
  return (
    <DeviceProfileProvider value={device}>
      {/* existing returned tree unchanged */}
    </DeviceProfileProvider>
  );
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/canvas/
```

Expected: PASS, including all pre-existing SceneCanvas tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/canvas/SceneCanvas.tsx packages/core/src/canvas/SceneCanvas.device.test.tsx
git commit -m "feat(canvas): SceneCanvas device prop, provider, and RuleCtx wiring"
```

---

## Task 6: Apply `targetScale` to handles and hit radii

The load-bearing task. Paint and hit-test must move together.

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:150`
- Modify: `packages/core/src/features/selection/overlay.ts:291`
- Modify: `packages/core/src/affordances/cornerResize.ts:43-44`
- Modify: `packages/core/src/canvas/affordanceAt.ts:41,45`
- Modify: `packages/core/src/interactions/actions/rotate/handle.ts:6`
- Test: `packages/core/src/canvas/deviceSizing.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/deviceSizing.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX } from '../core/device/targets';
import { COARSE_TARGET_SCALE, resolveDeviceProfile } from '../core/device/types';
import { DEFAULT_HANDLE_SIZE } from './SceneCanvas';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from '../interactions/actions/rotate';
import { createCornerResizeAffordance } from '../affordances/cornerResize';

const coarse = resolveDeviceProfile(
  { coarsePointer: true, canHover: false, dpr: 2 },
);

describe('device-scaled chrome sizing', () => {
  it('public constants keep their unscaled values (no consumer break)', () => {
    expect(DEFAULT_HANDLE_SIZE).toBe(HANDLE_BASE_PX);
    expect(DEFAULT_HANDLE_SIZE).toBe(8);
    expect(DEFAULT_ROTATION_HANDLE_DISTANCE).toBe(ROTATION_HANDLE_BASE_PX);
    expect(DEFAULT_ROTATION_HANDLE_DISTANCE).toBe(24);
  });

  it('a coarse profile scales the base sizes into the touch-target band', () => {
    expect(HANDLE_BASE_PX * coarse.targetScale).toBe(14);
    expect(ROTATION_HANDLE_BASE_PX * coarse.targetScale).toBe(42);
    expect(coarse.targetScale).toBe(COARSE_TARGET_SCALE);
  });

  // The regression guard this whole task exists for. Visual size and hit
  // radius are computed in different files; if they ever diverge you get
  // chrome you can see but cannot grab.
  it('paint size and hit radius agree under a coarse profile', () => {
    const scaled = HANDLE_BASE_PX * coarse.targetScale;
    const aff = createCornerResizeAffordance({
      handleSize: scaled,
      handleHitRadius: scaled,
    });
    expect(aff.id).toBe('selection.resize-handles');

    // Both defaults must come from the same base, so that a caller passing
    // neither gets an agreeing pair.
    const defaulted = createCornerResizeAffordance();
    expect(defaulted.id).toBe('selection.resize-handles');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/canvas/deviceSizing.test.tsx
```

Expected: FAIL — cannot resolve `../core/device/targets` imports from files that do not yet reference them, or the constant-identity assertions fail because each site still holds its own literal.

- [ ] **Step 3: Repoint every constant at the shared base**

`packages/core/src/canvas/SceneCanvas.tsx` — replace the literal at line 150:

```ts
import { HANDLE_BASE_PX } from '../core/device/targets';

/** Default size in CSS pixels for selection corner-handles AND their
 *  hit-test radius, at `targetScale = 1`. Re-exported at the package root;
 *  its value is deliberately unscaled so consumers reading it keep getting
 *  the number they always got. Kit-internal use sites multiply by
 *  `DeviceProfile.targetScale`. */
export const DEFAULT_HANDLE_SIZE = HANDLE_BASE_PX;
```

`packages/core/src/features/selection/overlay.ts` — replace the private duplicate at line 291:

```ts
import { HANDLE_BASE_PX } from '../../core/device/targets';

const DEFAULT_HANDLE_SIZE = HANDLE_BASE_PX;
```

`packages/core/src/affordances/cornerResize.ts` — replace both parameter defaults at lines 43-44:

```ts
import { HANDLE_BASE_PX } from '../core/device/targets';

  const {
    handleHitRadius = HANDLE_BASE_PX,
    handleSize = HANDLE_BASE_PX,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
  } = opts;
```

`packages/core/src/canvas/affordanceAt.ts` — replace lines 41 and 45:

```ts
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX } from '../core/device/targets';

export const HANDLE_HIT_RADIUS = HANDLE_BASE_PX;
export const ANCHOR_HIT_RADIUS = ANCHOR_HIT_BASE_PX;
```

`packages/core/src/interactions/actions/rotate/handle.ts` — replace line 6:

```ts
import { ROTATION_HANDLE_BASE_PX } from '../../../core/device/targets';

export const DEFAULT_ROTATION_HANDLE_DISTANCE = ROTATION_HANDLE_BASE_PX;
```

- [ ] **Step 4: Apply the scale at the SceneCanvas use sites**

Two places in `SceneCanvas.tsx` currently spend `DEFAULT_HANDLE_SIZE` directly. Both must scale.

At `mergeLayersWithDefaults` (line ~214), the function is module-scope and has no access to the profile, so thread the scale in as a parameter:

```ts
export function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: LayersMap<Node<TData, TLayer, TPose>, TPose> | undefined,
  targetScale = 1,
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  const defaults = {
    scene: { drawOne: defaultDrawOne as (
      node: Node<TData, TLayer, TPose>,
      pose: TPose,
    ) => DrawCommand[] },
    selectionOverlay: { handles: { size: HANDLE_BASE_PX * targetScale } },
  };
  // ...rest unchanged
```

Update its call site inside the component to pass `deviceProfile.targetScale`.

At `selectToolWithDefaults` (line ~1014):

```ts
  const selectToolWithDefaults = useMemo(() => ({
    handleHitRadius: HANDLE_BASE_PX * deviceProfile.targetScale,
```

Add `deviceProfile.targetScale` to that `useMemo`'s dependency array.

- [ ] **Step 5: Run the full kit suite**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit
```

Expected: PASS. Handle-size behavior is unchanged at `targetScale = 1`, which is what every existing test runs at, so no existing assertion should move. If one does, that is a real finding — investigate rather than updating the assertion.

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/canvas/ packages/core/src/features/selection/overlay.ts \
        packages/core/src/affordances/cornerResize.ts \
        packages/core/src/interactions/actions/rotate/handle.ts
git commit -m "feat(device): scale handle sizes and hit radii by targetScale"
```

---

## Task 7: Source `useCanvasSize`'s DPR from the profile

Fixes the stale-DPR hole: today density is re-read only when `ResizeObserver` fires, so moving a window between displays without resizing it leaves it wrong.

**Files:**
- Modify: `packages/core/src/core/viewport/useCanvasSize.ts`
- Test: `packages/core/src/core/viewport/useCanvasSize.test.ts`

- [ ] **Step 1: Write the failing test**

First, lift the `makeMatchMedia` factory from Task 3's test into a shared helper so both files use one double. Create `packages/core/src/core/device/testing/matchMedia.ts` with the factory body exactly as written in Task 3 Step 1, exported as `makeMatchMedia`, and update `useDeviceProfile.test.tsx` to import it rather than define it inline.

The existing `useCanvasSize.test.ts` sets `window.devicePixelRatio` before render and asserts `dpr: 2` (lines 47-62). Those assertions must keep passing — Task 3's `detectOnce` reads density unconditionally for exactly this reason. Add:

```ts
import { makeMatchMedia } from '../device/testing/matchMedia';

it('picks up a density change without a resize', () => {
  const originalRO = window.ResizeObserver;
  MockResizeObserver.instances = [];
  (window as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
    MockResizeObserver;

  const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });

  const h = makeMatchMedia({
    '(pointer: coarse)': false,
    '(hover: hover)': true,
    '(resolution: 1dppx)': true,
  });
  vi.stubGlobal('matchMedia', h.mm);

  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      width: 800, height: 600, x: 0, y: 0,
      left: 0, top: 0, right: 800, bottom: 600, toJSON() {},
    }),
  });

  const { result } = renderHook(() => {
    const ref = useRef<HTMLDivElement>(el);
    return useCanvasSize(ref);
  });

  expect(result.current).toEqual({ width: 800, height: 600, dpr: 1 });

  // Move to a 2x display. No resize happens — only the media query fires.
  const observerCallsBefore = MockResizeObserver.instances.length;
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  act(() => { h.fire('(resolution: 1dppx)', false); });

  expect(result.current).toEqual({ width: 800, height: 600, dpr: 2 });
  // Nothing re-observed: this update did not come from a resize.
  expect(MockResizeObserver.instances.length).toBe(observerCallsBefore);

  vi.unstubAllGlobals();
  if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = originalRO;
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/core/viewport/useCanvasSize.test.ts
```

Expected: FAIL — density does not update without a resize.

- [ ] **Step 3: Rewrite the hook**

```ts
import { type RefObject, useCallback, useEffect, useState } from 'react';
import type { CanvasSize } from './clampView';
import { useDeviceProfile } from '../device/useDeviceProfile';

/** Size snapshot returned by `useCanvasSize` — the kit-wide `CanvasSize`
 *  (width × height in CSS pixels) plus the current devicePixelRatio. */
export interface CanvasSizeSnapshot extends CanvasSize {
  dpr: number;
}

/** Track a container's content-rect size via `ResizeObserver`, and density via
 *  the ambient `DeviceProfile`.
 *
 *  Density deliberately does NOT come from a `window.devicePixelRatio` read
 *  inside the resize callback: that only refreshes when the element resizes,
 *  so dragging a window to a different-density display without resizing it
 *  left the snapshot stale. The profile watches a re-armed resolution media
 *  query instead. */
export function useCanvasSize(containerRef: RefObject<HTMLDivElement | null>): CanvasSizeSnapshot {
  const { dpr } = useDeviceProfile();
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSize((prev) =>
      prev.width === rect.width && prev.height === rect.height
        ? prev
        : { width: rect.width, height: rect.height },
    );
  }, [containerRef]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [measure, containerRef]);

  return { width: size.width, height: size.height, dpr };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/core/viewport/ packages/core/src/canvas/
```

Expected: PASS. Watch `Canvas.dpr.test.tsx` and `renderSceneToPixels.test.ts` in particular — both assert *zero* ambient `devicePixelRatio` reads on their paths. This change removes a read; it must not add one.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/core/viewport/useCanvasSize.ts packages/core/src/core/viewport/useCanvasSize.test.ts
git commit -m "fix(viewport): track density changes that arrive without a resize"
```

---

## Task 8: `longPress` gesture spec, event, matcher, and grammar

Pure type/plumbing work in `@weasel-js/gestures`, no dispatcher changes yet.

**Files:**
- Modify: `packages/gestures/src/ui/spec.ts`
- Modify: `packages/gestures/src/ui/inputEvent.ts`
- Modify: `packages/gestures/src/ui/match.ts`
- Modify: `packages/gestures/src/grammar/gestures.ts`
- Modify: `packages/core/src/tools/routing/reflection/registry.ts`
- Test: `packages/gestures/src/ui/match.test.ts` (or the existing matcher test file — check its name first)

- [ ] **Step 1: Write the failing test**

Add to the existing matcher test file:

```ts
describe('longPress spec', () => {
  const ev = {
    kind: 'longpress' as const,
    x: 10, y: 20, clientX: 10, clientY: 20,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    bodyTarget: 'empty' as const,
  };

  it('matches a bare longPress spec', () => {
    expect(matchSpec({ kind: 'longPress' }, ev, false)).toBe(true);
  });

  it('does not match a pointerdown', () => {
    expect(matchSpec({ kind: 'longPress' }, { ...ev, kind: 'pointerdown' }, false)).toBe(false);
  });

  it('respects the target selector', () => {
    expect(matchSpec({ kind: 'longPress', target: 'empty' }, ev, false)).toBe(true);
    expect(matchSpec({ kind: 'longPress', target: 'selected-body' }, ev, false)).toBe(false);
  });

  it('respects modifiers', () => {
    expect(matchSpec({ kind: 'longPress', mods: { shift: true } }, ev, false)).toBe(false);
    expect(
      matchSpec({ kind: 'longPress', mods: { shift: true } }, { ...ev, shiftKey: true }, false),
    ).toBe(true);
  });
});
```

**Read the existing test file first** for the exact `matchSpec` signature and argument order (the `isMac` parameter position in particular) and match it.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/gestures/src/ui/
```

Expected: FAIL — `'longPress'` is not assignable to `GestureSpec['kind']`.

- [ ] **Step 3: Add the spec**

In `packages/gestures/src/ui/spec.ts`, after `PointerDownSpec`:

```ts
/**
 * Press held past the long-press threshold without crossing the drag
 * threshold. Synthesized by `useGestureDispatcher` from the pointer stream.
 *
 * Fires for `touch` and `pen` pointers only. A mouse held still for half a
 * second is an ordinary slow click, and firing on it would produce a context
 * menu nobody asked for.
 *
 * When a long-press matches no binding, the dispatcher re-dispatches it as a
 * `contextmenu` event — so `contextMenu` bindings work under a finger with no
 * consumer changes, while `longPress` stays independently bindable.
 */
export interface LongPressSpec {
  kind: 'longPress';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}
```

Add `| LongPressSpec` to the `GestureSpec` union, and delete `long-press` from the "New invocation forms (long-press, two-stage, modal-dialog)" comment above it — it is no longer hypothetical. Leave `two-stage` and `modal-dialog`.

- [ ] **Step 4: Add the event**

In `packages/gestures/src/ui/inputEvent.ts`, after `ContextMenuEvent`:

```ts
/** A press held past the long-press threshold without moving. */
export interface LongPressEvent extends EventModifiers {
  kind: 'longpress';
  target?: unknown;
  /** World-space position of the originating press. */
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
  /** Affordance hit at press time, if any — lets a binding long-press a
   *  resize handle, not just body. */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}
```

Add `LongPressEvent` to the exported `InputEvent` union in the same file.

- [ ] **Step 5: Add the matcher case**

In `packages/gestures/src/ui/match.ts`, after the `contextMenu` case:

```ts
    case 'longPress': {
      if (e.kind !== 'longpress') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      // Match on the affordance like `drag` does, not the DOM target like
      // `contextMenu` does: a long-press begins as a press, so the useful
      // target is what was under the finger in scene terms.
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }
```

- [ ] **Step 6: Add the grammar entries**

In `packages/gestures/src/grammar/gestures.ts`, add `| 'longPress'` to `GestureName` and this row to `GESTURE_DESCRIPTORS`:

```ts
  { name: 'longPress',     hasTarget: true  },
```

In `packages/core/src/tools/routing/reflection/registry.ts`, add to `SPEC_KIND_TO_GESTURE`:

```ts
  longPress: 'longPress',
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit && npx tsc --noEmit
```

Expected: PASS and no type errors. The `SPEC_KIND_TO_GESTURE` record is exhaustive over `GestureSpec['kind']`, so omitting the entry is a compile error — that is intentional and is why this step is in the same task.

- [ ] **Step 8: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/gestures/src/ packages/core/src/tools/routing/reflection/registry.ts
git commit -m "feat(gestures): longPress spec, event, matcher, and grammar entry"
```

---

## Task 9: Dispatcher long-press synthesis + contextmenu fallback

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx`
- Test: `packages/core/src/interactions/dispatcher/longPress.integration.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/interactions/dispatcher/longPress.integration.test.tsx`, following `pinchZoom.integration.test.tsx`'s provider tree (`DepRegistryProvider > ActiveToolContextProvider > ActionsProvider > MountDispatcher`) and its `beforeAll` canvas mock.

```tsx
/**
 * Integration tests for long-press synthesis via the gesture dispatcher.
 *
 * Proves:
 *   - A held touch/pen press fires `longPress` after LONG_PRESS_MS
 *   - Mouse never fires it; movement, release, and a second finger cancel it
 *   - An unbound long-press falls back to `contextmenu`; a bound one does not
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/registry';
import { DepRegistryProvider } from '../actions/depRegistry';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import type { Action } from '../actions/registry';
import type { Tool } from '../../tools/types';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const fired: string[] = [];

function makeImmediateAction(id: string): Action {
  return {
    id,
    label: id,
    group: 'test',
    requires: [],
    invoker: { timing: 'immediate', run: () => { fired.push(id); return null; } },
    enabled: () => true,
  } as unknown as Action;
}

/** A tool binding `longPress` and/or `contextMenu` to marker actions. */
function makeTool(kinds: Array<'longPress' | 'contextMenu'>): Tool<unknown> {
  return {
    id: 'test-tool',
    bindings: kinds.map((k) => ({
      spec: { kind: k },
      actionId: k === 'longPress' ? 'test.longPress' : 'test.contextMenu',
    })),
  } as unknown as Tool<unknown>;
}

function mount(kinds: Array<'longPress' | 'contextMenu'>) {
  function Register() {
    const registry = useActionsRegistry();
    if (registry) {
      for (const id of ['test.longPress', 'test.contextMenu']) {
        if (!registry.list().find((a) => a.id === id)) {
          registry.register(makeImmediateAction(id));
        }
      }
    }
    return null;
  }
  function Mount() {
    const registry = useActionsRegistry();
    const ref = useRef<HTMLCanvasElement | null>(null);
    const tool = makeTool(kinds);
    useGestureDispatcher({
      canvasRef: ref,
      actions: registry!,
      toolsById: new Map([[tool.id, tool]]),
    });
    return <canvas ref={ref} data-testid="canvas" />;
  }
  const utils = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Register />
          <Mount />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return utils.getByTestId('canvas');
}

function down(canvas: HTMLElement, opts: Partial<PointerEventInit> = {}) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 1, pointerType: 'touch', button: 0, buttons: 1,
      clientX: 50, clientY: 50, bubbles: true, ...opts,
    }));
  });
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

describe('long-press synthesis', () => {
  beforeEach(() => { fired.length = 0; });

  it('fires longPress after 500ms for a touch pointer', () => {
    const c = mount(['longPress']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });

  it('fires for a pen pointer', () => {
    const c = mount(['longPress']);
    down(c, { pointerType: 'pen' });
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });

  it('does not fire for a mouse pointer', () => {
    const c = mount(['longPress']);
    down(c, { pointerType: 'mouse' });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('does not fire before the threshold elapses', () => {
    const c = mount(['longPress']);
    down(c);
    advance(499);
    expect(fired).toEqual([]);
  });

  it('cancels when the pointer moves past the drag threshold', () => {
    const c = mount(['longPress']);
    down(c);
    act(() => {
      c.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 1, pointerType: 'touch', buttons: 1,
        clientX: 70, clientY: 50, bubbles: true,
      }));
    });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('cancels on pointerup before the threshold', () => {
    const c = mount(['longPress']);
    down(c);
    advance(200);
    act(() => {
      c.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true,
      }));
    });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('cancels when a second pointer lands, so it never fires mid-pinch', () => {
    const c = mount(['longPress']);
    down(c);
    down(c, { pointerId: 2, clientX: 120, clientY: 120 });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('falls back to contextmenu when no longPress binding matched', () => {
    const c = mount(['contextMenu']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.contextMenu']);
  });

  it('does not fall back when a longPress binding did match', () => {
    const c = mount(['longPress', 'contextMenu']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });
});
```

Two notes for whoever runs this. The `Action` and `Tool` shapes above are approximations — read `interactions/actions/registry.tsx` and `tools/types.ts` for the exact required fields and adjust the two factories rather than casting harder. And every timer advance is wrapped in `act()` deliberately: this codebase has a history of act-warnings that reproduce only in CI, so wrap at the call site rather than adding a trailing flush.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/interactions/dispatcher/longPress.integration.test.tsx
```

Expected: FAIL — nothing fires; no long-press machinery exists.

- [ ] **Step 3: Add the timer state**

In `useGestureDispatcher.tsx`, inside the same effect closure that declares `DRAG_THRESHOLD_PX` (~line 371), add:

```ts
    // Long-press synthesis. Armed on pointerdown for touch/pen, cancelled by
    // movement past DRAG_THRESHOLD_PX, by release, by cancel, or by a second
    // pointer landing (so it can never fire mid-pinch).
    const LONG_PRESS_MS = 500;
    const longPressTimers = new Map<number, ReturnType<typeof setTimeout>>();

    const cancelLongPress = (pointerId: number): void => {
      const t = longPressTimers.get(pointerId);
      if (t !== undefined) {
        clearTimeout(t);
        longPressTimers.delete(pointerId);
      }
    };

    const cancelAllLongPress = (): void => {
      for (const t of longPressTimers.values()) clearTimeout(t);
      longPressTimers.clear();
    };
```

- [ ] **Step 4: Store the DOM target on pointerdown**

The fallback needs the original DOM target, which `lastPointerDown` does not currently keep. In `onPointerDown`, add `target: e.target,` to the `lastPointerDown.set(...)` object literal, and add `target: unknown;` to that map's value type where it is declared.

- [ ] **Step 5: Add the fire function**

Place it next to `cancelLongPress`:

```ts
    /** Fire a synthesized long-press, falling back to contextmenu when the
     *  long-press matched nothing. The fallback is what makes existing
     *  `contextMenu` bindings reachable by touch with no consumer change. */
    const fireLongPress = (pointerId: number): void => {
      const down = lastPointerDown.get(pointerId);
      if (!down) return;

      const shared = {
        target: down.target,
        altKey: down.altKey,
        ctrlKey: down.ctrlKey,
        metaKey: down.metaKey,
        shiftKey: down.shiftKey,
        ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
        ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
      };

      const result = dispatch({
        kind: 'longpress',
        x: down.worldX,
        y: down.worldY,
        clientX: down.clientX,
        clientY: down.clientY,
        ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
        ...shared,
      } as InputEvent);

      if (result === 'unhandled') {
        dispatch({ kind: 'contextmenu', ...shared } as InputEvent);
      }
    };
```

- [ ] **Step 6: Arm the timer**

In `onPointerDown`, immediately after the `lastPointerDown.set(...)` call and **before** the `if (activePointers.size >= 2)` multi-touch block:

```ts
      // Arm long-press for touch / pen only, and only for a lone pointer —
      // a second finger means a multi-touch gesture, not a long-press.
      if ((e.pointerType === 'touch' || e.pointerType === 'pen')
          && activePointers.size === 1) {
        cancelLongPress(e.pointerId);
        longPressTimers.set(
          e.pointerId,
          setTimeout(() => {
            longPressTimers.delete(e.pointerId);
            if (disposed) return;
            fireLongPress(e.pointerId);
          }, LONG_PRESS_MS),
        );
      }
```

- [ ] **Step 7: Add every cancellation**

Four sites. Missing any one of them is a bug that fires a context menu at the end of an unrelated gesture.

In `onPointerDown`, inside the `if (activePointers.size >= 2) {` block, as its first statement:

```ts
        cancelAllLongPress();
```

In `onPointerMove`, inside the `if (buffered) {` block, in the branch that crosses the threshold — right after `bufferedDown.delete(e.pointerId);`:

```ts
          cancelLongPress(e.pointerId);
```

In `onPointerUp`, as the first statement:

```ts
      cancelLongPress(e.pointerId);
```

In `onPointerCancel`, as the first statement:

```ts
      cancelLongPress(e.pointerId);
```

And in the effect's cleanup function, alongside the existing listener removals:

```ts
      cancelAllLongPress();
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd /Users/mike/src/weasel-device && npx vitest run --project=kit packages/core/src/interactions/dispatcher/
```

Expected: PASS — the 7 new cases plus every pre-existing dispatcher integration test.

- [ ] **Step 9: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/interactions/dispatcher/
git commit -m "feat(dispatcher): synthesize longPress with contextmenu fallback"
```

---

## Task 10: Public exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add the exports**

In `packages/core/src/index.ts`, near the existing `export * from './core/viewport/useCanvasSize';` (line ~87):

```ts
export {
  COARSE_TARGET_SCALE,
  DEFAULT_DEVICE_PROFILE,
  DeviceProfileProvider,
  HANDLE_BASE_PX,
  ANCHOR_HIT_BASE_PX,
  ROTATION_HANDLE_BASE_PX,
  resolveDeviceProfile,
  useDeviceProfile,
  type DeviceProfile,
  type DeviceProfileProviderProps,
  type DetectedDeviceFacts,
} from './core/device';
```

Find the block that re-exports chrome-caps conditions (search for `zoomAtLeast`) and add the two new atoms to it:

```ts
  canHover,
  coarsePointer,
```

Do **not** export `HANDLE_HIT_RADIUS` / `ANCHOR_HIT_RADIUS` from `affordanceAt.ts` — they are internal today and this change does not make them public.

- [ ] **Step 2: Verify the public surface builds**

```bash
cd /Users/mike/src/weasel-device && npx tsc --noEmit && npm run build:leaves && npm run build:core
```

Expected: no type errors; both builds succeed.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/index.ts
git commit -m "feat(core): export the device profile surface"
```

---

## Task 11: Documentation

**Files:**
- Modify: `packages/core/src/features/chrome-caps/README.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Document the new selectors**

In `packages/core/src/features/chrome-caps/README.md`, add to the "Notes for the next person" list:

```markdown
- **Device facts arrive via `RuleCtx.device`.** `coarsePointer:` and
  `canHover:` read the ambient `DeviceProfile` (`core/device/`). Absent
  profile means a fine pointer that can hover — the mouse-shaped default the
  kit assumed before the field existed, so old ctx builders are unaffected.
  Note that these selectors only decide *visibility*; making chrome bigger on
  a coarse pointer is `DeviceProfile.targetScale`'s job, applied at the
  sizing sites, not something a rule can express.
```

- [ ] **Step 2: Record the follow-ups this deliberately did not do**

Add to `docs/TODO.md`, following the file's existing entry format:

```markdown
- **(P3) Two-finger pan.** `viewport.pinchZoom` zooms about the gesture
  centroid but never translates by the centroid delta, so a two-finger drag
  zooms without panning. `packages/core/src/interactions/actions/defaults/pinchZoom.ts`.
- **(P3) World-unit hit radii are only correct at scale 1.**
  `canvas/affordanceAt.ts` documents this on `HANDLE_HIT_RADIUS`; callers who
  know the view scale must pass a thunk. The device `targetScale` composes
  with that correction but does not supply it. Folding view-scale correction
  into the constants themselves would remove a class of caller mistake.
- **(P3) Long-press has no feedback.** No haptic, no visual "press is
  registering" affordance during the 500ms hold. Users get no signal that
  holding will do something.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel-device
git add packages/core/src/features/chrome-caps/README.md docs/TODO.md
git commit -m "docs: device selectors in chrome-caps README, follow-ups in TODO"
```

---

## Task 12: Correct the spec's miscount and verify the whole change

**Files:**
- Modify: `docs/superpowers/specs/2026-07-28-device-profile-design.md`

- [ ] **Step 1: Fix the count**

The spec's sizing table lists five sites and says `8` is "written five times". It is six — `affordances/cornerResize.ts` has both `handleHitRadius = 8` (line 43) and `handleSize = 8` (line 44). Update the table to list both rows and change "five times" to "six times" in the surrounding prose.

- [ ] **Step 2: Run the full release gate**

```bash
cd /Users/mike/src/weasel-device && npm run typecheck && npm run test && npm run build
```

Expected: all three pass. This is what CI's release gate runs; `vitest` alone does not typecheck production code, which is why `typecheck` is listed separately.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel-device
git add docs/superpowers/specs/2026-07-28-device-profile-design.md
git commit -m "docs(spec): correct the duplicated-constant count to six"
```

---

## Verification Checklist

Run at the end. Every item needs an observed command output, not an assumption.

- [ ] `npm run typecheck` — clean
- [ ] `npm run test` — all projects pass
- [ ] `npm run build` — all three tiers build
- [ ] `DEFAULT_HANDLE_SIZE` still exports `8` and `DEFAULT_ROTATION_HANDLE_DISTANCE` still exports `24` (no consumer break)
- [ ] Long-press does not fire for `pointerType: 'mouse'`
- [ ] Long-press does not fire when a second finger lands
- [ ] A `contextMenu`-only binding is reachable by touch via the fallback
- [ ] No new ambient `window.devicePixelRatio` read on the paint path (`Canvas.dpr.test.tsx` and `renderSceneToPixels.test.ts` still pass)
