# Declarative tool routing — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundation for declarative tool routing — types, factories, action constructors, and supporting renames. Existing imperative tools keep working unchanged; the new `defineTool` and `defineViewportTool` factories produce kit-compatible `Tool<TScratch>` objects via translation. No tool migrations in this phase.

**Architecture:** The new `defineTool` factory translates a declarative `ToolDef<TScratch>` into the existing imperative `Tool<TScratch>` shape. The dispatcher doesn't change — it still consumes imperative tools. New tool authoring is declarative; the translation layer bridges to the existing pipeline. ToolCtx gains a `target: HitResult` field populated by the dispatcher during hit-test; existing tools that ignore it are unaffected.

**Tech Stack:** TypeScript, React 18+ (kit types use ReactNode), Vitest, no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.

---

### File map (locked at start)

**Created:**

- `src/tools/routing/hitResult.ts` — `HitResult` discriminated union (`EmptyHit | NodeHit | AffordanceHit`) plus `NodeRef`, `NodeRefHit`.
- `src/tools/routing/result.ts` — `Result<TScratch>` union plus action constructors (`apply`, `begin`, `hold`, `commit`, `cancel`, `claim`, `none`).
- `src/tools/routing/modifiers.ts` — `ModifierKey` type + `mods()` helper.
- `src/tools/routing/types.ts` — `ToolDef`, `PhaseDef`, `BeginSpec`, `RouteTable`, `RouteEntry`, `ModifierRoute`, `ActionFn`, `ViewportToolDef`, `ViewportPhaseDef`.
- `src/tools/routing/lookup.ts` — route lookup engine (pure function: `(table, hitResult, modifiers) → ActionFn | undefined`).
- `src/tools/routing/defineTool.ts` — the `defineTool` factory.
- `src/tools/routing/defineViewportTool.ts` — the `defineViewportTool` factory.
- `src/tools/routing/index.ts` — subpath barrel.
- Tests alongside each (`.test.ts`).

**Modified:**

- All files using `applyBatch` → `applyOps` (~129 files across `src/`, `packages/`, `demo/`, `apps/`).
- `src/affordances/types.ts` — rename existing `HitResult` interface → `AffordanceBinding`.
- All call sites of the existing `HitResult` (~10 files) updated.
- `src/tools/types.ts` — add `target?: HitResult` to `ToolCtx`. Make optional in this phase so existing tools that don't read it aren't broken.
- `src/tools/dispatcher.ts` — populate `ctx.target` from the existing hit-test pipeline. Phase 1: a minimal `HitResult` (target.kind from adapter's existing node-kind hook if present; otherwise `'unknown'`).
- `src/index.ts` — re-export from `./tools/routing` under a subpath import path.
- `package.json` — add `./routing` to the `exports` map.
- `tsup.config.ts` (or equivalent build config) — add the routing subpath to the build output.

---

## Task 1: Rename `applyBatch` → `applyOps` (kit-wide)

**Files:**

- ~129 files across `src/`, `packages/`, `demo/`, `apps/`. Mechanical rename.

The `applyBatch(ops, label?)` method on adapters and the `ctx.applyBatch` field tools call both rename to `applyOps`. The standalone `dispatchApplyBatch` helper renames to `dispatchApplyOps`.

- [ ] **Step 1: Survey the scope**

```bash
cd /Users/mike/src/weasel
grep -rln "applyBatch\|dispatchApplyBatch" src/ packages/ demo/ apps/ --include="*.ts" --include="*.tsx" | wc -l
```

Expected: ~130 files. Note the count.

- [ ] **Step 2: Run the rename**

```bash
cd /Users/mike/src/weasel
# Use a tool-agnostic find/sed pair. macOS sed needs '' after -i.
find src/ packages/ demo/ apps/ \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/applyBatch/applyOps/g' {} \;
find src/ packages/ demo/ apps/ \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/dispatchApplyOps/dispatchApplyOps/g' {} \;
# (Second sed catches dispatchApplyBatch which the first already converted to
#  dispatchApplyOps — idempotent, just verifies.)
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Must be clean. If any remaining references to `applyBatch` exist (in markdown, JSDoc strings the regex missed, etc.), they'll surface as type errors or warnings.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Must pass. Existing 2475-test baseline must hold.

- [ ] **Step 5: Spot-check for incidental matches**

The string `applyBatch` is specific enough that incidental matches are unlikely, but check:

```bash
grep -rln "applyBatch" src/ packages/ demo/ apps/
```

Should return zero matches in code files. Markdown / docs may still mention `applyBatch` — those don't matter for the kit's runtime contract, but update if you spot them in the same pass.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(tools): rename applyBatch → applyOps kit-wide

Per spec docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md.
'Batch' wasn't load-bearing — Op[] is already plural in the type — and
the new spec uses 'ops' as the canonical word everywhere. Mechanical
find/replace; no semantic changes."
```

---

## Task 2: Rename existing `HitResult` → `AffordanceBinding`

**Files:**

- `src/affordances/types.ts` — rename the interface.
- ~10 files in `src/affordances/`, `src/canvas/`, `src/tools/`, `demo/`, etc. — import-site updates.
- `src/index.ts` — re-export name updates.

The existing `HitResult` interface (gesture-binding nominator) renames to free the better name for the new discriminated-union HitResult arriving in Task 3.

- [ ] **Step 1: Inspect the existing type**

```bash
cd /Users/mike/src/weasel
sed -n '30,45p' src/affordances/types.ts
grep -rln "HitResult" src/ packages/ demo/ apps/ --include="*.ts" --include="*.tsx"
```

Confirm the existing `HitResult<TScratch>` is at `src/affordances/types.ts:35` and identify all import sites.

- [ ] **Step 2: Rename in the source file**

In `src/affordances/types.ts`, change:

```ts
export interface HitResult<TScratch = unknown> {
  drag: DragChannel<TScratch>;
  initialScratch?: TScratch;
}
```

to:

```ts
export interface AffordanceBinding<TScratch = unknown> {
  drag: DragChannel<TScratch>;
  initialScratch?: TScratch;
}
```

- [ ] **Step 3: Update all import sites**

```bash
cd /Users/mike/src/weasel
find src/ packages/ demo/ apps/ \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/\bHitResult\b/AffordanceBinding/g' {} \;
```

Note: the existing `HitResult` is the ONLY use of that name in the codebase at this point (the new HitResult lands in Task 3). So a global rename is safe.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Clean expected.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Pass expected.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(affordances): rename HitResult → AffordanceBinding

Frees the name HitResult for the new discriminated-union type arriving
with declarative tool routing (spec
docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md).
The existing type is a gesture-binding nominator ('which drag channel
handles this hit?') and AffordanceBinding describes it more precisely."
```

---

## Task 3: New `HitResult` type module

**Files:**

- Create: `src/tools/routing/hitResult.ts`
- Create: `src/tools/routing/hitResult.test.ts`

The discriminated union the dispatcher produces and every routed action consumes.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/hitResult.test.ts
import { describe, it, expect } from 'vitest';
import type {
  HitResult,
  EmptyHit,
  NodeHit,
  AffordanceHit,
  NodeRef,
  NodeRefHit,
} from './hitResult';
import { asNodeId } from '../../core/scene/types';

describe('HitResult shapes', () => {
  it('EmptyHit narrows by category', () => {
    const h: HitResult = { category: 'empty', kind: 'empty' };
    if (h.category === 'empty') {
      const _kind: 'empty' = h.kind;   // narrows to literal
      expect(_kind).toBe('empty');
    }
  });

  it('NodeHit carries id / pose / data', () => {
    const h: HitResult = {
      category: 'node',
      kind: 'rect',
      id: asNodeId('a'),
      pose: { x: 0, y: 0, width: 1, height: 1 },
      data: { fill: 'red' },
    };
    if (h.category === 'node') {
      expect(h.id).toBe('a');
      expect(h.kind).toBe('rect');
    }
  });

  it('AffordanceHit carries id pointing at the affected node', () => {
    const h: HitResult = {
      category: 'affordance',
      kind: 'handle:bottom-right',
      id: asNodeId('a'),
      pose: { x: 0, y: 0, width: 1, height: 1 },
      data: { fill: 'red' },
      meta: { handle: 'bottom-right' },
    };
    if (h.category === 'affordance') {
      expect(h.id).toBe('a');
      expect(h.meta?.handle).toBe('bottom-right');
    }
  });

  it('NodeRefHit alias covers node + affordance, excludes empty', () => {
    const node: NodeRefHit = {
      category: 'node',
      kind: 'rect',
      id: asNodeId('a'),
      pose: {},
      data: {},
    };
    const aff: NodeRefHit = {
      category: 'affordance',
      kind: 'handle:bottom-right',
      id: asNodeId('a'),
      pose: {},
      data: {},
    };
    // Both have .id — the point of NodeRefHit.
    expect(node.id).toBe('a');
    expect(aff.id).toBe('a');
  });
});
```

- [ ] **Step 2: Verify test fails**

```bash
cd /Users/mike/src/weasel
npm test -- src/tools/routing/hitResult.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/hitResult.ts
import type { NodeId } from '../../core/scene/types';

/** Common payload for any hit that references a scene node. */
export interface NodeRef {
  id: NodeId;
  pose: unknown;       // cast at use site (matches adapter: unknown convention)
  data: unknown;       // cast at use site
  meta?: Record<string, unknown>;
}

/** No hit — pointer landed on the background. */
export interface EmptyHit {
  category: 'empty';
  kind: 'empty';
}

/** Hit on a scene node's body. */
export interface NodeHit extends NodeRef {
  category: 'node';
  kind: string;        // 'rect', 'rect:selected', 'text', etc.
}

/** Hit on a node's affordance chrome (handle, anchor, etc.). */
export interface AffordanceHit extends NodeRef {
  category: 'affordance';
  kind: string;        // 'handle:bottom-right', 'anchor:first', etc.
}

/** Full discriminated union — every routed action's `ctx.target`. */
export type HitResult = EmptyHit | NodeHit | AffordanceHit;

/** Convenience: any hit that references a node (i.e., not EmptyHit). */
export type NodeRefHit = NodeHit | AffordanceHit;
```

- [ ] **Step 4: Verify test passes**

```bash
npm test -- src/tools/routing/hitResult.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/tools/routing/hitResult.ts src/tools/routing/hitResult.test.ts
git commit -m "feat(tools): HitResult discriminated union for declarative routing

Three categories: EmptyHit (no hit), NodeHit (node body), AffordanceHit
(node chrome). Shared NodeRef base for the two node-referencing
categories so ctx.target.id works uniformly without category-branching.
NodeRefHit alias covers node + affordance, excludes empty."
```

---

## Task 4: Extend `ToolCtx` with `target: HitResult`

**Files:**

- Modify: `src/tools/types.ts`
- Modify: `src/tools/dispatcher.ts`

The dispatcher populates `ctx.target` during event dispatch. Phase 1 ships a minimal classifier: target kind comes from the existing hit-test pipeline (adapter's node-kind hook if present; `'unknown'` otherwise for nodes; `'empty'` for misses).

- [ ] **Step 1: Add the field to ToolCtx (optional)**

In `src/tools/types.ts`, find the `ToolCtx` interface and add:

```ts
import type { HitResult } from './routing/hitResult';

// ... existing fields ...

  /** Hit-test result for the current event. Populated by the dispatcher
   *  before each handler call. Tools that don't use declarative routing
   *  can ignore this. Optional in Phase 1 for migration; will become
   *  required once the routing migration is complete. */
  target?: HitResult;
```

(Place it after `modifiers`.)

- [ ] **Step 2: Inspect dispatcher's hit-test path**

```bash
cd /Users/mike/src/weasel
grep -n "hitTest\|affordanceHit\|onClick\|onTap" src/tools/dispatcher.ts | head -20
```

Identify where the dispatcher currently runs hit-tests before calling tool handlers. The target population happens there.

- [ ] **Step 3: Populate `target` in the dispatcher**

In `src/tools/dispatcher.ts`, wherever the dispatcher builds a `ToolCtx` for an event, populate `target` from the existing hit-test result. Concrete shape:

```ts
function buildTarget(hit: AdapterHit | AffordanceBinding | null, adapter: unknown): HitResult {
  if (hit == null) return { category: 'empty', kind: 'empty' };
  // ... existing logic to determine what was hit ...
  // For affordance hits:
  if (isAffordanceHit(hit)) {
    return {
      category: 'affordance',
      kind: hit.affordanceKind ?? 'unknown',
      id: hit.targetId,
      pose: ..., data: ..., meta: hit.meta,
    };
  }
  // For node hits:
  return {
    category: 'node',
    kind: (adapter as { kindOf?: (id: NodeId) => string }).kindOf?.(hit.nodeId) ?? 'unknown',
    id: hit.nodeId,
    pose: hit.pose, data: hit.data,
  };
}
```

Adjust the exact shape based on what the existing dispatcher produces. The key insight: ctx.target is populated for every event, even if the tool doesn't read it.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Clean.

- [ ] **Step 5: Run tests**

```bash
npm test
```

No regressions. Existing tools don't read `ctx.target`, so their behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/tools/types.ts src/tools/dispatcher.ts
git commit -m "feat(tools): populate ctx.target with HitResult during dispatch

ToolCtx gains an optional `target: HitResult` field. The dispatcher
builds it from the existing hit-test pipeline before each handler
call. Existing imperative tools don't read it and are unaffected.
Required for the declarative routing factory arriving in subsequent
tasks. kindOf optional on adapter — kit doesn't own the node-kind
taxonomy, consumers register the classifier."
```

---

## Task 5: `Result` union + action constructors

**Files:**

- Create: `src/tools/routing/result.ts`
- Create: `src/tools/routing/result.test.ts`

The seven action result kinds (`apply`/`begin`/`hold`/`commit`/`cancel`/`claim`/`none`) and their constructor functions.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/result.test.ts
import { describe, it, expect } from 'vitest';
import {
  apply, begin, hold, commit, cancel, claim, none,
  type Result, type BeginSpec,
} from './result';

describe('action constructors', () => {
  it('apply tags ops and label', () => {
    const r = apply([], 'Insert');
    expect(r).toEqual({ kind: 'apply', ops: [], label: 'Insert' });
  });

  it('apply without label', () => {
    const r = apply([]);
    expect(r).toEqual({ kind: 'apply', ops: [] });
  });

  it('begin tags BeginSpec', () => {
    const spec: BeginSpec<{ x: number }> = { scratch: { x: 1 } };
    const r = begin(spec);
    expect(r).toEqual({ kind: 'begin', spec: { scratch: { x: 1 } } });
  });

  it('hold tags new scratch', () => {
    const r = hold({ x: 2 });
    expect(r).toEqual({ kind: 'hold', scratch: { x: 2 } });
  });

  it('commit tags ops and label', () => {
    const r = commit([], 'Done');
    expect(r).toEqual({ kind: 'commit', ops: [], label: 'Done' });
  });

  it('cancel takes no args', () => {
    const r = cancel();
    expect(r).toEqual({ kind: 'cancel' });
  });

  it('claim takes no args', () => {
    const r = claim();
    expect(r).toEqual({ kind: 'claim' });
  });

  it('none takes no args', () => {
    const r = none();
    expect(r).toEqual({ kind: 'none' });
  });

  it('Result union discriminates correctly', () => {
    const r: Result<{ x: number }> = apply([]);
    switch (r.kind) {
      case 'apply':  break;
      case 'begin':  break;
      case 'hold':   break;
      case 'commit': break;
      case 'cancel': break;
      case 'claim':  break;
      case 'none':   break;
    }
    // No further assertion — exhaustiveness check is compile-time.
    expect(r.kind).toBe('apply');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- src/tools/routing/result.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/result.ts
import type { Op } from '../../core/ops/types';
import type { ToolCtx } from '../types';

/** Returned from a continuation closure or action handler. */
export type Result<TScratch> =
  | { kind: 'apply';  ops: Op[]; label?: string }
  | { kind: 'begin';  spec: BeginSpec<TScratch> }
  | { kind: 'hold';   scratch: TScratch }
  | { kind: 'commit'; ops: Op[]; label?: string }
  | { kind: 'cancel' }
  | { kind: 'claim' }
  | { kind: 'none' };

/** Spec for `begin()` — opens engaged phase with continuation handlers. */
export interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;
  onMove?:    (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>) => void | Result<TScratch>;
}

export function apply<TScratch>(ops: Op[], label?: string): Result<TScratch> {
  return label !== undefined
    ? { kind: 'apply', ops, label }
    : { kind: 'apply', ops };
}

export function begin<TScratch>(spec: BeginSpec<TScratch>): Result<TScratch> {
  return { kind: 'begin', spec };
}

export function hold<TScratch>(scratch: TScratch): Result<TScratch> {
  return { kind: 'hold', scratch };
}

export function commit<TScratch>(ops: Op[], label?: string): Result<TScratch> {
  return label !== undefined
    ? { kind: 'commit', ops, label }
    : { kind: 'commit', ops };
}

export function cancel<TScratch>(): Result<TScratch> {
  return { kind: 'cancel' };
}

export function claim<TScratch>(): Result<TScratch> {
  return { kind: 'claim' };
}

export function none<TScratch>(): Result<TScratch> {
  return { kind: 'none' };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- src/tools/routing/result.test.ts
```

Expected: 9 tests PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/tools/routing/result.ts src/tools/routing/result.test.ts
git commit -m "feat(tools): Result union + action constructors for routing

Seven Result variants: apply / begin / hold / commit / cancel / claim /
none. Constructor functions produce the tagged shapes. BeginSpec
carries scratch + thresholdPx + onMove/onRelease/onCancel continuation
closures."
```

---

## Task 6: `ModifierKey` + `mods()` helper

**Files:**

- Create: `src/tools/routing/modifiers.ts`
- Create: `src/tools/routing/modifiers.test.ts`

The 8-key modifier sub-table key type and the order-canonicalizing helper.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/modifiers.test.ts
import { describe, it, expect } from 'vitest';
import { mods, type ModifierKey } from './modifiers';

describe('mods() helper', () => {
  it('no args returns "default"', () => {
    expect(mods()).toBe('default');
  });

  it('single modifier returns that key', () => {
    expect(mods('mod')).toBe('mod');
    expect(mods('shift')).toBe('shift');
    expect(mods('alt')).toBe('alt');
  });

  it('canonicalizes order regardless of input order', () => {
    expect(mods('alt', 'shift')).toBe('shift+alt');
    expect(mods('shift', 'alt')).toBe('shift+alt');
    expect(mods('shift', 'mod')).toBe('mod+shift');
    expect(mods('mod', 'shift')).toBe('mod+shift');
    expect(mods('alt', 'mod')).toBe('mod+alt');
  });

  it('three modifiers in any order canonicalize', () => {
    expect(mods('alt', 'shift', 'mod')).toBe('mod+shift+alt');
    expect(mods('mod', 'shift', 'alt')).toBe('mod+shift+alt');
    expect(mods('shift', 'alt', 'mod')).toBe('mod+shift+alt');
  });

  it('duplicates collapse', () => {
    // Set semantics — passing 'shift' twice is the same as once.
    expect(mods('shift', 'shift')).toBe('shift');
  });

  it('ModifierKey type accepts only valid keys (compile-time check)', () => {
    const valid: ModifierKey[] = [
      'default',
      'mod', 'shift', 'alt',
      'mod+shift', 'mod+alt', 'shift+alt',
      'mod+shift+alt',
    ];
    expect(valid).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
npm test -- src/tools/routing/modifiers.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/modifiers.ts

/** All valid keys for a modifier sub-table in a route entry. Canonical
 *  order: mod → shift → alt (matches formatShortcut). */
export type ModifierKey =
  | 'default'
  | 'mod' | 'shift' | 'alt'
  | 'mod+shift' | 'mod+alt' | 'shift+alt'
  | 'mod+shift+alt';

/** Convenience: produce the canonical ModifierKey from modifiers passed
 *  in any order. Useful in computed property syntax:
 *
 *      'rect': {
 *        [mods('shift')]:        addToSelection,
 *        [mods('alt', 'shift')]: cloneAndAdd,    // → 'shift+alt'
 *      }
 */
export function mods(
  ...keys: ReadonlyArray<'mod' | 'shift' | 'alt'>
): ModifierKey {
  if (keys.length === 0) return 'default';
  const set = new Set(keys);
  return [
    set.has('mod')   && 'mod',
    set.has('shift') && 'shift',
    set.has('alt')   && 'alt',
  ].filter(Boolean).join('+') as ModifierKey;
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- src/tools/routing/modifiers.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/modifiers.ts src/tools/routing/modifiers.test.ts
git commit -m "feat(tools): ModifierKey union + mods() helper

8 canonical keys (default + 3 singles + 3 pairs + 1 triple). Canonical
order: mod → shift → alt. mods() takes modifiers in any order and
returns the canonical key, intended for computed-property syntax in
route sub-tables."
```

---

## Task 7: `ToolDef` / `PhaseDef` / `RouteTable` types

**Files:**

- Create: `src/tools/routing/types.ts`

Pure type module. No test file — the types are exercised by Task 8's lookup engine and Task 9's factory.

- [ ] **Step 1: Write the type module**

```ts
// src/tools/routing/types.ts
import type { ReactNode } from 'react';
import type { ToolCtx, ToolPresentation } from '../types';
import type { KeyBinding } from '../../interactions/actions/useKeybinding';
import type { RenderLayer } from '../../core/layers/render';
import type { Result } from './result';
import type { ModifierKey } from './modifiers';

export type ActionFn<TScratch> = (ctx: ToolCtx<TScratch>) => Result<TScratch>;

export type ModifierRoute<TScratch> = Partial<Record<ModifierKey, ActionFn<TScratch>>>;

export type RouteEntry<TScratch> = ActionFn<TScratch> | ModifierRoute<TScratch>;

export type RouteTable<TScratch> = Partial<Record<string, RouteEntry<TScratch>>>;

export interface PhaseDef<TScratch> {
  click?:   RouteTable<TScratch>;
  dblTap?:  RouteTable<TScratch>;
  drag?:    RouteTable<TScratch> | ActionFn<TScratch>;
  wheel?:   ActionFn<TScratch>;
  keyDown?: Record<string, ActionFn<TScratch>>;
  keyUp?:   Record<string, ActionFn<TScratch>>;
  cursor?:  string | ((ctx: ToolCtx<TScratch>) => string);
  overlay?: (ctx: ToolCtx<TScratch>) => RenderLayer<unknown>;
  claimsAll?: boolean;
}

export interface ToolDef<TScratch = void> {
  id: string;
  presentation?: ToolPresentation<TScratch>;
  keybinding?: KeyBinding;
  onActivate?:   (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  initial: PhaseDef<TScratch>;
  engaged?: PhaseDef<TScratch>;
}

/** Viewport-tool spec — strict subset of ToolDef. Drops click/dblTap,
 *  narrows drag to plain ActionFn. Mechanically derived via Pick/Omit
 *  so the subset relationship is compiler-enforced. */
export type ViewportPhaseDef<TScratch = void> = Pick<
  PhaseDef<TScratch>, 'wheel' | 'keyDown' | 'keyUp' | 'cursor' | 'overlay' | 'claimsAll'
> & {
  drag?: ActionFn<TScratch>;
};

export type ViewportToolDef<TScratch = void> = Omit<
  ToolDef<TScratch>, 'initial' | 'engaged'
> & {
  initial: ViewportPhaseDef<TScratch>;
  engaged?: ViewportPhaseDef<TScratch>;
};
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/mike/src/weasel && npm run typecheck
```

Clean.

- [ ] **Step 3: Commit**

```bash
git add src/tools/routing/types.ts
git commit -m "feat(tools): ToolDef / PhaseDef / RouteTable types for routing

Phase 1 routing types module. ToolDef carries id + presentation +
keybinding + lifecycle hooks + cursor + initial/engaged phases.
PhaseDef holds gesture route tables, cursor override, overlay slot,
claimsAll. ViewportToolDef mechanically derived as strict subset
(drops click/dblTap, narrows drag)."
```

---

## Task 8: Route lookup engine

**Files:**

- Create: `src/tools/routing/lookup.ts`
- Create: `src/tools/routing/lookup.test.ts`

Pure function that takes `(routeTable, hitResult, modifiers)` and returns the matching `ActionFn` (or undefined). Encapsulates the four-level target lookup + modifier sub-table resolution.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/lookup.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveRoute } from './lookup';
import type { RouteTable, ActionFn } from './types';
import type { HitResult } from './hitResult';
import { asNodeId } from '../../core/scene/types';

const noMods = { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false };

function nodeHit(kind: string): HitResult {
  return { category: 'node', kind, id: asNodeId('a'), pose: {}, data: {} };
}

describe('resolveRoute target precedence', () => {
  it('exact kind wins', () => {
    const exact = vi.fn();
    const base  = vi.fn();
    const star  = vi.fn();
    const table: RouteTable<void> = {
      'rect:selected': exact as ActionFn<void>,
      'rect':          base  as ActionFn<void>,
      '*':             star  as ActionFn<void>,
    };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(exact);
  });

  it('subkind wildcard beats base-kind', () => {
    const subWild = vi.fn();
    const base    = vi.fn();
    const table: RouteTable<void> = {
      '*:selected': subWild as ActionFn<void>,
      'rect':       base    as ActionFn<void>,
    };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(subWild);
  });

  it('base-kind falls back when no subkind wildcard', () => {
    const base = vi.fn();
    const table: RouteTable<void> = { 'rect': base as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(base);
  });

  it('universal * falls back last', () => {
    const star = vi.fn();
    const table: RouteTable<void> = { '*': star as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(star);
  });

  it('empty kind does not fall through to *', () => {
    const star = vi.fn();
    const table: RouteTable<void> = { '*': star as ActionFn<void> };
    const empty: HitResult = { category: 'empty', kind: 'empty' };
    expect(resolveRoute(table, empty, noMods)).toBeUndefined();
  });

  it('returns undefined when no match', () => {
    const table: RouteTable<void> = { 'text': vi.fn() as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect'), noMods)).toBeUndefined();
  });
});

describe('resolveRoute modifier sub-tables', () => {
  it('exact modifier combo wins', () => {
    const shiftAlt = vi.fn();
    const def      = vi.fn();
    const table: RouteTable<void> = {
      'rect': {
        default:     def      as ActionFn<void>,
        'shift+alt': shiftAlt as ActionFn<void>,
      },
    };
    expect(resolveRoute(table, nodeHit('rect'), { ...noMods, shift: true, alt: true })).toBe(shiftAlt);
  });

  it('falls back to default when no modifier match', () => {
    const def = vi.fn();
    const table: RouteTable<void> = {
      'rect': { default: def as ActionFn<void>, shift: vi.fn() as ActionFn<void> },
    };
    expect(resolveRoute(table, nodeHit('rect'), { ...noMods, alt: true })).toBe(def);
  });

  it('function-form route entry ignores modifiers', () => {
    const fn = vi.fn();
    const table: RouteTable<void> = { 'rect': fn as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect'), { ...noMods, shift: true })).toBe(fn);
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
npm test -- src/tools/routing/lookup.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/tools/routing/lookup.ts
import type { ActionFn, RouteTable, RouteEntry, ModifierRoute } from './types';
import type { HitResult } from './hitResult';
import type { ToolModifiers } from '../types';
import { mods, type ModifierKey } from './modifiers';

/** Resolve a route entry to an ActionFn (or undefined) given the current
 *  hit-test result and modifier snapshot. Implements the four-level
 *  target precedence (exact → subkind-wildcard → base-kind → universal)
 *  and the modifier sub-table exact-match + 'default' fallback. */
export function resolveRoute<TScratch>(
  table: RouteTable<TScratch>,
  hit: HitResult,
  modifiers: ToolModifiers,
): ActionFn<TScratch> | undefined {
  const candidateKeys = buildCandidateKeys(hit);
  for (const key of candidateKeys) {
    const entry = table[key];
    if (entry == null) continue;
    const resolved = resolveEntry(entry, modifiers);
    if (resolved) return resolved;
  }
  return undefined;
}

/** Produce the ordered list of route-table keys to try for `hit`. */
function buildCandidateKeys(hit: HitResult): string[] {
  if (hit.category === 'empty') return ['empty'];
  const kind = hit.kind;
  const colon = kind.indexOf(':');
  if (colon < 0) {
    // No subkind — try exact then universal.
    return [kind, '*'];
  }
  const baseKind = kind.substring(0, colon);
  const subKind = kind.substring(colon + 1);
  // Order: exact → subkind-wildcard → base-kind → universal.
  return [kind, `*:${subKind}`, baseKind, '*'];
}

/** Resolve a RouteEntry (function or sub-table) using modifiers. */
function resolveEntry<TScratch>(
  entry: RouteEntry<TScratch>,
  modifiers: ToolModifiers,
): ActionFn<TScratch> | undefined {
  if (typeof entry === 'function') return entry;
  const subTable = entry as ModifierRoute<TScratch>;
  const wanted = modifiersToKey(modifiers);
  return subTable[wanted] ?? subTable.default;
}

/** Translate the runtime ToolModifiers snapshot to the canonical
 *  ModifierKey for sub-table lookup. */
function modifiersToKey(modifiers: ToolModifiers): ModifierKey {
  const active: Array<'mod' | 'shift' | 'alt'> = [];
  // 'mod' is the platform-natural primary modifier:
  // Cmd on Mac (meta), Ctrl elsewhere.
  if (modifiers.meta || modifiers.ctrl) active.push('mod');
  if (modifiers.shift) active.push('shift');
  if (modifiers.alt) active.push('alt');
  return mods(...active);
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- src/tools/routing/lookup.test.ts
```

Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/lookup.ts src/tools/routing/lookup.test.ts
git commit -m "feat(tools): resolveRoute — route table lookup engine

Pure function. Takes (table, hit, modifiers), returns the matching
ActionFn or undefined. Implements four-level target precedence
(exact → subkind-wildcard → base-kind → universal) and modifier
sub-table exact-match with 'default' fallback. Empty hits don't fall
through to '*'."
```

---

## Task 9: `defineTool` factory

**Files:**

- Create: `src/tools/routing/defineTool.ts`
- Create: `src/tools/routing/defineTool.test.ts`

The factory that translates a `ToolDef<TScratch>` into the existing imperative `Tool<TScratch>`. The dispatcher continues to consume imperative tools; the translation bridges declarative authoring to that pipeline.

Substantial task — split into multiple steps. Translation responsibilities:

- `click` route table → `pointer.onClick` handler
- `dblTap` route table → `dblTap.onTap` handler
- `drag` (table or function) → `drag.onStart/onMove/onEnd/onCancel` handlers managing scratch & engaged phase
- `keyDown` / `keyUp` → `keyboard.onDown` / `keyboard.onUp`
- `wheel` → `wheel.onWheel`
- `cursor` (top-level + phase override) → `tool.cursor` as function-of-ctx
- `claimsAll` → `tool.claimsAll`
- `overlay` → `tool.overlay`
- `onActivate` / `onDeactivate` → pass through

Phase state lives in scratch — when scratch is non-null, the tool is engaged; the translation reads the engaged phase's route tables instead of initial.

- [ ] **Step 1: Write failing tests covering the main translation paths**

```ts
// src/tools/routing/defineTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { defineTool } from './defineTool';
import { apply, begin, hold, commit, cancel, claim } from './result';
import { asNodeId } from '../../core/scene/types';
import type { Op } from '../../core/ops/types';

const noMods = { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false };
const stubOp: Op = { apply: () => {}, invert: () => stubOp };

function buildCtx(overrides: Record<string, unknown> = {}) {
  return {
    worldX: 0, worldY: 0,
    point: { x: 0, y: 0 },
    modifiers: noMods,
    selection: { current: [] as unknown },
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: vi.fn(),
    canvasRect: { left: 0, top: 0, width: 100, height: 100 } as DOMRect,
    target: { category: 'empty' as const, kind: 'empty' as const },
    scratch: null,
    ...overrides,
  };
}

describe('defineTool — basic translation', () => {
  it('produces a Tool with id and presentation', () => {
    const tool = defineTool({
      id: 'test',
      presentation: { label: 'Test', group: 'select' },
      initial: {},
    });
    expect(tool.id).toBe('test');
    expect(tool.presentation?.label).toBe('Test');
  });

  it('phase-free click action fires apply', () => {
    const tool = defineTool({
      id: 'test',
      initial: {
        click: { '*': () => apply([stubOp], 'Test') },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(ctx.applyOps).toHaveBeenCalledWith([stubOp], 'Test');
  });

  it('begin opens engaged phase by setting scratch', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({ scratch: { x: 1 } }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ x: 1 });
  });

  it('hold updates scratch within engaged', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { x: 1 },
          onMove: (ctx) => hold({ x: ctx.scratch.x + 1 }),
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    tool.drag?.onMove?.(new MouseEvent('mousemove') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: { x: number } }).scratch).toEqual({ x: 2 });
  });

  it('commit applies ops and closes engaged', () => {
    const tool = defineTool<{ done: boolean }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { done: false },
          onRelease: () => commit([stubOp], 'Done'),
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    tool.drag?.onEnd?.(new MouseEvent('mouseup') as unknown as PointerEvent, ctx as never);
    expect(ctx.applyOps).toHaveBeenCalledWith([stubOp], 'Done');
    expect((ctx as { scratch: unknown }).scratch).toBeNull();
  });

  it('cancel closes engaged without applying', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { x: 1 },
          onCancel: () => undefined,
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    tool.drag?.onCancel?.(ctx as never);
    expect(ctx.applyOps).not.toHaveBeenCalled();
    expect((ctx as { scratch: unknown }).scratch).toBeNull();
  });

  it('engaged.click routes when scratch is set', () => {
    const onAnchorClick = vi.fn(() => apply([stubOp]));
    const tool = defineTool<{ anchors: number[] }>({
      id: 'pen',
      initial: {
        click: { 'empty': () => begin({ scratch: { anchors: [0] } }) },
      },
      engaged: {
        click: { '*': onAnchorClick },
      },
    });
    const ctx = buildCtx();
    // First click opens engaged phase
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ anchors: [0] });
    // Second click — now engaged, routes through engaged.click
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(onAnchorClick).toHaveBeenCalledTimes(1);
  });

  it('cursor resolves with phase override', () => {
    const tool = defineTool<{ x: number }>({
      id: 'test',
      cursor: 'grab',
      engaged: { cursor: 'grabbing' },
      initial: { drag: () => begin({ scratch: { x: 0 } }) },
    });
    const ctx = buildCtx();
    // Idle: top-level cursor
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grab');
    // Open engaged phase
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    // Engaged: phase cursor override
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grabbing');
  });

  it('claim suppresses fall-through', () => {
    const tool = defineTool({
      id: 'test',
      initial: { click: { '*': () => claim() } },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const result = tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(result).toBe('claim');
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
npm test -- src/tools/routing/defineTool.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement the factory**

```ts
// src/tools/routing/defineTool.ts
import type { Tool, ToolCtx, ToolModifiers } from '../types';
import type { ToolDef, PhaseDef, ActionFn } from './types';
import type { Result } from './result';
import { resolveRoute } from './lookup';

/** Translate a declarative `ToolDef<TScratch>` into the existing imperative
 *  `Tool<TScratch>` shape. The dispatcher consumes the resulting Tool as
 *  it does today; declarative authoring is the only change. */
export function defineTool<TScratch = void>(
  def: ToolDef<TScratch>,
): Tool<TScratch> {
  // Phase state derives from ctx.scratch presence: scratch !== null means
  // engaged. The translated handlers consult def.engaged when scratch is
  // set, def.initial otherwise.
  const phaseOf = (ctx: ToolCtx<TScratch>): PhaseDef<TScratch> => {
    return ctx.scratch != null && def.engaged ? def.engaged : def.initial;
  };

  // Apply a Result by mutating ctx and/or dispatching ops. Returns the
  // dispatch decision ('claim' or 'pass') based on whether the handler
  // produced an effect.
  const applyResult = (
    ctx: ToolCtx<TScratch>,
    result: Result<TScratch> | void,
  ): 'claim' | 'pass' => {
    if (result == null) return 'pass';
    switch (result.kind) {
      case 'apply':
        ctx.applyOps(result.ops, result.label);
        return 'claim';
      case 'begin': {
        // Open engaged: install scratch, store continuation closures
        // on the scratch so onMove/onRelease/onCancel can read them.
        const scratchWithSpec = { ...result.spec.scratch, __beginSpec: result.spec };
        (ctx as { scratch: unknown }).scratch = scratchWithSpec;
        return 'claim';
      }
      case 'hold':
        // Preserve __beginSpec from existing scratch so continuations stay wired.
        (ctx as { scratch: unknown }).scratch = {
          ...result.scratch,
          __beginSpec: (ctx.scratch as { __beginSpec?: unknown })?.__beginSpec,
        };
        return 'claim';
      case 'commit':
        ctx.applyOps(result.ops, result.label);
        (ctx as { scratch: unknown }).scratch = null;
        return 'claim';
      case 'cancel':
        (ctx as { scratch: unknown }).scratch = null;
        return 'claim';
      case 'claim':
        return 'claim';
      case 'none':
        return 'pass';
    }
  };

  // Build pointer.onClick handler from click route table.
  const onClick = def.initial.click || def.engaged?.click
    ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
        const phase = phaseOf(ctx);
        if (!phase.click) return 'pass';
        const action = resolveRoute(phase.click, ctx.target!, ctx.modifiers);
        if (!action) return 'pass';
        return applyResult(ctx, action(ctx));
      }
    : undefined;

  // Build drag handlers. drag can be either a route table or a function.
  const dragRoute = def.initial.drag;
  const onDragStart = dragRoute
    ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
        const action = typeof dragRoute === 'function'
          ? dragRoute
          : resolveRoute(dragRoute, ctx.target!, ctx.modifiers);
        if (!action) return 'pass';
        return applyResult(ctx, action(ctx));
      }
    : undefined;

  const onDragMove = (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const spec = (ctx.scratch as { __beginSpec?: { onMove?: ActionFn<TScratch> } })?.__beginSpec;
    if (!spec?.onMove) return 'pass';
    return applyResult(ctx, spec.onMove(ctx));
  };

  const onDragEnd = (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const spec = (ctx.scratch as { __beginSpec?: { onRelease?: ActionFn<TScratch> } })?.__beginSpec;
    if (!spec?.onRelease) {
      // No explicit onRelease — close engaged without applying.
      (ctx as { scratch: unknown }).scratch = null;
      return 'claim';
    }
    return applyResult(ctx, spec.onRelease(ctx));
  };

  const onDragCancel = (ctx: ToolCtx<TScratch>): void => {
    const spec = (ctx.scratch as { __beginSpec?: { onCancel?: ActionFn<TScratch> } })?.__beginSpec;
    if (spec?.onCancel) {
      const r = spec.onCancel(ctx);
      if (r) applyResult(ctx, r);
    }
    (ctx as { scratch: unknown }).scratch = null;
  };

  // Keyboard / wheel handlers — straightforward route lookups.
  const buildKeyHandler = (
    pick: (phase: PhaseDef<TScratch>) => Record<string, ActionFn<TScratch>> | undefined,
  ) => (e: KeyboardEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
    const table = pick(phaseOf(ctx));
    if (!table) return 'pass';
    const action = table[e.key];
    if (!action) return 'pass';
    return applyResult(ctx, action(ctx));
  };

  // cursor: phase override beats top-level.
  const resolveCursor = (ctx: ToolCtx<TScratch>): string | undefined => {
    const phaseCursor = phaseOf(ctx).cursor;
    if (phaseCursor != null) {
      return typeof phaseCursor === 'function' ? phaseCursor(ctx) : phaseCursor;
    }
    if (def.cursor != null) {
      return typeof def.cursor === 'function' ? def.cursor(ctx) : def.cursor;
    }
    return undefined;
  };

  // claimsAll lives on the engaged phase, optionally.
  const claimsAll = (ctx: ToolCtx<TScratch>): boolean => {
    return phaseOf(ctx).claimsAll === true;
  };

  return {
    id: def.id,
    presentation: def.presentation,
    keybinding: def.keybinding,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    initScratch: () => null as unknown as TScratch,
    cursor: resolveCursor,
    claimsAll,
    pointer: onClick ? { onClick } : undefined,
    drag: onDragStart ? {
      onStart: onDragStart,
      onMove: onDragMove,
      onEnd: onDragEnd,
      onCancel: onDragCancel,
    } : undefined,
    dblTap: def.initial.dblTap || def.engaged?.dblTap
      ? {
          onTap: (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
            const table = phaseOf(ctx).dblTap;
            if (!table) return 'pass';
            const action = resolveRoute(table, ctx.target!, ctx.modifiers);
            if (!action) return 'pass';
            return applyResult(ctx, action(ctx));
          },
        }
      : undefined,
    keyboard: (def.initial.keyDown || def.engaged?.keyDown || def.initial.keyUp || def.engaged?.keyUp)
      ? {
          onDown: buildKeyHandler((p) => p.keyDown),
          onUp:   buildKeyHandler((p) => p.keyUp),
        }
      : undefined,
    wheel: def.initial.wheel || def.engaged?.wheel
      ? {
          onWheel: (_e: WheelEvent, ctx: ToolCtx<TScratch>) => {
            const action = phaseOf(ctx).wheel;
            if (!action) return 'pass';
            return applyResult(ctx, action(ctx));
          },
        }
      : undefined,
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- src/tools/routing/defineTool.test.ts
```

Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/defineTool.ts src/tools/routing/defineTool.test.ts
git commit -m "feat(tools): defineTool factory — declarative → imperative translation

Translates ToolDef<TScratch> into the existing Tool<TScratch> shape.
The dispatcher consumes the result as-is; only the authoring surface
changes. Phase state derives from ctx.scratch presence (non-null =
engaged); route tables dispatched against either initial or engaged
based on phase. begin/hold/commit/cancel/claim/apply/none all wire
to ctx.applyOps and scratch mutations appropriately."
```

---

## Task 10: `defineViewportTool` factory

**Files:**

- Create: `src/tools/routing/defineViewportTool.ts`
- Create: `src/tools/routing/defineViewportTool.test.ts`

Simpler than `defineTool` — no route tables, only handler-form gestures.

- [ ] **Step 1: Write the failing test**

```ts
// src/tools/routing/defineViewportTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { defineViewportTool } from './defineViewportTool';
import { begin, hold, cancel } from './result';

const noMods = { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false };

function buildCtx(overrides: Record<string, unknown> = {}) {
  return {
    worldX: 0, worldY: 0,
    point: { x: 0, y: 0 },
    modifiers: noMods,
    selection: { current: [] },
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: vi.fn(),
    canvasRect: { left: 0, top: 0, width: 100, height: 100 } as DOMRect,
    target: { category: 'empty' as const, kind: 'empty' as const },
    scratch: null,
    ...overrides,
  };
}

describe('defineViewportTool', () => {
  it('produces a Tool with id', () => {
    const tool = defineViewportTool({
      id: 'hand',
      initial: {},
    });
    expect(tool.id).toBe('hand');
  });

  it('function-form drag fires on pointerdown', () => {
    const tool = defineViewportTool<{ x: number }>({
      id: 'hand',
      initial: {
        drag: (ctx) => begin({
          scratch: { x: ctx.point.x },
          onMove: (ctx) => hold({ x: ctx.point.x + 1 }),
          onRelease: cancel,
        }),
      },
    });
    const ctx = buildCtx({ point: { x: 5, y: 0 } });
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ x: 5 });
  });

  it('cursor resolution works with phase override', () => {
    const tool = defineViewportTool<{ x: number }>({
      id: 'hand',
      cursor: 'grab',
      engaged: { cursor: 'grabbing' },
      initial: { drag: () => begin({ scratch: { x: 0 } }) },
    });
    const ctx = buildCtx();
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grab');
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grabbing');
  });
});
```

- [ ] **Step 2: Verify fail**

```bash
npm test -- src/tools/routing/defineViewportTool.test.ts
```

- [ ] **Step 3: Implement**

`defineViewportTool` shares most of `defineTool`'s translation logic — the only difference is that route tables are forbidden on viewport tools. The cleanest implementation delegates to `defineTool` after adapting the spec.

```ts
// src/tools/routing/defineViewportTool.ts
import type { Tool } from '../types';
import type { ViewportToolDef, PhaseDef, ActionFn } from './types';
import { defineTool } from './defineTool';

/** Translate a viewport-tool spec. Viewport tools have no targets,
 *  so route tables aren't allowed — drag is a function-form ActionFn.
 *  This factory delegates to defineTool after lifting the ViewportPhaseDef
 *  shape to the more permissive PhaseDef shape (which accepts both
 *  function-form and route-table drags). */
export function defineViewportTool<TScratch = void>(
  def: ViewportToolDef<TScratch>,
): Tool<TScratch> {
  const liftPhase = (phase: ViewportToolDef<TScratch>['initial']): PhaseDef<TScratch> => ({
    wheel: phase.wheel,
    keyDown: phase.keyDown,
    keyUp: phase.keyUp,
    cursor: phase.cursor,
    overlay: phase.overlay,
    claimsAll: phase.claimsAll,
    drag: phase.drag as ActionFn<TScratch> | undefined,
  });

  return defineTool<TScratch>({
    id: def.id,
    presentation: def.presentation,
    keybinding: def.keybinding,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    cursor: def.cursor,
    initial: liftPhase(def.initial),
    engaged: def.engaged ? liftPhase(def.engaged) : undefined,
  });
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- src/tools/routing/defineViewportTool.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/defineViewportTool.ts src/tools/routing/defineViewportTool.test.ts
git commit -m "feat(tools): defineViewportTool factory

Restricted variant of defineTool. No click/dblTap route tables (drops
those via ViewportPhaseDef Pick); drag is function-form only. Internally
delegates to defineTool after lifting ViewportPhaseDef to PhaseDef. The
factory's value is the authoring-time constraint: a ViewportToolDef
literally cannot include click or dblTap routes (compile error)."
```

---

## Task 11: Routing subpath barrel + main index re-exports

**Files:**

- Create: `src/tools/routing/index.ts`
- Modify: `src/index.ts`
- Modify: `package.json` (add `./routing` to `exports` map)
- Verify: `tsup.config.ts` (or equivalent build config — kit's build needs to emit the routing subpath)

- [ ] **Step 1: Create the routing barrel**

```ts
// src/tools/routing/index.ts
export type {
  HitResult, EmptyHit, NodeHit, AffordanceHit, NodeRef, NodeRefHit,
} from './hitResult';
export type { Result, BeginSpec } from './result';
export { apply, begin, hold, commit, cancel, claim, none } from './result';
export type { ModifierKey } from './modifiers';
export { mods } from './modifiers';
export type {
  ToolDef, PhaseDef, RouteTable, RouteEntry, ModifierRoute, ActionFn,
  ViewportToolDef, ViewportPhaseDef,
} from './types';
export { resolveRoute } from './lookup';
export { defineTool } from './defineTool';
export { defineViewportTool } from './defineViewportTool';
```

- [ ] **Step 2: Re-export from main kit index under a subpath alias**

The new factory is shipped under `@orochi235/weasel/routing` — an experimental subpath. Existing imperative `defineTool` (at `src/tools/defineTool.ts`) stays exported from the main `@orochi235/weasel` barrel. They're separate functions at separate import paths during the migration; consumers opt into the new shape via the subpath.

Add a section to `src/index.ts`:

```ts
// New declarative routing surface — experimental.
// import { defineTool } from '@orochi235/weasel/routing';
export * as routing from './tools/routing';
```

This namespace re-export keeps the name `defineTool` unambiguous: `routing.defineTool` from the main barrel, or the bare name from the subpath.

- [ ] **Step 3: Add the subpath to package.json**

In `package.json`, add to the `exports` map:

```json
"./routing": {
  "import": "./src/tools/routing/index.ts",
  "types": "./src/tools/routing/index.ts"
},
```

(Alongside the existing `"."` and any other subpath entries.)

- [ ] **Step 4: Verify build config supports the subpath**

```bash
cd /Users/mike/src/weasel
grep -n "routing\|entry" tsup.config.ts 2>/dev/null
```

If `tsup.config.ts` enumerates explicit entries, add `'src/tools/routing/index.ts'` to the entry list. If it auto-discovers, no change needed.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Clean.

- [ ] **Step 6: Smoke-test the subpath import**

Create a temporary file to verify the import resolves:

```bash
cat > /tmp/routing-smoke.ts <<'EOF'
import { defineTool, apply, begin, hold } from '@orochi235/weasel/routing';
const t = defineTool({ id: 'test', initial: {} });
console.log(t.id);
EOF
npx tsc --noEmit /tmp/routing-smoke.ts
rm /tmp/routing-smoke.ts
```

Expected: no errors. (Resolves via the package.json exports map or the tsconfig path mapping for in-repo consumers.)

- [ ] **Step 7: Commit**

```bash
git add src/tools/routing/index.ts src/index.ts package.json tsup.config.ts
# Only add tsup.config.ts if you actually modified it.
git commit -m "feat(tools): ship declarative routing under /routing subpath

@orochi235/weasel/routing exports the new factory + action constructors
+ types. Existing imperative defineTool stays exported from the main
barrel during the migration; subpath gives the new factory an
unambiguous import location. Once all built-in tools migrate, the
routing factory promotes to the main barrel and the old defineTool
deprecates."
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** every spec section in `2026-05-12-declarative-tool-routing-design.md` maps to one or more tasks. HitResult shape, action vocabulary, ModifierKey, ToolDef/PhaseDef, ViewportToolDef-as-subset, lookup engine, factories, subpath delivery — all covered.

- **Phase scope:** this plan is Phase 1 only. Tool migrations (`useHandTool`, `useSelectTool`, others) are explicitly out of scope here. They get their own plan once Phase 1's `defineTool` is in use and validated.

- **`HitResult` rename safety:** Task 2 renames the existing `HitResult` BEFORE Task 3 introduces the new one. No naming overlap at any commit boundary.

- **`applyBatch` rename:** the kit-wide find/replace in Task 1 is mechanical. If any callsite is missed (because, say, the identifier is in a string template), the typecheck or test run in subsequent tasks catches it.

- **`defineTool` collision:** the new factory is shipped at `@orochi235/weasel/routing`; the existing imperative `defineTool` stays at the main barrel. Both work during the migration. Once all built-ins migrate, the routing factory promotes and the old one deprecates.

- **Test patterns:** each task writes its tests against `vitest`. The `ToolCtx` stubs in `defineTool.test.ts` are tedious — consider extracting a `buildToolCtx(overrides)` helper to a shared test utility in a follow-up. Not in scope here.

- **Adapter `kindOf` hook:** Task 4 references an optional `kindOf?: (id: NodeId) => string` on the adapter. Phase 1 punts to `'unknown'` when this method isn't present. Real migrations (Phase 2+) will require consumer adapters to wire it for proper kind-driven routing.

- **`__beginSpec` on scratch:** Task 9's `defineTool` stashes the BeginSpec on the scratch object so continuation closures can be retrieved during onMove/onRelease/onCancel. This is internal — actions never see `__beginSpec`. A future cleanup could move it to a separate field on the tool's runtime state instead of polluting the scratch shape.

- **Cursor resolution:** Task 9's `resolveCursor` re-runs every time the kit reads `tool.cursor(ctx)`. Phase 1 is naive about caching; if profiling shows cursor resolution as a hot path, memoize on phase + scratch identity. Unlikely.
