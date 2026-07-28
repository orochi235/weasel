# Binding Resolution View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dispatch precedence statically legible — add `Dispatcher.resolveAll` and a Resolution widget in apps/draw's ToolkitBuilder that shows which binding wins a synthesized input and why the others don't.

**Architecture:** `resolveAll` replays the existing dispatch walk (scope assembly → `matchSorted` → eligibility → `enabled()`) but records a verdict per candidate instead of returning at the first hit; `resolveOnly` is reimplemented as its first `would-fire` entry so the two cannot drift. apps/draw's ToolkitBuilder gains input pickers that synthesize an `InputEvent`, feed it to a locally-constructed dispatcher, and render the ordered result.

**Tech Stack:** TypeScript, React 19, Vitest, existing `@weasel-js/core` dispatcher and `@weasel-js/gestures` spec types.

**Spec:** `docs/superpowers/specs/2026-07-28-binding-resolution-view-design.md`

---

## Three corrections to the spec, found while planning

Read these before starting — two tasks below differ from what the spec says.

1. **Scope is not static, so the Routes widget cannot show it.** The spec says the Routes widget gains "scope + specificity" columns. It can't: `buildRouteRegistry(tools)` only sees tools, and the runtime scope (`hotkey` / `active` / `ambient`) depends on which tool is active and what's on the hotkey stack at dispatch time. ToolkitBuilder does know each tool's **slot** (`registry` vs `ambient` — it already renders this in the Tools widget at `ToolkitBuilder.tsx:244`), which is a static fact and a useful proxy. So: **Routes gets `slot` + `specificity`; true `scope` appears only in the Resolution widget**, sourced from `resolveAll`. Task 6 does this.

2. **`RegistryEntry` doesn't carry the spec object**, so specificity isn't computable from a row. Task 2 adds an additive `spec: GestureSpec` field.

3. **`resolveOnly` tries each action at most once** (`triedActionIds` at `dispatcher.ts:978`) — several bindings can point at one action. In `resolveAll`, a later binding for an already-evaluated action **inherits that action's verdict**: `shadowed` if the earlier one fired, or the same `disabled` / `ineligible` verdict otherwise. This is truthful and needs no fifth verdict kind.

Also note, not fixed here: `buildRouteRegistry` maps `multiTouch`, `drop`, and `paste` to `undefined` in `SPEC_KIND_TO_GESTURE` (`registry.ts:58-62`) and skips those bindings, so the Routes widget silently omits them. No tool binds those kinds today (only actions do, via `defaultBinding`), so it isn't visible. Out of scope; mention it if you touch that file.

---

## File Structure

**Modify — kit:**
- `packages/core/src/tools/routing/reflection/registry.ts` — `phaseOf` totality, `RegistryEntry.phase` widened to include `'any'`, additive `RegistryEntry.spec`
- `packages/core/src/tools/routing/reflection/conflicts.ts` — `Conflict.phase` widens with it
- `packages/core/src/interactions/dispatcher/dispatcher.ts` — `ResolvedCandidate`, `resolveAll`, `resolveOnly` reimplemented on it

**Modify — app:**
- `apps/draw/src/dev/ToolkitBuilder.tsx` — Routes widget columns; new Resolution widget
- `apps/draw/src/dev/ToolkitBuilder.module.css` — verdict row styling

**Create:**
- `apps/draw/src/dev/resolutionInput.ts` — pure `InputEvent` synthesis from picker state (kept out of the component so it can be unit-tested without rendering)
- `apps/draw/src/dev/resolutionInput.test.ts`
- `apps/draw/src/dev/ToolkitBuilder.test.tsx`

**Modify — tests:**
- `packages/core/src/tools/routing/reflection/registry.test.ts`
- `packages/core/src/tools/routing/reflection/conflicts.test.ts`
- `packages/core/src/interactions/dispatcher/dispatcher.resolveAll.test.ts` (create)

**No barrel changes needed.** `packages/core/src/interactions/dispatcher/index.ts` is `export * from './dispatcher'`, and `packages/core/src/index.ts:210-219` already re-exports the dispatcher types by name — **except** it lists them explicitly, so `ResolvedCandidate` must be added there. Task 5 does this.

---

## Task 1: `phaseOf` becomes total over `PhaseSpec`

`phaseOf` uses an identity check (`phase === 'engaged'`) against a type that
includes `'*'` and `readonly PhaseAtom[]`. Both fall through to `'initial'`,
which makes `findConflicts` bucket an any-phase binding with genuinely-initial
ones and report a false-positive conflict.

**Files:**
- Modify: `packages/core/src/tools/routing/reflection/registry.ts:16-18` (type), `:110-114` (function)
- Modify: `packages/core/src/tools/routing/reflection/conflicts.ts:10`
- Test: `packages/core/src/tools/routing/reflection/registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/tools/routing/reflection/registry.test.ts`, inside the existing `describe('buildRouteRegistry', ...)` block:

```ts
  describe('phase resolution', () => {
    const phaseOfBinding = (phase: unknown) =>
      buildRouteRegistry([tool('t', [
        { spec: phase === undefined ? { kind: 'click' } : { kind: 'click', phase }, actionId: 'a' },
      ])])[0].phase;

    it('reports an unrestricted binding as any', () => {
      expect(phaseOfBinding(undefined)).toBe('any');
    });

    it('reports the string forms verbatim', () => {
      expect(phaseOfBinding('initial')).toBe('initial');
      expect(phaseOfBinding('engaged')).toBe('engaged');
    });

    it('reports the wildcard as any', () => {
      expect(phaseOfBinding('*')).toBe('any');
    });

    it('reports an atom array by its agreed phase', () => {
      expect(phaseOfBinding([{ channel: '*', phase: 'engaged' }])).toBe('engaged');
      expect(phaseOfBinding([{ channel: '*', phase: 'initial' }])).toBe('initial');
      expect(phaseOfBinding([
        { channel: '&', phase: 'engaged' },
        { channel: 'select', phase: 'engaged' },
      ])).toBe('engaged');
    });

    it('reports any when atoms disagree or any atom is a wildcard', () => {
      expect(phaseOfBinding([
        { channel: '&', phase: 'initial' },
        { channel: 'select', phase: 'engaged' },
      ])).toBe('any');
      expect(phaseOfBinding([{ channel: '*', phase: '*' }])).toBe('any');
    });

    it('reports an empty atom array as any', () => {
      expect(phaseOfBinding([])).toBe('any');
    });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/core/src/tools/routing/reflection/registry.test.ts`
Expected: FAIL — several cases report `'initial'` where `'any'` or `'engaged'` is expected. The two `'string forms verbatim'` assertions pass already.

- [ ] **Step 3: Widen the type and make `phaseOf` total**

In `packages/core/src/tools/routing/reflection/registry.ts`, replace the `phase` field docblock and type (lines 16-18):

```ts
  /** Which phase the binding's `phase` spec restricts it to. `'any'` when it
   *  declares none, declares `'*'`, or declares an atom list whose atoms
   *  don't agree on one phase — such a binding fires in either phase, and
   *  reporting it as `'initial'` made it collide with genuinely-initial
   *  bindings in `findConflicts`' bucket key. */
  phase: 'initial' | 'engaged' | 'any';
```

Replace `phaseOf` (lines 110-114):

```ts
/** Collapse a `PhaseSpec` to the single phase a binding is restricted to, or
 *  `'any'` when it isn't restricted to one.
 *
 *  `PhaseAtom.channel` says which channel's phase state the binding reads,
 *  not which phase it fires in, so it plays no part in this collapse — only
 *  the set of distinct `atom.phase` values matters. */
function phaseOf(phase: PhaseSpec | undefined): 'initial' | 'engaged' | 'any' {
  if (phase === undefined || phase === '*') return 'any';
  if (phase === 'initial' || phase === 'engaged') return phase;
  const distinct = new Set(phase.map((atom) => atom.phase));
  if (distinct.size !== 1) return 'any';
  const only = [...distinct][0];
  return only === 'initial' || only === 'engaged' ? only : 'any';
}
```

In `packages/core/src/tools/routing/reflection/conflicts.ts`, widen `Conflict.phase` (line 10):

```ts
  phase: 'initial' | 'engaged' | 'any';
```

- [ ] **Step 4: Run to verify the new tests pass**

Run: `npx vitest run packages/core/src/tools/routing/reflection/registry.test.ts`
Expected: the `phase resolution` block PASSES. Other tests in the file FAIL — the existing `toContainEqual<RegistryEntry>` assertions hardcode `phase: 'initial'` for unrestricted bindings. Step 5 fixes them.

- [ ] **Step 5: Update the existing assertions to the new default**

In `registry.test.ts`, in the `'flattens one row per binding'` test, change both expected objects' `phase: 'initial'` to `phase: 'any'` (neither binding declares a phase):

```ts
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', actionId: 'clearSelection', phase: 'any',
      gesture: 'click', arg: undefined, target: 'empty', modifiers: {},
    });
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', actionId: 'move', phase: 'any',
      gesture: 'drag', arg: undefined, target: 'selected-body', modifiers: {},
    });
```

Then search the rest of the file for any other `phase: 'initial'` in an expected object and change it to `'any'` **only where the source binding declares no `phase`**. Leave bindings that declare `phase: 'initial'` alone.

- [ ] **Step 6: Add a conflicts test for the false positive this fixes**

Append to `packages/core/src/tools/routing/reflection/conflicts.test.ts`, inside the existing `describe`:

```ts
  it('does NOT flag an any-phase binding against an initial-phase one', () => {
    // Regression: `phaseOf` used to collapse every non-'engaged' PhaseSpec to
    // 'initial', so these two bucketed together and reported a conflict that
    // isn't one — they fire in different phases.
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty', phase: 'initial' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('flags two any-phase bindings on the same tuple', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'y' }]);
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].phase).toBe('any');
  });
```

The existing `'flags two tools claiming the same tuple'` and `'flags a three-way conflict'` tests don't assert on `phase`, so they still pass.

- [ ] **Step 7: Run the full reflection suite**

Run: `npx vitest run packages/core/src/tools/routing/reflection/`
Expected: PASS, all files.

- [ ] **Step 8: Typecheck — the widened type has app-side readers**

Run: `npx tsc --noEmit`
Expected: exit 0. `ToolkitBuilder.tsx:313` sorts with `a.phase.localeCompare(b.phase)` and `:341` / `:380` render it — all string operations, so the widened union needs no change there. If `tsc` reports otherwise, fix at the reported site.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/tools/routing/reflection/
git commit -m "fix(reflection): make phaseOf total over PhaseSpec

phaseOf collapsed every non-'engaged' PhaseSpec to 'initial' via an identity
check, so '*' and the PhaseAtom[] form both reported 'initial'. findConflicts
keys its dedup buckets on that value, so an unrestricted binding collided with
genuinely-initial ones and reported a false-positive conflict.

RegistryEntry.phase (and Conflict.phase) gain 'any' for the unrestricted case,
which is also the new default for a binding that declares no phase. Visible in
ToolkitBuilder's Routes table, where most rows now read 'any' instead of
'initial' — the correct reading."
```

---

## Task 2: `RegistryEntry` carries its source spec

The Routes widget needs to compute `specificity(spec)` per row, and the row
doesn't carry the spec.

**Files:**
- Modify: `packages/core/src/tools/routing/reflection/registry.ts`
- Test: `packages/core/src/tools/routing/reflection/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside `describe('buildRouteRegistry', ...)`:

```ts
  it('carries the source spec on each row', () => {
    const spec = { kind: 'drag', target: 'selected-body', mods: { shift: true } };
    const r = buildRouteRegistry([tool('select', [{ spec, actionId: 'move' }])]);
    expect(r).toHaveLength(1);
    expect(r[0].spec).toBe(spec);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/core/src/tools/routing/reflection/registry.test.ts -t "carries the source spec"`
Expected: FAIL — `expected undefined to be { kind: 'drag', ... }`.

- [ ] **Step 3: Add the field**

In `registry.ts`, add to the `RegistryEntry` interface, after `actionId`:

```ts
  /** The `GestureSpec` this row was flattened from, by reference. Reflection
   *  consumers that need something the grammar doesn't capture — the
   *  specificity tuple, a `kindOf` predicate identity — read it here rather
   *  than re-walking `Tool.bindings`. */
  spec: GestureSpec;
```

`GestureSpec` is already imported at `registry.ts:2`.

Then in `buildRouteRegistry`'s row construction (the object literal returned by the per-binding mapping around `registry.ts:101`), add `spec,` alongside the existing fields. The binding's spec is already in scope as the variable the function destructures — if it is named differently there, use that name.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/core/src/tools/routing/reflection/registry.test.ts -t "carries the source spec"`
Expected: PASS.

- [ ] **Step 5: Fix the exact-shape assertions**

The `'flattens one row per binding'` test uses `toContainEqual<RegistryEntry>` with complete object literals, which now fail on the missing `spec`. Add it to both:

```ts
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', actionId: 'clearSelection', phase: 'any',
      gesture: 'click', arg: undefined, target: 'empty', modifiers: {},
      spec: { kind: 'click', target: 'empty' },
    });
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', actionId: 'move', phase: 'any',
      gesture: 'drag', arg: undefined, target: 'selected-body', modifiers: {},
      spec: { kind: 'drag', target: 'selected-body' },
    });
```

- [ ] **Step 6: Run the suite and typecheck**

Run: `npx vitest run packages/core/src/tools/routing/reflection/ && npx tsc --noEmit`
Expected: tests PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/tools/routing/reflection/
git commit -m "feat(reflection): carry the source GestureSpec on RegistryEntry

Reflection consumers that need something the route grammar doesn't capture —
the specificity tuple, a kindOf predicate's identity — had to re-walk
Tool.bindings to get back to the spec. Additive field, by reference."
```

---

## Task 3: `ResolvedCandidate` type

Type-only task so the next two can be written against a fixed shape.

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/dispatcher.ts` (after `ResolveOnlyResult`, which ends at line 232)

- [ ] **Step 1: Add the type**

Insert after the `ResolveOnlyResult` interface in `dispatcher.ts`:

```ts
/**
 * One candidate from `Dispatcher.resolveAll` — a binding that matched the
 * event, with why it did or didn't get to fire.
 *
 * Verdicts:
 *  - `would-fire`  — eligible, `enabled()` passed, and nothing above it fired.
 *    At most one candidate per call carries this.
 *  - `ineligible`  — the action's `eligible` rule evaluated false against the
 *    live `RuleCtx`. `reason` is the rule, serialized.
 *  - `disabled`    — `enabled()` returned a disabled reason, carried verbatim.
 *  - `shadowed`    — never asked: something above it fires first, or the same
 *    action was already evaluated higher in the list (several bindings may
 *    point at one action, and the dispatcher tries each action once).
 */
export interface ResolvedCandidate {
  actionId: string;
  action: Action;
  binding: GestureBinding;
  scope: BindingScope;
  ownerToolId: string | null;
  /** The tuple from `specificity(binding.spec)`, surfaced so a reader can see
   *  why one candidate outranks another rather than inferring it. */
  specificity: readonly [number, number, number, number];
  verdict:
    | { kind: 'would-fire' }
    | { kind: 'ineligible'; reason: string }
    | { kind: 'disabled'; reason: string }
    | { kind: 'shadowed' };
}
```

`Action` (line 40 area), `GestureBinding` (line 39), and `BindingScope` (line 44) are already imported in this file. `specificity` is **not** — add it to the existing import from `./matcher` at line 45:

```ts
import { matchSorted, specificity } from './matcher';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (The type is unused so far; TypeScript doesn't complain about unused exports.)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/interactions/dispatcher/dispatcher.ts
git commit -m "feat(dispatch): add the ResolvedCandidate type"
```

---

## Task 4: `resolveAll`, with `resolveOnly` reimplemented on it

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/dispatcher.ts:234-257` (interface), `:960-994` (implementation), `:1153` (returned object)
- Test: `packages/core/src/interactions/dispatcher/dispatcher.resolveAll.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/interactions/dispatcher/dispatcher.resolveAll.test.ts`:

```ts
/**
 * `Dispatcher.resolveAll` — the ordered candidate list behind `resolveOnly`.
 * Covers ordering across scopes, every verdict kind, and the invariant that
 * keeps the two methods from drifting.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry, Action } from '../actions/registry';
import type { DepRegistry } from '../actions/depRegistry';
import type { InputEvent } from './matcher';
import type { Tool } from '../../tools/types';
import type { RuleCtx } from '../../features/chrome-caps';

function makeRegistry(actions: Action[]): ActionsRegistry {
  const map = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    list: () => Array.from(map.values()),
    trigger: vi.fn().mockReturnValue(false),
    subscribe: vi.fn().mockReturnValue(() => {}),
    begin: vi.fn().mockReturnValue(null),
    setDispatcher: vi.fn(),
    setDepRegistry: vi.fn(),
  };
}

function makeDepRegistry(): DepRegistry {
  return { register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'] };
}

function makeRuleCtx(overrides: Partial<RuleCtx> = {}): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    mode: 'normal',
    allowedCapabilities: new Set(),
    ...overrides,
  };
}

function makeCtx(
  overrides: Partial<DispatcherContext> & { actions: ActionsRegistry },
): DispatcherContext {
  return {
    depRegistry: makeDepRegistry(),
    activeToolId: 'select',
    hotkeyStack: [],
    toolsById: new Map(),
    isMac: false,
    ...overrides,
  };
}

/** An action that would fire: ongoing invoker, no eligibility restriction. */
function action(id: string, extra: Partial<Action> = {}): Action {
  return {
    id,
    label: id,
    invoker: { timing: 'ongoing', start: vi.fn().mockReturnValue({}) as never },
    ...extra,
  };
}

function tool(id: string, bindings: unknown[]): Tool<unknown> {
  return { id, bindings } as unknown as Tool<unknown>;
}

const dragEvent: InputEvent = {
  kind: 'drag',
  phase: 'move',
  worldX: 0, worldY: 0, clientX: 0, clientY: 0,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
};

describe('resolveAll', () => {
  it('returns an empty array when nothing matches', () => {
    const d = createDispatcher();
    const ctx = makeCtx({ actions: makeRegistry([]) });
    expect(d.resolveAll(dragEvent, ctx)).toEqual([]);
  });

  it('orders candidates hotkey > active > ambient', () => {
    const d = createDispatcher();
    const bind = (actionId: string) => ({ spec: { kind: 'drag' }, actionId });
    const ctx = makeCtx({
      actions: makeRegistry([action('hk'), action('act'), action('amb')]),
      activeToolId: 'activeTool',
      hotkeyStack: ['hotkeyTool'],
      ambientToolIds: ['ambientTool'],
      toolsById: new Map<string, Tool<unknown>>([
        ['hotkeyTool', tool('hotkeyTool', [bind('hk')])],
        ['activeTool', tool('activeTool', [bind('act')])],
        ['ambientTool', tool('ambientTool', [bind('amb')])],
      ]),
    });
    const out = d.resolveAll(dragEvent, ctx);
    expect(out.map((c) => c.actionId)).toEqual(['hk', 'act', 'amb']);
    expect(out.map((c) => c.scope)).toEqual(['hotkey', 'active', 'ambient']);
  });

  it('marks the first passing candidate would-fire and the rest shadowed', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('first'), action('second')]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'first' },
        { spec: { kind: 'drag' }, actionId: 'second' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out.map((c) => c.verdict.kind)).toEqual(['would-fire', 'shadowed']);
  });

  it('reports the specificity tuple that drove the ordering', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('narrow'), action('broad')]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag' }, actionId: 'broad' },
        { spec: { kind: 'drag', target: 'selected-body', mods: { shift: true } }, actionId: 'narrow' },
      ])]]),
    });
    const out = d.resolveAll(
      { ...dragEvent, shiftKey: true, bodyTarget: 'selected-body' } as InputEvent,
      ctx,
    );
    // Declared broad-first, but the narrow one outranks it on specificity.
    expect(out[0].actionId).toBe('narrow');
    expect(out[0].specificity).toEqual([1, 1, 0, 1]);
    expect(out[1].specificity).toEqual([0, 0, 0, 1]);
  });

  it('marks a candidate disabled and carries its reason, then fires the next', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([
        action('off', { enabled: () => 'selection-required' as never }),
        action('on'),
      ]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'off' },
        { spec: { kind: 'drag' }, actionId: 'on' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out[0].verdict).toEqual({ kind: 'disabled', reason: 'selection-required' });
    expect(out[1].verdict).toEqual({ kind: 'would-fire' });
  });

  it('marks a candidate ineligible when its rule fails', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([
        action('gated', { eligible: { capability: 'edits-page' } }),
        action('open'),
      ]),
      activeToolId: 't',
      getRuleCtx: () => makeRuleCtx({ allowedCapabilities: new Set() }),
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'gated' },
        { spec: { kind: 'drag' }, actionId: 'open' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out[0].verdict.kind).toBe('ineligible');
    expect(out[1].verdict).toEqual({ kind: 'would-fire' });
  });

  it('gives a repeated action the verdict of its first occurrence', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([action('same', { enabled: () => 'scene-empty' as never })]),
      activeToolId: 't',
      toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
        { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'same' },
        { spec: { kind: 'drag' }, actionId: 'same' },
      ])]]),
    });
    const out = d.resolveAll({ ...dragEvent, bodyTarget: 'selected-body' } as InputEvent, ctx);
    expect(out).toHaveLength(2);
    expect(out[0].verdict).toEqual({ kind: 'disabled', reason: 'scene-empty' });
    expect(out[1].verdict).toEqual({ kind: 'disabled', reason: 'scene-empty' });
  });
});

describe('resolveOnly agrees with resolveAll', () => {
  // The anti-drift property: resolveOnly must be exactly the first would-fire
  // entry, so a change to one can't silently diverge from the other.
  const cases: Array<{ name: string; ctx: () => DispatcherContext }> = [
    {
      name: 'no match',
      ctx: () => makeCtx({ actions: makeRegistry([]) }),
    },
    {
      name: 'single match',
      ctx: () => makeCtx({
        actions: makeRegistry([action('only')]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([
          ['t', tool('t', [{ spec: { kind: 'drag' }, actionId: 'only' }])],
        ]),
      }),
    },
    {
      name: 'first disabled, second fires',
      ctx: () => makeCtx({
        actions: makeRegistry([
          action('off', { enabled: () => 'not-applicable' as never }),
          action('on'),
        ]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([['t', tool('t', [
          { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'off' },
          { spec: { kind: 'drag' }, actionId: 'on' },
        ])]]),
      }),
    },
    {
      name: 'every candidate disabled',
      ctx: () => makeCtx({
        actions: makeRegistry([action('off', { enabled: () => 'not-applicable' as never })]),
        activeToolId: 't',
        toolsById: new Map<string, Tool<unknown>>([
          ['t', tool('t', [{ spec: { kind: 'drag' }, actionId: 'off' }])],
        ]),
      }),
    },
  ];

  for (const { name, ctx: makeCase } of cases) {
    it(name, () => {
      const d = createDispatcher();
      const ctx = makeCase();
      const event = { ...dragEvent, bodyTarget: 'selected-body' } as InputEvent;
      const only = d.resolveOnly(event, ctx);
      const first = d.resolveAll(event, ctx).find((c) => c.verdict.kind === 'would-fire');
      if (first === undefined) {
        expect(only).toBeNull();
      } else {
        expect(only).not.toBeNull();
        expect(only!.actionId).toBe(first.actionId);
        expect(only!.scope).toBe(first.scope);
        expect(only!.ownerToolId).toBe(first.ownerToolId);
        expect(only!.action).toBe(first.action);
      }
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/dispatcher.resolveAll.test.ts`
Expected: FAIL — `d.resolveAll is not a function`.

- [ ] **Step 3: Declare `resolveAll` on the interface**

In `dispatcher.ts`, in the `Dispatcher` interface, immediately after the `resolveOnly` declaration (line 257):

```ts
  /**
   * Every binding that matches `event`, in dispatch precedence order, each
   * with a verdict explaining whether it would fire. Same walk as
   * `resolveOnly` — scope assembly, specificity-sorted match, eligibility
   * filter, per-candidate `enabled()` gate — without stopping at the winner
   * and without invoking anything. Pure query: no invoker runs, no in-flight
   * state changes, no trace-log entry.
   *
   * `resolveOnly` is the first `would-fire` entry of this list.
   *
   * Shares `resolveOnly`'s known divergence from a real dispatch: an ongoing
   * invoker that matches but returns an empty handle at `start()` makes the
   * real dispatch fall through, and this cannot see that.
   */
  resolveAll(event: InputEvent, ctx: DispatcherContext): ResolvedCandidate[];
```

- [ ] **Step 4: Implement `resolveAll` and rebuild `resolveOnly` on it**

Replace the whole `resolveOnly` function body in `dispatcher.ts` (lines 963-994) with:

```ts
  /** Serialize an `eligible` rule for display. `evaluate()` returns a bare
   *  boolean, so there is no reason string to carry — the rule itself is the
   *  most informative thing available. */
  function describeEligible(eligible: NonNullable<Action['eligible']>): string {
    const rule = eligibleToRule(eligible);
    try {
      return JSON.stringify(rule) ?? '(rule)';
    } catch {
      return '(rule)';
    }
  }

  function resolveAll(event: InputEvent, ctx: DispatcherContext): ResolvedCandidate[] {
    const scopedBindings = assembleScopedBindings(ctx);
    const engagedChannels = snapshotEngagedChannels();
    const matches = matchSorted(event, scopedBindings, ctx.isMac, engagedChannels);
    if (matches.length === 0) return [];

    const actionMap = buildActionMap(ctx.actions);
    const ruleCtx = ctx.getRuleCtx?.();

    // Verdict per action id, so a second binding for an action already
    // evaluated higher up inherits that verdict instead of being re-asked —
    // mirroring handleInput's `triedActionIds` dedup.
    const verdictByAction = new Map<string, ResolvedCandidate['verdict']>();
    let fired = false;
    const out: ResolvedCandidate[] = [];

    for (const match of matches) {
      const actionId = match.binding.actionId;
      const action = actionMap.get(actionId);
      // A binding pointing at an unregistered action can never fire. Not a
      // candidate at all — skip it, as the dispatch loop does.
      if (!action) continue;

      let verdict = verdictByAction.get(actionId);
      if (verdict === undefined) {
        if (fired) {
          verdict = { kind: 'shadowed' };
        } else if (
          ruleCtx && action.eligible &&
          !evaluate(eligibleToRule(action.eligible), ruleCtx)
        ) {
          verdict = { kind: 'ineligible', reason: describeEligible(action.eligible) };
        } else {
          const disabled = action.enabled
            ? action.enabled(buildDepsFromRequires(action, ctx.depRegistry))
            : true;
          if (disabled !== true) {
            verdict = { kind: 'disabled', reason: String(disabled) };
          } else {
            verdict = { kind: 'would-fire' };
            fired = true;
          }
        }
        verdictByAction.set(actionId, verdict);
      } else if (verdict.kind === 'would-fire') {
        // The action already won on an earlier binding; this one never runs.
        verdict = { kind: 'shadowed' };
      }

      out.push({
        actionId,
        action,
        binding: match.binding,
        scope: match.scope,
        ownerToolId: match.ownerToolId,
        specificity: specificity(match.binding.spec),
        verdict,
      });
    }
    return out;
  }

  function resolveOnly(event: InputEvent, ctx: DispatcherContext): ResolveOnlyResult | null {
    const winner = resolveAll(event, ctx).find((c) => c.verdict.kind === 'would-fire');
    if (!winner) return null;
    return {
      actionId: winner.actionId,
      action: winner.action,
      scope: winner.scope,
      ownerToolId: winner.ownerToolId,
    };
  }
```

`evaluate` and `eligibleToRule` are already in scope (imported at line 46 and defined at line 182). `buildDepsFromRequires` is imported at line 42.

- [ ] **Step 5: Add `resolveAll` to the returned dispatcher object**

At `dispatcher.ts:1153`, next to `resolveOnly,` in the returned object literal, add:

```ts
    resolveAll,
```

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run packages/core/src/interactions/dispatcher/dispatcher.resolveAll.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 7: Run the whole dispatcher suite for regressions**

Run: `npx vitest run packages/core/src/interactions/dispatcher/`
Expected: PASS. `resolveOnly` changed implementation, so the hover-cursor pump tests in `useGestureDispatcher.test.tsx` are the ones to watch. If any fail, the reimplementation diverged — compare against the original loop at Step 4's replaced code before changing tests.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/interactions/dispatcher/
git commit -m "feat(dispatch): Dispatcher.resolveAll — the ordered candidate list

resolveOnly already replayed the whole walk (scope assembly, specificity-sorted
match, eligibility filter, enabled() gate) and then discarded everything except
the winner. resolveAll returns the list with a verdict per candidate:
would-fire, ineligible, disabled, or shadowed.

resolveOnly is now its first would-fire entry, so the prediction the
hover-cursor pump reads and the list the inspector renders cannot drift. A
test pins that invariant explicitly.

No behavior change."
```

---

## Task 5: Export `ResolvedCandidate` from the package barrel

`packages/core/src/index.ts` re-exports dispatcher types by name, so a new one
must be added or consumers can't import it.

**Files:**
- Modify: `packages/core/src/index.ts:210-219`

- [ ] **Step 1: Add the export**

In the `export type { ... } from './interactions/dispatcher';` block, add `ResolvedCandidate,` after `ResolveOnlyResult,`.

- [ ] **Step 2: Verify it resolves from a consumer**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export ResolvedCandidate"
```

---

## Task 6: Routes widget gains `slot` and `specificity`

Per correction 1 at the top of this plan: `slot`, not `scope`.

**Files:**
- Modify: `apps/draw/src/dev/ToolkitBuilder.tsx:310-355` (the `RoutesWidget` function)

- [ ] **Step 1: Thread the slot set into the widget**

`RoutesWidget` currently takes `{ routes }`. Its caller already has
`toolSlots` (computed around `ToolkitBuilder.tsx:154-157`) and the Tools widget
already receives it as `slots`. Change the signature to match:

```tsx
function RoutesWidget({
  routes,
  slots,
}: {
  routes: readonly RegistryEntry[];
  slots: { registry: readonly string[]; ambient: readonly string[] };
}): ReactElement {
  const ambientSet = new Set(slots.ambient);
```

Update the call site to pass `slots={toolSlots}`, matching how the Tools widget is already called.

- [ ] **Step 2: Add the two columns**

Add to the `<thead>` row, after `<th>Tool</th>`:

```tsx
                <th>Slot</th>
```

and after `<th>Mods</th>`:

```tsx
                <th title="target, required mods, phase declared, typed drop/paste">Specificity</th>
```

In the `<tbody>` map, after the `Tool` cell:

```tsx
                  <td>{ambientSet.has(r.toolId) ? 'ambient' : 'registry'}</td>
```

and after the `Mods` cell:

```tsx
                  <td><code>{specificity(r.spec).join(' · ')}</code></td>
```

- [ ] **Step 3: Import `specificity`**

Add to the existing `@weasel-js/core` import block in `ToolkitBuilder.tsx`:

```tsx
  specificity,
```

- [ ] **Step 4: Note why this column says slot, not scope**

Add above `RoutesWidget`'s existing block comment:

```tsx
// `slot` is a static fact (which slot the tool was mounted in); the runtime
// `scope` the matcher sorts by — hotkey > active > ambient — depends on which
// tool is active and what's on the hotkey stack at dispatch time, so it lives
// in the Resolution widget below, sourced from resolveAll.
```

- [ ] **Step 5: Typecheck and eyeball**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run dev:draw` (check `package.json` for the exact script name if this
fails), open `#/dev/toolkits`, confirm the Routes table shows Slot and
Specificity, and that most Phase cells now read `any` (from Task 1).

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/dev/ToolkitBuilder.tsx
git commit -m "feat(draw): show slot and specificity in the Routes table

The Routes table listed every binding but never said which slot its tool sits
in or how specific the binding is — the two things that decide which one wins."
```

---

## Task 7: `InputEvent` synthesis from picker state

Pure module, so it can be tested without rendering.

**Files:**
- Create: `apps/draw/src/dev/resolutionInput.ts`
- Test: `apps/draw/src/dev/resolutionInput.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/draw/src/dev/resolutionInput.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { synthesizeInput, RESOLUTION_GESTURES, RESOLUTION_BODY_TARGETS } from './resolutionInput';

describe('synthesizeInput', () => {
  it('builds a drag event with no modifiers held', () => {
    const e = synthesizeInput({ gesture: 'drag', target: 'empty', mods: {} });
    expect(e.kind).toBe('drag');
    expect(e.altKey).toBe(false);
    expect(e.shiftKey).toBe(false);
    expect((e as { bodyTarget?: string }).bodyTarget).toBe('empty');
    expect((e as { affordance?: unknown }).affordance).toBeUndefined();
  });

  it('carries held modifiers onto the event', () => {
    const e = synthesizeInput({ gesture: 'click', target: 'empty', mods: { shift: true, alt: true } });
    expect(e.shiftKey).toBe(true);
    expect(e.altKey).toBe(true);
    expect(e.metaKey).toBe(false);
    expect(e.ctrlKey).toBe(false);
  });

  it('synthesizes a minimal AffordanceHit for a chrome target', () => {
    const e = synthesizeInput({ gesture: 'drag', target: 'affordance:rotate-handle', mods: {} });
    expect((e as { affordance?: { kind: string } }).affordance).toEqual({ kind: 'rotate-handle' });
    // bodyTarget is absent: the press landed on chrome, not on a body.
    expect((e as { bodyTarget?: string }).bodyTarget).toBeUndefined();
  });

  it('sets a key for key gestures so the spec key matcher has something to compare', () => {
    const e = synthesizeInput({ gesture: 'key', target: 'empty', mods: {}, key: 'Escape' });
    expect(e.kind).toBe('key');
    expect((e as { key?: string }).key).toBe('Escape');
  });

  it('exposes the pickable gesture kinds and body targets', () => {
    expect(RESOLUTION_GESTURES).toContain('drag');
    expect(RESOLUTION_GESTURES).toContain('click');
    expect(RESOLUTION_BODY_TARGETS).toEqual(['empty', 'selected-body', 'unselected-body']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/draw/src/dev/resolutionInput.test.ts`
Expected: FAIL — cannot resolve `./resolutionInput`.

- [ ] **Step 3: Write the module**

Create `apps/draw/src/dev/resolutionInput.ts`:

```ts
/**
 * Synthesize an `InputEvent` from the Resolution widget's pickers.
 *
 * Kept out of the component so the synthesis rules are unit-testable without
 * rendering, and so the honesty boundary is stated in one place:
 *
 *  - A body target (`empty` / `selected-body` / `unselected-body`) sets
 *    `bodyTarget` and leaves `affordance` undefined. Predicates evaluate
 *    TRUTHFULLY against this — `isAnchorOrControl(undefined)` is a real
 *    `false`, not a guess. This is the "press landed on the scene" case.
 *  - An `affordance:<kind>` target synthesizes a minimal `{ kind }`
 *    `AffordanceHit`. Most kit predicates discriminate on `kind` alone, so
 *    those also evaluate truthfully. A predicate reading `payload`,
 *    `targetIds`, or `anchor` cannot be satisfied this way — which is why the
 *    widget badges predicate-target rows rather than claiming certainty.
 */
import type { InputEvent } from '@weasel-js/core';

/** Gesture kinds the picker offers. Deliberately the pointer/key kinds a
 *  reader asks "who wins this?" about — not `drop` / `paste` / `multiTouch`,
 *  which have no meaningful synthetic form here. */
export const RESOLUTION_GESTURES = [
  'click', 'doubleClick', 'pointerDown', 'drag', 'wheel', 'key', 'contextMenu',
] as const;
export type ResolutionGesture = (typeof RESOLUTION_GESTURES)[number];

export const RESOLUTION_BODY_TARGETS = ['empty', 'selected-body', 'unselected-body'] as const;
export type ResolutionBodyTarget = (typeof RESOLUTION_BODY_TARGETS)[number];

/** `affordance:` prefix marks a chrome target in the picker's flat list. */
export const AFFORDANCE_PREFIX = 'affordance:';

export interface ResolutionMods {
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrl?: boolean;
}

export interface ResolutionInput {
  gesture: ResolutionGesture;
  /** A body target, or `affordance:<kind>` for chrome. */
  target: string;
  mods: ResolutionMods;
  /** For `key` gestures. Ignored otherwise. */
  key?: string;
}

export function synthesizeInput(input: ResolutionInput): InputEvent {
  const base = {
    altKey: input.mods.alt === true,
    ctrlKey: input.mods.ctrl === true,
    metaKey: input.mods.meta === true,
    shiftKey: input.mods.shift === true,
  };

  if (input.gesture === 'key') {
    return { kind: 'key', key: input.key ?? 'Escape', ...base } as InputEvent;
  }

  const targetFields = input.target.startsWith(AFFORDANCE_PREFIX)
    ? { affordance: { kind: input.target.slice(AFFORDANCE_PREFIX.length) } }
    : { bodyTarget: input.target };

  if (input.gesture === 'wheel') {
    return { kind: 'wheel', deltaX: 0, deltaY: -1, clientX: 0, clientY: 0, ...base } as InputEvent;
  }

  if (input.gesture === 'drag') {
    return {
      kind: 'drag', phase: 'move',
      worldX: 0, worldY: 0, clientX: 0, clientY: 0,
      ...targetFields, ...base,
    } as InputEvent;
  }

  // click / doubleClick / pointerDown / contextMenu share a shape.
  return {
    kind: input.gesture,
    worldX: 0, worldY: 0, clientX: 0, clientY: 0,
    ...targetFields, ...base,
  } as InputEvent;
}

/** Is this target a `{ kindOf }` predicate rather than a named class? Drives
 *  the `?` badge — the caveat belongs on rows that can be wrong, not on rows
 *  with string targets, which need none. */
export function isPredicateTarget(spec: unknown): boolean {
  const t = (spec as { target?: unknown } | null | undefined)?.target;
  return typeof t === 'object' && t !== null && 'kindOf' in t;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/draw/src/dev/resolutionInput.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify the synthesized shapes match what the matcher reads**

The `as InputEvent` casts mean TypeScript won't catch a wrong field name.
Cross-check each arm against `packages/gestures/src/ui/inputEvent.ts` — the
`DragEvent`, `ClickEvent`, `PointerDownEvent`, `WheelEvent`, and `KeyEvent`
interfaces. If a required field is missing, add it; if `bodyTarget` /
`affordance` are named differently on an arm, correct the module and its test.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/dev/resolutionInput.ts apps/draw/src/dev/resolutionInput.test.ts
git commit -m "feat(draw): synthesize InputEvents from Resolution picker state

Pure module so the synthesis rules are testable without rendering, and so the
honesty boundary — body targets evaluate predicates truthfully, synthesized
affordance hits only satisfy predicates that read \`kind\` — is stated once."
```

---

## Task 8: The Resolution widget

**Files:**
- Modify: `apps/draw/src/dev/ToolkitBuilder.tsx`
- Modify: `apps/draw/src/dev/ToolkitBuilder.module.css`

- [ ] **Step 1: Add the verdict styles**

Append to `apps/draw/src/dev/ToolkitBuilder.module.css`:

```css
/* Resolution widget — verdict-driven row emphasis. */
.resolutionControls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; }
.resolutionControls label { display: flex; align-items: center; gap: 4px; font-size: 11px; }
.verdictFires { font-weight: 600; }
.verdictShadowed { opacity: 0.5; }
.verdictBlocked { opacity: 0.75; text-decoration: line-through; }
.predicateBadge { cursor: help; margin-left: 4px; }
```

- [ ] **Step 2: Build the widget**

Add to `ToolkitBuilder.tsx`, and render it between the Routes and Conflicts
widgets in the page body:

```tsx
// ─────────────────────────────────────────────────────────────────────────
// Widget: which binding wins a given input, and why the others don't.
//
// Synthesizes an InputEvent from the pickers and asks a locally-constructed
// dispatcher to resolve it. The dispatcher is local because resolveAll is a
// pure query — it reads the ctx it's handed and touches no in-flight state,
// so it needs no relationship to the canvas's own dispatcher.
// ─────────────────────────────────────────────────────────────────────────

function ResolutionWidget({
  defs,
  actions,
  slots,
  activeToolId,
}: {
  defs: readonly Tool<unknown>[];
  actions: readonly Action[];
  slots: { registry: readonly string[]; ambient: readonly string[] };
  activeToolId: string;
}): ReactElement {
  const [gesture, setGesture] = useState<ResolutionGesture>('drag');
  const [target, setTarget] = useState<string>('selected-body');
  const [mods, setMods] = useState<ResolutionMods>({});

  // Chrome targets the mounted tools actually declare, so the picker offers
  // real kinds rather than a hardcoded list that drifts.
  const affordanceKinds = useMemo(() => {
    const out = new Set<string>();
    for (const entry of buildRouteRegistry(defs)) {
      if (typeof entry.target === 'string' && entry.target.startsWith('affordance:')) {
        out.add(entry.target.slice('affordance:'.length));
      }
    }
    return [...out].sort();
  }, [defs]);

  const candidates = useMemo(() => {
    const dispatcher = createDispatcher();
    const registry: ActionsRegistry = {
      register: () => () => {},
      unregister: () => {},
      list: () => actions,
      trigger: () => false,
      subscribe: () => () => {},
      begin: () => null,
      setDispatcher: () => {},
      setDepRegistry: () => {},
    };
    return dispatcher.resolveAll(
      synthesizeInput({ gesture, target, mods }),
      {
        actions: registry,
        depRegistry: { register: () => () => {}, get: () => undefined } as never,
        activeToolId,
        hotkeyStack: [],
        ambientToolIds: slots.ambient,
        toolsById: new Map(defs.map((d) => [d.id, d])),
        isMac: false,
      },
    );
  }, [defs, actions, slots.ambient, activeToolId, gesture, target, mods]);

  const toggle = (key: keyof ResolutionMods) =>
    setMods((m) => ({ ...m, [key]: m[key] === true ? undefined : true }));

  return (
    <div className={s.widget}>
      <h2 className={s.widgetTitle}>Resolution</h2>
      <div className={s.resolutionControls}>
        <label>
          gesture
          <select value={gesture} onChange={(e) => setGesture(e.target.value as ResolutionGesture)}>
            {RESOLUTION_GESTURES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label>
          target
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {RESOLUTION_BODY_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
            {affordanceKinds.map((k) => (
              <option key={k} value={`${AFFORDANCE_PREFIX}${k}`}>chrome: {k}</option>
            ))}
          </select>
        </label>
        {(['shift', 'alt', 'meta', 'ctrl'] as const).map((m) => (
          <label key={m}>
            <input type="checkbox" checked={mods[m] === true} onChange={() => toggle(m)} />
            {m}
          </label>
        ))}
      </div>
      <div className={s.widgetBodyScrollXY}>
        {candidates.length === 0 ? (
          <p className={s.empty}>No binding matches this input.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Scope</th>
                <th>Tool</th>
                <th>Action</th>
                <th>Specificity</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => (
                <tr
                  key={`${c.actionId}-${i}`}
                  className={
                    c.verdict.kind === 'would-fire' ? s.verdictFires
                    : c.verdict.kind === 'shadowed' ? s.verdictShadowed
                    : s.verdictBlocked
                  }
                >
                  <td>{i + 1}</td>
                  <td>{c.scope}</td>
                  <td>
                    <code>{c.ownerToolId ?? '—'}</code>
                    {isPredicateTarget(c.binding.spec) && (
                      <span
                        className={s.predicateBadge}
                        title="Evaluated against a synthesized hit — a predicate reading more than `kind` may differ at runtime."
                      >?</span>
                    )}
                  </td>
                  <td><code>{c.actionId}</code></td>
                  <td><code>{c.specificity.join(' · ')}</code></td>
                  <td>
                    {c.verdict.kind === 'would-fire' ? 'fires'
                      : c.verdict.kind === 'shadowed' ? 'shadowed'
                      : `${c.verdict.kind}: ${c.verdict.reason}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the imports**

To the `@weasel-js/core` import block in `ToolkitBuilder.tsx`, add
`createDispatcher` and the types `ActionsRegistry`. To the routing import
block, `buildRouteRegistry` is already imported. Add a new import:

```tsx
import {
  synthesizeInput,
  isPredicateTarget,
  RESOLUTION_GESTURES,
  RESOLUTION_BODY_TARGETS,
  AFFORDANCE_PREFIX,
  type ResolutionGesture,
  type ResolutionMods,
} from './resolutionInput';
```

`useState` and `useMemo` are already imported from React.

- [ ] **Step 4: Render it**

Find where `<RoutesWidget ... />` and `<ConflictsWidget ... />` are rendered and
insert between them:

```tsx
        <ResolutionWidget
          defs={defs}
          actions={actions}
          slots={toolSlots}
          activeToolId={toolSlots.registry[0] ?? ''}
        />
```

Use whatever the surrounding local variables are actually named — `defs` and
`actions` are the names used by the Tools and Actions widgets at
`ToolkitBuilder.tsx:225` and `:264`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. The `depRegistry` cast is `as never` because the widget never
triggers an action that reads deps — if `tsc` objects to the `ActionsRegistry`
literal, add the missing members rather than widening the cast.

- [ ] **Step 6: Verify in the browser**

Run the draw dev server, open `#/dev/toolkits`. Confirm:
- Default (`drag` / `selected-body`, no mods) lists several candidates with
  exactly one `fires`.
- Toggling `shift` reorders when a shift-requiring binding exists.
- Choosing a `chrome:` target changes the winner.
- Predicate-target rows show `?` with a tooltip; string-target rows don't.

- [ ] **Step 7: Commit**

```bash
git add apps/draw/src/dev/ToolkitBuilder.tsx apps/draw/src/dev/ToolkitBuilder.module.css
git commit -m "feat(draw): Resolution widget — which binding wins, and why not the others

The phase tables made precedence structurally legible; bindings made it
computed (scope > specificity > registration order, with enabled()-gated
fall-through) and visible nowhere. Pick a gesture, target, and modifiers; see
the ordered candidate list with the winner marked and each loser's reason."
```

---

## Task 9: Render test for the widget

**Files:**
- Create: `apps/draw/src/dev/ToolkitBuilder.test.tsx`

- [ ] **Step 1: Check the app test conventions first**

Read `apps/draw/src/dev/RegistryDetail.test.tsx` for how this app renders
components under test (Testing Library setup, any required providers, whether
`act` wrapping is needed). Match it — do not invent a different harness.

- [ ] **Step 2: Write the test**

Create `apps/draw/src/dev/ToolkitBuilder.test.tsx`, exporting `ResolutionWidget`
from `ToolkitBuilder.tsx` so it can be imported (add `export` to the function
declaration).

```tsx
/**
 * Resolution widget — renders the ordered candidate list for a fixed tool set.
 * Verifies the three things the widget exists to communicate: the winner is
 * marked, losers are distinguished, and the predicate caveat lands only on
 * rows that need it.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResolutionWidget } from './ToolkitBuilder';
import type { Action, Tool } from '@weasel-js/core';

const isAnchor = (hit: unknown) =>
  (hit as { kind?: string } | null | undefined)?.kind === 'anchor';

function tool(id: string, bindings: unknown[]): Tool<unknown> {
  return { id, bindings } as unknown as Tool<unknown>;
}

function action(id: string): Action {
  return { id, label: id, invoker: { timing: 'immediate', run: () => {} } };
}

const defs = [
  tool('select', [
    { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' },
  ]),
  tool('pen', [
    { spec: { kind: 'drag', target: { kindOf: isAnchor } }, actionId: 'editAnchors' },
  ]),
  tool('viewport', [
    { spec: { kind: 'drag' }, actionId: 'viewport.dragPan' },
  ]),
];
const actions = [action('move'), action('editAnchors'), action('viewport.dragPan')];
const slots = { registry: ['select', 'pen'], ambient: ['viewport'] };

describe('ResolutionWidget', () => {
  it('marks exactly one candidate as firing', () => {
    const { container } = render(
      <ResolutionWidget defs={defs} actions={actions} slots={slots} activeToolId="select" />,
    );
    expect(screen.getAllByText('fires')).toHaveLength(1);
    // The ambient viewport drag matches too, but is shadowed by select's.
    expect(container.textContent).toContain('shadowed');
  });

  it('reports the scope each candidate rides', () => {
    render(
      <ResolutionWidget defs={defs} actions={actions} slots={slots} activeToolId="select" />,
    );
    expect(screen.getByText('active')).toBeTruthy();
    expect(screen.getByText('ambient')).toBeTruthy();
  });

  it('badges predicate-target rows only', () => {
    const { container } = render(
      <ResolutionWidget defs={defs} actions={actions} slots={slots} activeToolId="pen" />,
    );
    const badges = container.querySelectorAll('[title*="synthesized hit"]');
    // pen's is the only predicate target among the matching bindings.
    expect(badges).toHaveLength(1);
  });

  it('says so when nothing matches', () => {
    render(
      <ResolutionWidget defs={[]} actions={[]} slots={{ registry: [], ambient: [] }} activeToolId="" />,
    );
    expect(screen.getByText('No binding matches this input.')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run apps/draw/src/dev/ToolkitBuilder.test.tsx`
Expected: PASS, 4 tests.

If the third test's badge count is wrong, check whether the default target
(`selected-body`) makes pen's predicate binding match at all — `isAnchor(undefined)`
is `false`, so it may not appear as a candidate. If so, change that test to set
the widget's target to a chrome kind, or assert `toHaveLength(0)` with a comment
explaining that the predicate correctly declines a body target. Do not weaken
the assertion without saying which of the two is true.

- [ ] **Step 4: Commit**

```bash
git add apps/draw/src/dev/ToolkitBuilder.test.tsx apps/draw/src/dev/ToolkitBuilder.tsx
git commit -m "test(draw): cover the Resolution widget's three claims"
```

---

## Task 10: Full gates and spec reconciliation

- [ ] **Step 1: Run the release gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc exit 0; 602+ test files passing (601 before this work, plus the
new ones); build exit 0.

This matches CI's release gate — `vitest` alone does not typecheck production
code.

- [ ] **Step 2: Reconcile the spec with what got built**

The spec says the Routes widget gains a "scope" column. It gained `slot`
instead, for the reason in correction 1 at the top of this plan. Edit
`docs/superpowers/specs/2026-07-28-binding-resolution-view-design.md` §3.1 to
say `slot`, and add a sentence explaining that runtime scope isn't a static
property of a tool's binding list. Leave the rest of the spec as written.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-28-binding-resolution-view-design.md
git commit -m "docs(spec): Routes shows slot, not scope

Scope (hotkey/active/ambient) is a dispatch-time fact — it depends on the
active tool and hotkey stack, so buildRouteRegistry can't know it. The static
proxy is the tool's slot; true scope shows up in the Resolution widget, from
resolveAll."
```

---

## Self-review notes

**Spec coverage:** §2 `resolveAll` → Tasks 3-5. §3.1 Routes columns → Task 6
(with the documented `slot` correction). §3.2 Resolution widget → Tasks 7-8.
§4 predicate honesty → Task 7 (`isPredicateTarget`, synthesis rules) and Task 8
(the `?` badge). §5 `phaseOf` → Task 1. §6 scope boundary → nothing to build.
§7 testing → Tasks 1, 4, 7, 9.

**Type consistency:** `ResolvedCandidate` fields defined in Task 3 are the ones
read in Task 4 (construction), Task 8 (`c.scope`, `c.actionId`, `c.specificity`,
`c.verdict`, `c.ownerToolId`, `c.binding.spec`), and Task 9. `RegistryEntry.spec`
added in Task 2 is read in Task 6 (`specificity(r.spec)`) and Task 8
(`buildRouteRegistry(defs)` for affordance kinds). `phase: 'any'` from Task 1 is
asserted in Task 1's own tests only.

**Known softness:** Tasks 6 and 8 give line numbers and surrounding variable
names for a 704-line file that Task 6 edits before Task 8 reads. Both steps say
to use the names actually present rather than assuming. Task 7 Step 5 and Task 9
Step 3 each name a specific thing to verify against the source rather than
trusting the plan's guess — the `InputEvent` arm shapes and the predicate-badge
count are the two places this plan is least certain.
