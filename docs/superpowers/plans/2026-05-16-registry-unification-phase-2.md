# Registry unification — Phase 2: populate `gestureBinding` on immediate actions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `gestureBinding: GestureSpec` (or `GestureSpec[]`) on every existing default-action factory whose `defaultBinding: KeyBinding` is non-trivial. Pure structural change; no runtime behavior change (the legacy `useKeybinding` path keeps reading `defaultBinding`).

**Architecture:** Phase 2 begins with three small type extensions (KeySpec multi-key, ModSpec `mod`/`'optional'` shift, `Action.gestureBinding` array form) needed to faithfully represent every existing `KeyBinding`. Then sweeps the nine default-action factories in `src/interactions/actions/defaults/` and populates `gestureBinding`.

**Tech Stack:** TypeScript, Vitest. Builds on Phase 1's types. The Phase 1 branch (`registry-unification-phase-1`) is the base — Phase 2 commits land on the same branch (no separate worktree).

---

## File map

**Modify (Phase 1 types extended):**
- `src/interactions/gestures/spec.ts` — widen `KeySpec.key` to `string | string[]`; extend `ModSpec` with `mod` and `'optional'` shift values
- `src/interactions/gestures/spec.test.ts` — extend tests to cover new shapes
- `src/interactions/actions/registry.tsx` — widen `Action.gestureBinding` to `GestureSpec | GestureSpec[]`
- `src/interactions/actions/registry.test.tsx` — test array-form gestureBinding

**Modify (default action factories populated):**
- `src/interactions/actions/defaults/escape.ts` + test
- `src/interactions/actions/defaults/selectAll.ts` + test
- `src/interactions/actions/defaults/delete.ts` + test
- `src/interactions/actions/defaults/duplicate.ts` + test
- `src/interactions/actions/defaults/flip.ts` + test
- `src/interactions/actions/defaults/group.ts` + test
- `src/interactions/actions/defaults/reorder.ts` + test
- `src/interactions/actions/defaults/undoRedo.ts` (no existing test; small addition)
- `src/interactions/actions/defaults/nudge.ts` (the `shift: 'optional'` case) + test

**Not modified:**
- `align.tsx`, `distribute.tsx`, `booleans.tsx` — their `defaultBinding` is undefined; no `gestureBinding` needed (yet — Phase 6+ may add ambient bindings later).

## KeyBinding → GestureSpec mapping reference

Population uses this table:

| KeyBinding | Equivalent GestureSpec |
|---|---|
| `{ key: 'a' }` | `{ kind: 'key', key: 'a' }` |
| `{ key: 'a', mod: true }` | `{ kind: 'key', key: 'a', mods: { mod: true } }` |
| `{ key: 'a', shift: true }` | `{ kind: 'key', key: 'a', mods: { shift: true } }` |
| `{ key: 'a', mod: true, shift: true }` | `{ kind: 'key', key: 'a', mods: { mod: true, shift: true } }` |
| `{ key: ['Delete', 'Backspace'] }` | `{ kind: 'key', key: ['Delete', 'Backspace'] }` |
| `{ key: 'ArrowUp', shift: 'optional' }` | `{ kind: 'key', key: 'ArrowUp', mods: { shift: 'optional' } }` |
| (multiple distinct gestures) | `[{...}, {...}]` |

`mods.mod` mirrors the existing `KeyBinding.mod` semantics (meta on mac OR ctrl elsewhere). `mods.shift: 'optional'` mirrors the existing optional-shift semantics.

## Scope boundaries

- Does NOT remove or modify `defaultBinding` on any existing action — both fields coexist.
- Does NOT change the runtime dispatch (still goes through `useKeybinding` reading `defaultBinding`).
- Does NOT add `gestureBinding` to actions that don't have a `defaultBinding` today (align, distribute, booleans).
- Does NOT touch test-file structure beyond adding parallel `gestureBinding` assertions next to existing `defaultBinding` assertions.

---

### Task 1: Extend GestureSpec to cover multi-key + mod shorthand + optional shift

**Files:**
- Modify: `src/interactions/gestures/spec.ts`
- Modify: `src/interactions/gestures/spec.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/interactions/gestures/spec.test.ts`:

```ts
describe('GestureSpec Phase 2 extensions', () => {
  it('KeySpec.key accepts string array (multi-key bindings)', () => {
    const multi: KeySpec = { kind: 'key', key: ['Delete', 'Backspace'] };
    expectTypeOf(multi).toMatchTypeOf<KeySpec>();
  });

  it('ModSpec accepts mod shorthand (meta-or-ctrl)', () => {
    const mods: ModSpec = { mod: true };
    expectTypeOf(mods).toMatchTypeOf<ModSpec>();
  });

  it('ModSpec accepts optional-shift policy', () => {
    const mods: ModSpec = { shift: 'optional' };
    expectTypeOf(mods).toMatchTypeOf<ModSpec>();
  });

  it('KeySpec composes the new ModSpec features', () => {
    const optShift: KeySpec = { kind: 'key', key: 'ArrowUp', mods: { shift: 'optional' } };
    const modKey: KeySpec = { kind: 'key', key: 'a', mods: { mod: true } };
    expectTypeOf(optShift).toMatchTypeOf<KeySpec>();
    expectTypeOf(modKey).toMatchTypeOf<KeySpec>();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd /Users/mike/src/weasel/.claude/worktrees/registry-phase-1
npx vitest run src/interactions/gestures/spec.test.ts
```

Expected: FAIL — `key` is currently `string` (not `string | string[]`); `mods.mod` doesn't exist; `mods.shift` is `boolean` (not `boolean | 'optional'`).

- [ ] **Step 3: Modify `src/interactions/gestures/spec.ts`**

Change `ModSpec` from:

```ts
export type ModSpec = Partial<{
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}>;
```

To:

```ts
/** Optional modifier-key requirement for a gesture spec. All fields are
 *  optional; an omitted field means "either is acceptable." A `true` means
 *  the modifier MUST be held; `false` means it MUST NOT be held.
 *
 *  `mod` is a platform-aware shorthand: matches `metaKey` on mac, `ctrlKey`
 *  elsewhere (mirrors `KeyBinding.mod`).
 *
 *  `shift` additionally accepts `'optional'` meaning "shifted or unshifted
 *  both acceptable" — used by actions like nudge whose step size depends
 *  on shift but whose firing does not.
 */
export type ModSpec = Partial<{
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  mod: boolean;
  shift: boolean | 'optional';
}>;
```

Change `KeySpec.key` from `key: string;` to `key: string | string[];`. Add a comment: `/** A single key, or an array of acceptable keys (case-insensitive match). */`. Same change for `KeyHeldSpec.key`.

- [ ] **Step 4: Run tests to verify pass**

```
npx vitest run src/interactions/gestures/spec.test.ts
npx tsc --noEmit
```

Expected: all spec.test.ts tests pass (original 7 + new 4 = 11), tsc clean.

- [ ] **Step 5: Commit**

```
git add src/interactions/gestures/spec.ts src/interactions/gestures/spec.test.ts
git commit -m "feat(registry): extend GestureSpec — multi-key, mod shorthand, optional-shift"
```

---

### Task 2: Widen `Action.gestureBinding` to accept `GestureSpec | GestureSpec[]`

**Files:**
- Modify: `src/interactions/actions/registry.tsx`
- Modify: `src/interactions/actions/registry.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to the "Action with new invoker / GestureSpec fields" describe block in `registry.test.tsx`:

```ts
it('accepts an array of GestureSpec on gestureBinding (multi-binding actions)', () => {
  const action: Action = {
    id: 'demo.multi',
    label: 'Demo multi',
    gestureBinding: [
      { kind: 'key', key: 'z', mods: { mod: true } },
      { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
    ],
    run: () => {},
  };
  expect(Array.isArray(action.gestureBinding)).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

```
npx vitest run src/interactions/actions/registry.test.tsx
```

Expected: FAIL — `gestureBinding` is currently `GestureSpec | undefined`, not `GestureSpec | GestureSpec[]`.

- [ ] **Step 3: Modify `Action.gestureBinding` in `registry.tsx`**

Change the type from `gestureBinding?: GestureSpec` to `gestureBinding?: GestureSpec | GestureSpec[]`. Update the JSDoc to note the array form (any-of semantics — any matching gesture fires the action).

- [ ] **Step 4: Verify pass + tsc clean**

```
npx vitest run src/interactions/actions/registry.test.tsx
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```
git add src/interactions/actions/registry.tsx src/interactions/actions/registry.test.tsx
git commit -m "feat(registry): Action.gestureBinding accepts GestureSpec | GestureSpec[]"
```

---

### Task 3: Populate `gestureBinding` on the simple factories (escape, selectAll, duplicate, delete)

**Files:**
- Modify each of: `escape.ts`, `selectAll.ts`, `duplicate.ts`, `delete.ts` + their test files

For each factory, the change is: keep `defaultBinding` unchanged, add `gestureBinding` with the equivalent `KeySpec`. Tests gain a parallel assertion next to the existing one.

Mapping for these four:

| File | defaultBinding | New gestureBinding |
|---|---|---|
| escape.ts | `{ key: 'Escape' }` | `{ kind: 'key', key: 'Escape' }` |
| selectAll.ts | `{ key: 'a', mod: true }` | `{ kind: 'key', key: 'a', mods: { mod: true } }` |
| duplicate.ts | `{ key: 'd', mod: true }` | `{ kind: 'key', key: 'd', mods: { mod: true } }` |
| delete.ts | `{ key: ['Delete', 'Backspace'] }` | `{ kind: 'key', key: ['Delete', 'Backspace'] }` |

- [ ] **Step 1: Write failing tests** for each — open each test file and add a parallel assertion:

```ts
it('declares gestureBinding mirroring defaultBinding', () => {
  const a = defaultEscapeAction(baseDeps);
  expect(a.gestureBinding).toEqual({ kind: 'key', key: 'Escape' });
});
```

(Adjust the assertion's payload per the mapping table above for each file.)

- [ ] **Step 2: Run to verify failure**

```
npx vitest run src/interactions/actions/defaults/{escape,selectAll,duplicate,delete}.test.ts
```

Expected: 4 new failures, all complaining that `gestureBinding` is undefined.

- [ ] **Step 3: Populate** in each factory. For escape.ts:

```ts
return {
  id: 'escape',
  label: 'Escape',
  defaultBinding: { key: 'Escape' },
  gestureBinding: { kind: 'key', key: 'Escape' },
  run: () => { ... },
  enabled: ...,
};
```

Apply the equivalent change in selectAll.ts, duplicate.ts, delete.ts using the mapping table.

- [ ] **Step 4: Verify pass**

```
npx vitest run src/interactions/actions/defaults/{escape,selectAll,duplicate,delete}.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```
git add src/interactions/actions/defaults/{escape,selectAll,duplicate,delete}.{ts,test.ts}
git commit -m "feat(registry): populate gestureBinding on escape, selectAll, duplicate, delete actions"
```

---

### Task 4: Populate `gestureBinding` on the modifier-heavy factories (flip, group/ungroup, reorder)

**Files:** `flip.ts`, `group.ts`, `reorder.ts` + tests.

Mapping:

| File | defaultBinding | New gestureBinding |
|---|---|---|
| flip.ts (flipX) | `{ key: ['h', 'H'], shift: true }` | `{ kind: 'key', key: ['h', 'H'], mods: { shift: true } }` |
| flip.ts (flipY) | `{ key: ['v', 'V'], shift: true }` | `{ kind: 'key', key: ['v', 'V'], mods: { shift: true } }` |
| group.ts (group) | `{ key: 'g', mod: true }` | `{ kind: 'key', key: 'g', mods: { mod: true } }` |
| group.ts (ungroup) | `{ key: 'g', mod: true, shift: true }` | `{ kind: 'key', key: 'g', mods: { mod: true, shift: true } }` |
| reorder.ts (bringForward) | `{ key: [']', '}'], mod: true }` | `{ kind: 'key', key: [']', '}'], mods: { mod: true } }` |
| reorder.ts (sendBackward) | `{ key: ['[', '{'], mod: true }` | `{ kind: 'key', key: ['[', '{'], mods: { mod: true } }` |
| reorder.ts (bringToFront) | `{ key: [']', '}'], mod: true, shift: true }` | `{ kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } }` |
| reorder.ts (sendToBack) | `{ key: ['[', '{'], mod: true, shift: true }` | `{ kind: 'key', key: ['[', '{'], mods: { mod: true, shift: true } }` |

- [ ] **Steps 1–5:** Same TDD shape as Task 3, applied to flip, group, reorder. Single commit per file at the end; or one commit covering all three. Match the convention of recent commits — single commit is fine since the change is mechanically uniform.

Commit message: `feat(registry): populate gestureBinding on flip, group, reorder actions`

---

### Task 5: Populate the multi-key-modifier factories — undoRedo and nudge

**Files:** `undoRedo.ts`, `nudge.ts` (+ `nudge.test.ts`; undoRedo has no test today — add a minimal one).

undoRedo mapping:

| Action | defaultBinding | gestureBinding |
|---|---|---|
| undo | `{ key: 'z', mod: true }` | `{ kind: 'key', key: 'z', mods: { mod: true } }` |
| redo | `{ key: 'z', mod: true, shift: true }` | `{ kind: 'key', key: 'z', mods: { mod: true, shift: true } }` |

nudge mapping (8 entries: 4 arrows × 2 step sizes). The factory loops over an axis/direction matrix and builds bindings dynamically. The existing factory at `src/interactions/actions/defaults/nudge/nudge.ts` line 116 has `shift: 'optional'`. The `gestureBinding` should mirror:

For each `(direction, big)` cell:
- `defaultBinding: { key: arrowKey, shift: big ? true : false }` (today)
- `gestureBinding: { kind: 'key', key: arrowKey, mods: { shift: big ? true : false } }`

OR — since the nudge factory historically uses `shift: 'optional'` for the small-step variants (firing both shifted and unshifted), check the actual existing logic and mirror it faithfully. If small-step uses `shift: 'optional'` and big-step uses `shift: true`, mirror in `gestureBinding` using `mods: { shift: 'optional' }` and `mods: { shift: true }` respectively.

- [ ] **Step 1:** Read `src/interactions/actions/defaults/nudge/nudge.ts` carefully. Confirm the shift policy for small-step vs big-step. Note any other modifiers (alt, meta) that gate the action.

- [ ] **Step 2:** For each cell the factory emits, add `gestureBinding` alongside `defaultBinding`. Use the exact same shift policy.

- [ ] **Step 3:** Write test assertions for nudge — one or two representative cases verifying `gestureBinding` matches the existing `defaultBinding` semantics. For undoRedo, add a small test file:

```ts
// src/interactions/actions/defaults/undoRedo.test.ts
import { describe, it, expect } from 'vitest';
import { defaultUndoAction, defaultRedoAction } from './undoRedo';

const baseDeps = { undo: () => {}, redo: () => {} };

describe('defaultUndoAction', () => {
  it('declares gestureBinding mirroring defaultBinding', () => {
    const a = defaultUndoAction(baseDeps);
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true } });
  });
});

describe('defaultRedoAction', () => {
  it('declares gestureBinding mirroring defaultBinding', () => {
    const a = defaultRedoAction(baseDeps);
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true, shift: true } });
  });
});
```

(Adjust `baseDeps` if undoRedo's deps shape differs — read the factory source first.)

- [ ] **Step 4:** Run

```
npx vitest run src/interactions/actions/defaults/undoRedo.test.ts src/interactions/actions/defaults/nudge
npx tsc --noEmit
```

- [ ] **Step 5:** Commit

```
git add src/interactions/actions/defaults/{undoRedo.ts,undoRedo.test.ts,nudge}
git commit -m "feat(registry): populate gestureBinding on undoRedo and nudge actions"
```

---

### Task 6: End-to-end Phase 2 verification

**Files:** none modified — verification only.

- [ ] **Step 1: Full pre-publish gate**

```
cd /Users/mike/src/weasel/.claude/worktrees/registry-phase-1
npm run prepublishOnly 2>&1 | tail -10
```

Expected: tsc clean, vitest all passing, tsup build success.

- [ ] **Step 2: Demo build**

```
npm run build:demo 2>&1 | tail -10
```

Expected: success.

- [ ] **Step 3: Confirm no consumer regressions**

The legacy `useKeybinding` path still reads `defaultBinding`. Every action's `defaultBinding` is unchanged. Run:

```
npx vitest run src/interactions/actions/registry.test.tsx src/interactions/actions/useKeybinding.test.ts
```

Expected: PASS — no behavioral changes.

- [ ] **Step 4: Update `docs/TODO.md`**

Replace the Phase status block under "Unify the registry" with:

```
Status:
  - Phase 1 (types + skeleton): shipped 2026-05-16 — additive types only (`GestureSpec`, `Invoker`, `GestureBinding`, `ActiveToolContext`; `Action` gains optional `invoker` and `gestureBinding` fields; `Tool` gains optional `bindings`). No runtime behavior change.
  - Phase 2 (gestureBinding population): shipped 2026-05-16 — every default immediate-action factory now declares `gestureBinding: GestureSpec` mirroring its `defaultBinding`. `GestureSpec` extended to cover multi-key, mod shorthand, and optional-shift. No runtime behavior change.
  - Phases 3–9: pending. (Phase 3 builds the gesture dispatcher; later phases port ongoing actions, dissolve ambient tools, and delete legacy hook surfaces.)
```

Then commit:

```
git add docs/TODO.md
git commit -m "docs(todo): note Phase 2 of registry unification shipped"
```

## Done criteria for Phase 2

- All 6 tasks complete.
- `npm run prepublishOnly` green.
- `npm run build:demo` green.
- No existing test deleted or weakened.
- Every default immediate-action factory in `src/interactions/actions/defaults/` (that has a `defaultBinding`) now has a parallel `gestureBinding`.
- The legacy dispatch path is unchanged — `useKeybinding` continues to read `defaultBinding` exclusively.

## What's next

Phase 3 — build the gesture dispatcher. New module `src/interactions/dispatcher/` reading active-tool context + ambient bindings + tool bindings; matches `GestureSpec` against input events; pumps `OngoingHandle` for ongoing actions. Substantial real-code phase (unlike Phases 1–2). Will be its own plan; needs architectural input before drafting.
