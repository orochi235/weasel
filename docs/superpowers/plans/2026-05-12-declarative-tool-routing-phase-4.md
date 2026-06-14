# Declarative tool routing — Phase 4 (Reflection consumers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three reflection consumers the spec commits to — an **action registry**, a **conflict checker**, and a **debug overlay** — against the migrated `useHandTool` (Phase 2) and `useSelectTool` (Phase 3). These are what cash the framework promise of "tools as declarative data": once `ToolDef` is data, the kit gets registry/conflict/debug tooling for free, but they have to be built or the data shape is just ceremony.

**Architecture:** All three consumers are pure introspectors over `ToolDef` — they accept `readonly ToolDef[]` (declarative specs, not the translated `Tool<TScratch>` outputs) and produce either a static report (`buildActionRegistry`, `findConflicts`) or a reactive snapshot (`useToolDebugInfo`). Static consumers live as pure functions in `src/tools/routing/reflection/`. The debug overlay needs a runtime signal: the dispatcher gains an `onRouteResolved?: (info: RouteResolvedInfo) => void` option plus a `getLastRoute()` getter, and the `defineTool`/`defineViewportTool` factories invoke a kit-internal hook each time `resolveRoute` returns a hit. The hook bridges from the factory (which sees route resolution at event time) to the dispatcher (which owns the published-state surface consumers read).

**Tech Stack:** TypeScript, React 18+, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.
**Predecessors:** Phase 1/2/3 plans (in the same directory).

---

### Design decisions resolved up-front

These choices the prompt left open are locked here so each task can be deterministic. If a future revision reopens them, edit this section and propagate.

- **Action `description` strategy:** **v1 ships no `description` field.** Consumers (palette, cheat sheet) attach their own human-readable labels via a registry-side lookup keyed on `(toolId, target, modifiers, gesture)`. Rationale: adding `description` to `ActionFn` forces a breaking shape change (`fn | { fn, description }`) on every existing route, and introspecting by calling the `ActionFn` with a synthetic ctx is fragile (closures may dereference real state). Listed as a follow-up at the bottom of this plan.
- **Conflict semantics:** `findConflicts` flags **exact-tuple duplicates only** — two tools with the same `(phase, gesture, target, modifiers)` key. Wildcard-vs-specific overlaps (e.g. `click['*']` vs. `click['rect']`) are **not** conflicts; that's the cascading-fallback pattern from the spec, and the lookup engine handles it deterministically. Ambient stacking (a tool with `apply` on click.rect that intentionally lets the next ambient run via `pass`/`none`) is also out of scope to statically detect — we'd need to evaluate the `ActionFn` to know if it returns `claim`. v1 flags all exact-tuple overlaps; consumers can suppress known-intentional ambient compositions in their UI layer.
- **Route-resolution signal direction:** the dispatcher exposes `onRouteResolved` + `getLastRoute()`. The `defineTool` factory calls a kit-internal callback (passed through `ToolCtx.__reportRoute` — a new optional field, populated by the dispatcher) each time `resolveRoute` yields a non-undefined `ActionFn`. This keeps the factory free of direct dispatcher coupling while letting the dispatcher own the published state. Alternative ("dispatcher snoops scratch transitions") rejected — it can't see route resolution that returned `none()`/no-op.
- **Registry entry granularity:** one row per `(toolId, phase, gesture, target, modifiers)` tuple. A `RouteTable` entry that's a plain `ActionFn` (no modifier sub-table) emits a single row with `modifiers: 'default'`. A `ModifierRoute` sub-table emits one row per defined key (including `'default'` if present). Function-form `drag` (no target, no modifiers — Hand tool shape) emits one row with `target: '*'`, `modifiers: 'default'`.

---

### File map (locked at start)

**Created:**

- `src/tools/routing/reflection/registry.ts` — `buildActionRegistry`, `RegistryEntry`.
- `src/tools/routing/reflection/registry.test.ts`
- `src/tools/routing/reflection/conflicts.ts` — `findConflicts`, `Conflict`.
- `src/tools/routing/reflection/conflicts.test.ts`
- `src/tools/routing/reflection/route-resolved.ts` — `RouteResolvedInfo` type + `formatRouteResolved` helper.
- `src/tools/routing/reflection/useToolDebugInfo.ts` — React hook that snapshots `dispatcher.getLastRoute()` on each `onGestureChange` and `onRouteResolved` tick.
- `src/tools/routing/reflection/ToolDebugOverlay.tsx` — React component, reads info from the hook, renders a styled panel.
- `src/tools/routing/reflection/ToolDebugOverlay.module.css` — overlay styles (no inline-style).
- `src/tools/routing/reflection/index.ts` — barrel.
- `demo/demos/ToolReflectionDemo.tsx` — demo card mounting all three consumers side-by-side.
- Tests alongside each module (`.test.ts` / `.test.tsx`).

**Modified:**

- `src/tools/types.ts` — add optional `__reportRoute?: (info: RouteResolvedInfo) => void` to `ToolCtx`. Kit-internal; consumer tools don't read it. Underscore prefix signals "kit-private".
- `src/tools/dispatcher.ts` — accept `onRouteResolved?: (info: RouteResolvedInfo) => void`; expose `getLastRoute(): RouteResolvedInfo | null` on the dispatcher API; populate `ctx.__reportRoute` in `getCtx` overrides so the factory can call it; cache the last-resolved info in dispatcher state.
- `src/tools/routing/defineTool.ts` — call `ctx.__reportRoute?.({...})` immediately after every successful `resolveRoute` hit (i.e., before invoking the `ActionFn`).
- `src/tools/routing/index.ts` — re-export from `./reflection`.
- `package.json` — extend the `./routing` subpath to include reflection exports (no new top-level subpath needed; reflection rides on `/routing`).
- `demo/demos/index.ts` (or the demo router) — register `ToolReflectionDemo`.

---

## Task 1: `RouteResolvedInfo` type + dispatcher hook plumbing

**Files:**

- Create: `src/tools/routing/reflection/route-resolved.ts`
- Modify: `src/tools/types.ts`
- Modify: `src/tools/dispatcher.ts`
- Modify: `src/tools/routing/defineTool.ts`

The runtime substrate the debug overlay rides on. Land this first because Tasks 2/3 (pure registry + conflict checker) don't depend on it, but Task 4 (overlay hook) does, and Task 5 (demo) wires everything together.

- [ ] **Step 1: Define the type**

Create `src/tools/routing/reflection/route-resolved.ts`:

```ts
// src/tools/routing/reflection/route-resolved.ts
import type { HitResult } from '../hitResult';
import type { ModifierKey } from '../modifiers';

/** Phase the route was resolved against. Mirrors the spec's two-phase
 *  vocabulary — `initial` (idle, scratch null) or `engaged` (mid-gesture). */
export type RoutePhase = 'initial' | 'engaged';

/** Gesture channel the route fired on. */
export type RouteGesture = 'click' | 'dblTap' | 'drag' | 'wheel' | 'keyDown' | 'keyUp';

/** Snapshot of one route resolution, emitted by the factory on each
 *  successful lookup. Captured by the dispatcher as the "last resolved
 *  route" for debug-overlay consumers. */
export interface RouteResolvedInfo {
  toolId: string;
  phase: RoutePhase;
  gesture: RouteGesture;
  /** Route-table key that matched (post-precedence). E.g. 'rect:selected',
   *  '*:selected', 'rect', '*', 'empty'. For function-form `drag` (no
   *  table), this is '*'. For keyDown/keyUp, it's the key name ('Escape',
   *  'Enter', etc.). */
  matchedKey: string;
  modifiers: ModifierKey;
  /** The full HitResult at resolution time (snapshot — safe to read). */
  target: HitResult;
  /** Monotonic timestamp (ms since page load via performance.now()).
   *  Used for "resolved Nms ago" displays. */
  timestamp: number;
}

/** Render-friendly one-line string. Used by ToolDebugOverlay; exported
 *  so non-React consumers can format the same way. */
export function formatRouteResolved(info: RouteResolvedInfo): string {
  const mod = info.modifiers === 'default' ? '' : ` mods=${info.modifiers}`;
  return `${info.toolId} [${info.phase}] ${info.gesture} → ${info.matchedKey}${mod}`;
}
```

- [ ] **Step 2: Test the formatter**

Create `src/tools/routing/reflection/route-resolved.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatRouteResolved, type RouteResolvedInfo } from './route-resolved';
import { asNodeId } from '../../../core/scene/types';

describe('formatRouteResolved', () => {
  it('formats a default-modifier hit', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select',
      phase: 'initial',
      gesture: 'click',
      matchedKey: 'rect',
      modifiers: 'default',
      target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} },
      timestamp: 1000,
    };
    expect(formatRouteResolved(info)).toBe('select [initial] click → rect');
  });

  it('appends modifier info when non-default', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select',
      phase: 'initial',
      gesture: 'click',
      matchedKey: 'rect',
      modifiers: 'shift',
      target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} },
      timestamp: 1000,
    };
    expect(formatRouteResolved(info)).toBe('select [initial] click → rect mods=shift');
  });
});
```

Run:

```bash
cd /Users/mike/src/weasel
npm test -- src/tools/routing/reflection/route-resolved.test.ts
```

Expected: 2 PASS.

- [ ] **Step 3: Add `__reportRoute` to `ToolCtx`**

In `src/tools/types.ts`, find the `ToolCtx` interface and add (after the existing optional fields):

```ts
import type { RouteResolvedInfo } from './routing/reflection/route-resolved';

// ... inside ToolCtx ...
  /** Kit-internal: route-resolution reporter. The dispatcher populates
   *  this; the declarative routing factory calls it after each successful
   *  resolveRoute() hit so the dispatcher can publish the last-resolved
   *  snapshot to debug-overlay consumers. Underscore prefix signals
   *  "do not consume in tool code." */
  __reportRoute?: (info: RouteResolvedInfo) => void;
```

Typecheck:

```bash
npm run typecheck
```

Clean (no consumer reads this field; addition is non-breaking).

- [ ] **Step 4: Extend the dispatcher**

In `src/tools/dispatcher.ts`:

1. Add to `ToolsDispatcherOptions` (alongside `onGestureChange`):

```ts
  /** Called whenever a declarative route resolves to an ActionFn. The
   *  dispatcher caches the most recent invocation; consumers read it via
   *  `getLastRoute()`. Useful for the kit's ToolDebugOverlay. */
  onRouteResolved?: (info: RouteResolvedInfo) => void;
```

2. Add to `ToolsDispatcher` (the returned API):

```ts
  /** Most recent route resolution emitted by a declarative tool, or null
   *  if none has fired yet (or `cancelGesture()` has cleared it). */
  getLastRoute: () => RouteResolvedInfo | null;
```

3. Inside `createToolsDispatcher`, after `let inFlight: InFlight | null = null;`:

```ts
  let lastRoute: RouteResolvedInfo | null = null;
  const reportRoute = (info: RouteResolvedInfo): void => {
    lastRoute = info;
    opts.onRouteResolved?.(info);
  };
```

4. In the `ctxFor` helper, accept and inject `__reportRoute`. Simplest path: thread `reportRoute` into the `getCtx` invocation. Change `ctxFor`:

```ts
function ctxFor(
  scratch: unknown,
  base: Omit<ToolCtx, 'scratch'>,
  reportRoute: (info: RouteResolvedInfo) => void,
): ToolCtx {
  return { ...base, scratch, __reportRoute: reportRoute };
}
```

Update every call site of `ctxFor(scratch, base)` in the dispatcher to pass `reportRoute` as the third argument. The dispatcher's `dispatchOnce` signature also needs threading — pass `reportRoute` into it as a parameter.

5. Expose `getLastRoute` on the returned API:

```ts
  const api: ToolsDispatcher & { /* ... */ } = {
    // ... existing fields ...
    getLastRoute: () => lastRoute,
  };
```

6. In `cancelGesture()`, optionally clear `lastRoute` — or leave it set so the overlay shows the gesture that was cancelled. Leave it set (don't clear); the overlay can show "[cancelled]" via a separate signal in Task 4 if needed.

Typecheck + run dispatcher tests:

```bash
npm run typecheck
npm test -- src/tools/dispatcher.test.ts
```

Both clean (no behavioral change for tools that don't read `__reportRoute`).

- [ ] **Step 5: Wire `defineTool` to call `__reportRoute`**

In `src/tools/routing/defineTool.ts`, locate every place `resolveRoute(table, ctx.target!, ctx.modifiers)` is called. After a non-undefined return, before invoking the action, report. Concrete edits:

Add a small helper near the top of the function body (inside `defineTool`):

```ts
import type { RouteResolvedInfo, RoutePhase, RouteGesture } from './reflection/route-resolved';
import { mods } from './modifiers';

const modifiersToCanonicalKey = (m: ToolModifiers): ModifierKey => {
  const active: Array<'mod' | 'shift' | 'alt'> = [];
  if (m.meta || m.ctrl) active.push('mod');
  if (m.shift) active.push('shift');
  if (m.alt) active.push('alt');
  return mods(...active);
};

const report = (
  ctx: ToolCtx<TScratch>,
  phase: RoutePhase,
  gesture: RouteGesture,
  matchedKey: string,
): void => {
  ctx.__reportRoute?.({
    toolId: def.id,
    phase,
    gesture,
    matchedKey,
    modifiers: modifiersToCanonicalKey(ctx.modifiers),
    target: ctx.target ?? { category: 'empty', kind: 'empty' },
    timestamp: performance.now(),
  });
};
```

Then update each route-resolution site. Click handler example:

```ts
const onClick = (def.initial.click || def.engaged?.click)
  ? (_e, ctx) => {
      const phase: RoutePhase = ctx.scratch != null && def.engaged ? 'engaged' : 'initial';
      const table = phaseOf(ctx).click;
      if (!table) return 'pass';
      const { action, matchedKey } = resolveRouteWithKey(table, ctx.target!, ctx.modifiers);
      if (!action) return 'pass';
      report(ctx, phase, 'click', matchedKey);
      return applyResult(ctx, action(ctx));
    }
  : undefined;
```

`resolveRoute` currently returns only `ActionFn | undefined`; the reporter needs the matched key too. Promote `resolveRoute` to return `{ action, matchedKey } | undefined` — or add a sibling `resolveRouteWithKey`. Cleanest: change `resolveRoute`'s return type. The callers in `defineTool.ts` are the only consumers.

Edit `src/tools/routing/lookup.ts`:

```ts
export interface RouteMatch<TScratch> {
  action: ActionFn<TScratch>;
  matchedKey: string;
}

export function resolveRoute<TScratch>(
  table: RouteTable<TScratch>,
  hit: HitResult,
  modifiers: ToolModifiers,
): RouteMatch<TScratch> | undefined {
  const candidateKeys = buildCandidateKeys(hit);
  for (const key of candidateKeys) {
    const entry = table[key];
    if (entry == null) continue;
    const resolved = resolveEntry(entry, modifiers);
    if (resolved) return { action: resolved, matchedKey: key };
  }
  return undefined;
}
```

Update `lookup.test.ts` expectations — every `expect(resolveRoute(...)).toBe(fn)` becomes `expect(resolveRoute(...)?.action).toBe(fn)`. Re-run:

```bash
npm test -- src/tools/routing/lookup.test.ts
```

All PASS.

Update every callsite in `defineTool.ts` to read `.action` and `.matchedKey`. Do the same for `dblTap`, `drag` (when it's a route table — function form has implicit key `'*'`), and the key handlers (gesture `keyDown` / `keyUp` matchedKey is the keyboard event's `e.key`). Wheel uses `'*'` as the matched key (it's not a routed table — single ActionFn).

- [ ] **Step 6: Verify `defineTool` tests still pass**

```bash
npm test -- src/tools/routing/defineTool.test.ts
```

All PASS (existing tests don't read `__reportRoute`, so they're unaffected).

- [ ] **Step 7: Add a dispatcher test for `getLastRoute`**

Append to `src/tools/dispatcher.test.ts`:

```ts
describe('dispatcher.getLastRoute', () => {
  it('starts null', () => {
    const d = createTestDispatcher();
    expect(d.getLastRoute()).toBeNull();
  });

  it('records the most recent route after a click dispatch', () => {
    const d = createTestDispatcher({
      activeTool: defineTool({
        id: 'test',
        initial: { click: { '*': () => apply([]) } },
      }),
    });
    d.onPointerDown(makePointerEvent({ clientX: 10, clientY: 10 }));
    d.onPointerUp(makePointerEvent({ clientX: 10, clientY: 10 }));
    const last = d.getLastRoute();
    expect(last?.toolId).toBe('test');
    expect(last?.gesture).toBe('click');
    expect(last?.matchedKey).toBe('*');
  });

  it('fires onRouteResolved callback when provided', () => {
    const cb = vi.fn();
    const d = createTestDispatcher({
      activeTool: defineTool({
        id: 'test',
        initial: { click: { '*': () => apply([]) } },
      }),
      onRouteResolved: cb,
    });
    d.onPointerDown(makePointerEvent({ clientX: 10, clientY: 10 }));
    d.onPointerUp(makePointerEvent({ clientX: 10, clientY: 10 }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].toolId).toBe('test');
  });
});
```

(The exact `createTestDispatcher` / `makePointerEvent` helpers in this file are pre-existing — match the existing test patterns.)

Run:

```bash
npm test -- src/tools/dispatcher.test.ts
```

Three new tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/routing/reflection/route-resolved.ts src/tools/routing/reflection/route-resolved.test.ts src/tools/types.ts src/tools/dispatcher.ts src/tools/dispatcher.test.ts src/tools/routing/defineTool.ts src/tools/routing/lookup.ts src/tools/routing/lookup.test.ts
git commit -m "$(cat <<'EOF'
feat(routing): RouteResolvedInfo + dispatcher getLastRoute() hook

Lays the runtime substrate the debug overlay rides on. The declarative
defineTool factory reports each successful resolveRoute() hit through a
kit-internal ctx.__reportRoute callback the dispatcher populates. The
dispatcher caches the most recent invocation as `lastRoute`, exposes it
via getLastRoute(), and fires an optional onRouteResolved callback.

resolveRoute() now returns { action, matchedKey } so the reporter can
include the post-precedence matched key — useful for debugging
"why did `*:selected` fire instead of `rect`?" cases.

Phase 4 of declarative tool routing — see
docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md.
EOF
)"
```

---

## Task 2: `buildActionRegistry(tools)` — action registry

**Files:**

- Create: `src/tools/routing/reflection/registry.ts`
- Create: `src/tools/routing/reflection/registry.test.ts`

Walk a `readonly ToolDef[]`, emit one `RegistryEntry` per `(toolId, phase, gesture, target, modifiers)` tuple. Used by command palettes, cheat sheets, "what does shift-click do here?" tooltips.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/reflection/registry.test.ts
import { describe, it, expect } from 'vitest';
import { buildActionRegistry, type RegistryEntry } from './registry';
import { apply, begin, none } from '../result';
import { mods } from '../modifiers';
import type { ToolDef } from '../types';

const noOp = () => apply<void>([]);

describe('buildActionRegistry', () => {
  it('returns an empty array for no tools', () => {
    expect(buildActionRegistry([])).toEqual([]);
  });

  it('flattens click routes (plain ActionFn entries)', () => {
    const tool: ToolDef = {
      id: 'select',
      initial: {
        click: {
          'rect': noOp,
          'empty': noOp,
        },
      },
    };
    const r = buildActionRegistry([tool]);
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', phase: 'initial', gesture: 'click', target: 'rect', modifiers: 'default',
    });
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', phase: 'initial', gesture: 'click', target: 'empty', modifiers: 'default',
    });
    expect(r).toHaveLength(2);
  });

  it('explodes modifier sub-tables into one row per key', () => {
    const tool: ToolDef = {
      id: 'select',
      initial: {
        click: {
          'rect': {
            [mods()]:        noOp,
            [mods('shift')]: noOp,
            [mods('alt')]:   noOp,
          },
        },
      },
    };
    const r = buildActionRegistry([tool]);
    const targets = r.map((e) => `${e.target}/${e.modifiers}`).sort();
    expect(targets).toEqual(['rect/alt', 'rect/default', 'rect/shift']);
  });

  it('walks all phases', () => {
    const tool: ToolDef = {
      id: 'pen',
      initial: { click: { 'empty': noOp } },
      engaged: { click: { 'anchor:first': noOp, '*': noOp } },
    };
    const r = buildActionRegistry([tool]);
    expect(r.filter((e) => e.phase === 'initial')).toHaveLength(1);
    expect(r.filter((e) => e.phase === 'engaged')).toHaveLength(2);
  });

  it('walks all gesture channels', () => {
    const tool: ToolDef = {
      id: 'test',
      initial: {
        click:   { 'rect': noOp },
        dblTap:  { 'rect': noOp },
        drag:    { 'rect': noOp },
        wheel:   noOp,
        keyDown: { 'Escape': noOp },
        keyUp:   { 'Shift':  noOp },
      },
    };
    const r = buildActionRegistry([tool]);
    const gestures = new Set(r.map((e) => e.gesture));
    expect(gestures).toEqual(new Set(['click', 'dblTap', 'drag', 'wheel', 'keyDown', 'keyUp']));
  });

  it('function-form drag emits a single row with target=*', () => {
    const tool: ToolDef = {
      id: 'hand',
      initial: { drag: () => begin({ scratch: undefined }) },
    };
    const r = buildActionRegistry([tool]);
    expect(r).toEqual<RegistryEntry[]>([
      { toolId: 'hand', phase: 'initial', gesture: 'drag', target: '*', modifiers: 'default' },
    ]);
  });

  it('wheel emits a single row with target=*', () => {
    const tool: ToolDef = {
      id: 'wheel-zoom',
      initial: { wheel: noOp },
    };
    const r = buildActionRegistry([tool]);
    expect(r).toEqual<RegistryEntry[]>([
      { toolId: 'wheel-zoom', phase: 'initial', gesture: 'wheel', target: '*', modifiers: 'default' },
    ]);
  });

  it('keyDown/keyUp use the key name as target', () => {
    const tool: ToolDef = {
      id: 'test',
      initial: { keyDown: { 'Escape': noOp, 'Enter': noOp } },
    };
    const r = buildActionRegistry([tool]);
    expect(r.map((e) => e.target).sort()).toEqual(['Enter', 'Escape']);
  });

  it('aggregates multiple tools', () => {
    const a: ToolDef = { id: 'a', initial: { click: { 'rect': noOp } } };
    const b: ToolDef = { id: 'b', initial: { click: { 'text': noOp } } };
    const r = buildActionRegistry([a, b]);
    expect(r.map((e) => e.toolId).sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- src/tools/routing/reflection/registry.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/reflection/registry.ts
import type {
  ToolDef, PhaseDef, RouteTable, RouteEntry, ModifierRoute, ActionFn,
} from '../types';
import type { ModifierKey } from '../modifiers';
import type { RoutePhase, RouteGesture } from './route-resolved';

/** One row in the action registry — uniquely identifies a routing slot
 *  on one tool. Multiple rows can share (target, modifiers, gesture) if
 *  different tools both declare them; consumers walk the list and group
 *  client-side. */
export interface RegistryEntry {
  toolId: string;
  phase: RoutePhase;
  /** Canonical 8-key string from mods(). 'default' when the route has no
   *  modifier sub-table. */
  modifiers: ModifierKey;
  gesture: RouteGesture;
  /** Route-table key the entry was registered under. For click/dblTap/drag
   *  route tables, this is the target kind. For wheel and function-form
   *  drag, this is '*' (no target dimension). For keyDown/keyUp, this is
   *  the key name (e.g., 'Escape', 'Enter'). */
  target: string;
}

/** Walk a list of ToolDefs and produce a flat registry of every routed
 *  action they expose. The result is a static snapshot — call again if
 *  tools register or unregister. */
export function buildActionRegistry(
  tools: readonly ToolDef<unknown>[],
): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const tool of tools) {
    walkPhase(tool.id, 'initial', tool.initial, out);
    if (tool.engaged) walkPhase(tool.id, 'engaged', tool.engaged, out);
  }
  return out;
}

function walkPhase(
  toolId: string,
  phase: RoutePhase,
  phaseDef: PhaseDef<unknown>,
  out: RegistryEntry[],
): void {
  if (phaseDef.click)  walkRouteTable(toolId, phase, 'click',  phaseDef.click,  out);
  if (phaseDef.dblTap) walkRouteTable(toolId, phase, 'dblTap', phaseDef.dblTap, out);
  if (phaseDef.drag)   walkDrag(toolId, phase, phaseDef.drag, out);
  if (phaseDef.wheel)  out.push({ toolId, phase, gesture: 'wheel', target: '*', modifiers: 'default' });
  if (phaseDef.keyDown) walkKeyMap(toolId, phase, 'keyDown', phaseDef.keyDown, out);
  if (phaseDef.keyUp)   walkKeyMap(toolId, phase, 'keyUp',   phaseDef.keyUp,   out);
}

function walkRouteTable(
  toolId: string,
  phase: RoutePhase,
  gesture: RouteGesture,
  table: RouteTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const target of Object.keys(table)) {
    const entry = table[target];
    if (entry == null) continue;
    if (typeof entry === 'function') {
      out.push({ toolId, phase, gesture, target, modifiers: 'default' });
    } else {
      walkModifierRoute(toolId, phase, gesture, target, entry, out);
    }
  }
}

function walkModifierRoute(
  toolId: string,
  phase: RoutePhase,
  gesture: RouteGesture,
  target: string,
  sub: ModifierRoute<unknown>,
  out: RegistryEntry[],
): void {
  for (const modKey of Object.keys(sub) as ModifierKey[]) {
    if (sub[modKey] == null) continue;
    out.push({ toolId, phase, gesture, target, modifiers: modKey });
  }
}

function walkDrag(
  toolId: string,
  phase: RoutePhase,
  drag: RouteTable<unknown> | ActionFn<unknown>,
  out: RegistryEntry[],
): void {
  if (typeof drag === 'function') {
    // Function-form drag — uniform across targets, no modifier dimension.
    out.push({ toolId, phase, gesture: 'drag', target: '*', modifiers: 'default' });
  } else {
    walkRouteTable(toolId, phase, 'drag', drag, out);
  }
}

function walkKeyMap(
  toolId: string,
  phase: RoutePhase,
  gesture: 'keyDown' | 'keyUp',
  table: Record<string, ActionFn<unknown>>,
  out: RegistryEntry[],
): void {
  for (const key of Object.keys(table)) {
    out.push({ toolId, phase, gesture, target: key, modifiers: 'default' });
  }
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- src/tools/routing/reflection/registry.test.ts
```

All 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/reflection/registry.ts src/tools/routing/reflection/registry.test.ts
git commit -m "$(cat <<'EOF'
feat(routing): buildActionRegistry — flat introspection over ToolDefs

Walks a list of ToolDefs and produces one RegistryEntry per
(toolId × phase × gesture × target × modifiers) tuple. Used by command
palettes / keybinding cheat sheets / 'what does shift-click do here?'
tooltips — consumers filter the flat list client-side.

Function-form drag and wheel emit a single row with target='*'. KeyDown/
keyUp use the key name as the target field. ModifierRoute sub-tables
explode into one row per defined ModifierKey.

Part of Phase 4 of declarative tool routing.
EOF
)"
```

---

## Task 3: `findConflicts(tools)` — conflict checker

**Files:**

- Create: `src/tools/routing/reflection/conflicts.ts`
- Create: `src/tools/routing/reflection/conflicts.test.ts`

Find tuples where two or more tools declare the same `(phase, gesture, target, modifiers)`. Reuses `buildActionRegistry` — the conflict checker is essentially a `groupBy` over the registry's output.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/reflection/conflicts.test.ts
import { describe, it, expect } from 'vitest';
import { findConflicts, type Conflict } from './conflicts';
import { apply } from '../result';
import { mods } from '../modifiers';
import type { ToolDef } from '../types';

const noOp = () => apply<void>([]);

describe('findConflicts', () => {
  it('returns empty array when no overlap', () => {
    const a: ToolDef = { id: 'a', initial: { click: { 'rect': noOp } } };
    const b: ToolDef = { id: 'b', initial: { click: { 'text': noOp } } };
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('flags exact-tuple overlap', () => {
    const a: ToolDef = { id: 'a', initial: { click: { 'rect': noOp } } };
    const b: ToolDef = { id: 'b', initial: { click: { 'rect': noOp } } };
    const c = findConflicts([a, b]);
    expect(c).toEqual<Conflict[]>([{
      phase: 'initial',
      gesture: 'click',
      target: 'rect',
      modifiers: 'default',
      toolIds: ['a', 'b'],
    }]);
  });

  it('flags overlap on a specific modifier sub-key', () => {
    const a: ToolDef = {
      id: 'a',
      initial: { click: { 'rect': { [mods('shift')]: noOp } } },
    };
    const b: ToolDef = {
      id: 'b',
      initial: { click: { 'rect': { [mods('shift')]: noOp } } },
    };
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].modifiers).toBe('shift');
  });

  it('does NOT flag wildcard-vs-specific overlap (cascading-fallback is expected)', () => {
    const a: ToolDef = { id: 'a', initial: { click: { '*':    noOp } } };
    const b: ToolDef = { id: 'b', initial: { click: { 'rect': noOp } } };
    // The lookup engine cleanly resolves: rect → 'rect' on b, anything-else → '*' on a.
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag different modifier combos on the same target', () => {
    const a: ToolDef = {
      id: 'a',
      initial: { click: { 'rect': { [mods('shift')]: noOp } } },
    };
    const b: ToolDef = {
      id: 'b',
      initial: { click: { 'rect': { [mods('alt')]: noOp } } },
    };
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag same-tool self-overlap (impossible by construction — single key)', () => {
    // A ToolDef literal can't declare the same target key twice — JS object literal
    // semantics deduplicate. So self-overlap can only happen across two tools.
    // This test documents the invariant.
    const a: ToolDef = { id: 'a', initial: { click: { 'rect': noOp } } };
    expect(findConflicts([a])).toEqual([]);
  });

  it('flags three-way conflict (>= 2 tools claim same tuple)', () => {
    const mk = (id: string): ToolDef => ({ id, initial: { click: { 'rect': noOp } } });
    const c = findConflicts([mk('a'), mk('b'), mk('c')]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('flags conflicts in engaged phase independently of initial phase', () => {
    const a: ToolDef = { id: 'a', engaged: { keyDown: { 'Escape': noOp } }, initial: {} };
    const b: ToolDef = { id: 'b', engaged: { keyDown: { 'Escape': noOp } }, initial: {} };
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].phase).toBe('engaged');
    expect(c[0].gesture).toBe('keyDown');
    expect(c[0].target).toBe('Escape');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- src/tools/routing/reflection/conflicts.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/reflection/conflicts.ts
import type { ToolDef } from '../types';
import type { ModifierKey } from '../modifiers';
import type { RoutePhase, RouteGesture } from './route-resolved';
import { buildActionRegistry, type RegistryEntry } from './registry';

/** Two or more tools declare the same exact (phase, gesture, target,
 *  modifiers) tuple — the dispatcher's slot precedence picks one
 *  arbitrarily (well, deterministically by slot order, but the author
 *  probably didn't intend the duplication). */
export interface Conflict {
  phase: RoutePhase;
  gesture: RouteGesture;
  target: string;
  modifiers: ModifierKey;
  /** All tool ids that registered the same tuple. At least 2 by
   *  construction. Order matches the input tools[] order. */
  toolIds: string[];
}

/** Detect exact-tuple overlaps across a tool registration set.
 *
 *  Intentionally NOT flagged:
 *  - Wildcard vs. specific (e.g., `click['*']` + `click['rect']`) — that's
 *    the cascading-fallback pattern; the lookup engine resolves cleanly.
 *  - Different modifier sub-keys on the same target — they fire on
 *    different inputs.
 *  - Ambient stacking where a tool returns `pass`/`none()` from its
 *    ActionFn to intentionally let another ambient tool run. We'd need
 *    to evaluate the ActionFn to detect intent; consumers can suppress
 *    known-intentional compositions in their UI layer.
 */
export function findConflicts(
  tools: readonly ToolDef<unknown>[],
): Conflict[] {
  const entries = buildActionRegistry(tools);
  const groups = new Map<string, RegistryEntry[]>();
  for (const entry of entries) {
    const key = `${entry.phase}|${entry.gesture}|${entry.target}|${entry.modifiers}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  const conflicts: Conflict[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    // Multiple registrations from the same tool can't share a key (Object
    // literals dedupe), so bucket.length >= 2 implies >= 2 distinct toolIds.
    const first = bucket[0];
    conflicts.push({
      phase: first.phase,
      gesture: first.gesture,
      target: first.target,
      modifiers: first.modifiers,
      toolIds: bucket.map((e) => e.toolId),
    });
  }
  return conflicts;
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- src/tools/routing/reflection/conflicts.test.ts
```

All 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/reflection/conflicts.ts src/tools/routing/reflection/conflicts.test.ts
git commit -m "$(cat <<'EOF'
feat(routing): findConflicts — exact-tuple overlap detector

Reuses buildActionRegistry to extract every (phase, gesture, target,
modifiers) tuple, then groups by tuple and reports any group with >= 2
tools as a Conflict.

Wildcard-vs-specific overlap is NOT a conflict — that's the cascading-
fallback pattern from the spec, deterministically resolved by the lookup
engine. Only exact-tuple duplicates flag.

Part of Phase 4 of declarative tool routing.
EOF
)"
```

---

## Task 4: `useToolDebugInfo()` hook + `<ToolDebugOverlay>` component

**Files:**

- Create: `src/tools/routing/reflection/useToolDebugInfo.ts`
- Create: `src/tools/routing/reflection/useToolDebugInfo.test.tsx`
- Create: `src/tools/routing/reflection/ToolDebugOverlay.tsx`
- Create: `src/tools/routing/reflection/ToolDebugOverlay.module.css`
- Create: `src/tools/routing/reflection/ToolDebugOverlay.test.tsx`

The hook reads `dispatcher.getLastRoute()` reactively (re-tick on each `onRouteResolved`); the component renders a styled panel showing tool id, phase, gesture, target, modifiers.

- [ ] **Step 1: Inspect the dispatcher accessor pattern**

```bash
cd /Users/mike/src/weasel
grep -n "useToolsDispatcher\|ToolsDispatcher" src/tools/useTools.ts src/canvas/SceneCanvas.tsx 2>/dev/null | head -20
```

Confirm how consumers normally get a handle on the dispatcher. The hook should accept a dispatcher reference (or read from a kit-shipped context if one exists). For v1, take the dispatcher as an argument — simplest, no context dependency.

- [ ] **Step 2: Write the hook**

```ts
// src/tools/routing/reflection/useToolDebugInfo.ts
import { useEffect, useState } from 'react';
import type { ToolsDispatcher } from '../../dispatcher';
import type { RouteResolvedInfo } from './route-resolved';

/** Reactive snapshot of the most recently resolved route. Re-renders
 *  the consuming component whenever a new route resolves. Returns null
 *  when no route has resolved yet (or after `cancelGesture()`).
 *
 *  Pass the kit's ToolsDispatcher reference. The hook subscribes via
 *  the dispatcher's existing onRouteResolved option — if the consumer's
 *  dispatcher wasn't constructed with this hook in mind, the consumer
 *  must thread an extra subscription. (Future improvement: kit-shipped
 *  dispatcher context.) */
export function useToolDebugInfo(
  dispatcher: ToolsDispatcher,
): RouteResolvedInfo | null {
  const [info, setInfo] = useState<RouteResolvedInfo | null>(() =>
    dispatcher.getLastRoute(),
  );
  useEffect(() => {
    // Poll-on-tick fallback: the dispatcher's onRouteResolved option is
    // owned by createToolsDispatcher (set once at construction). If the
    // consumer didn't wire it to this hook, we still want some signal.
    // Strategy: use requestAnimationFrame loop while mounted to read
    // getLastRoute(). Cheap (single function call per frame); the kit's
    // event loop is the same one driving renders, so no extra work.
    let raf = 0;
    let last = dispatcher.getLastRoute();
    const tick = (): void => {
      const next = dispatcher.getLastRoute();
      if (next !== last) {
        last = next;
        setInfo(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dispatcher]);
  return info;
}
```

(Identity-compare on `dispatcher.getLastRoute()` works because the dispatcher reassigns `lastRoute` to a fresh object on each report; the returned reference is stable until the next report.)

- [ ] **Step 3: Write the hook test**

```tsx
// src/tools/routing/reflection/useToolDebugInfo.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolDebugInfo } from './useToolDebugInfo';
import type { ToolsDispatcher } from '../../dispatcher';
import type { RouteResolvedInfo } from './route-resolved';
import { asNodeId } from '../../../core/scene/types';

function makeDispatcher(initial: RouteResolvedInfo | null = null): {
  dispatcher: ToolsDispatcher;
  setRoute: (r: RouteResolvedInfo) => void;
} {
  let last = initial;
  return {
    setRoute: (r) => { last = r; },
    dispatcher: {
      onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {},
      onKeyDown: () => {}, onKeyUp: () => {}, onWheel: () => {},
      cancelGesture: () => {}, hasActiveGesture: () => false,
      getActiveScratch: () => null,
      getLastRoute: () => last,
    },
  };
}

describe('useToolDebugInfo', () => {
  beforeEach(() => {
    let raf = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      raf++;
      // Synchronous schedule via microtask so act() can flush deterministically.
      queueMicrotask(() => cb(performance.now()));
      return raf;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns null when no route resolved', () => {
    const { dispatcher } = makeDispatcher();
    const { result } = renderHook(() => useToolDebugInfo(dispatcher));
    expect(result.current).toBeNull();
  });

  it('returns the most-recent route after the dispatcher updates', async () => {
    const { dispatcher, setRoute } = makeDispatcher();
    const { result } = renderHook(() => useToolDebugInfo(dispatcher));
    expect(result.current).toBeNull();
    const info: RouteResolvedInfo = {
      toolId: 'select', phase: 'initial', gesture: 'click',
      matchedKey: 'rect', modifiers: 'default',
      target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} },
      timestamp: 1000,
    };
    await act(async () => {
      setRoute(info);
      // Let one rAF tick fire.
      await new Promise((r) => queueMicrotask(() => r(null)));
    });
    expect(result.current).toEqual(info);
  });
});
```

- [ ] **Step 4: Write the overlay component**

```tsx
// src/tools/routing/reflection/ToolDebugOverlay.tsx
import type { RouteResolvedInfo } from './route-resolved';
import styles from './ToolDebugOverlay.module.css';

export interface ToolDebugOverlayProps {
  /** Most recent route resolution. Pass the result of useToolDebugInfo(). */
  info: RouteResolvedInfo | null;
  /** Optional override for the "idle" placeholder text shown when info is null. */
  emptyLabel?: string;
}

/** Dev-tools-style panel showing the most recently resolved route.
 *  Mount in a corner of the viewport (typically bottom-right). Pure
 *  presentation — no dispatcher coupling; the parent threads the info. */
export function ToolDebugOverlay({
  info,
  emptyLabel = 'No route resolved yet',
}: ToolDebugOverlayProps): JSX.Element {
  if (!info) {
    return (
      <div className={styles.overlay} data-state="empty">
        <span className={styles.empty}>{emptyLabel}</span>
      </div>
    );
  }
  const modText = info.modifiers === 'default' ? '—' : info.modifiers;
  const targetText = info.target.category === 'empty'
    ? 'empty'
    : `${info.target.kind}${'id' in info.target ? `(${String(info.target.id)})` : ''}`;
  return (
    <div className={styles.overlay} data-state="resolved">
      <div className={styles.row}>
        <span className={styles.label}>tool</span>
        <span className={styles.value}>{info.toolId}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>phase</span>
        <span className={styles.value}>{info.phase}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>gesture</span>
        <span className={styles.value}>{info.gesture}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>matched</span>
        <span className={styles.value}>{info.matchedKey}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>target</span>
        <span className={styles.value}>{targetText}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>mods</span>
        <span className={styles.value}>{modText}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the CSS module**

```css
/* src/tools/routing/reflection/ToolDebugOverlay.module.css */
.overlay {
  position: absolute;
  bottom: 12px;
  right: 12px;
  min-width: 180px;
  padding: 8px 10px;
  background: rgba(20, 20, 24, 0.86);
  color: #eaeaea;
  font: 11px/1.4 ui-monospace, "SF Mono", Menlo, monospace;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  pointer-events: none;
  user-select: none;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.label {
  color: #888;
}

.value {
  color: #f5f5f5;
}

.empty {
  color: #888;
  font-style: italic;
}
```

(No inline styles — per the project's coding rules. All visual presentation lives in the CSS module.)

- [ ] **Step 6: Write the overlay component test**

```tsx
// src/tools/routing/reflection/ToolDebugOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolDebugOverlay } from './ToolDebugOverlay';
import type { RouteResolvedInfo } from './route-resolved';
import { asNodeId } from '../../../core/scene/types';

describe('ToolDebugOverlay', () => {
  it('shows the empty placeholder when info is null', () => {
    render(<ToolDebugOverlay info={null} />);
    expect(screen.getByText('No route resolved yet')).toBeDefined();
  });

  it('honors a custom emptyLabel', () => {
    render(<ToolDebugOverlay info={null} emptyLabel="Idle" />);
    expect(screen.getByText('Idle')).toBeDefined();
  });

  it('renders all six rows when info is resolved', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select', phase: 'initial', gesture: 'click',
      matchedKey: 'rect', modifiers: 'shift',
      target: { category: 'node', kind: 'rect', id: asNodeId('node-42'), pose: {}, data: {} },
      timestamp: 1000,
    };
    render(<ToolDebugOverlay info={info} />);
    expect(screen.getByText('select')).toBeDefined();
    expect(screen.getByText('initial')).toBeDefined();
    expect(screen.getByText('click')).toBeDefined();
    expect(screen.getByText('rect')).toBeDefined();
    expect(screen.getByText('rect(node-42)')).toBeDefined();
    expect(screen.getByText('shift')).toBeDefined();
  });

  it('formats empty-target rows as "empty"', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select', phase: 'initial', gesture: 'click',
      matchedKey: 'empty', modifiers: 'default',
      target: { category: 'empty', kind: 'empty' },
      timestamp: 1000,
    };
    render(<ToolDebugOverlay info={info} />);
    expect(screen.getByText('empty')).toBeDefined();
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npm test -- src/tools/routing/reflection/useToolDebugInfo.test.tsx src/tools/routing/reflection/ToolDebugOverlay.test.tsx
```

All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/routing/reflection/useToolDebugInfo.ts src/tools/routing/reflection/useToolDebugInfo.test.tsx src/tools/routing/reflection/ToolDebugOverlay.tsx src/tools/routing/reflection/ToolDebugOverlay.module.css src/tools/routing/reflection/ToolDebugOverlay.test.tsx
git commit -m "$(cat <<'EOF'
feat(routing): useToolDebugInfo hook + ToolDebugOverlay component

Hook subscribes to the dispatcher's getLastRoute() via rAF polling
(identity-compare on the returned object means we re-render only when
a new route actually resolves). Component renders a fixed-corner panel
showing tool/phase/gesture/matched-key/target/modifiers — no inline
styles, all presentation in a CSS module.

Part of Phase 4 of declarative tool routing.
EOF
)"
```

---

## Task 5: Reflection barrel + main `routing` index re-exports

**Files:**

- Create: `src/tools/routing/reflection/index.ts`
- Modify: `src/tools/routing/index.ts`

Surface the reflection consumers via the existing `@weasel-js/core/routing` subpath. No new top-level subpath needed — reflection rides on routing.

- [ ] **Step 1: Create the reflection barrel**

```ts
// src/tools/routing/reflection/index.ts
export type { RegistryEntry } from './registry';
export { buildActionRegistry } from './registry';
export type { Conflict } from './conflicts';
export { findConflicts } from './conflicts';
export type {
  RouteResolvedInfo, RoutePhase, RouteGesture,
} from './route-resolved';
export { formatRouteResolved } from './route-resolved';
export { useToolDebugInfo } from './useToolDebugInfo';
export { ToolDebugOverlay, type ToolDebugOverlayProps } from './ToolDebugOverlay';
```

- [ ] **Step 2: Re-export from `src/tools/routing/index.ts`**

Append to the existing routing barrel:

```ts
// Reflection consumers — registry / conflict checker / debug overlay.
export * from './reflection';
```

- [ ] **Step 3: Smoke-test the imports**

```bash
cd /Users/mike/src/weasel
cat > /tmp/reflection-smoke.ts <<'EOF'
import {
  buildActionRegistry, findConflicts,
  useToolDebugInfo, ToolDebugOverlay,
  type RegistryEntry, type Conflict, type RouteResolvedInfo,
} from '@weasel-js/core/routing';
const _r: RegistryEntry[] = buildActionRegistry([]);
const _c: Conflict[] = findConflicts([]);
console.log(_r, _c, useToolDebugInfo, ToolDebugOverlay);
EOF
npx tsc --noEmit --jsx react /tmp/reflection-smoke.ts
rm /tmp/reflection-smoke.ts
```

Expected: no errors.

- [ ] **Step 4: Typecheck + tests**

```bash
npm run typecheck
npm test
```

Both clean. Baseline test count holds.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/reflection/index.ts src/tools/routing/index.ts
git commit -m "$(cat <<'EOF'
feat(routing): export reflection consumers from /routing subpath

Reflection rides on the existing @weasel-js/core/routing subpath —
no new package.json exports needed. Consumers import
buildActionRegistry / findConflicts / useToolDebugInfo / ToolDebugOverlay
alongside defineTool from the same path.

Part of Phase 4 of declarative tool routing.
EOF
)"
```

---

## Task 6: `ToolReflectionDemo` — demo card

**Files:**

- Create: `demo/demos/ToolReflectionDemo.tsx`
- Modify: `demo/demos/index.ts` (or wherever the demo router enumerates demos)

A live demo showing all three reflection consumers operating on the migrated `useSelectTool` + `useHandTool`. The registry table on the left, the conflict report in the middle, the live `<ToolDebugOverlay>` overlaid on the canvas on the right.

- [ ] **Step 1: Inspect the demo router**

```bash
cd /Users/mike/src/weasel
grep -n "LayerListDemo\|ResizeDemo\|registerDemo" demo/demos/index.ts demo/index.tsx 2>/dev/null | head
```

Confirm how demos register (likely a `Record<string, () => JSX.Element>` keyed by hash).

- [ ] **Step 2: Write the demo**

```tsx
// demo/demos/ToolReflectionDemo.tsx
import { useMemo, useRef } from 'react';
import { SceneCanvas } from '@weasel-js/core';
import {
  buildActionRegistry, findConflicts,
  useToolDebugInfo, ToolDebugOverlay,
  type RegistryEntry, type Conflict,
} from '@weasel-js/core/routing';
import { useSelectTool } from '@weasel-js/core';
import { useHandTool } from '@weasel-js/core';

export function ToolReflectionDemo(): JSX.Element {
  const select = useSelectTool();
  const hand = useHandTool();
  // The reflection consumers introspect ToolDefs, but our migrated builtins
  // already return the translated Tool<TScratch>. For the demo, hold onto
  // the same ToolDef inputs we feed into defineTool — for builtins we
  // approximate by re-deriving from the Tool's exposed metadata. (Real kit
  // consumers usually have the ToolDef in their own source.) Demo-only
  // shortcut: re-build a stub ToolDef for each tool that captures the
  // gesture surface seen by the dispatcher. See note below.
  const tools = useMemo(() => buildDemoToolDefs(), []);
  const registry: RegistryEntry[] = useMemo(() => buildActionRegistry(tools), [tools]);
  const conflicts: Conflict[] = useMemo(() => findConflicts(tools), [tools]);

  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <div className="reflection-demo">
      <header>
        <h2>Tool reflection</h2>
        <p>
          Action registry (left), conflict report (middle), live debug
          overlay (right, on the canvas).
        </p>
      </header>
      <div className="grid">
        <RegistryTable rows={registry} />
        <ConflictsReport conflicts={conflicts} />
        <div className="canvas-wrap" ref={canvasRef}>
          <SceneCanvas
            active={select}
            ambient={[hand]}
            /* ... rest of standard scene wiring ... */
          />
          <DemoOverlay />
        </div>
      </div>
    </div>
  );
}

function RegistryTable({ rows }: { rows: RegistryEntry[] }): JSX.Element {
  return (
    <table className="registry">
      <thead>
        <tr>
          <th>tool</th><th>phase</th><th>gesture</th>
          <th>target</th><th>mods</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.toolId}</td>
            <td>{r.phase}</td>
            <td>{r.gesture}</td>
            <td>{r.target}</td>
            <td>{r.modifiers}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConflictsReport({ conflicts }: { conflicts: Conflict[] }): JSX.Element {
  if (conflicts.length === 0) {
    return <p className="no-conflicts">No conflicts.</p>;
  }
  return (
    <ul className="conflicts">
      {conflicts.map((c, i) => (
        <li key={i}>
          <code>
            {c.phase}.{c.gesture}[{c.target}]
            {c.modifiers !== 'default' && `:${c.modifiers}`}
          </code>{' '}
          claimed by {c.toolIds.join(', ')}
        </li>
      ))}
    </ul>
  );
}

function DemoOverlay(): JSX.Element {
  // Reaches into the kit-shipped useTools dispatcher reference. In the
  // demo we know the SceneCanvas constructs one; the demo-helper
  // useSceneDispatcher exposes it.
  const dispatcher = useSceneDispatcher();
  const info = useToolDebugInfo(dispatcher);
  return <ToolDebugOverlay info={info} />;
}

// Demo shortcut — builds ToolDef stubs that mirror the gesture surfaces
// of useSelectTool / useHandTool for registry/conflict introspection.
// Real kit consumers introspect the ToolDef they defined in their own
// source; here we approximate so the demo is self-contained.
function buildDemoToolDefs(): readonly import('@weasel-js/core/routing').ToolDef[] {
  // Inline the same routes as the migrated builtins:
  //   select: click on rect/text/path/empty (+ shift sub-table), drag on
  //           rect/text/path → move, drag on empty → marquee, dblTap on
  //           text/path → enter edit.
  //   hand:   function-form drag.
  return [
    {
      id: 'select',
      initial: {
        click: {
          'rect':  { default: () => ({ kind: 'apply', ops: [] }), shift: () => ({ kind: 'apply', ops: [] }) },
          'text':  () => ({ kind: 'apply', ops: [] }),
          'path':  () => ({ kind: 'apply', ops: [] }),
          'empty': () => ({ kind: 'apply', ops: [] }),
        },
        dblTap: {
          'text': () => ({ kind: 'apply', ops: [] }),
          'path': () => ({ kind: 'apply', ops: [] }),
        },
        drag: {
          'rect':  () => ({ kind: 'apply', ops: [] }),
          'empty': () => ({ kind: 'apply', ops: [] }),
        },
      },
    },
    {
      id: 'hand',
      initial: {
        drag: () => ({ kind: 'apply', ops: [] }),
      },
    },
  ];
}

// Stub — demo wires this to the real dispatcher via SceneCanvas context.
declare function useSceneDispatcher(): import('@weasel-js/core').ToolsDispatcher;
```

- [ ] **Step 3: Resolve the `useSceneDispatcher` access**

The demo needs a handle on the dispatcher to feed `useToolDebugInfo`. Check the kit for an existing pattern:

```bash
grep -rn "ToolsDispatcher\b" /Users/mike/src/weasel/src/canvas/ 2>/dev/null | head
```

If `SceneCanvas` already exposes a `dispatcherRef` prop (or context), use it. If not, the demo can either:

(a) skip the live overlay and show registry + conflicts only (acceptable v1 — the overlay's correctness is covered by the Task 4 tests);
(b) construct the dispatcher manually (lift `useTools` out of `SceneCanvas` for this demo).

Pick (a) for v1 — keeps the demo self-contained without a kit refactor. Remove the `<DemoOverlay>` section if the SceneCanvas doesn't expose its dispatcher. Note the limitation in the demo's header text: "Live debug overlay coverage requires a SceneCanvas API extension — see follow-ups."

If `SceneCanvas` does expose a dispatcher hook (e.g., `useSceneDispatcher` already exists), keep the overlay path and remove the stub `declare function`.

- [ ] **Step 4: Add demo styles**

Create `demo/demos/ToolReflectionDemo.module.css` with the layout (3-column grid, table styling, conflict-list styling). Mirror existing demo CSS patterns from `LayerListDemo` or `ActionsDemo`. No inline styles.

- [ ] **Step 5: Register the demo in the demo router**

In `demo/demos/index.ts` (or the equivalent demo enumeration), add:

```ts
import { ToolReflectionDemo } from './ToolReflectionDemo';
// ... existing demos ...
export const demos = {
  // ... existing entries ...
  'tool-reflection': { component: ToolReflectionDemo, label: 'Tool reflection' },
};
```

(Exact shape — match the existing record.)

- [ ] **Step 6: Run dev server, manual smoke**

```bash
npm run dev
```

Open the demo at `#tool-reflection`:
- Registry table lists ~10-12 rows: select.click.rect/text/path/empty/empty:shift/etc., select.dblTap.text/path, select.drag.rect/empty, hand.drag.*.
- Conflicts: should be empty (the stub ToolDefs don't overlap).
- If overlay path is wired: switch to select tool, click a rect — overlay shows `select [initial] click → rect`. Shift-click — overlay shows `select [initial] click → rect mods=shift`.

- [ ] **Step 7: Commit**

```bash
git add demo/demos/ToolReflectionDemo.tsx demo/demos/ToolReflectionDemo.module.css demo/demos/index.ts
git commit -m "$(cat <<'EOF'
demo(routing): ToolReflectionDemo — registry + conflicts + live overlay

Mounts all three reflection consumers side-by-side against stub ToolDefs
that mirror the gesture surfaces of useSelectTool + useHandTool. Live
overlay shows the most recently resolved route as the user interacts.

Validates the data shape works end-to-end before later phases lock it.
EOF
)"
```

---

## Self-review checklist

Per the writing-plans skill:

1. **Spec coverage** — every part of the "Reflection consumers" promise in the spec maps to a task:
   - "Action registry" (spec §Reflection consumers, item 1) → Task 2.
   - "Conflict detection at boot" (item 2) → Task 3.
   - "Tool-introspection debug overlay" (item 3) → Tasks 1 + 4 (runtime hook + presentation).
   - "Build against migrated tools from phases 2/3" → Task 6 (demo) consumes useSelectTool + useHandTool.

2. **Placeholder scan** — no TBD or "implement later" markers in steps. The two design decisions left ambiguous by the prompt (description strategy, conflict semantics on wildcards) are resolved in the up-front "Design decisions resolved up-front" section so each task is deterministic. The one task with conditional branching (Task 6 step 3, dispatcher access) lays out both options concretely; the implementer picks based on what the kit already exposes.

3. **Type consistency** —
   - `RegistryEntry` (Task 2) and `Conflict` (Task 3) both reference `RoutePhase` / `RouteGesture` / `ModifierKey` from the same `route-resolved.ts` / `modifiers.ts` modules.
   - `RouteResolvedInfo` (Task 1) is consumed unchanged by `useToolDebugInfo` (Task 4) and `<ToolDebugOverlay>` (Task 4).
   - The dispatcher API addition (`getLastRoute(): RouteResolvedInfo | null`) matches the hook's expected return shape exactly.

4. **Step content** — each step contains actual code or a real command with expected output. The `defineTool` edit in Task 1 step 5 names the specific function-internal sites that need updating; the dispatcher edit in step 4 enumerates the six sub-edits.

---

## Follow-ups (not in scope for this plan)

- **`description` field on `ActionFn`.** If consumer feedback shows palettes / cheat sheets need human-readable labels at the framework level (not just consumer-side), promote `ActionFn` to accept `{ fn, description }` and thread `description` through `RegistryEntry`. Breaking change — needs a separate plan.
- **Conflict suppression for intentional ambient stacking.** A `ToolDef` could grow an `ambientCompose?: boolean` flag that marks "I expect to fall through; don't flag me as conflicting." Out of scope until a real consumer hits the false-positive.
- **Kit-shipped dispatcher context.** If `useToolDebugInfo` ends up needing the dispatcher reference threaded through many components, ship a `<KitProvider>` context with the dispatcher and let the hook read from there. Out of scope; the explicit-argument shape is fine for v1.
- **Recording / replay.** `RouteResolvedInfo` is a structured event — a future plan could buffer them in a ring and ship a "replay last 100 gestures" demo. Out of scope.
- **Cross-phase conflict awareness.** If a tool registers `initial.click.rect` AND `engaged.click.rect`, that's not a conflict (different phases, different state). The current `findConflicts` correctly skips this. If we later want to detect "this phase transition is unreachable because no route opens engaged," that's a separate static analysis — out of scope.
