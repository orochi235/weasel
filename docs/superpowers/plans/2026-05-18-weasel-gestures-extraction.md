# `weasel-gestures` Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the pure gesture-routing logic (taxonomy, route grammars, spec types, pure matcher functions) into a new workspace package `@orochi235/weasel-gestures`. The kit (`@orochi235/weasel`) then consumes from there instead of owning the source. No behavior changes; this is a relocation refactor.

**Architecture:** Two phases. **Phase A (creation)** stands up the new package with all source + tests, building and testing in isolation. Nothing in the kit changes; the new package is dead weight until Phase B. Phase A is safe to run in the background. **Phase B (adoption)** replaces the kit's local copies with re-exports/imports from `weasel-gestures` and deletes the originals. Phase B is sequential and must wait for Phase A to be green.

**Tech Stack:** TypeScript, npm workspaces (existing setup), vitest, tsup. No new deps.

**What moves to `weasel-gestures`:**

| Current path | New path |
|---|---|
| `src/tools/routing/gestures.ts` | `packages/weasel-gestures/src/gestures.ts` |
| `src/tools/routing/modifiers.ts` | `packages/weasel-gestures/src/modifiers.ts` |
| `src/tools/routing/routeGrammar.ts` | `packages/weasel-gestures/src/routeGrammar.ts` |
| `src/tools/routing/keyRouteGrammar.ts` | `packages/weasel-gestures/src/keyRouteGrammar.ts` |
| `src/interactions/gestures/spec.ts` | `packages/weasel-gestures/src/spec.ts` |
| `matchModifiers` + `matchKey` + `matchSpec` (from `src/interactions/dispatcher/matcher.ts`) | `packages/weasel-gestures/src/match.ts` |
| `InputEvent` (from matcher.ts) | `packages/weasel-gestures/src/inputEvent.ts` |
| `RoutePhase` (from `src/tools/routing/reflection/route-resolved.ts`) | `packages/weasel-gestures/src/phase.ts` |
| All co-located tests | alongside source files in `packages/weasel-gestures/src/` |

**What stays in `weasel`:**

- `useGestureDispatcher.tsx` — React/DOM glue
- `dispatcher.ts` — orchestrator that consumes pure matcher
- `defineTool.ts`, `PhaseDef`, `RouteTable` etc. — tool-routing layer that consumes the descriptor table
- `reflection/registry.ts`, `route-resolved.ts` (minus `RoutePhase`) — kit-specific reflection
- `actions/binding.ts`, `BindingScope`, `ScopedBinding`, `MatchResult` — action-layer types
- All built-in tools

**Scope cuts (deliberately deferred):**

- **No parametrization of the gesture vocabulary.** A consumer that wants a different gesture set is a follow-up; this plan ships the vocabulary as a fixed export. The parametrization redesign is documented in a future plan.
- **No npm publish.** The package stays `"private": true` until a real external consumer exists.
- **No grammar changes.** The v3 grammar sketch (`[phases]gesture(arg).target:+mod-shift?alt`) is out of scope for this plan. Land the extraction first; v3 lands on top of it cleanly.

---

## Phase A — Create `packages/weasel-gestures`

> **Parallelizable note:** Tasks A1 (skeleton) blocks the rest. After A1, tasks A2–A10 are independent up to the barrel (A11). When dispatching subagents, A2–A10 can run in any order or in parallel — they touch separate files.

### Task A1: Workspace skeleton

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/package.json`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/tsconfig.json`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/README.md`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/index.ts` (empty barrel for now)

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@orochi235/weasel-gestures",
  "version": "0.0.0",
  "private": true,
  "description": "Pure gesture taxonomy, route grammars, and matcher primitives. No React, no DOM, no scene.",
  "license": "MIT",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./package.json": "./package.json"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  }
}
```

- [ ] **Step 3: Write README.md**

```markdown
# @orochi235/weasel-gestures

Pure gesture-routing primitives for the weasel kit and downstream apps. No React, no DOM, no scene-graph awareness. Just types, parsers, and pure matcher functions.

Exports:
- `GESTURE_DESCRIPTORS`, `getGestureDescriptor`, `GestureName`, `GestureDescriptor`, `GestureArgSpec`
- `parseRoute`, `formatRoute`, `ParsedRoute`
- `parseKeyRoute`, `formatKeyRoute`, `keyRouteToSpec`, `ParsedKeyRoute`, `OptionalMod`
- `matchSpec`, `matchModifiers`, `matchKey`, `matchTarget`
- `GestureSpec`, `KeySpec`, `KeyHeldSpec`, `WheelSpec`, `ClickSpec`, `DragSpec`, `MultiTouchSpec`, `ContextMenuSpec`, `MultiTouchTapSpec`, `ModSpec`, `TargetSpec`
- `ModifierKey`, `mods()`
- `RoutePhase`, `InputEvent`

This package is consumed by `@orochi235/weasel` and is currently `private: true`. Stabilize and lock in before any external publish.
```

- [ ] **Step 4: Write empty barrel**

```ts
// packages/weasel-gestures/src/index.ts
// Barrel filled in by Task A11. Source modules land in tasks A2–A10.
export {};
```

- [ ] **Step 5: Verify workspace picks it up**

```bash
cd /Users/mike/src/weasel
npm install --workspaces=false 2>&1 | tail -5
```

Expected: no errors; the existing `workspaces` field in the root `package.json` already includes `packages/*`, so the new package is discovered automatically.

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures
git commit -m "feat(weasel-gestures): workspace skeleton

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: Copy `gestures.ts` + test

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/gestures.ts`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/gestures.test.ts`

- [ ] **Step 1: Read the source**

```bash
cat /Users/mike/src/weasel/src/tools/routing/gestures.ts
cat /Users/mike/src/weasel/src/tools/routing/gestures.test.ts
```

- [ ] **Step 2: Copy verbatim to the new package**

Copy the contents of both files to:
- `/Users/mike/src/weasel/packages/weasel-gestures/src/gestures.ts`
- `/Users/mike/src/weasel/packages/weasel-gestures/src/gestures.test.ts`

The test imports `from './gestures'` — that resolves the same way in both locations, so no edits needed.

- [ ] **Step 3: Run the new package's test**

```bash
cd /Users/mike/src/weasel
npx vitest run packages/weasel-gestures/src/gestures.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/gestures.ts packages/weasel-gestures/src/gestures.test.ts
git commit -m "feat(weasel-gestures): copy gestures descriptor table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: Copy `modifiers.ts` + test (if one exists)

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/modifiers.ts`
- Maybe create: `/Users/mike/src/weasel/packages/weasel-gestures/src/modifiers.test.ts`

- [ ] **Step 1: Check for existing test**

```bash
ls /Users/mike/src/weasel/src/tools/routing/modifiers.test.ts 2>&1
```

- [ ] **Step 2: Copy `modifiers.ts`**

Copy `/Users/mike/src/weasel/src/tools/routing/modifiers.ts` to `/Users/mike/src/weasel/packages/weasel-gestures/src/modifiers.ts` verbatim.

- [ ] **Step 3: Write a test if none exists**

If no existing test, write `/Users/mike/src/weasel/packages/weasel-gestures/src/modifiers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mods, type ModifierKey } from './modifiers';

describe('mods()', () => {
  it('returns "default" for no args', () => {
    expect(mods()).toBe('default');
  });
  it('canonicalizes order to mod → shift → alt regardless of input order', () => {
    expect(mods('alt', 'mod')).toBe('mod+alt');
    expect(mods('alt', 'shift', 'mod')).toBe('mod+shift+alt');
    expect(mods('shift')).toBe('shift');
  });
  it('produces every legal ModifierKey value', () => {
    const all: ModifierKey[] = [
      'default', 'mod', 'shift', 'alt',
      'mod+shift', 'mod+alt', 'shift+alt', 'mod+shift+alt',
    ];
    all.forEach((k) => { /* type-level check */ });
    expect(all.length).toBe(8);
  });
});
```

- [ ] **Step 4: Run the test**

```bash
cd /Users/mike/src/weasel && npx vitest run packages/weasel-gestures/src/modifiers.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/modifiers.ts packages/weasel-gestures/src/modifiers.test.ts
git commit -m "feat(weasel-gestures): copy modifier helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A4: Copy `spec.ts` (gesture-spec types) + test

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/spec.ts`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/spec.test.ts`

- [ ] **Step 1: Copy verbatim**

Copy:
- `/Users/mike/src/weasel/src/interactions/gestures/spec.ts` → `packages/weasel-gestures/src/spec.ts`
- `/Users/mike/src/weasel/src/interactions/gestures/spec.test.ts` → `packages/weasel-gestures/src/spec.test.ts`

The test imports `from './spec'` — works in both locations.

- [ ] **Step 2: Run the test**

```bash
cd /Users/mike/src/weasel && npx vitest run packages/weasel-gestures/src/spec.test.ts
```

Expected: pass (same suite as the existing one).

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/spec.ts packages/weasel-gestures/src/spec.test.ts
git commit -m "feat(weasel-gestures): copy GestureSpec types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A5: Copy `RoutePhase` to its own file

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/phase.ts`

The `RoutePhase` type lives inside `src/tools/routing/reflection/route-resolved.ts` mixed with kit-specific reflection types. We carve it out into its own file in the new package.

- [ ] **Step 1: Write phase.ts**

```ts
// packages/weasel-gestures/src/phase.ts

/** Phase of a gesture lifecycle. `initial` means the tool is idle
 *  (scratch null); `engaged` means a gesture is in progress (scratch
 *  populated). The route-grammar's `[phase]` slot draws from this set. */
export type RoutePhase = 'initial' | 'engaged';
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit -p packages/weasel-gestures
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/phase.ts
git commit -m "feat(weasel-gestures): RoutePhase type

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A6: Copy `routeGrammar.ts` + test

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/routeGrammar.ts`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/routeGrammar.test.ts`

- [ ] **Step 1: Copy with adjusted imports**

Source: `/Users/mike/src/weasel/src/tools/routing/routeGrammar.ts`. Copy contents, then change imports from:
- `from './gestures'` → unchanged (sibling in new package)
- `from './modifiers'` → unchanged
- `from './reflection/route-resolved'` → `from './phase'` (RoutePhase relocated)

Test: copy `/Users/mike/src/weasel/src/tools/routing/routeGrammar.test.ts` verbatim — imports are all sibling.

- [ ] **Step 2: Run tests**

```bash
cd /Users/mike/src/weasel && npx vitest run packages/weasel-gestures/src/routeGrammar.test.ts
```

Expected: 14 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/routeGrammar.ts packages/weasel-gestures/src/routeGrammar.test.ts
git commit -m "feat(weasel-gestures): copy route grammar parser/formatter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A7: Copy `keyRouteGrammar.ts` + test

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/keyRouteGrammar.ts`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/keyRouteGrammar.test.ts`

- [ ] **Step 1: Copy with adjusted imports**

Source: `/Users/mike/src/weasel/src/tools/routing/keyRouteGrammar.ts`. Copy contents, then change:
- `import type { KeySpec, ModSpec } from '../../interactions/gestures/spec';` → `import type { KeySpec, ModSpec } from './spec';`

Test: copy verbatim.

- [ ] **Step 2: Run tests**

```bash
cd /Users/mike/src/weasel && npx vitest run packages/weasel-gestures/src/keyRouteGrammar.test.ts
```

Expected: 11 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/keyRouteGrammar.ts packages/weasel-gestures/src/keyRouteGrammar.test.ts
git commit -m "feat(weasel-gestures): copy key route mini-grammar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A8: Extract `InputEvent` + matcher to new package

**Files:**
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/inputEvent.ts`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/match.ts`
- Create: `/Users/mike/src/weasel/packages/weasel-gestures/src/match.test.ts`

This is the largest task in Phase A. The existing `src/interactions/dispatcher/matcher.ts` mixes pure functions (`matchSpec`, `matchModifiers`, `matchKey`, `matchTarget`, `InputEvent` union) with kit-specific types (`MatchResult`, `BindingScope`, `ScopedBinding`, references to `GestureBinding` / `AffordanceHit`). Carve the pure layer into the new package.

- [ ] **Step 1: Extract `InputEvent` to `inputEvent.ts`**

Copy the entire `InputEvent` discriminated-union type from `src/interactions/dispatcher/matcher.ts` (lines ~38–123) into `packages/weasel-gestures/src/inputEvent.ts`. The union references `AffordanceHit` for `pointerdown` and `click` variants:

```ts
| { kind: 'pointerdown'; ... affordance?: AffordanceHit; ... }
```

For the extraction, replace `affordance?: AffordanceHit` with `affordance?: unknown` and document:

```ts
/** Generic affordance payload (the kit narrows this to `AffordanceHit`). */
```

That keeps `weasel-gestures` free of the kit's affordance type. Document at the top of the file:

```ts
/**
 * Normalized input-event shape consumed by the pure matcher. Built by the
 * React seam (`useGestureDispatcher`) from DOM events. Pump-only events
 * (`pointermove`, `pointerup`, `pointercancel`) ride in the same union so
 * the dispatcher's handleInput signature stays uniform; the matcher itself
 * never matches them.
 */
```

- [ ] **Step 2: Extract pure matcher functions to `match.ts`**

Copy these symbols from `src/interactions/dispatcher/matcher.ts` to `packages/weasel-gestures/src/match.ts`:

- `matchModifiers` (with `KeyRequirement` + `resolveSpecValue` + `checkKey` helpers + `ModifiersEvent` type)
- `matchKey`
- `matchTarget`
- `matchSpec`

Imports inside `match.ts`:

```ts
import type { GestureSpec, ModSpec, TargetSpec } from './spec';
import type { InputEvent } from './inputEvent';
```

Do **not** copy: `MatchResult`, `BindingScope`, `ScopedBinding`, `matchBest`, `ScopedBinding` — those are kit-actions-layer concerns; they stay in `weasel`.

- [ ] **Step 3: Copy + trim the matcher tests**

Source: `src/interactions/dispatcher/matcher.test.ts`. Copy to `packages/weasel-gestures/src/match.test.ts`. Trim:
- Any test that imports `matchBest` or constructs `ScopedBinding`s — those stay in `weasel`'s test
- Any test using `GestureBinding` — same

Update remaining imports:

```ts
import { matchSpec, matchModifiers, matchKey } from './match';
import type { InputEvent } from './inputEvent';
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/mike/src/weasel && npx vitest run packages/weasel-gestures/src/match.test.ts
```

Expected: the trimmed subset of the matcher tests passes (target ~40+ tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/inputEvent.ts packages/weasel-gestures/src/match.ts packages/weasel-gestures/src/match.test.ts
git commit -m "feat(weasel-gestures): extract InputEvent + pure matcher

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A9: Fill in the barrel

**Files:**
- Modify: `/Users/mike/src/weasel/packages/weasel-gestures/src/index.ts`

- [ ] **Step 1: Write the full barrel**

```ts
// packages/weasel-gestures/src/index.ts

// Gesture taxonomy
export {
  GESTURE_DESCRIPTORS,
  getGestureDescriptor,
  isKnownGestureName,
} from './gestures';
export type {
  GestureName,
  GestureDescriptor,
  GestureArgSpec,
} from './gestures';

// Modifier helpers
export { mods } from './modifiers';
export type { ModifierKey } from './modifiers';

// Route grammar
export { parseRoute, formatRoute } from './routeGrammar';
export type { ParsedRoute } from './routeGrammar';

// Key-route grammar
export { parseKeyRoute, formatKeyRoute, keyRouteToSpec } from './keyRouteGrammar';
export type { ParsedKeyRoute, OptionalMod } from './keyRouteGrammar';

// Phase + InputEvent
export type { RoutePhase } from './phase';
export type { InputEvent } from './inputEvent';

// GestureSpec union + sub-types + ModSpec + TargetSpec
export type {
  GestureSpec,
  KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec,
  MultiTouchSpec, ContextMenuSpec, MultiTouchTapSpec,
  ModSpec, TargetSpec,
} from './spec';

// Pure matcher functions
export { matchSpec, matchModifiers, matchKey, matchTarget } from './match';
```

- [ ] **Step 2: Full typecheck of the new package**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit -p packages/weasel-gestures 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 3: Run the package's whole test suite**

```bash
cd /Users/mike/src/weasel && npx vitest run packages/weasel-gestures --reporter=dot 2>&1 | tail -10
```

Expected: every test green.

- [ ] **Step 4: Verify nothing in `weasel` is broken**

The new package is a sibling that nothing imports yet, so the existing kit + apps should be unaffected:

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit 2>&1 | tail -10
cd /Users/mike/src/weasel && npx vitest run --reporter=dot 2>&1 | tail -8
```

Expected: clean tsc, all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel
git add packages/weasel-gestures/src/index.ts
git commit -m "feat(weasel-gestures): export barrel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

**End of Phase A.** The package now stands on its own, fully tested, with zero consumers. Phase B switches the kit over.

---

## Phase B — Migrate `weasel` to consume `weasel-gestures`

> **Sequential.** Each task replaces the kit's local copy of a module with a re-export from `weasel-gestures`, then deletes the original. Run after Phase A is committed.

### Task B1: Add the dependency

**Files:**
- Modify: `/Users/mike/src/weasel/package.json` (kit's root)

- [ ] **Step 1: Add to dependencies**

In the root `package.json`, add `"@orochi235/weasel-gestures": "*"` to `dependencies` (mirror how `weasel-ui` is declared). Run `npm install` to relink.

- [ ] **Step 2: Verify resolution**

```bash
cd /Users/mike/src/weasel && node -e "console.log(require.resolve('@orochi235/weasel-gestures/package.json'))"
```

Expected: prints the path under `packages/weasel-gestures/`.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/src/weasel
git add package.json package-lock.json
git commit -m "deps(weasel): consume @orochi235/weasel-gestures workspace package

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Replace `src/tools/routing/gestures.ts` with a re-export

**Files:**
- Modify: `/Users/mike/src/weasel/src/tools/routing/gestures.ts`
- Delete: `/Users/mike/src/weasel/src/tools/routing/gestures.test.ts` (moved to new package)

- [ ] **Step 1: Rewrite as re-export**

Replace the file's entire contents with:

```ts
/** Re-export from the extracted `@orochi235/weasel-gestures` package.
 *  The descriptor table lives there; this file is kept so existing
 *  imports under `src/tools/routing/gestures` resolve without churn. */
export {
  GESTURE_DESCRIPTORS,
  getGestureDescriptor,
  isKnownGestureName,
} from '@orochi235/weasel-gestures';
export type {
  GestureName,
  GestureDescriptor,
  GestureArgSpec,
} from '@orochi235/weasel-gestures';
```

- [ ] **Step 2: Delete the duplicate test**

```bash
cd /Users/mike/src/weasel
rm src/tools/routing/gestures.test.ts
```

- [ ] **Step 3: Typecheck + test**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit 2>&1 | tail -5
cd /Users/mike/src/weasel && npx vitest run --reporter=dot 2>&1 | tail -8
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/src/weasel
git add src/tools/routing/gestures.ts src/tools/routing/gestures.test.ts
git commit -m "refactor(routing): gestures.ts re-exports from weasel-gestures

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: Replace `modifiers.ts`

Mirror B2 for `src/tools/routing/modifiers.ts`:

```ts
export { mods } from '@orochi235/weasel-gestures';
export type { ModifierKey } from '@orochi235/weasel-gestures';
```

Delete any duplicate test in `src/tools/routing/`. Typecheck, run, commit.

```bash
cd /Users/mike/src/weasel
git commit -am "refactor(routing): modifiers.ts re-exports from weasel-gestures

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B4: Replace `routeGrammar.ts` + `keyRouteGrammar.ts`

Both files become thin re-exports:

```ts
// src/tools/routing/routeGrammar.ts
export { parseRoute, formatRoute } from '@orochi235/weasel-gestures';
export type { ParsedRoute } from '@orochi235/weasel-gestures';
```

```ts
// src/tools/routing/keyRouteGrammar.ts
export { parseKeyRoute, formatKeyRoute, keyRouteToSpec } from '@orochi235/weasel-gestures';
export type { ParsedKeyRoute, OptionalMod } from '@orochi235/weasel-gestures';
```

Delete the duplicate test files. Typecheck + test + commit.

---

### Task B5: Replace `src/interactions/gestures/spec.ts`

```ts
// src/interactions/gestures/spec.ts
export type {
  GestureSpec,
  KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec,
  MultiTouchSpec, ContextMenuSpec, MultiTouchTapSpec,
  ModSpec, TargetSpec,
} from '@orochi235/weasel-gestures';
```

Delete `src/interactions/gestures/spec.test.ts` (moved). Typecheck + test + commit.

---

### Task B6: Trim `src/interactions/dispatcher/matcher.ts`

This is the most delicate B-phase task. The file currently mixes pure matchers (now in the new package) with kit-actions-layer types (`MatchResult`, `ScopedBinding`, `matchBest`). Reduce the file to ONLY the kit-actions-layer pieces, importing the pure ones from `weasel-gestures`:

```ts
// src/interactions/dispatcher/matcher.ts

// Pure matcher primitives live in @orochi235/weasel-gestures.
// This file keeps the kit-actions-layer types and the `matchBest`
// orchestrator that walks ScopedBindings.
import { matchSpec, matchModifiers, matchKey, matchTarget } from '@orochi235/weasel-gestures';
import type { InputEvent } from '@orochi235/weasel-gestures';
import type { GestureBinding } from '../actions/binding';

// Re-export the pure primitives so existing kit consumers' imports keep working.
export { matchSpec, matchModifiers, matchKey, matchTarget };
export type { InputEvent };

// ... keep the existing BindingScope, ScopedBinding, MatchResult, matchBest definitions
//     and their tests. Delete only the duplicated pure-function blocks.
```

Trim the `matcher.test.ts` to keep only the `matchBest`-shaped tests; the pure tests already live in `packages/weasel-gestures/src/match.test.ts`. Typecheck + run full suite + commit.

```bash
cd /Users/mike/src/weasel
git commit -am "refactor(dispatcher): matcher.ts consumes pure primitives from weasel-gestures

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B7: Inspector + downstream re-exports

**Files:**
- Modify: `/Users/mike/src/weasel/apps/swillustrator/src/dev/registryData.ts`

Currently the inspector re-exports `parseRoute` from `@orochi235/weasel/routing`. That re-export chain still works (kit's `routing` barrel re-exports the renamed `routeGrammar.ts` which re-exports from `weasel-gestures`). Verify no change is needed; if any direct deep imports under `apps/` reach into `src/tools/routing/*`, redirect them to the kit barrel.

- [ ] **Verify with**

```bash
cd /Users/mike/src/weasel
grep -rn "from '@orochi235/weasel/" apps packages --include='*.ts' --include='*.tsx' | head -20
```

- [ ] **Run full suite + build**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit
cd /Users/mike/src/weasel && npx vitest run --reporter=dot 2>&1 | tail -8
cd /Users/mike/src/weasel && npm run build 2>&1 | tail -10
```

Expected: clean across the board.

- [ ] **Commit any final fixups**

```bash
cd /Users/mike/src/weasel
git commit -am "chore: inspector + downstream import cleanups after extraction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B8: (Optional) Drop the re-export shims

Once consumers have all migrated to importing directly from `@orochi235/weasel-gestures`, the thin re-export files in `src/tools/routing/gestures.ts`, `modifiers.ts`, `routeGrammar.ts`, `keyRouteGrammar.ts`, and `src/interactions/gestures/spec.ts` are dead weight. Delete them and rewrite the kit's barrels (`src/tools/routing/index.ts`, `src/index.ts`) to re-export from `weasel-gestures` directly.

This step is **optional** for this plan — the shims are cheap and let us defer downstream churn. Suggested approach: leave them for one release cycle, monitor for any direct deep-import in apps, then delete in a follow-up.

---

## Self-Review (author's notes)

**Spec coverage:**

- ✅ Pure logic (descriptor, grammars, spec types, matcher) moves to `weasel-gestures` (Phase A)
- ✅ Tests move alongside source; isolated package suite (Phase A)
- ✅ Kit consumes from new package via shims first, optionally direct imports later (Phase B)
- ✅ No vocabulary parametrization — fixed export until a real second consumer needs override
- ✅ Phase A safe to background-dispatch: it doesn't touch `weasel`'s source at all
- ✅ Phase B sequential: each task replaces one file, runs full test sweep

**Known risks:**

- **`matcher.ts` is the trickiest carve** (Task A8). The pure-vs-impure split is mostly clean, but `matchSpec`'s switch references InputEvent variants that themselves reference `AffordanceHit`. The plan resolves this by widening `affordance?: unknown` at the `weasel-gestures` boundary; the kit narrows it back to `AffordanceHit` at consumption.
- **Workspace resolution** — the new package needs to appear under `packages/*` and be declared in the root `package.json` `dependencies` as `"@orochi235/weasel-gestures": "*"` (mirroring how `weasel-ui` is wired). If the dispatcher agent forgets this, `tsc` will fail to resolve the import; Task B1 forces this explicitly before any consumer task runs.
- **Test relocations may surface stale fixtures** — if any test in `weasel` ends up duplicated against the new-package version, drop the kit's copy. The new package's copy is canonical.

**Phase ordering rationale:** Phase A is the entire extraction in isolation. Phase B is purely substitution. Splitting this way means Phase A can be reviewed and merged on its own (zero kit-runtime risk) before Phase B begins.
