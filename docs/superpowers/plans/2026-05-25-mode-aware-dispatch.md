# Mode-aware dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify chrome visibility, affordance classification, and action eligibility under a single declarative selector-tree grammar with mode as a first-class dimension. Fix the "resize fires on anchor drag in path-edit" bug as a downstream consequence.

**Architecture:** Replace closure-based `Condition` predicates with a JSON tree (`Rule = Selector | { all } | { any } | { not } | { when }`). Fluent layer (`selectionAtLeast(1).and(modeIs('normal'))`) compiles to canonical tree fragments. The same evaluator gates chrome rendering, affordance hit-testing, and action dispatch. Mode and capability are first-class selector keys; mode owns its chrome budget; action descriptors gain optional `eligible: Rule`.

**Tech Stack:** TypeScript, React, Vitest. Affected packages: `packages/weasel-modes`, `src/features/chrome-caps`, `src/canvas`, `src/interactions/actions`, `src/interactions/dispatcher`, `src/tools/builtin/select`, `apps/draw`.

**Spec:** `docs/superpowers/specs/2026-05-25-mode-aware-dispatch-design.md`

**Phasing:** The plan is structured in 5 phases (matching the spec). Phases 1-2 are pure groundwork (no behavior change). Phase 3 ships the visible bug fix (chrome stops painting in path-edit). Phase 4 closes the affordance gap (hit-test stops firing). Phase 5 adds defense-in-depth at the dispatcher + completes the migration. Each phase is independently shippable and testable. Pause between phases for review.

---

## File Map

### New files

- `src/features/chrome-caps/rule.ts` — `Rule` / `Selector` types, `evaluate(rule, ctx)` interpreter, type guards.
- `src/features/chrome-caps/ruleCtx.ts` — `RuleCtx` type (superset of `ChromeCtx`); `buildRuleCtx` assembler.
- `src/features/chrome-caps/rule.test.ts` — evaluator unit tests.
- `src/interactions/dispatcher/predicates.ts` — named `kindOf` predicates (`isBody`, `isAnchor`, etc.).
- `src/interactions/dispatcher/predicates.test.ts` — predicate unit tests.

### Modified files

- `packages/weasel-modes/src/capabilities.ts` — rename `'selection'` → `'creates-selection'`.
- `packages/weasel-modes/src/presets/default.ts` — update mode `allows` lists with new tag name.
- `src/features/chrome-caps/conditions.ts` — atoms now construct tree fragments; combinators produce `all`/`any`/`not` nodes.
- `src/features/chrome-caps/types.ts` — remove `suppressedIds` from `ChromeCtx`; `Condition` becomes alias for `Rule`.
- `src/features/chrome-caps/defaults.ts` — rewrite rules in tree form with mode constraints.
- `src/features/chrome-caps/buildChromeCtx.ts` — remove `suppressedIds`; add mode/capability inputs.
- `src/features/chrome-caps/resolve.ts` — evaluator-backed resolution.
- `src/features/chrome-caps/chrome-caps.test.ts` — update for new grammar + mode-aware defaults.
- `src/canvas/affordanceAt.ts` — accept `isVisible: (id) => boolean`; gate corner/rotate/anchor branches on chrome-id visibility.
- `src/canvas/SceneCanvas.tsx` — remove `suppressedIds` plumbing; thread `isVisible` into `buildAffordanceAt`; supply mode source to `buildRuleCtx`.
- `src/canvas/deps/editAnchors.ts` — selection-overlay layer no longer needs its own suppression filter.
- `src/interactions/actions/registry.tsx` — add optional `eligible: Rule` to `Action`.
- `src/interactions/dispatcher/dispatcher.ts` — eligibility filter step in `matchSorted` → `start()` loop.
- `src/interactions/actions/defaults/*.ts` — annotate every action with `eligible` (or omit for always-on).
- `src/interactions/actions/defaults/nudge.ts` — split into `nudgeNodeAction` + `nudgeAnchorAction`.
- `src/interactions/actions/useStandardActions.ts` — include both nudge variants.
- `src/tools/builtin/select/useSelectTool.ts` — capability rename.
- All `.test.ts*` files that reference `'selection'` capability or `suppressedIds`.

---

## Phase 1 — Grammar, evaluator, context

Pure groundwork. No behavior change. Defines the `Rule` shape and the evaluator that consumes it. Existing chrome-caps surface is untouched.

### Task 1: Rule grammar types

**Files:**
- Create: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/rule.ts`

- [ ] **Step 1: Define the Selector interface and Rule union**

Write `rule.ts`:

```ts
import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { CapabilityTag } from '@orochi235/weasel-modes';
import type { RuleCtx } from './ruleCtx';

/**
 * A selector is a conjunction of key/value tests. Multiple keys at the same
 * level AND together. Each key maps to a selector primitive in the evaluator.
 */
export interface Selector {
  selection?: { is?: number; atLeast?: number; empty?: boolean };
  mode?: string | { not: string } | { in: readonly string[] };
  capability?:
    | CapabilityTag
    | readonly CapabilityTag[]
    | { in: readonly CapabilityTag[] }
    | { not: CapabilityTag };
  gesturing?: boolean;
  actionIs?: string;
  modifierHeld?: keyof ModifierState;
  focused?: boolean;
  hovering?: boolean;
  hoveringSelected?: boolean;
  zoomAtLeast?: number;
}

/**
 * Composable visibility/eligibility rule. Trees of `all`/`any`/`not` nodes
 * over `Selector` leaves. `when` is the escape hatch — its closure is
 * opaque to introspection and should be avoided when a declarative form
 * exists. Empty `all` is true; empty `any` is false.
 */
export type Rule =
  | Selector
  | { all: readonly Rule[] }
  | { any: readonly Rule[] }
  | { not: Rule }
  | { when: (ctx: RuleCtx) => boolean };

/** Constant rules. Kept here so they have a single source. */
export const ALWAYS: Rule = { all: [] };
export const NEVER: Rule = { any: [] };

// ───────────────────────────────────────────────────────────────────────────
// Type guards
// ───────────────────────────────────────────────────────────────────────────

export function isAllRule(r: Rule): r is { all: readonly Rule[] } {
  return typeof r === 'object' && r !== null && 'all' in r;
}
export function isAnyRule(r: Rule): r is { any: readonly Rule[] } {
  return typeof r === 'object' && r !== null && 'any' in r;
}
export function isNotRule(r: Rule): r is { not: Rule } {
  return typeof r === 'object' && r !== null && 'not' in r;
}
export function isWhenRule(r: Rule): r is { when: (ctx: RuleCtx) => boolean } {
  return typeof r === 'object' && r !== null && 'when' in r;
}
export function isSelector(r: Rule): r is Selector {
  return !isAllRule(r) && !isAnyRule(r) && !isNotRule(r) && !isWhenRule(r);
}
```

- [ ] **Step 2: Typecheck (RuleCtx not yet defined — expect one error there)**

Run from worktree root: `npx tsc --noEmit 2>&1 | grep "rule.ts" | head`

Expected: a "Cannot find module './ruleCtx'" error from `rule.ts:5`. Other source files in the repo must NOT fail. If you see unrelated errors, stop and report.

- [ ] **Step 3: Commit**

```bash
git add src/features/chrome-caps/rule.ts
git commit -m "feat(chrome-caps): add Rule grammar types"
```

---

### Task 2: RuleCtx type and assembler

**Files:**
- Create: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/ruleCtx.ts`

- [ ] **Step 1: Define `RuleCtx`**

Write `ruleCtx.ts`:

```ts
import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { CapabilityTag } from '@orochi235/weasel-modes';

/**
 * Live state read by rule evaluation. Built once per frame on the consuming
 * surface — chrome-caps, the affordance pipeline, the dispatcher's
 * eligibility filter — and discarded.
 *
 * Adding a new field is additive: existing rules don't change, new
 * selector atoms can read it.
 */
export interface RuleCtx {
  readonly focused: boolean;
  readonly selection: readonly NodeId[];
  readonly multiActive: boolean;
  readonly modifiers: ModifierState;
  readonly action: { readonly kind: string | null; readonly id: string | null };
  readonly hover: NodeId | null;
  readonly view: View;
  /** Active mode id. `'normal'` when no non-default mode is engaged. */
  readonly mode: string;
  /** Capability tags allowed by the active mode (the union of
   *  `ModeDefinition.allows` plus implicit tags). The `capability:`
   *  selector reads this to determine whether a tag is permitted. */
  readonly allowedCapabilities: ReadonlySet<CapabilityTag>;
}

export interface BuildRuleCtxArgs {
  focused: boolean;
  selection: readonly NodeId[];
  multiActive: boolean;
  modifiers: ModifierState;
  action: { kind: string | null; id: string | null };
  hover: NodeId | null;
  view: View;
  mode: string;
  allowedCapabilities: ReadonlySet<CapabilityTag>;
}

export function buildRuleCtx(args: BuildRuleCtxArgs): RuleCtx {
  return {
    focused: args.focused,
    selection: args.selection,
    multiActive: args.multiActive,
    modifiers: args.modifiers,
    action: args.action,
    hover: args.hover,
    view: args.view,
    mode: args.mode,
    allowedCapabilities: args.allowedCapabilities,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "ruleCtx|rule\.ts" | head`

Expected: clean. `rule.ts`'s import of `./ruleCtx` now resolves.

- [ ] **Step 3: Commit**

```bash
git add src/features/chrome-caps/ruleCtx.ts
git commit -m "feat(chrome-caps): add RuleCtx superset of ChromeCtx"
```

---

### Task 3: Rule evaluator with TDD

**Files:**
- Create: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/rule.test.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/rule.ts` (add `evaluate` function)

- [ ] **Step 1: Write failing tests**

Append to `rule.ts` placeholder export so import works:

```ts
// stub — implementation lands in this task
export function evaluate(_rule: Rule, _ctx: RuleCtx): boolean {
  throw new Error('not implemented');
}
```

Create `rule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluate, ALWAYS, NEVER, type Rule } from './rule';
import type { RuleCtx } from './ruleCtx';

function baseCtx(overrides: Partial<RuleCtx> = {}): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } } as unknown as RuleCtx['view'],
    mode: 'normal',
    allowedCapabilities: new Set(['navigation', 'creates-selection']),
    ...overrides,
  };
}

describe('evaluate — constants', () => {
  it('ALWAYS is true in any context', () => {
    expect(evaluate(ALWAYS, baseCtx())).toBe(true);
  });
  it('NEVER is false in any context', () => {
    expect(evaluate(NEVER, baseCtx())).toBe(false);
  });
});

describe('evaluate — Selector keys', () => {
  it('selection.atLeast matches', () => {
    expect(evaluate({ selection: { atLeast: 1 } }, baseCtx({ selection: ['n1'] as never }))).toBe(true);
    expect(evaluate({ selection: { atLeast: 2 } }, baseCtx({ selection: ['n1'] as never }))).toBe(false);
  });
  it('selection.is exact match', () => {
    expect(evaluate({ selection: { is: 0 } }, baseCtx())).toBe(true);
    expect(evaluate({ selection: { is: 1 } }, baseCtx())).toBe(false);
  });
  it('selection.empty', () => {
    expect(evaluate({ selection: { empty: true } }, baseCtx())).toBe(true);
    expect(evaluate({ selection: { empty: true } }, baseCtx({ selection: ['n1'] as never }))).toBe(false);
  });
  it('mode exact match', () => {
    expect(evaluate({ mode: 'normal' }, baseCtx())).toBe(true);
    expect(evaluate({ mode: 'path-edit' }, baseCtx())).toBe(false);
  });
  it('mode { in: [...] }', () => {
    expect(evaluate({ mode: { in: ['normal', 'isolation'] } }, baseCtx())).toBe(true);
    expect(evaluate({ mode: { in: ['path-edit', 'text-edit'] } }, baseCtx())).toBe(false);
  });
  it('mode { not: x }', () => {
    expect(evaluate({ mode: { not: 'path-edit' } }, baseCtx())).toBe(true);
    expect(evaluate({ mode: { not: 'normal' } }, baseCtx())).toBe(false);
  });
  it('capability single', () => {
    expect(evaluate({ capability: 'creates-selection' }, baseCtx())).toBe(true);
    expect(evaluate({ capability: 'edits-anchors' }, baseCtx())).toBe(false);
  });
  it('capability array (AND)', () => {
    expect(evaluate({ capability: ['navigation', 'creates-selection'] }, baseCtx())).toBe(true);
    expect(evaluate({ capability: ['navigation', 'edits-anchors'] }, baseCtx())).toBe(false);
  });
  it('capability { in: [...] } (OR)', () => {
    expect(evaluate({ capability: { in: ['edits-anchors', 'creates-selection'] } }, baseCtx())).toBe(true);
    expect(evaluate({ capability: { in: ['edits-anchors', 'edits-text'] } }, baseCtx())).toBe(false);
  });
  it('capability { not: x }', () => {
    expect(evaluate({ capability: { not: 'edits-anchors' } }, baseCtx())).toBe(true);
    expect(evaluate({ capability: { not: 'navigation' } }, baseCtx())).toBe(false);
  });
  it('gesturing true/false', () => {
    expect(evaluate({ gesturing: false }, baseCtx())).toBe(true);
    expect(evaluate({ gesturing: true }, baseCtx())).toBe(false);
    expect(evaluate({ gesturing: true }, baseCtx({ action: { kind: 'move', id: 'm1' } }))).toBe(true);
  });
  it('actionIs', () => {
    expect(evaluate({ actionIs: 'move' }, baseCtx({ action: { kind: 'move', id: 'm1' } }))).toBe(true);
    expect(evaluate({ actionIs: 'resize' }, baseCtx({ action: { kind: 'move', id: 'm1' } }))).toBe(false);
  });
  it('focused', () => {
    expect(evaluate({ focused: true }, baseCtx({ focused: true }))).toBe(true);
    expect(evaluate({ focused: true }, baseCtx({ focused: false }))).toBe(false);
  });
  it('hovering / hoveringSelected', () => {
    const sel = ['n1'] as never;
    expect(evaluate({ hovering: true }, baseCtx({ hover: 'n1' as never }))).toBe(true);
    expect(evaluate({ hoveringSelected: true }, baseCtx({ hover: 'n1' as never, selection: sel }))).toBe(true);
    expect(evaluate({ hoveringSelected: true }, baseCtx({ hover: 'n2' as never, selection: sel }))).toBe(false);
  });
  it('zoomAtLeast', () => {
    const view = { x: 0, y: 0, scale: { x: 2, y: 2 } } as unknown as RuleCtx['view'];
    expect(evaluate({ zoomAtLeast: 1.5 }, baseCtx({ view }))).toBe(true);
    expect(evaluate({ zoomAtLeast: 3 }, baseCtx({ view }))).toBe(false);
  });
  it('multiple keys AND together', () => {
    const ctx = baseCtx({ selection: ['n1', 'n2'] as never, mode: 'normal' });
    expect(evaluate({ selection: { atLeast: 2 }, mode: 'normal' }, ctx)).toBe(true);
    expect(evaluate({ selection: { atLeast: 2 }, mode: 'path-edit' }, ctx)).toBe(false);
    expect(evaluate({ selection: { atLeast: 3 }, mode: 'normal' }, ctx)).toBe(false);
  });
});

describe('evaluate — combinators', () => {
  it('all empty is true', () => {
    expect(evaluate({ all: [] }, baseCtx())).toBe(true);
  });
  it('any empty is false', () => {
    expect(evaluate({ any: [] }, baseCtx())).toBe(false);
  });
  it('all short-circuits on false', () => {
    const ctx = baseCtx();
    expect(evaluate({ all: [{ mode: 'normal' }, { mode: 'path-edit' }] }, ctx)).toBe(false);
  });
  it('any short-circuits on true', () => {
    const ctx = baseCtx();
    expect(evaluate({ any: [{ mode: 'path-edit' }, { mode: 'normal' }] }, ctx)).toBe(true);
  });
  it('not inverts', () => {
    expect(evaluate({ not: { mode: 'path-edit' } }, baseCtx())).toBe(true);
    expect(evaluate({ not: { mode: 'normal' } }, baseCtx())).toBe(false);
  });
  it('when escape hatch runs the closure', () => {
    expect(evaluate({ when: (ctx) => ctx.mode === 'normal' }, baseCtx())).toBe(true);
    expect(evaluate({ when: (ctx) => ctx.mode === 'path-edit' }, baseCtx())).toBe(false);
  });
  it('nested combinators', () => {
    const r: Rule = { all: [{ mode: 'normal' }, { any: [{ selection: { atLeast: 1 } }, { focused: true }] }] };
    expect(evaluate(r, baseCtx())).toBe(true); // focused=true
    expect(evaluate(r, baseCtx({ focused: false, selection: ['n1'] as never }))).toBe(true);
    expect(evaluate(r, baseCtx({ focused: false }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/chrome-caps/rule.test.ts 2>&1 | tail -10`

Expected: all tests fail with "not implemented" errors from the stub.

- [ ] **Step 3: Implement evaluator**

Replace the stub `evaluate` in `rule.ts` with the full implementation. Add this above the existing `evaluate` stub:

```ts
function checkSelection(s: NonNullable<Selector['selection']>, ctx: RuleCtx): boolean {
  if (s.empty !== undefined && (ctx.selection.length === 0) !== s.empty) return false;
  if (s.is !== undefined && ctx.selection.length !== s.is) return false;
  if (s.atLeast !== undefined && ctx.selection.length < s.atLeast) return false;
  return true;
}

function checkMode(m: NonNullable<Selector['mode']>, ctx: RuleCtx): boolean {
  if (typeof m === 'string') return ctx.mode === m;
  if ('not' in m) return ctx.mode !== m.not;
  if ('in' in m) return m.in.includes(ctx.mode);
  // exhaustiveness: tsc enforces above branches cover all forms
  return false;
}

function checkCapability(c: NonNullable<Selector['capability']>, ctx: RuleCtx): boolean {
  if (typeof c === 'string') return ctx.allowedCapabilities.has(c);
  if (Array.isArray(c)) return c.every((tag) => ctx.allowedCapabilities.has(tag));
  if ('in' in c) return c.in.some((tag) => ctx.allowedCapabilities.has(tag));
  if ('not' in c) return !ctx.allowedCapabilities.has(c.not);
  return false;
}

function evaluateSelector(s: Selector, ctx: RuleCtx): boolean {
  if (s.selection !== undefined && !checkSelection(s.selection, ctx)) return false;
  if (s.mode !== undefined && !checkMode(s.mode, ctx)) return false;
  if (s.capability !== undefined && !checkCapability(s.capability, ctx)) return false;
  if (s.gesturing !== undefined && (ctx.action.kind !== null) !== s.gesturing) return false;
  if (s.actionIs !== undefined && ctx.action.kind !== s.actionIs) return false;
  if (s.modifierHeld !== undefined && !ctx.modifiers[s.modifierHeld]) return false;
  if (s.focused !== undefined && ctx.focused !== s.focused) return false;
  if (s.hovering !== undefined && (ctx.hover !== null) !== s.hovering) return false;
  if (s.hoveringSelected !== undefined) {
    const isHovSel = ctx.hover !== null && ctx.selection.includes(ctx.hover);
    if (isHovSel !== s.hoveringSelected) return false;
  }
  if (s.zoomAtLeast !== undefined) {
    const sx = ctx.view.scale.x, sy = ctx.view.scale.y;
    const z = sx === sy ? sx : Math.sqrt(sx * sy);
    if (z < s.zoomAtLeast) return false;
  }
  return true;
}
```

Now replace the stub `evaluate` with:

```ts
export function evaluate(rule: Rule, ctx: RuleCtx): boolean {
  if (isAllRule(rule)) return rule.all.every((r) => evaluate(r, ctx));
  if (isAnyRule(rule)) return rule.any.some((r) => evaluate(r, ctx));
  if (isNotRule(rule)) return !evaluate(rule.not, ctx);
  if (isWhenRule(rule)) return rule.when(ctx);
  return evaluateSelector(rule, ctx);
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npx vitest run src/features/chrome-caps/rule.test.ts 2>&1 | tail -5`

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/chrome-caps/rule.ts src/features/chrome-caps/rule.test.ts
git commit -m "feat(chrome-caps): implement Rule evaluator with full selector coverage"
```

---

## Phase 2 — Fluent compiles to tree

Existing `Condition` predicates become builders that produce `Rule` trees. The public API (atom names, combinator semantics) stays the same; the underlying representation changes.

### Task 4: Rewrite atoms and combinators as tree builders

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/conditions.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/types.ts`

- [ ] **Step 1: Update `types.ts` — `Condition` becomes a fluent wrapper around `Rule`**

Replace the body of `types.ts` keeping the existing exports stable, but reshape `Condition`:

```ts
import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { Rule } from './rule';

export type { Rule };
export type { RuleCtx } from './ruleCtx';

/**
 * Live state read by chrome-visibility {@link Condition}s. Backward-compat
 * alias for `RuleCtx` — kept for consumers that still import `ChromeCtx`.
 * Subset of `RuleCtx`: legacy ChromeCtx didn't carry mode/capability info.
 * Resolve.ts upgrades a `ChromeCtx` to a `RuleCtx` for evaluation by
 * supplying defaults (mode='normal', empty allowedCapabilities).
 */
export interface ChromeCtx {
  readonly focused: boolean;
  readonly selection: readonly NodeId[];
  readonly multiActive: boolean;
  readonly modifiers: ModifierState;
  readonly action: { readonly kind: string | null; readonly id: string | null };
  readonly hover: NodeId | null;
  readonly view: View;
}

/**
 * Composable visibility predicate with fluent surface. Carries its underlying
 * `Rule` tree at `.rule` so the resolver can introspect / share trees with
 * the affordance pipeline and the dispatcher's eligibility filter.
 *
 * Callable form `cond(ctx)` evaluates the tree against ctx. The fluent
 * methods return new Conditions wrapping new trees.
 */
export interface Condition {
  (ctx: RuleCtx): boolean;
  readonly rule: Rule;
  and(other: Condition | Rule): Condition;
  or(other: Condition | Rule): Condition;
  andNot(other: Condition | Rule): Condition;
  orNot(other: Condition | Rule): Condition;
}

// ChromeId / VisibilityRules — unchanged
export type ChromeId =
  | 'selection.outline'
  | 'selection.resize-handles'
  | 'selection.rotation-handle'
  | 'action.marquee'
  | 'action.lasso'
  | 'action.move-ghosts'
  | 'action.insert-preview'
  | 'action.commands'
  | 'snap.guides'
  | 'snap.targets'
  | 'grid'
  | (string & {});

export type VisibilityRules = Partial<Record<ChromeId, Condition | Rule>>;

// Import RuleCtx for the Condition signature above.
import type { RuleCtx } from './ruleCtx';
```

- [ ] **Step 2: Rewrite `conditions.ts` — atoms produce tree fragments; combinators build trees**

Replace the body of `conditions.ts`:

```ts
import type { Condition } from './types';
import type { Rule, Selector } from './rule';
import type { RuleCtx } from './ruleCtx';
import { evaluate, ALWAYS, NEVER } from './rule';
import type { ModifierState } from '../../interactions/gestures/types';

/**
 * Promote a Rule tree to a fluent Condition. The function form evaluates
 * the tree against a RuleCtx; combinator methods produce new Conditions
 * wrapping `all`/`any`/`not` nodes.
 *
 * Combinators flatten same-kind nesting on construction so `a.and(b).and(c)`
 * produces `{ all: [a, b, c] }` rather than `{ all: [{ all: [a, b] }, c] }`.
 * Canonical form simplifies downstream introspection.
 */
export function cond(rule: Rule): Condition {
  const fn = (ctx: RuleCtx) => evaluate(rule, ctx);
  const condition = fn as Condition;
  (condition as { rule: Rule }).rule = rule;
  condition.and    = (other) => cond(combineAll(rule, asRule(other)));
  condition.or     = (other) => cond(combineAny(rule, asRule(other)));
  condition.andNot = (other) => cond(combineAll(rule, { not: asRule(other) }));
  condition.orNot  = (other) => cond(combineAny(rule, { not: asRule(other) }));
  return condition;
}

function asRule(value: Condition | Rule): Rule {
  return typeof value === 'function' ? (value as Condition).rule : value;
}

function combineAll(a: Rule, b: Rule): Rule {
  const left = 'all' in a ? a.all : [a];
  const right = 'all' in b ? b.all : [b];
  return { all: [...left, ...right] };
}

function combineAny(a: Rule, b: Rule): Rule {
  const left = 'any' in a ? a.any : [a];
  const right = 'any' in b ? b.any : [b];
  return { any: [...left, ...right] };
}

/** Inline-lambda escape hatch. Wraps the closure as a `when` rule node. */
export function when(fn: (ctx: RuleCtx) => boolean): Condition {
  return cond({ when: fn });
}

// ─── Variadic helpers ──────────────────────────────────────────────────

export function and(...cs: (Condition | Rule)[]): Condition {
  return cond({ all: cs.map(asRule) });
}
export function or(...cs: (Condition | Rule)[]): Condition {
  return cond({ any: cs.map(asRule) });
}
export function not(c: Condition | Rule): Condition {
  return cond({ not: asRule(c) });
}

// ─── Constant atoms ────────────────────────────────────────────────────

export const always: Condition = cond(ALWAYS);
export const never: Condition = cond(NEVER);

// ─── Atoms (each maps 1:1 to a tree fragment) ──────────────────────────

export const focused: Condition = cond({ focused: true });
export const gesturing: Condition = cond({ gesturing: true });
export const actionIs = (kind: string): Condition => cond({ actionIs: kind });

export const selectionEmpty: Condition = cond({ selection: { empty: true } });
export const selectionIs = (n: number): Condition => cond({ selection: { is: n } });
export const selectionAtLeast = (n: number): Condition => cond({ selection: { atLeast: n } });
export const multiActive: Condition = cond({ when: (c) => c.multiActive });

export const hovering: Condition = cond({ hovering: true });
export const hoveringSelected: Condition = cond({ hoveringSelected: true });

export const modifierHeld = (m: keyof ModifierState): Condition => cond({ modifierHeld: m });

export const zoomAtLeast = (z: number): Condition => cond({ zoomAtLeast: z });

// ─── Mode + capability atoms (new) ─────────────────────────────────────

export const modeIs = (m: string): Condition => cond({ mode: m });
export const modeIn = (modes: readonly string[]): Condition => cond({ mode: { in: modes } });
export const modeNot = (m: string): Condition => cond({ mode: { not: m } });

export const capabilityIs = (cap: string): Condition => cond({ capability: cap });
export const capabilityIn = (caps: readonly string[]): Condition => cond({ capability: { in: caps } });
export const capabilityAll = (caps: readonly string[]): Condition => cond({ capability: [...caps] });
export const capabilityNot = (cap: string): Condition => cond({ capability: { not: cap } });
```

The `multiActive` atom uses `{ when: ... }` because `multiActive` isn't a selector key today and adding one is unnecessary — it's derived from `selection.length > 1` at the caller site (`buildRuleCtx` populates `multiActive` from selection length). The `when` here is brief and stable; not a concern.

- [ ] **Step 3: Verify existing chrome-caps tests still pass**

Run: `npx vitest run src/features/chrome-caps/ 2>&1 | tail -10`

Expected: every existing test passes. The fluent surface is unchanged; only the internals shifted from closures to tree builders.

If any test fails due to a behavioral change, stop and report — Phase 2 is supposed to be transparent.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`

Expected: clean (or only errors in other files we haven't touched yet — Phase 5's `eligible` field on Action descriptor will surface later).

- [ ] **Step 5: Commit**

```bash
git add src/features/chrome-caps/types.ts src/features/chrome-caps/conditions.ts
git commit -m "refactor(chrome-caps): fluent atoms compile to canonical Rule trees"
```

---

### Task 5: Update resolve.ts and buildChromeCtx for evaluator-backed resolution

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/resolve.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/buildChromeCtx.ts`

- [ ] **Step 1: Update resolve.ts to accept both `Condition` and `Rule` in the rule table**

Replace `resolve.ts`:

```ts
import type { ChromeId, VisibilityRules } from './types';
import type { Rule } from './rule';
import type { RuleCtx } from './ruleCtx';
import { evaluate, ALWAYS } from './rule';
import { defaultVisibilityRules } from './defaults';

/**
 * Build the per-frame visibility check. Merges consumer rules on top of
 * the kit defaults, then closes over `ctx` so each chrome-id lookup runs
 * its rule against the current state.
 *
 * Rules may be either fluent `Condition` instances (have a `.rule` field)
 * or plain `Rule` trees. Both are unwrapped to a Rule before evaluation.
 */
export function resolveVisibility(
  consumer: VisibilityRules | undefined,
  ctx: RuleCtx,
): (id: ChromeId) => boolean {
  const merged: VisibilityRules = consumer
    ? { ...defaultVisibilityRules, ...consumer }
    : defaultVisibilityRules;
  return (id) => {
    const entry = merged[id] ?? ALWAYS;
    const rule: Rule = typeof entry === 'function' ? (entry as { rule: Rule }).rule : entry;
    return evaluate(rule, ctx);
  };
}
```

- [ ] **Step 2: Update buildChromeCtx.ts to produce a RuleCtx (drop suppressedIds)**

Replace `buildChromeCtx.ts`:

```ts
/**
 * Pure assembler for {@link RuleCtx}. Re-exported as `buildChromeCtx` for
 * backward compat (the old name still works; the produced object is
 * structurally a superset of legacy ChromeCtx).
 *
 * Called once per frame on the consuming side — chrome-caps' resolver,
 * the affordance pipeline, the dispatcher's eligibility filter — and
 * discarded.
 */

import type { NodeId } from '../../core/scene/types';
import type { ModifierState } from '../../interactions/gestures/types';
import type { View } from '../../core/viewport/view';
import type { CapabilityTag } from '@orochi235/weasel-modes';
import { buildRuleCtx, type RuleCtx } from './ruleCtx';

const EMPTY_CAPS: ReadonlySet<CapabilityTag> = new Set();

export interface BuildChromeCtxArgs {
  focused: boolean;
  selection: readonly NodeId[];
  multiActive: boolean;
  modifiers: ModifierState;
  action: { kind: string | null; id: string | null };
  hover: NodeId | null;
  view: View;
  /** Active mode id. Defaults to `'normal'` when omitted (back-compat). */
  mode?: string;
  /** Capability tags allowed by the active mode. Defaults to empty set
   *  when omitted — rules with `capability:` selectors will fail, but
   *  legacy callers that don't use capability selectors won't notice. */
  allowedCapabilities?: ReadonlySet<CapabilityTag>;
}

export function buildChromeCtx(args: BuildChromeCtxArgs): RuleCtx {
  return buildRuleCtx({
    focused: args.focused,
    selection: args.selection,
    multiActive: args.multiActive,
    modifiers: args.modifiers,
    action: args.action,
    hover: args.hover,
    view: args.view,
    mode: args.mode ?? 'normal',
    allowedCapabilities: args.allowedCapabilities ?? EMPTY_CAPS,
  });
}
```

- [ ] **Step 3: Update buildChromeCtx.test.ts for the new shape (drop suppressedIds assertion)**

Read `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/buildChromeCtx.test.ts` first. Replace any assertion or fixture referring to `suppressedIds` with assertions on `mode` and `allowedCapabilities`. Default values: `mode='normal'`, `allowedCapabilities=new Set()`.

- [ ] **Step 4: Update index.ts exports**

`/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/index.ts` — add exports for `Rule`, `RuleCtx`, `evaluate`, `buildRuleCtx`. Verify no broken imports across the kit.

- [ ] **Step 5: Run chrome-caps tests**

Run: `npx vitest run src/features/chrome-caps/ 2>&1 | tail -10`

Expected: all pass.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`

Expected: errors only in `SceneCanvas.tsx` (passes `suppressedIds` to `buildChromeCtx`) and the affordance pipeline (still references `ChromeState.suppressedIds`). Phase 3 fixes those. If errors anywhere else, stop and report.

- [ ] **Step 7: Commit**

```bash
git add src/features/chrome-caps/
git commit -m "refactor(chrome-caps): evaluator-backed resolution; RuleCtx supersedes ChromeCtx"
```

---

## Phase 3 — Migrate defaults, drop suppressedIds, gate path-edit chrome

The visible bug fix on the render side. After this phase, resize handles stop *painting* in path-edit mode. The affordance pipeline still hit-tests them (Phase 4 closes that gap).

### Task 6: Migrate defaults.ts with mode constraints

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/defaults.ts`

- [ ] **Step 1: Rewrite defaults in tree form with mode gating**

Replace `defaults.ts`:

```ts
import type { VisibilityRules } from './types';
import type { Rule } from './rule';

/**
 * Kit-shipped defaults. Merged with the consumer's `chromeVisibility` map
 * at resolve time; consumer entries take precedence per id.
 *
 * Written as literal Rule trees rather than fluent chains so the inputs
 * each rule depends on are immediately visible. The fluent atoms compile
 * to the same trees; either form is valid in a VisibilityRules entry.
 *
 * Mode gating: selection chrome is suppressed in `path-edit` because the
 * path-editing overlay takes over visually. Path-edit-specific chrome
 * ids (`path-edit.*`) are positively gated to that mode. This replaces
 * the old `suppressedIds` set, which only the selection-outline path
 * honored.
 */
export const defaultVisibilityRules: VisibilityRules = {
  // Static selection chrome — visible while a selection exists, but off
  // in path-edit (the path-editing overlay takes over).
  'selection.outline': {
    selection: { atLeast: 1 },
    mode: { not: 'path-edit' },
  } as Rule,

  'selection.resize-handles': {
    all: [
      { selection: { atLeast: 1 } },
      { gesturing: false },
      { mode: { not: 'path-edit' } },
    ],
  } as Rule,

  'selection.rotation-handle': {
    all: [
      { selection: { atLeast: 1 } },
      { focused: true },
      { gesturing: false },
      { mode: { not: 'path-edit' } },
    ],
  } as Rule,

  // Transient action chrome — only shown during the matching action.
  'action.marquee': { actionIs: 'marquee' } as Rule,
  'action.lasso':   { actionIs: 'lasso' } as Rule,
  'action.move-ghosts': { actionIs: 'move' } as Rule,

  // Path-edit chrome — gated positively to path-edit mode.
  'path-edit.anchors': { mode: 'path-edit' } as Rule,
  'path-edit.overlay': { mode: 'path-edit' } as Rule,

  // Snap system — guides during any action; targets consumer-driven for now.
  'snap.guides': { gesturing: true } as Rule,
};
```

- [ ] **Step 2: Run chrome-caps tests — expect failures from new mode gating**

Run: `npx vitest run src/features/chrome-caps/ 2>&1 | tail -20`

Expected: existing tests for `selection.resize-handles` / `selection.rotation-handle` / `selection.outline` will need fixtures updated to supply a `mode` field. New test cases needed for path-edit gating.

- [ ] **Step 3: Update chrome-caps.test.ts**

Read `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/features/chrome-caps/chrome-caps.test.ts`. For each test that asserts a `selection.*` chrome id's visibility:

- Add a `mode: 'normal'` to the test's `buildChromeCtx` arguments (or rely on the default).
- Add a parallel "in path-edit, this chrome is off" test for each suppressed chrome id (`selection.outline`, `selection.resize-handles`, `selection.rotation-handle`).
- Add coverage for `'path-edit.anchors'` and `'path-edit.overlay'` chrome ids — on in path-edit, off otherwise.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/chrome-caps/ 2>&1 | tail -10`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/chrome-caps/defaults.ts src/features/chrome-caps/chrome-caps.test.ts
git commit -m "feat(chrome-caps): mode-gated defaults — selection chrome off in path-edit"
```

---

### Task 7: Remove suppressedIds plumbing from SceneCanvas

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/canvas/SceneCanvas.tsx`

- [ ] **Step 1: Wire mode + capabilities into buildChromeCtx call site**

Find the `getIsVisibleForCanvas` callback (around L1205). It currently passes `suppressedIds: suppressedForCapsRef.current`. Replace that with mode + capability inputs:

The mode source is the modality machine — apps/draw owns it. SceneCanvas needs a new optional prop `getActiveMode?: () => { id: string; allowedCapabilities: ReadonlySet<string> }`. When absent, default to `{ id: 'normal', allowedCapabilities: new Set() }`.

Find the props declaration (around L588 `chromeVisibility?: ...`). Add the new prop:

```ts
/** Returns the active mode id + the capability tags the mode allows.
 *  Defaults to `'normal'` mode with an empty capability set when omitted.
 *  Apps using the modality machine should derive this from
 *  `modality.machine.registry.current()` + `eligibleForMode` semantics. */
getActiveMode?: () => { id: string; allowedCapabilities: ReadonlySet<string> };
```

Add `getActiveMode` to the destructuring at L727:

```ts
getActiveMode,
```

Add a ref:

```ts
const getActiveModeRef = useRef(getActiveMode);
getActiveModeRef.current = getActiveMode;
```

Update `getIsVisibleForCanvas`:

```ts
const getIsVisibleForCanvas = useCallback((): (id: string) => boolean => {
  const sel = selectionForCapsRef.current;
  const modeInfo = getActiveModeRef.current?.() ?? { id: 'normal', allowedCapabilities: new Set<string>() };
  const ctx = buildChromeCtx({
    focused: getFocusedPropRef.current ? getFocusedPropRef.current() : true,
    selection: sel,
    multiActive: sel.length > 1,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: dispatcher.getActiveAction(),
    hover: getHover(),
    view: currentViewRef.current,
    mode: modeInfo.id,
    allowedCapabilities: modeInfo.allowedCapabilities,
  });
  return resolveVisibility(chromeVisibilityRef.current, ctx);
}, [dispatcher, getHover]);
```

Remove the `suppressedForCapsRef` declaration (L1193) and its update at L1346.

- [ ] **Step 2: Update selection-overlay layer (which previously read suppressedIds)**

Find the `getSuppressedSelectionIds` callback (L1333-1336) and its use in `selectionOverlayLayer` (L1406). The overlay's selection-outline gating is now handled by chrome-caps via the `'selection.outline'` rule. The overlay layer should call `getIsVisibleForCanvas()` and check `'selection.outline'` before drawing the outline.

Find the selection-overlay's draw path; it likely receives `getIsVisible` already as part of the layer contract. If so, the outline draw becomes:

```ts
if (getIsVisible('selection.outline')) {
  // draw outline for each selected id
}
```

If the overlay doesn't yet receive `getIsVisible`, this is the change site — thread it through.

- [ ] **Step 3: Remove getSuppressedSelectionIds entirely**

Delete the `getSuppressedSelectionIds` callback and `EMPTY_ID_SET` if no other consumer remains. Update the `selectionOverlayLayer` factory to not require `suppressedIds`.

- [ ] **Step 4: Wire apps/draw to supply getActiveMode**

In `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/apps/draw/src/App.tsx`, find where `SceneCanvas` is rendered. Add the `getActiveMode` prop:

```ts
import { eligibleForMode } from '@orochi235/weasel-modes';

// ...

const getActiveMode = useCallback((): { id: string; allowedCapabilities: ReadonlySet<string> } => {
  const mode = modality.machine.registry.current();
  // Build the allowed-capabilities set from the mode definition + implicit tags.
  const allowed = new Set<string>([...mode.allows, 'navigation']);
  return { id: mode.id, allowedCapabilities: allowed };
}, [modality.machine]);

// In the <SceneCanvas .../> JSX:
<SceneCanvas
  // ... existing props
  getActiveMode={getActiveMode}
/>
```

- [ ] **Step 5: Typecheck + tests**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: clean, except affordance pipeline if it still imports `suppressedIds` from `ChromeState`. If so, that's Phase 4's territory — leave that error.

Run: `npx vitest run src/features/chrome-caps/ src/canvas/ 2>&1 | tail -15`
Expected: passes (or only failures in affordance-related tests that Phase 4 will fix).

- [ ] **Step 6: Commit**

```bash
git add src/canvas/ apps/draw/src/App.tsx
git commit -m "feat(chrome-caps): thread mode+capabilities; drop suppressedIds plumbing"
```

---

## Phase 4 — Affordance pipeline consumes the resolver

Closes the affordance/chrome-caps drift. After this phase, the path-edit anchor-drag bug is fixed: resize handles can't be hit-tested in path-edit because the resolver returns false.

### Task 8: Thread isVisible into buildAffordanceAt

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/canvas/affordanceAt.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/canvas/SceneCanvas.tsx` (call site)

- [ ] **Step 1: Update `buildAffordanceAt` signature to accept `isVisible`**

Edit `affordanceAt.ts`. Update the `buildAffordanceAt` function signature:

```ts
export function buildAffordanceAt(
  getChromeState: () => ChromeState,
  hitRadius: number = HANDLE_HIT_RADIUS,
  rotateDistance: number = ROTATE_DISTANCE,
  getAnchorState?: () => AnchorState | null,
  /** Resolver from chrome-caps. When provided, the classifier consults it
   *  before claiming an affordance kind exists — ensures the affordance
   *  pipeline and the renderer agree on which chrome is live. */
  getIsVisible?: () => (id: string) => boolean,
): (worldPoint: { x: number; y: number }) => AffordanceHit | null {
  return function affordanceAt({ x: wx, y: wy }) {
    const state = getChromeState();
    const isVisible = getIsVisible?.() ?? (() => true);
    const r2 = hitRadius * hitRadius;

    // -- Corner resize handles — gated by 'selection.resize-handles' --
    if (isVisible('selection.resize-handles')) {
      const resizeTarget = pickResizeTarget(state);
      if (resizeTarget) {
        for (const c of cornersFor(resizeTarget.bounds)) {
          if (dist2(wx, wy, c.worldX, c.worldY) <= r2) {
            return {
              kind: c.kind,
              fixedPoint: { x: c.fixedX, y: c.fixedY },
              targetIds: [resizeTarget.id],
              anchor: c.anchor,
            };
          }
        }
      }
    }

    // -- Rotation handle — gated by 'selection.rotation-handle' --
    if (isVisible('selection.rotation-handle')) {
      const rotateTarget = pickResizeTarget(state);
      if (rotateTarget) {
        const { x, y, width, rotation = 0 } = rotateTarget.bounds;
        const cx = x + width / 2;
        const cy = rotateTarget.bounds.y + rotateTarget.bounds.height / 2;
        const rawHx = x + width / 2;
        const rawHy = y - rotateDistance;
        const hw = rotateAround(rawHx, rawHy, cx, cy, rotation);
        if (dist2(wx, wy, hw.x, hw.y) <= r2) {
          return {
            kind: 'rotate-handle',
            fixedPoint: { x: cx, y: cy },
            targetIds: [rotateTarget.id],
          };
        }
      }
    }

    // -- Anchor / control-handle hits — gated by 'path-edit.anchors' --
    if (isVisible('path-edit.anchors') && getAnchorState) {
      const anchorState = getAnchorState();
      if (anchorState) {
        // ... existing anchor / controlIn / controlOut hit-test logic
        // (unchanged from current implementation)
      }
    }

    return null;
  };
}
```

Keep the anchor branch's existing logic verbatim — only the wrapping `if (isVisible('path-edit.anchors') && getAnchorState)` is new.

- [ ] **Step 2: Wire the resolver at the SceneCanvas call site**

In `SceneCanvas.tsx`, find the `buildAffordanceAt(...)` call (around L1677). Add the resolver argument:

```ts
buildAffordanceAt(
  getChromeState,
  HANDLE_HIT_RADIUS,
  ROTATE_DISTANCE,
  getAnchorState,
  () => getIsVisibleForCanvas(),  // pass the resolver factory
)
```

- [ ] **Step 3: Update affordanceAt tests**

Run: `npx vitest run src/canvas/affordanceAt.clientToWorld.test.ts src/canvas/affordanceAt.test.ts 2>&1 | tail -15`

Existing tests may need fixtures updated to supply a `getIsVisible` thunk. For tests that don't care about the gate, pass `() => () => true`. Add new tests:

- "in path-edit mode (visibility returns false for selection.resize-handles), a click on a resize-handle location does NOT return a handle hit"
- "in normal mode (visibility returns true), the same click DOES return a handle hit"

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/canvas/ 2>&1 | tail -10`

Expected: pass.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/affordanceAt.ts src/canvas/SceneCanvas.tsx src/canvas/affordanceAt.test.ts src/canvas/affordanceAt.clientToWorld.test.ts
git commit -m "fix(affordance): gate corner/rotate/anchor hit-test on chrome-id visibility"
```

---

### Task 9: Manual smoke — anchor drag in path-edit no longer fires resize

**Files:** none (verification only).

- [ ] **Step 1: Start the worktree dev server**

The dev server should still be running from earlier on http://localhost:5174/weasel/draw/. If not, restart:

```bash
nohup npm run dev:draw > /tmp/weasel-draw-worktree.log 2>&1 &
sleep 3 && grep -E "Local:|ready in" /tmp/weasel-draw-worktree.log
```

- [ ] **Step 2: Manual test sequence**

1. Draw a polygon with the pen tool (or use an existing one).
2. Double-click to enter path-edit mode (workspace tint indicates path-edit is active).
3. Verify: selection chrome (corners, rotation handle) is no longer painted.
4. Drag an anchor of the polygon.
5. Verify in the dispatch trace panel: `editAnchors` action fires (not `resize` or `move`).
6. Verify visually: only the dragged anchor moves; the rest of the path stays in place during the drag and commits to a new shape on release.

If any of these fail, surface to the human — there's a deeper issue.

- [ ] **Step 3: Run full test suite**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -15`

Expected: clean.

- [ ] **Step 4: Commit any test fixture updates that emerged from step 2-3** (if applicable). No commit if nothing changed.

---

## Phase 5 — Action eligibility, capability rename, nudge split, target predicates

The final phase. Adds defense-in-depth at the dispatcher and completes the spec's behavioral migration.

### Task 10: Add `eligible` field to Action; dispatcher filters by it

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/actions/registry.tsx`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/dispatcher/dispatcher.ts`

- [ ] **Step 1: Add `eligible` to the Action interface**

In `registry.tsx`, locate the `Action` interface and add:

```ts
export interface Action {
  // ... existing fields
  /** Declarative eligibility rule. Evaluated against the current RuleCtx
   *  before the dispatcher invokes `start()`. Omitted = always eligible.
   *  Fluent-form (Condition) and raw Rule both accepted. */
  eligible?: import('../../features/chrome-caps').Rule | import('../../features/chrome-caps').Condition;
}
```

- [ ] **Step 2: Add the eligibility filter to the dispatcher loop**

In `dispatcher.ts`, locate the match-and-try loop (the section that iterates over `matchSorted(...)` results and calls `action.start(...)`). Insert the eligibility filter step:

```ts
import { evaluate } from '../../features/chrome-caps';
import type { Rule, RuleCtx } from '../../features/chrome-caps';

// ... inside the dispatch function, after matchSorted:
const candidates = matchSorted(event, bindings, isMac, engagedChannels);
const eligibleCandidates = candidates.filter((c) => {
  const action = actionMap.get(c.binding.actionId);
  if (!action?.eligible) return true; // no eligible = always eligible
  const rule: Rule = typeof action.eligible === 'function'
    ? (action.eligible as { rule: Rule }).rule
    : action.eligible;
  return evaluate(rule, ruleCtx);
});

for (const candidate of eligibleCandidates) {
  // ... existing start() invocation
}
```

The dispatcher needs access to a `RuleCtx` — thread it from the same source SceneCanvas uses to build the chrome-caps ctx. Add `getRuleCtx?: () => RuleCtx` to the dispatcher's options/context if not already present.

- [ ] **Step 3: Write a dispatcher integration test**

Add to `src/interactions/dispatcher/dispatcher.test.ts`:

```ts
it('filters out actions whose `eligible` rule fails for the active mode', () => {
  // Setup: a binding for `moveAction` with eligible: { capability: 'transforms-selection' }
  // and a context where the active mode does NOT allow that capability.
  // Assert: matchSorted returns the binding, but the dispatch filter strips it
  // and falls through to the next match (or no match).
  // Use the existing test harness patterns in this file.
});
```

Implement the test using the file's existing helpers.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/interactions/dispatcher/ 2>&1 | tail -10`

Expected: pass (including new test).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/registry.tsx src/interactions/dispatcher/
git commit -m "feat(dispatcher): action eligibility filter via Rule grammar"
```

---

### Task 11: Rename `'selection'` capability tag to `'creates-selection'`

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/packages/weasel-modes/src/capabilities.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/packages/weasel-modes/src/presets/default.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/tools/builtin/select/useSelectTool.ts`
- Modify: All test files that reference `'selection'` capability (see grep below).

- [ ] **Step 1: Update the capability vocabulary**

In `capabilities.ts`, change `'selection'` to `'creates-selection'` in the `ALL_TAGS` array.

- [ ] **Step 2: Update mode preset allow-lists**

In `presets/default.ts`, find every occurrence of `'selection'` in an `allows` array and replace with `'creates-selection'`. Both NORMAL and ISOLATION mode definitions include it.

- [ ] **Step 3: Update select tool's capability declaration**

In `src/tools/builtin/select/useSelectTool.ts:271`, replace `capabilities: ['selection']` with `capabilities: ['creates-selection']`.

- [ ] **Step 4: Grep + fix all remaining references**

Run: `grep -rn "'selection'" packages/weasel-modes/src/ src/ apps/draw/src/ 2>&1 | grep -v ".md:"`

For each match, determine if it's the capability tag or an unrelated string. Likely matches to update:
- `packages/weasel-modes/src/capabilities.test.ts`
- `packages/weasel-modes/src/eligibility.test.ts`
- `src/interactions/dispatcher/dispatcher.test.ts`
- `src/interactions/dispatcher/move.integration.test.tsx`
- `src/interactions/dispatcher/resize.integration.test.tsx`
- Various other action/dep test files

Apps/draw's `PreferencesModal.tsx` has `id: 'selection'` for a preference — this is NOT a capability tag, do not change.

- [ ] **Step 5: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -10`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-modes/ src/ apps/draw/
git commit -m "refactor(capabilities): rename 'selection' to 'creates-selection'"
```

---

### Task 12: Extract target predicates library

**Files:**
- Create: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/dispatcher/predicates.ts`
- Create: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/dispatcher/predicates.test.ts`

- [ ] **Step 1: Write the predicates file**

Create `predicates.ts`:

```ts
/**
 * Named predicates for `defaultBinding.target.kindOf`. Each matches the
 * existing `kindOf` signature `(target: unknown, bodyTarget?: string) => boolean`
 * so they drop into action descriptors without a wrapper:
 *
 *     target: { kindOf: isAnchor }
 *
 * Single source of truth for "what does this affordance kind mean" — adding
 * a new predicate here is what enables every action that needs the same
 * shape to read it. Drift prevention.
 */

// ─── Body-class predicates (read the second arg) ───────────────────────

/** Matches any body hit — selected or unselected node body. */
export const isBody = (_target: unknown, bodyTarget?: string): boolean =>
  bodyTarget === 'selected-body' || bodyTarget === 'unselected-body';

/** Body hit specifically already in the selection. */
export const isSelectedBody = (_target: unknown, bodyTarget?: string): boolean =>
  bodyTarget === 'selected-body';

/** Body hit specifically NOT in the selection. */
export const isUnselectedBody = (_target: unknown, bodyTarget?: string): boolean =>
  bodyTarget === 'unselected-body';

/** Empty-canvas hit — no node beneath cursor. */
export const isEmpty = (_target: unknown, bodyTarget?: string): boolean =>
  bodyTarget === 'empty';

// ─── Affordance-kind predicates (read the first arg) ───────────────────

function kindOf(target: unknown): string | undefined {
  if (typeof target !== 'object' || target === null) return undefined;
  const k = (target as { kind?: unknown }).kind;
  return typeof k === 'string' ? k : undefined;
}

/** Any corner resize handle — top-left/top-right/bottom-left/bottom-right. */
export const isResizeHandle = (target: unknown): boolean => {
  const k = kindOf(target);
  return k !== undefined && k.startsWith('handle:');
};

/** The rotate-around-center handle above the bounding box. */
export const isRotateHandle = (target: unknown): boolean =>
  kindOf(target) === 'rotate-handle';

/** Any path anchor (the on-curve dot). */
export const isAnchor = (target: unknown): boolean => {
  const k = kindOf(target);
  return k !== undefined && /^anchor:\d+$/.test(k);
};

/** Either control handle (controlIn or controlOut). */
export const isControlHandle = (target: unknown): boolean => {
  const k = kindOf(target);
  return k !== undefined && /^(controlIn|controlOut):\d+$/.test(k);
};

/** Any of the three anchor-editing affordances (anchor + both controls). */
export const isAnchorOrControl = (target: unknown): boolean =>
  isAnchor(target) || isControlHandle(target);
```

- [ ] **Step 2: Write predicates.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import {
  isBody, isSelectedBody, isUnselectedBody, isEmpty,
  isResizeHandle, isRotateHandle, isAnchor, isControlHandle, isAnchorOrControl,
} from './predicates';

describe('body predicates', () => {
  it('isBody matches selected or unselected body', () => {
    expect(isBody(null, 'selected-body')).toBe(true);
    expect(isBody(null, 'unselected-body')).toBe(true);
    expect(isBody(null, 'empty')).toBe(false);
    expect(isBody(null, undefined)).toBe(false);
  });
  it('isSelectedBody / isUnselectedBody / isEmpty discriminate', () => {
    expect(isSelectedBody(null, 'selected-body')).toBe(true);
    expect(isSelectedBody(null, 'unselected-body')).toBe(false);
    expect(isUnselectedBody(null, 'unselected-body')).toBe(true);
    expect(isEmpty(null, 'empty')).toBe(true);
  });
});

describe('affordance-kind predicates', () => {
  it('isResizeHandle matches handle:* kinds', () => {
    expect(isResizeHandle({ kind: 'handle:top-left' })).toBe(true);
    expect(isResizeHandle({ kind: 'handle:bottom-right' })).toBe(true);
    expect(isResizeHandle({ kind: 'rotate-handle' })).toBe(false);
    expect(isResizeHandle({ kind: 'anchor:0' })).toBe(false);
    expect(isResizeHandle(null)).toBe(false);
  });
  it('isRotateHandle matches rotate-handle exactly', () => {
    expect(isRotateHandle({ kind: 'rotate-handle' })).toBe(true);
    expect(isRotateHandle({ kind: 'handle:top-left' })).toBe(false);
  });
  it('isAnchor matches anchor:N', () => {
    expect(isAnchor({ kind: 'anchor:0' })).toBe(true);
    expect(isAnchor({ kind: 'anchor:42' })).toBe(true);
    expect(isAnchor({ kind: 'controlIn:0' })).toBe(false);
    expect(isAnchor({ kind: 'anchor:' })).toBe(false); // no digits
  });
  it('isControlHandle matches controlIn:N / controlOut:N', () => {
    expect(isControlHandle({ kind: 'controlIn:0' })).toBe(true);
    expect(isControlHandle({ kind: 'controlOut:5' })).toBe(true);
    expect(isControlHandle({ kind: 'anchor:0' })).toBe(false);
  });
  it('isAnchorOrControl matches all three', () => {
    expect(isAnchorOrControl({ kind: 'anchor:0' })).toBe(true);
    expect(isAnchorOrControl({ kind: 'controlIn:0' })).toBe(true);
    expect(isAnchorOrControl({ kind: 'controlOut:0' })).toBe(true);
    expect(isAnchorOrControl({ kind: 'handle:top-left' })).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/interactions/dispatcher/predicates.test.ts 2>&1 | tail -10`

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/interactions/dispatcher/predicates.ts src/interactions/dispatcher/predicates.test.ts
git commit -m "feat(dispatcher): named target-predicate library"
```

---

### Task 13: Annotate all built-in actions with `eligible` + replace inline kindOf closures

**Files:**
- Modify: every file under `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/actions/defaults/*.ts`

This is the bulk migration. Mechanical but touches many files.

- [ ] **Step 1: Annotate per the canonical mapping in the spec**

For each action file in `src/interactions/actions/defaults/`, add the `eligible` field according to the table in `docs/superpowers/specs/2026-05-25-mode-aware-dispatch-design.md#action-capability-annotations---the-full-registry`.

Always-on actions (omit `eligible`): `undo`, `redo`, `escape`, `cancelGesture`, `viewportDragPan`, `pinchZoom`, viewport.pan, viewport.wheelPan, viewport.zoom.

Single capability — `creates-selection`: `selectAll`, `clearSelection`, `areaSelect`, `lassoSelect`.

Single capability — `transforms-selection`: `move`, `resize`, `rotate`, `flip`, `align*`, `distribute*`.

Single capability — `edits-anchors`: `editAnchors`, `insertPathAnchor`.

Multi-cap AND `['edits-page', 'creates-selection']`: `duplicate`, `clone`.

Single capability — `edits-page`: `delete`, `group`, `ungroup`, `reorderForward`, `reorderBackward`.

Single capability — `creates-shapes`: `insert`, `insertRotate`, `pathfinder*` (6 of them).

Single capability — `applies-fill`: `setFill`, `setStroke`, `setFillOpacity`, `setStrokeOpacity`.

Mode-gated entry actions: `enterPathEdit` → `eligible: { mode: { in: ['normal', 'isolation'] } }`, `enterTextEdit` → same, `exitPathEdit` → `eligible: { mode: 'path-edit' }`.

- [ ] **Step 2: Replace inline kindOf closures with named predicates**

For each action that has a `target: { kindOf: ... }` in its binding:

```bash
grep -rn "kindOf:" src/interactions/actions/defaults/ 2>&1
```

Walk each match. If the closure matches one of the named predicates (`isBody`, `isAnchor`, etc.), replace it. Imports:

```ts
import { isBody, isAnchor, isAnchorOrControl, /* etc. */ } from '../../dispatcher/predicates';
```

If a closure is inline-once (no library equivalent), leave it.

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Run: `npx vitest run src/interactions/actions/ 2>&1 | tail -10`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/interactions/actions/defaults/
git commit -m "feat(actions): eligibility annotations + named target predicates across all built-ins"
```

---

### Task 14: Split nudge action into node-nudge and anchor-nudge

**Files:**
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/actions/defaults/nudge.ts`
- Modify: `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/actions/useStandardActions.ts`

- [ ] **Step 1: Read the existing nudge implementation**

Read `/Users/mike/src/weasel/.claude/worktrees/path-edit-undo-granularity/src/interactions/actions/defaults/nudge.ts`. The current `nudgeUpAction` / `nudgeDownAction` / `nudgeLeftAction` / `nudgeRightAction` translate selected nodes via `scene.setPose`.

- [ ] **Step 2: Add anchor-nudge variants**

In `nudge.ts`, add four new actions: `nudgeAnchorUpAction`, `nudgeAnchorDownAction`, `nudgeAnchorLeftAction`, `nudgeAnchorRightAction`. Each is structurally similar to its node-nudge sibling but invokes the anchor-nudge codepath instead of `scene.setPose`. The anchor-nudge codepath is what pen-edit mode uses today — find it via `nudgeSelectedAnchors` references.

Pattern:

```ts
export const nudgeAnchorUpAction: Action = {
  id: 'nudgeAnchorUp',
  label: 'Nudge anchor up',
  defaultBinding: { kind: 'key', key: 'ArrowUp' },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: { /* invokes anchor-nudge */ },
  enabled: () => true,
};
```

The existing node-nudge actions get `eligible: { capability: 'transforms-selection' }` in Task 13 (or add it here if Task 13 missed nudge).

- [ ] **Step 3: Register the new actions**

In `useStandardActions.ts`, add the four new action descriptors to the `KIT_STANDARD_DESCRIPTORS` array. Update the count comment at the top.

- [ ] **Step 4: Add tests**

Add a test in `src/interactions/actions/defaults/nudge.test.ts` (create if needed):

- "In normal mode, nudgeUp translates selected nodes; nudgeAnchorUp is filtered out by eligibility."
- "In path-edit mode, nudgeAnchorUp translates selected anchors; nudgeUp is filtered out."

Use the existing test harness patterns for action invocation.

- [ ] **Step 5: Tests + typecheck**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -10`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/interactions/actions/defaults/nudge.ts src/interactions/actions/defaults/nudge.test.ts src/interactions/actions/useStandardActions.ts
git commit -m "feat(actions): split nudge into node-nudge + anchor-nudge variants"
```

---

### Task 15: Full integration verification + prepublish gate

**Files:** none (verification only).

- [ ] **Step 1: Full test suite + typecheck**

Run: `npm run prepublishOnly`

Expected: tsc clean, all tests pass, tsup build succeeds, typedoc generation succeeds.

- [ ] **Step 2: Manual integration sequence in apps/draw**

Dev server still on http://localhost:5174/weasel/draw/. Run through:

1. Draw a polygon. Click to select. Verify selection chrome (outline + corners + rotate handle) appears.
2. Double-click to enter path-edit. Verify selection chrome disappears; path-edit chrome (anchor squares + control handles) appears.
3. Drag an anchor. Verify `editAnchors` fires (dispatch trace), not `resize`/`move`. Only the dragged anchor moves; release commits the new shape.
4. Press arrow keys. Verify selected anchors translate (not the whole node).
5. Press Cmd-Z. Verify the anchor edit undoes cleanly.
6. Press Escape. Verify exit to normal mode; selection chrome reappears.
7. Drag the polygon body. Verify `move` fires; whole node translates.
8. Drag a corner handle. Verify `resize` fires.
9. Press Cmd-D in normal mode. Verify duplicate works.
10. Enter path-edit. Press Cmd-D. Verify it does nothing (multi-cap eligibility rejects: `creates-selection` not allowed in path-edit).
11. Press Cmd-Z in any mode. Verify undo works.

- [ ] **Step 3: If everything green, commit no-op marker for the plan completion**

If no test fixture updates needed and integration is clean, no commit. If any small fix was needed, commit it with a descriptive message.

---

## Notes for the executor

- **Phase 1-2 are pure groundwork.** No behavior changes; existing tests must keep passing. If they don't, something is wrong.
- **Phase 3 is where the visible bug fix lands** on the render side (chrome stops painting in path-edit). The hit-test fix follows in Phase 4.
- **The bug is fixed by Task 8 (Phase 4)**, not earlier. Manual test in Task 9 verifies.
- **Phase 5 is the biggest by file count** but each file change is small and mechanical. The eligibility annotations are direct lookups from the spec table.
- **Don't reintroduce `suppressedIds`** anywhere. It's fully replaced by mode-aware chrome rules + the affordance pipeline's visibility consumption.
- **`when` escape hatch usage should stay limited.** If a rule keeps needing `when`, that's a signal to add a new selector key. v1 has `multiActive` as a `when` because adding a one-off selector key for it isn't worth it; that's the standard for when `when` is acceptable.
- **The path-edit anchor-drag bug is the load-bearing acceptance criterion** for this whole plan. If after Phase 4 the bug persists, do not proceed to Phase 5 — diagnose first.
