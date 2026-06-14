# Tool-Owned Prefs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let kit tools declare their own user-facing preferences as static metadata on the hook function, composed into the swillustrator prefs registry at app boot.

**Architecture:** Kit gains a minimal `ToolPref` type (number / boolean / string / enum + name / description / default / expression hints). Tools attach a `.prefs` group to their hook function (option A from the brainstorm). The swillustrator app exports `composeToolPrefs`, an identity-typed generic that intersects literal-typed contributions; `PREFS.children.tools` is built from it. App-level prefs (`ui`, `view`, `tools.lastTool`) remain hand-declared. The two existing tool-flavored prefs migrate: `tools.penAutoCommitOnClose` → `tools.pen.autoCommitOnClose` (now owned by the pen tool), and `tools.pathFillRule` → `drawing.pathFillRule` (app-level — it's a drawing default, not pen-specific). Per user direction, existing persisted values under the moved paths are abandoned (no migration code); they sit as harmless cruft until overwritten.

**Tech Stack:** TypeScript, React, vitest.

---

## File Structure

**Kit (`src/`):**
- Create: `src/tools/prefs.ts` — `ToolPref`, `ToolPrefGroup`, expression-hint unions. Pure types + zero runtime.
- Modify: `src/tools/builtin/usePenTool/usePenTool.ts` — attach `usePenTool.prefs` after the function declaration.
- Modify: `src/tools/index.ts` (or wherever public exports live) — re-export `ToolPref` / `ToolPrefGroup` types if they're part of the kit's public API.

**App (`apps/swillustrator/`):**
- Modify: `apps/swillustrator/src/prefs.ts` — add `composeToolPrefs`, restructure `PREFS` (new `drawing` group, `tools.children` composed from contributions, drop the two leaves that moved).
- Modify: `apps/swillustrator/src/App.tsx` — update two `usePref` call sites for the new paths.
- Modify: `apps/swillustrator/src/prefs.test.ts` — update path strings in tests that referenced the moved keys; add one test that proves a tool-contributed pref round-trips.

No file splits beyond the one new `src/tools/prefs.ts`. Everything else is a localized edit.

---

## Task 1: Add kit-level `ToolPref` types

**Files:**
- Create: `src/tools/prefs.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/tools/prefs.ts
//
// Minimal pref descriptor for tools that want to expose user-facing
// settings (commit-on-close, snap thresholds, etc.). Host apps compose
// these into their own preferences registry; the kit ships no storage
// or UI of its own. The shape is intentionally narrow — number,
// boolean, string, enum, plus rendering hints — so it's a clean
// structural subset of whatever a host app already has.

export type ToolPrefKind = 'number' | 'boolean' | 'string' | 'enum';

interface ToolPrefBase<K extends ToolPrefKind, Value> {
  kind: K;
  /** Human-readable label. */
  name: string;
  /** Longer help text — shown in tooltips / a settings pane. */
  description: string;
  /** Fallback when nothing is persisted. */
  default: Value;
  /** Hide from a host app's settings UI by default. */
  hidden?: boolean;
}

export type ToolPrefNumberExpression = 'input' | 'slider';
export type ToolPrefBooleanExpression = 'checkbox' | 'switch';
export type ToolPrefStringExpression = 'input' | 'textarea';
export type ToolPrefEnumExpression = 'select' | 'radio';

export interface ToolPrefNumber extends ToolPrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  expression?: ToolPrefNumberExpression;
}
export interface ToolPrefBoolean extends ToolPrefBase<'boolean', boolean> {
  expression?: ToolPrefBooleanExpression;
}
export interface ToolPrefString extends ToolPrefBase<'string', string> {
  expression?: ToolPrefStringExpression;
}
export interface ToolPrefEnum<T extends string = string>
  extends ToolPrefBase<'enum', T> {
  options: readonly { value: T; label: string }[];
  expression?: ToolPrefEnumExpression;
}

export type ToolPref =
  | ToolPrefNumber
  | ToolPrefBoolean
  | ToolPrefString
  | ToolPrefEnum;

/** Nestable group: branch nodes a tool can use to organize its prefs. */
export interface ToolPrefGroup {
  name: string;
  description?: string;
  children: Record<string, ToolPref | ToolPrefGroup>;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors introduced).

- [ ] **Step 3: Commit**

```bash
git add src/tools/prefs.ts
git commit -m "feat(tools): add ToolPref / ToolPrefGroup descriptor types"
```

---

## Task 2: Re-export `ToolPref` types from the kit's public surface

**Files:**
- Modify: `src/tools/index.ts` (and any barrel re-exported by `src/index.ts`)

- [ ] **Step 1: Check what currently flows through the public barrel**

Run: `grep -n "from './prefs'\|from './tools/prefs'" src/index.ts src/tools/index.ts 2>/dev/null`
Expected: no match (the file is new).

Run: `grep -n "tools/builtin\|from './tools'" src/index.ts | head -5`
Expected: shows how tool exports flow today — match that pattern.

- [ ] **Step 2: Add type re-exports**

Edit `src/tools/index.ts` (or the appropriate barrel). Add:

```ts
export type {
  ToolPref,
  ToolPrefGroup,
  ToolPrefKind,
  ToolPrefNumber,
  ToolPrefBoolean,
  ToolPrefString,
  ToolPrefEnum,
  ToolPrefNumberExpression,
  ToolPrefBooleanExpression,
  ToolPrefStringExpression,
  ToolPrefEnumExpression,
} from './prefs';
```

If `src/index.ts` re-exports from `src/tools`, no further change is needed. Otherwise add a parallel `export type { ToolPref, ToolPrefGroup } from './tools/prefs';` to `src/index.ts`.

- [ ] **Step 3: Verify the app can import the types**

Run: `cd apps/swillustrator && npx tsc --noEmit -p . 2>&1 | head -20`
Expected: PASS (the app doesn't use the types yet — this just confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
git add src/tools/index.ts src/index.ts
git commit -m "feat(tools): export ToolPref types from public barrel"
```

---

## Task 3: Attach `.prefs` to `usePenTool`

**Files:**
- Modify: `src/tools/builtin/usePenTool/usePenTool.ts` — add a `usePenTool.prefs = ...` block immediately after the function declaration.

- [ ] **Step 1: Locate the end of the function**

Run: `grep -n "^export function usePenTool\|^}" src/tools/builtin/usePenTool/usePenTool.ts | head -20`
Expected: shows the `export function usePenTool(...)` line and matching `}`. The new `usePenTool.prefs = ...` statement goes immediately after the closing brace of the function.

- [ ] **Step 2: Add the prefs attachment**

Edit `src/tools/builtin/usePenTool/usePenTool.ts`. Add at the top of the file (after existing imports):

```ts
import type { ToolPrefGroup } from '../../prefs';
```

After the closing `}` of `export function usePenTool<TPose>(...) { ... }`, append:

```ts
usePenTool.prefs = {
  name: 'Pen',
  description: 'Pen-tool behavior.',
  children: {
    autoCommitOnClose: {
      kind: 'boolean',
      name: 'Auto-commit pen on close',
      description: "When you click the pen tool's first anchor to close a region, commit immediately so it renders with its fill. Off: keep the path in preview until you press Enter (lets you build a compound path from multiple closed subpaths).",
      default: true,
    },
  },
} satisfies ToolPrefGroup;
```

(Note: `usePenTool` is generic — `function usePenTool<TPose>(...)`. Assigning a property on a generic function is still a value-level assignment and works without ceremony in TS.)

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify existing pen tool tests still pass**

Run: `npx vitest run src/tools/builtin/usePenTool/`
Expected: PASS (no behavior changed).

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/usePenTool/usePenTool.ts
git commit -m "feat(usePenTool): declare autoCommitOnClose as a tool-owned pref"
```

---

## Task 4: Add `composeToolPrefs` and restructure swillustrator's `PREFS`

**Files:**
- Modify: `apps/swillustrator/src/prefs.ts`

This task is the largest. It does three things in one commit because they're a coherent change: introduce the composer, restructure `PREFS.children.tools` so the pen subgroup comes from `usePenTool.prefs`, and move `pathFillRule` to a new `drawing` group. `penAutoCommitOnClose` at the old path disappears; `tools.lastTool` stays put.

- [ ] **Step 1: Add the composer and import the pen tool**

Edit `apps/swillustrator/src/prefs.ts`. At the top of the file, after the existing imports, add:

```ts
import { usePenTool } from '@weasel-js/core';
import type { ToolPrefGroup } from '@weasel-js/core';
```

Just below the `SwillPrefGroup` interface declaration (~line 103), add:

```ts
/**
 * Compose tool-contributed pref groups into a `Record<string, ToolPrefGroup>`
 * keyed by tool id. The function is the identity at runtime — its only job
 * is to capture each contribution's literal type so `typeof PREFS` still
 * drives `SwillPrefPath` after composition.
 *
 * `ToolPrefGroup` is structurally a `SwillPrefGroup` (its kinds are a
 * subset), so the result slots into `PREFS.children.tools.children`
 * without a cast.
 */
function composeToolPrefs<T extends Record<string, ToolPrefGroup>>(t: T): T {
  return t;
}
```

- [ ] **Step 2: Restructure the `PREFS` constant**

In the same file, find the existing `tools` branch in `PREFS.children` (currently containing `lastTool`, `penAutoCommitOnClose`, `pathFillRule`). Replace it with:

```ts
    tools: {
      name: 'Tools',
      description: 'Tool memory and per-tool settings.',
      children: {
        lastTool: {
          kind: 'registry-enum',
          source: 'tools',
          name: 'Last used tool',
          description: 'Restored on app start.',
          default: 'select',
        },
        ...composeToolPrefs({
          pen: usePenTool.prefs,
        }),
      },
    },
```

Then add a new top-level branch `drawing` (place it after `view`, before `tools`):

```ts
    drawing: {
      name: 'Drawing',
      description: 'Defaults applied to newly-created paths and shapes.',
      children: {
        pathFillRule: {
          kind: 'enum',
          name: 'Path fill rule',
          description: 'How self-intersecting paths fill. Nonzero (SVG default) leaves a hole anywhere two opposite-winding loops overlap; evenodd fills any region enclosed by an odd number of edges. Switch to evenodd if you draw lasso-style outlines that cross themselves.',
          default: 'nonzero',
          options: [
            { value: 'nonzero', label: 'Nonzero (SVG default)' },
            { value: 'evenodd', label: 'Even-odd' },
          ],
        },
      },
    },
```

- [ ] **Step 3: Verify the file typechecks**

Run: `cd apps/swillustrator && npx tsc --noEmit -p .`
Expected: this will surface errors at the two `usePref(...)` call sites in `App.tsx` that reference the old paths. Those are fixed in Task 5. The `prefs.ts` file itself should typecheck cleanly. If `prefs.ts` itself has errors, fix them before moving on.

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/prefs.ts
git commit -m "feat(swill/prefs): compose tool-owned prefs; move pathFillRule to drawing"
```

---

## Task 5: Update `App.tsx` call sites for new pref paths

**Files:**
- Modify: `apps/swillustrator/src/App.tsx` — two `usePref` calls.

- [ ] **Step 1: Find the exact lines**

Run: `grep -n "tools.penAutoCommitOnClose\|tools.pathFillRule" apps/swillustrator/src/App.tsx`
Expected: two matches around lines 1360–1361.

- [ ] **Step 2: Update both paths**

Edit `apps/swillustrator/src/App.tsx`. Change:

```tsx
  const [penAutoCommitOnClose] = usePref('tools.penAutoCommitOnClose');
  const [pathFillRule] = usePref('tools.pathFillRule');
```

to:

```tsx
  const [penAutoCommitOnClose] = usePref('tools.pen.autoCommitOnClose');
  const [pathFillRule] = usePref('drawing.pathFillRule');
```

- [ ] **Step 3: Verify**

Run: `cd apps/swillustrator && npx tsc --noEmit -p .`
Expected: PASS (zero errors).

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/App.tsx
git commit -m "fix(swill): update usePref paths to match composed prefs registry"
```

---

## Task 6: Update prefs tests; add a tool-prefs round-trip test

**Files:**
- Modify: `apps/swillustrator/src/prefs.test.ts`

- [ ] **Step 1: Find tests that reference the moved paths**

Run: `grep -n "penAutoCommitOnClose\|pathFillRule" apps/swillustrator/src/prefs.test.ts`
Expected: may or may not find matches — the existing tests mostly exercise `view.gridDensity`. If matches exist, update each to use the new path (`tools.pen.autoCommitOnClose` or `drawing.pathFillRule`). If there are no matches, no edits are required for existing tests.

- [ ] **Step 2: Add a round-trip test for a tool-contributed pref**

Append to the `describe('usePref', ...)` block in `apps/swillustrator/src/prefs.test.ts`:

```ts
  it('round-trips a tool-contributed pref at its composed path', async () => {
    const { result } = renderHook(() => usePref('tools.pen.autoCommitOnClose'));
    // Default from usePenTool.prefs is `true`.
    expect(result.current[0]).toBe(true);
    act(() => { result.current[1](false); });
    await flushMicrotasks();
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY)!);
    expect(parsed.tools.pen.autoCommitOnClose).toBe(false);
  });
```

- [ ] **Step 3: Run the prefs test file**

Run: `cd apps/swillustrator && npx vitest run src/prefs.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/swillustrator/src/prefs.test.ts
git commit -m "test(swill/prefs): cover tool-contributed pref round-trip"
```

---

## Task 7: Verification sweep

**Files:**
- None (verification only).

- [ ] **Step 1: Typecheck the whole repo**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Typecheck the app**

Run: `cd apps/swillustrator && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 3: Run the full kit test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Run the swillustrator test suite**

Run: `cd apps/swillustrator && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Spot-check in the running app**

Start the swillustrator dev server (the user's normal workflow). Open the Preferences modal (Cmd-,). Confirm:
- A "Drawing" section exists with "Path fill rule".
- The "Tools" section contains "Pen → Auto-commit pen on close".
- Toggling either persists across a reload.
- The pen tool still respects the auto-commit toggle when closing a path.
- Drawing a self-intersecting path still respects the fill-rule choice.

Report any UI regressions back to the user before declaring the task complete. (Per the user's coding rules, type checks and tests don't verify feature correctness — eyeballing the modal is required.)

- [ ] **Step 6: No commit**

Verification only. If everything passes, the plan is complete.
