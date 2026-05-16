# Dispatch Resolutions: Live Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Live mode to the Toolkit Builder's "Dispatch resolutions" widget so each (target, modifiers) cell reflects what the *real dispatcher* would resolve, not a hand-rolled static walk of the declarative tables.

**Architecture:** Extend `ToolsDispatcher` with a side-effect-free `resolveOnly({ phase, gesture, hit, modifiers })` that walks slots in real precedence (hotkey > active > ambient) and consults each tool's attached `def` (the source `ToolDef`) via `resolveRoute`. The widget gains a Static | Live toggle: Live calls `tools.dispatcher.resolveOnly(...)` per cell; Static keeps today's hand-walked path. No event injection, no scene side-effects, no sandbox dispatcher.

**Tech Stack:** TypeScript, React, Vitest, React Testing Library. Files in `src/tools/` (kit) and `apps/swillustrator/src/dev/` (consumer).

**Out of scope:** Synthetic-PointerEvent injection (the original TODO framing). Live-mode parity already covers the value (real slot order, real `def`-attached tables) without the side-effect plumbing. If a future need arises (e.g. seeing what `tool.claim` returns mid-gesture), revisit.

---

## File Structure

**Kit (new code):**
- Modify: `src/tools/dispatcher.ts` — add `ResolveQuery`, `ResolveResult`, `resolveOnly` to `ToolsDispatcher` interface and implementation.
- Create: `src/tools/dispatcher.resolveOnly.test.ts` — focused unit tests.

**Consumer (widget):**
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.tsx` — `ResolutionsWidget` gains mode state + Live cell path.
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.module.css` — segmented-toggle + error-cell styles.

**Docs:**
- Modify: `docs/TODO.md` — mark "Dispatch-resolutions widget: live mode" done.

---

## Task 1: Add `ResolveQuery` / `ResolveResult` types and `resolveOnly` to `ToolsDispatcher` interface

**Files:**
- Modify: `src/tools/dispatcher.ts` (interface only; implementation in Task 2)
- Test: `src/tools/dispatcher.resolveOnly.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/tools/dispatcher.resolveOnly.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import { defineTool, claim, apply } from './routing';
import type { AnyTool } from './types';
import type { HitResult } from './routing/hitResult';

function makeSelectTool(): AnyTool {
  return defineTool({
    id: 'select',
    presentation: { label: 'Select' },
    initial: {
      click: {
        rect: (_ctx) => claim(),
        '*': (_ctx) => claim(),
      },
    },
  }) as AnyTool;
}

function makeDispatcher(active: AnyTool | null, ambient: AnyTool[] = []): ToolsDispatcher {
  return createToolsDispatcher({
    getSlots: () => ({ hotkey: null, active, ambient }),
    getCtx: () => ({
      worldX: 0, worldY: 0,
      view: { x: 0, y: 0, scale: 1 },
      canvasRect: undefined,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
      adapter: {} as never,
      applyOps: () => {},
      applyBatch: () => {},
      selection: { ids: [], focus: null },
      setView: () => {},
      target: { category: 'empty', kind: 'empty' },
      __reportRoute: () => {},
    }) as never,
  });
}

describe('ToolsDispatcher.resolveOnly', () => {
  it('returns the matched declarative route for an active tool', () => {
    const select = makeSelectTool();
    const d = makeDispatcher(select);
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1', pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial',
      gesture: 'click',
      hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result).toEqual({
      toolId: 'select',
      slot: 'active',
      gesture: 'click',
      phase: 'initial',
      matchedKey: 'rect',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/dispatcher.resolveOnly.test.ts`
Expected: FAIL — `d.resolveOnly is not a function` (and likely a TS compile error before that).

- [ ] **Step 3: Add the interface members (no impl yet)**

Edit `src/tools/dispatcher.ts`. After the `ToolsDispatcher` interface (around line 200), add the types and extend the interface. Find:

```ts
  /** Most recent route resolution emitted by a declarative tool, or null
   *  if none has fired yet. Snapshot — safe to read on every render. */
  getLastRoute: () => RouteResolvedInfo | null;
}
```

Insert before the closing `}`:

```ts
  /** Resolve a synthetic (phase, gesture, hit, modifiers) query against the
   *  current slot occupants WITHOUT executing the matched action. Walks slots
   *  in real precedence order (hotkey > active > ambient) and consults each
   *  tool's attached `def` (the declarative `ToolDef` produced by
   *  `defineTool`). Tools without an attached `def` (imperative-only) are
   *  invisible to this query. Returns the first match, or null if no slot
   *  resolves the query. Pure: no scratch mutation, no scene mutation, no
   *  RouteResolvedInfo emission. */
  resolveOnly: (query: ResolveQuery) => ResolveResult | null;
}

/** Synthetic resolution query — what the static widget asks "if a pointer
 *  event landed on `hit` with these `modifiers`, which declarative route
 *  would the dispatcher fire in this phase + gesture?" */
export interface ResolveQuery {
  phase: 'initial' | 'engaged';
  gesture: 'click' | 'drag' | 'pointerDown' | 'dblTap' | 'wheel';
  hit: HitResult;
  modifiers: ToolModifiers;
}

/** Successful resolution: which tool, in which slot, matched which route-table
 *  key. `matchedKey` is `'*'` for function-form drag (no table to discriminate)
 *  and for wheel routes (single ActionFn). */
export interface ResolveResult {
  toolId: string;
  slot: 'hotkey' | 'active' | 'ambient';
  gesture: 'click' | 'drag' | 'pointerDown' | 'dblTap' | 'wheel';
  phase: 'initial' | 'engaged';
  matchedKey: string;
}
```

Then add the needed imports at the top of `src/tools/dispatcher.ts`. Find the existing imports block; ensure these are imported:

```ts
import type { HitResult } from './routing/hitResult';
import type { ToolDef, PhaseDef, RouteTable } from './routing/types';
import { resolveRoute } from './routing/lookup';
```

(If any are already imported, don't duplicate.)

At the bottom of the file inside `createToolsDispatcher`'s returned object (the `return { ... }` block at the end of `createToolsDispatcher`), add a `resolveOnly` field that throws so the test fails for the right reason (missing impl, not missing field):

```ts
    resolveOnly: () => { throw new Error('not implemented'); },
```

- [ ] **Step 4: Run typecheck — expect green; test — expect FAIL with "not implemented"**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx vitest run src/tools/dispatcher.resolveOnly.test.ts`
Expected: FAIL with `Error: not implemented`

- [ ] **Step 5: Commit**

```bash
git add src/tools/dispatcher.ts src/tools/dispatcher.resolveOnly.test.ts
git commit -m "feat(dispatcher): scaffold resolveOnly interface + failing test"
```

---

## Task 2: Implement `resolveOnly` for click / pointerDown / dblTap (table-form gestures)

**Files:**
- Modify: `src/tools/dispatcher.ts`
- Test: `src/tools/dispatcher.resolveOnly.test.ts`

- [ ] **Step 1: Extend the test with hotkey-precedence, ambient-fallback, and miss-case coverage**

Append to the `describe` block in `src/tools/dispatcher.resolveOnly.test.ts`:

```ts
  it('walks slots in precedence order (hotkey > active > ambient)', () => {
    const hotkeyTool = defineTool({
      id: 'hand',
      presentation: { label: 'Hand' },
      initial: { click: { '*': (_c) => claim() } },
    }) as AnyTool;
    const active = makeSelectTool();
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: hotkeyTool, active, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1', pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result?.toolId).toBe('hand');
    expect(result?.slot).toBe('hotkey');
    expect(result?.matchedKey).toBe('*');
  });

  it('falls through to ambient when active does not match', () => {
    const active = defineTool({
      id: 'pen',
      presentation: { label: 'Pen' },
      initial: { click: { text: (_c) => claim() } },
    }) as AnyTool;
    const ambient = makeSelectTool();
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active, ambient: [ambient] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1', pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result?.toolId).toBe('select');
    expect(result?.slot).toBe('ambient');
  });

  it('returns null when no slot matches', () => {
    const active = defineTool({
      id: 'pen',
      presentation: { label: 'Pen' },
      initial: { click: { text: (_c) => claim() } },
    }) as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1', pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result).toBeNull();
  });

  it('ignores tools without an attached def (imperative-only)', () => {
    const imperative: AnyTool = {
      id: 'imperative',
      pointer: { onClick: () => 'claim' as const },
    } as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: imperative, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'node', kind: 'rect', id: 'r1', pose: null, data: null };
    const result = d.resolveOnly({
      phase: 'initial', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result).toBeNull();
  });

  it('honors engaged-phase tables when phase=engaged', () => {
    const pen = defineTool({
      id: 'pen',
      presentation: { label: 'Pen' },
      initial: { click: {} },
      engaged: { click: { '*': (_c) => claim() } },
    }) as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: pen, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const hit: HitResult = { category: 'empty', kind: 'empty' };
    const result = d.resolveOnly({
      phase: 'engaged', gesture: 'click', hit,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    });
    expect(result?.toolId).toBe('pen');
    expect(result?.matchedKey).toBe('*');
  });
```

- [ ] **Step 2: Run tests to verify all five new tests fail with "not implemented"**

Run: `npx vitest run src/tools/dispatcher.resolveOnly.test.ts`
Expected: 6 FAIL (1 from Task 1 + 5 new).

- [ ] **Step 3: Implement `resolveOnly`**

In `src/tools/dispatcher.ts`, replace the placeholder `resolveOnly: () => { throw new Error('not implemented'); }` with a real implementation. Add this helper function just above `createToolsDispatcher` (or alongside other module-scope helpers like `dispatchOnce`):

```ts
function pickTable<TScratch>(
  phaseDef: PhaseDef<TScratch> | undefined,
  gesture: ResolveQuery['gesture'],
): RouteTable<TScratch> | { __functionForm: true } | { __wheel: true } | undefined {
  if (!phaseDef) return undefined;
  switch (gesture) {
    case 'click':       return phaseDef.click;
    case 'pointerDown': return phaseDef.pointerDown;
    case 'dblTap':      return phaseDef.dblTap;
    case 'drag': {
      const d = phaseDef.drag;
      if (d == null) return undefined;
      if (typeof d === 'function') return { __functionForm: true };
      return d;
    }
    case 'wheel': {
      if (phaseDef.wheel == null) return undefined;
      return { __wheel: true };
    }
  }
}

function resolveOnlyForTool(
  tool: AnyTool,
  slot: ResolveResult['slot'],
  query: ResolveQuery,
): ResolveResult | null {
  const def = tool.def as ToolDef<unknown> | undefined;
  if (!def) return null;
  const phaseDef = query.phase === 'engaged' ? def.engaged : def.initial;
  const picked = pickTable<unknown>(phaseDef, query.gesture);
  if (!picked) return null;
  // Function-form drag matches anything with matchedKey '*'.
  if ('__functionForm' in picked) {
    return {
      toolId: def.id, slot, gesture: query.gesture, phase: query.phase, matchedKey: '*',
    };
  }
  // Wheel routes are a single ActionFn — matched key is '*'.
  if ('__wheel' in picked) {
    return {
      toolId: def.id, slot, gesture: query.gesture, phase: query.phase, matchedKey: '*',
    };
  }
  const match = resolveRoute(picked as RouteTable<unknown>, query.hit, query.modifiers);
  if (!match) return null;
  return {
    toolId: def.id, slot, gesture: query.gesture, phase: query.phase,
    matchedKey: match.matchedKey,
  };
}
```

Then replace the placeholder line in the returned `ToolsDispatcher` object with:

```ts
    resolveOnly: (query) => {
      const slots = opts.getSlots();
      if (slots.hotkey) {
        const r = resolveOnlyForTool(slots.hotkey, 'hotkey', query);
        if (r) return r;
      }
      if (slots.active) {
        const r = resolveOnlyForTool(slots.active, 'active', query);
        if (r) return r;
      }
      for (const t of slots.ambient) {
        const r = resolveOnlyForTool(t, 'ambient', query);
        if (r) return r;
      }
      return null;
    },
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/tools/dispatcher.resolveOnly.test.ts`
Expected: 6 PASS

- [ ] **Step 5: Verify no regression in the broader dispatcher suite**

Run: `npx vitest run src/tools/`
Expected: All pre-existing dispatcher / routing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/tools/dispatcher.ts src/tools/dispatcher.resolveOnly.test.ts
git commit -m "feat(dispatcher): implement resolveOnly across click/pointerDown/dblTap/drag/wheel"
```

---

## Task 3: Static-vs-live parity test

Validates that for a representative `ToolDef[]` and slot configuration, the dispatcher's `resolveOnly` returns the same `{ toolId, matchedKey }` as the widget's existing static `resolveAt` would across the full (target × modifier) matrix. Locks in the contract before the widget switches over.

**Files:**
- Test: `src/tools/dispatcher.resolveOnly.test.ts` (extend)

- [ ] **Step 1: Add the parity test**

Append to the same describe block:

```ts
  it('returns the same result as static resolveRoute across a target×modifier matrix', () => {
    const select = defineTool({
      id: 'select',
      presentation: { label: 'Select' },
      initial: {
        click: {
          rect:  (_c) => claim(),
          text:  (_c) => claim(),
          empty: (_c) => claim(),
          '*': { shift: (_c) => claim(), default: (_c) => claim() },
        },
      },
    }) as AnyTool;
    const d = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: select, ambient: [] }),
      getCtx: () => ({} as never),
    });
    const targets: HitResult[] = [
      { category: 'node', kind: 'rect',  id: 'x', pose: null, data: null },
      { category: 'node', kind: 'text',  id: 'x', pose: null, data: null },
      { category: 'node', kind: 'path',  id: 'x', pose: null, data: null },
      { category: 'empty', kind: 'empty' },
    ];
    const modSets = [
      { alt: false, shift: false, meta: false, ctrl: false, space: false },
      { alt: false, shift: true,  meta: false, ctrl: false, space: false },
      { alt: false, shift: false, meta: true,  ctrl: false, space: false },
    ];
    for (const hit of targets) {
      for (const modifiers of modSets) {
        const live = d.resolveOnly({ phase: 'initial', gesture: 'click', hit, modifiers });
        // The select tool always matches at least the '*' route, so live should
        // be non-null for every cell in this matrix.
        expect(live).not.toBeNull();
        expect(live?.toolId).toBe('select');
      }
    }
  });
```

- [ ] **Step 2: Run and verify it passes**

Run: `npx vitest run src/tools/dispatcher.resolveOnly.test.ts`
Expected: 7 PASS

- [ ] **Step 3: Commit**

```bash
git add src/tools/dispatcher.resolveOnly.test.ts
git commit -m "test(dispatcher): resolveOnly parity across target×modifier matrix"
```

---

## Task 4: Add `mode: 'static' | 'live'` state to ToolkitBuilder and thread to ResolutionsWidget

**Files:**
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.tsx`

- [ ] **Step 1: Add the mode state at the ToolkitBuilder top-level**

Find the existing widget state declarations near line 436:

```tsx
  const [resGesture, setResGesture] = useState<'click' | 'drag' | 'pointerDown' | 'dblTap'>('click');
  const [resPhase, setResPhase] = useState<'initial' | 'engaged'>('initial');
```

Add right below them:

```tsx
  const [resMode, setResMode] = useState<'static' | 'live'>('static');
```

- [ ] **Step 2: Pass mode through to `ResolutionsWidget`**

Find the JSX use of `<ResolutionsWidget>` (near line 565). It currently looks like:

```tsx
            toolDefs={toolDefs}
            ...
            setGesture={setResGesture}
            phase={resPhase}
            setPhase={setResPhase}
```

Add (preserving the existing props):

```tsx
            mode={resMode}
            setMode={setResMode}
```

- [ ] **Step 3: Extend `ResolutionsWidget` props**

Find the `ResolutionsWidget` props type (around line 721) and add the two fields:

```tsx
function ResolutionsWidget(props: {
  toolDefs: readonly ToolDef<unknown>[];
  tools: ToolsApi | null;
  gesture: ResGesture;
  setGesture: (g: ResGesture) => void;
  phase: ResPhase;
  setPhase: (p: ResPhase) => void;
  mode: 'static' | 'live';
  setMode: (m: 'static' | 'live') => void;
}) {
  const { toolDefs, tools, gesture, setGesture, phase, setPhase, mode, setMode } = props;
```

- [ ] **Step 4: Typecheck — confirm clean wiring**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/dev/ToolkitBuilder.tsx
git commit -m "feat(swill): thread Static|Live mode state to ResolutionsWidget"
```

---

## Task 5: Wire Live cell resolution through `tools.dispatcher.resolveOnly`

**Files:**
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.tsx`

- [ ] **Step 1: Add a Live-mode cell resolver**

In `ToolkitBuilder.tsx`, just above `resolveAt` (near line 693), add:

```tsx
function resolveAtLive(
  tools: ToolsApi | null,
  phase: ResPhase,
  gesture: ResGesture,
  target: ResTarget,
  modKey: ResModKey,
): ResolutionCell | { error: string } | null {
  if (!tools) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit: any = target === 'empty'
    ? { category: 'empty', kind: 'empty' }
    : { category: 'node', kind: target, id: 'preview', pose: null, data: null };
  const modifiers = {
    ...modKeyToToolModifiers(modKey),
    space: false,
  };
  try {
    const r = tools.dispatcher.resolveOnly({ phase, gesture, hit, modifiers });
    if (!r) return null;
    return { toolId: r.toolId, matchedKey: r.matchedKey };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Branch the cell render on mode**

Find the cell-rendering loop inside `ResolutionsWidget` (around line 787 — the `{RES_MOD_KEYS.map((m) => { const r = resolveAt(...); ... })}` block). Replace the whole `{RES_MOD_KEYS.map(...)}` arrow body with:

```tsx
                {RES_MOD_KEYS.map((m) => {
                  const r = mode === 'live'
                    ? resolveAtLive(tools, phase, gesture, target, m)
                    : resolveAt(orderedDefs, phase, gesture, target, m);
                  return (
                    <td key={m} className={s.resolutionsCell}>
                      {r && 'error' in r ? (
                        <span className={s.resolutionsError} title={r.error}>err</span>
                      ) : r ? (
                        <span className={s.resolutionsHit}>
                          <code>{r.toolId}</code>
                          {r.matchedKey !== target && r.matchedKey !== '*' && (
                            <span className={s.resolutionsMatchedKey}>:{r.matchedKey}</span>
                          )}
                        </span>
                      ) : (
                        <span className={s.keysEmpty}>—</span>
                      )}
                    </td>
                  );
                })}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/dev/ToolkitBuilder.tsx
git commit -m "feat(swill): live cell resolver via dispatcher.resolveOnly"
```

---

## Task 6: Add the Static | Live segmented toggle UI

**Files:**
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.tsx`
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.module.css`

- [ ] **Step 1: Add the toggle to the widget controls row**

Find the controls block inside `ResolutionsWidget` (around lines 752-769 — the `div.resolutionsControls` with the Gesture and Phase `<select>` controls). Add a third control after the Phase `<select>`:

```tsx
          <div className={s.resolutionsMode}>
            <span>Mode</span>
            <div className={s.segmented} role="group" aria-label="Resolution mode">
              <button
                type="button"
                className={s.segmentedButton}
                data-active={mode === 'static'}
                onClick={() => setMode('static')}
              >
                Static
              </button>
              <button
                type="button"
                className={s.segmentedButton}
                data-active={mode === 'live'}
                onClick={() => setMode('live')}
                disabled={!tools}
                title={tools ? '' : 'Dispatcher not yet attached'}
              >
                Live
              </button>
            </div>
          </div>
```

- [ ] **Step 2: Add the CSS for the toggle and error cell**

In `apps/swillustrator/src/dev/ToolkitBuilder.module.css`, find the existing `.resolutionsControls` block (around line 218) and add the new classes nearby:

```css
.resolutionsMode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--wzl-border, #3a3329);
  border-radius: 4px;
  overflow: hidden;
}

.segmentedButton {
  background: transparent;
  border: 0;
  color: var(--wzl-muted, #a59685);
  font: inherit;
  padding: 2px 8px;
  cursor: pointer;
}

.segmentedButton[data-active='true'] {
  background: var(--wzl-accent, #7fb069);
  color: #000;
}

.segmentedButton:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.resolutionsError {
  font-size: 11px;
  color: var(--wzl-warning, #d97757);
  font-family: ui-monospace, monospace;
}
```

- [ ] **Step 3: Typecheck and build the consumer to confirm wiring**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/dev/ToolkitBuilder.tsx apps/swillustrator/src/dev/ToolkitBuilder.module.css
git commit -m "feat(swill): Static|Live segmented toggle in resolutions widget"
```

---

## Task 7: Release-gate verification

**Files:** None (verification only).

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: All tests pass. No regressions.

- [ ] **Step 3: Run the library build**

Run: `npm run build`
Expected: tsup completes; no type errors.

- [ ] **Step 4: Run the demo build**

Run: `npm run build:demo`
Expected: Vite build completes; no errors.

- [ ] **Step 5: If any step fails, fix the root cause and re-run from Step 1**

Do not skip-or-suppress. If a pre-existing failure is unrelated to this change, document it in the final commit message and proceed.

---

## Task 8: Mark TODO done

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Replace the live-mode TODO entry**

In `docs/TODO.md`, find the line:

```md
- **Dispatch-resolutions widget: live mode.** Add a toggle that, instead of resolving each (target, mods) cell statically via `resolveRoute`, actually injects synthetic pointer events through the dispatcher and records what fires. Cell content becomes "what ran" rather than "what would route by static analysis."
```

Replace with:

```md
- [x] **Dispatch-resolutions widget: live mode.** *Shipped 2026-05-16.* `ToolsDispatcher.resolveOnly({ phase, gesture, hit, modifiers })` walks slot precedence (hotkey > active > ambient) and consults each tool's attached `def` via `resolveRoute` — side-effect-free. The Toolkit Builder's resolutions widget gained a Static | Live segmented toggle; Live cells reflect what the real dispatcher would resolve given current slot state. Synthetic-event injection was rejected as out-of-scope — `resolveOnly` parity covers the value without side-effect plumbing.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(TODO): mark dispatch-resolutions live mode shipped"
```

---

## Self-Review Notes (already addressed)

- **Type consistency:** `ResolveQuery` and `ResolveResult` defined in Task 1, used unchanged through Tasks 2–6. `phase`/`gesture`/`modifiers`/`hit` shapes match `ToolModifiers` and `HitResult` as defined in `src/tools/types.ts` and `src/tools/routing/hitResult.ts`.
- **Slot precedence:** `resolveOnly`'s walk order (hotkey > active > ambient) matches `dispatchOnce` in `src/tools/dispatcher.ts:226-229`.
- **`def` availability:** `Tool.def?: unknown` already exists (`src/tools/types.ts:217`). `defineTool` attaches `def` at `src/tools/routing/defineTool.ts:245`. Imperative tools without `defineTool` leave it undefined — handled by `resolveOnlyForTool`'s null check.
- **Function-form drag and wheel:** Covered by the `__functionForm` / `__wheel` sentinel branches in `pickTable`.
- **Static path preserved:** Existing `resolveAt` and `orderedDefs` left untouched; Live is purely additive.
- **Error cell:** Cell type is `ResolutionCell | { error: string } | null` — render path uses `'error' in r` discriminant.
