# Modality WeaselDraw Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the modality kit (built in `2026-05-24-modality-kit-foundations.md`) into the WeaselDraw app (`apps/draw/`). Land the kit-side hooks foundations leaves out (capability tags on tools, journal routing through `applyOps`, scoping-dim render layer, decoration-layer prop on `<Canvas>`), then build the WeaselDraw mode machine, journal cache, chrome (breadcrumb, status indicator, palette greying, workspace tint), and bring **path-edit** up end-to-end as the first real mode. The remaining stock modes (isolation, free-transform, text-edit, crop) are an explicit follow-up plan.

**Architecture:** Four phases.
1. *Kit hooks* — extend `Tool` with `capabilities`, tag built-ins, route `applyOps` through an active journal slot, ship a scoping-dim render-layer factory, expose `<Canvas decorationLayer={...}>`.
2. *App mode machine* — `apps/draw/src/modality/machine.ts` holds the active mode + dispatch, double-click entry via `Hit.kind`, background-click composition table, LRU journal cache.
3. *App chrome* — `ModeBreadcrumb`, `ModeStatusIndicator`, palette greying, workspace-tint CSS overlay driven by `--wd-mode-tint*` variables.
4. *Path-edit end-to-end* — register PATH_EDIT decoration painter, wire double-click → enter, `⎋` → suspend, `⌘⎋` → discard, staleness check, end-to-end verification of dim/grey/tint/undo.

**Tech Stack:** TypeScript, React, npm workspaces, vitest, `@orochi235/weasel-history`, `@orochi235/weasel-modes`, existing kit conventions (`RenderLayer`, `ToolCtx.applyOps`, `useScene`).

**Spec:** `docs/superpowers/specs/2026-05-24-modality-design.md`

**Sequencing:** Depends on (a) modality-kit-foundations plan complete, (b) Canvas/SceneCanvas seam refactor complete (`docs/superpowers/plans/2026-05-24-canvas-scenecanvas-seam.md`). The seam refactor supplies `Hit.kind` and the `onBackgroundClick` callback this plan composes.

---

## File structure overview

After this plan:

```
packages/weasel-modes/                       (extended)
  src/
    capabilities.ts                          (already exists; +ALL_TAGS check)
    eligibility.ts                           NEW — eligibleTool(registry, tool)
    scopingLayer.ts                          NEW — scoping-dim RenderLayer factory
    scopingLayer.test.ts                     NEW

packages/weasel-history/                     (extended)
  src/
    journal.ts                               (already exists)
    routing.ts                               NEW — ApplyOpsRouter helper
    routing.test.ts                          NEW

src/
  tools/
    types.ts                                 MODIFIED — Tool.capabilities field
    builtin/
      useHandTool/useHandTool.ts             MODIFIED — capabilities: ['navigation']
      useSelectTool/useSelectTool.ts         MODIFIED — capabilities: ['selection']
      useRectTool/useRectTool.ts             MODIFIED — capabilities: ['creates-shapes']
      useEllipseTool/useEllipseTool.ts       MODIFIED — same
      useLineTool/useLineTool.ts             MODIFIED — same
      useStarTool/useStarTool.ts             MODIFIED — same
      usePolygonTool/usePolygonTool.ts       MODIFIED — same
      usePenTool/usePenTool.ts               MODIFIED — capabilities: ['creates-paths']
      usePencilTool/usePencilTool.ts         MODIFIED — same
      useLassoTool/useLassoTool.ts           MODIFIED — capabilities: ['selection']
      useTextTool/useTextTool.ts             MODIFIED — capabilities: ['creates-text']
      useEyedropperTool/useEyedropperTool.ts MODIFIED — capabilities: ['samples-color']
      useRotateTool/useRotateTool.ts         MODIFIED — capabilities: ['transforms-selection']
      usePinchZoomTool/usePinchZoomTool.ts   MODIFIED — capabilities: ['navigation']
      useNestedSelectTool.ts                 MODIFIED — capabilities: ['selection']
  core/
    scene/
      useScene.ts                            MODIFIED — accepts journalSlot, routes applyOps
      useScene.journal.test.ts               NEW — routing tests
  canvas/
    Canvas.tsx                               MODIFIED — adds decorationLayer? prop

apps/draw/
  src/
    modality/
      machine.ts                             NEW — mode state machine
      machine.test.ts                        NEW
      journalCache.ts                        NEW — LRU 8
      journalCache.test.ts                   NEW
      backgroundClickPolicy.ts               NEW — per-mode composition
      backgroundClickPolicy.test.ts          NEW
      doubleClickEntry.ts                    NEW — hit-kind → entry dispatch
      doubleClickEntry.test.ts               NEW
      pathEditPainter.ts                     NEW — anchor dots + handle lines
      pathEditPainter.test.ts                NEW
      index.ts                               NEW — barrel
      chrome/
        ModeBreadcrumb.tsx                   NEW
        ModeBreadcrumb.module.css            NEW
        ModeBreadcrumb.test.tsx              NEW
        ModeStatusIndicator.tsx              NEW
        ModeStatusIndicator.test.tsx         NEW
    App.tsx                                  MODIFIED — wires machine, journal cache,
                                                          decorationLayer, palette greying,
                                                          tint variables, breadcrumb
    app.css                                  MODIFIED — `.wd-canvas-host::before` overlay
    ToolPalette.tsx (or equivalent)          MODIFIED — eligibility-driven opacity
```

> **Path-name note.** The spec calls the app "WeaselDraw" and uses `apps/weaseldraw/...` in its file plan; the on-disk directory is `apps/draw/`. Every path in this plan uses the on-disk name. CSS class `.wd-canvas-host` is unchanged (it's already the product-named class in `app.css`).

---

## Phase 1: Kit-side hooks (the bits foundations leaves out)

Foundations builds the `Journal`, the mode registry, the `ModeDefinition` data, the `eligibleForMode(mode, toolTags)` predicate, and the *adapter* for a mode-owned decoration layer. It does **not** add capability tags to tool definitions, it does **not** route `applyOps` through journals, it has no scoping-dim render layer, and the decoration adapter is not yet consumed by `<Canvas>`. Phase 1 fills those gaps.

### Task 1: Add `capabilities` to the `Tool` interface

The kit's `Tool<TScratch>` interface needs a `capabilities?: CapabilityTag[]` field so app-level mode eligibility can be computed without a side table. Optional for backwards compatibility — untagged tools are eligible in `normal` only (which `allows` every tag explicitly).

**Files:**
- Modify: `src/tools/types.ts:140-220`
- Test: `src/tools/types.test.ts`

- [ ] **Step 1: Confirm foundations is merged**

Run: `grep -l "createModeRegistry\|eligibleForMode" packages/weasel-modes/src/*.ts`
Expected: matches `registry.ts`, `modeDefinition.ts`. If empty, stop and merge foundations first.

- [ ] **Step 2: Write the failing test**

Open `src/tools/types.test.ts`, append:

```ts
import type { Tool } from './types';
import type { CapabilityTag } from '@orochi235/weasel-modes';

describe('Tool.capabilities', () => {
  it('accepts CapabilityTag[] and is optional', () => {
    const tagged: Tool = { id: 'a', capabilities: ['selection'] as CapabilityTag[] };
    const untagged: Tool = { id: 'b' };
    expect(tagged.capabilities).toEqual(['selection']);
    expect(untagged.capabilities).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/tools/types.test.ts`
Expected: FAIL — `capabilities` not on `Tool`.

- [ ] **Step 4: Add the field**

In `src/tools/types.ts`, find the `Tool<TScratch>` interface (line ~140) and add immediately after `id`:

```ts
  /**
   * App-level capability tags for modality. The `weasel-modes` package's
   * `eligibleForMode(mode, capabilities)` predicate consumes these to decide
   * whether the tool is usable in the active mode. Tags are extensible
   * strings — apps can define their own. Untagged tools are treated as
   * ineligible by all modes except those whose `allows` list includes
   * every implicit-or-declared tag (i.e. `normal` in the default preset).
   */
  capabilities?: import('@orochi235/weasel-modes').CapabilityTag[];
```

Also add `@orochi235/weasel-modes` to the kit's `package.json` `dependencies` (workspace `*`):

Run: `npm pkg set dependencies.@orochi235/weasel-modes='*'`
Run: `npm install`

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/tools/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean — adding an optional field shouldn't break existing tools.

- [ ] **Step 7: Commit**

```bash
git add src/tools/types.ts src/tools/types.test.ts package.json package-lock.json
git commit -m "feat(tools): add optional Tool.capabilities for modality eligibility"
```

---

### Task 2: Tag every built-in tool

Walk the built-in tool list and attach `capabilities` per the spec's capability-tag table (modality-design.md §Capability tags). Each is a one-line change — but each must have its own test asserting the tag, so a future engineer who deletes the tag fails fast.

The mapping (from `src/tools/builtin/index.ts` × spec table):

| Tool file | `capabilities` |
|---|---|
| `useHandTool/useHandTool.ts` | `['navigation']` |
| `usePinchZoomTool.ts` | `['navigation']` |
| `useSelectTool/useSelectTool.ts` | `['selection']` |
| `useNestedSelectTool.ts` | `['selection']` |
| `useLassoTool/useLassoTool.ts` | `['selection']` |
| `useRectTool/useRectTool.ts` | `['creates-shapes']` |
| `useEllipseTool/useEllipseTool.ts` | `['creates-shapes']` |
| `useLineTool/useLineTool.ts` | `['creates-shapes']` |
| `useStarTool/useStarTool.ts` | `['creates-shapes']` |
| `usePolygonTool/usePolygonTool.ts` | `['creates-shapes']` |
| `usePenTool/usePenTool.ts` | `['creates-paths']` |
| `usePencilTool/usePencilTool.ts` | `['creates-paths']` |
| `useTextTool/useTextTool.ts` | `['creates-text']` |
| `useEyedropperTool/useEyedropperTool.ts` | `['samples-color']` |
| `useRotateTool/useRotateTool.ts` | `['transforms-selection']` |

> **Note.** `edits-anchors`, `edits-text`, `applies-fill`, `edits-page` exist in the spec for *future* tools (direct-select, text caret, fill bucket, crop handles). Those tools aren't built yet — when each lands, tag it then. Don't pre-create empty tool files here.

- [ ] **Step 1: Write a single combined test**

Create `src/tools/builtin/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as builtins from './index';

// Hooks here are pure factories at top level — we instantiate each by
// calling its hook in a renderHook environment with a minimal set of
// required args, and read .capabilities off the returned Tool.
//
// Where a hook takes required options, we pass the smallest set that
// satisfies the type — the test only checks the tag string. If a hook's
// signature changes later, this test will fail at the renderHook call
// site and the engineer updates the option literal.

describe('built-in tool capabilities', () => {
  const cases: Array<[string, () => { capabilities?: readonly string[] } | null, readonly string[]]> = [
    ['hand', () => builtins.useHandTool({}), ['navigation']],
    ['select', () => builtins.useSelectTool({} as never), ['selection']],
    ['nestedSelect', () => builtins.useNestedSelectTool({} as never), ['selection']],
    ['lasso', () => builtins.useLassoTool({} as never), ['selection']],
    ['rect', () => builtins.useRectTool({} as never), ['creates-shapes']],
    ['ellipse', () => builtins.useEllipseTool({} as never), ['creates-shapes']],
    ['line', () => builtins.useLineTool({} as never), ['creates-shapes']],
    ['star', () => builtins.useStarTool({} as never), ['creates-shapes']],
    ['polygon', () => builtins.usePolygonTool({} as never), ['creates-shapes']],
    ['pen', () => builtins.usePenTool({} as never), ['creates-paths']],
    ['pencil', () => builtins.usePencilTool({} as never), ['creates-paths']],
    ['text', () => builtins.useTextTool({} as never), ['creates-text']],
    ['eyedropper', () => builtins.useEyedropperTool({} as never), ['samples-color']],
    ['rotate', () => builtins.useRotateTool({} as never), ['transforms-selection']],
    ['pinchZoom', () => builtins.usePinchZoomTool({} as never), ['navigation']],
  ];

  for (const [name, hook, expected] of cases) {
    it(`${name} declares capabilities: [${expected.join(', ')}]`, () => {
      const { result } = renderHook(hook);
      const tool = (result.current && typeof result.current === 'object' && 'tool' in result.current)
        ? (result.current as { tool: { capabilities?: readonly string[] } }).tool
        : (result.current as { capabilities?: readonly string[] } | null);
      expect(tool?.capabilities).toEqual(expected);
    });
  }
});
```

> **Implementation hazard.** Some `useXTool` hooks return `{ tool, ...rest }`, others return the `Tool` directly. The test's defensive `'tool' in result.current` branch handles both. If a hook throws because its options aren't actually optional, change `{} as never` to a viable minimum (`{ scene: makeFakeScene() }`, etc.) — read the hook's signature.

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tools/builtin/capabilities.test.ts`
Expected: FAIL — `tool.capabilities` is undefined on every tool.

- [ ] **Step 3: Add `capabilities` to each tool**

For each entry in the table above, open the tool file, find the `defineTool({ ... })` or returned `Tool` literal, and add `capabilities: ['<tag>']` immediately after `id`. Example for the hand tool:

```ts
// src/tools/builtin/useHandTool/useHandTool.ts
export const handTool: Tool = defineTool({
  id: 'hand',
  capabilities: ['navigation'],
  // ... existing fields
});
```

Repeat for every tool in the table. If a tool exports the `Tool` object inside a hook closure, add the field inside the literal returned by the hook.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/tools/builtin/capabilities.test.ts`
Expected: PASS (15 cases).

- [ ] **Step 5: Run full test suite to catch incidental breakage**

Run: `npx vitest run`
Expected: green. If failures appear, they should be limited to tests that snapshot `Tool` shape — update snapshots only if they exist.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin
git commit -m "feat(tools): tag built-in tools with capability tags for modality"
```

---

### Task 3: `eligibleTool` helper

A thin wrapper around `eligibleForMode` that takes a `ModeRegistry` and a `Tool` (or `Tool['capabilities']`) and returns whether the tool is usable right now. Lives in `weasel-modes` because the predicate is kit-level; the app calls it from the palette renderer.

**Files:**
- Create: `packages/weasel-modes/src/eligibility.ts`
- Modify: `packages/weasel-modes/src/index.ts`
- Test: `packages/weasel-modes/src/eligibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-modes/src/eligibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eligibleTool, eligibleToolByCapabilities } from './eligibility';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES } from './presets/default';

const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });

describe('eligibleTool', () => {
  it('returns true in normal for a selection tool', () => {
    expect(eligibleTool(reg, { id: 't', capabilities: ['selection'] })).toBe(true);
  });

  it('returns true for navigation tools in any mode (implicit tag)', () => {
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleTool(r2, { id: 'hand', capabilities: ['navigation'] })).toBe(true);
    expect(eligibleTool(r2, { id: 'zoom', capabilities: ['navigation'] })).toBe(true);
  });

  it('returns false in path-edit for selection tools', () => {
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleTool(r2, { id: 'sel', capabilities: ['selection'] })).toBe(false);
  });

  it('untagged tools are ineligible everywhere except modes that allow []', () => {
    expect(eligibleTool(reg, { id: 'mystery' })).toBe(false);
    expect(eligibleTool(reg, { id: 'mystery', capabilities: [] })).toBe(false);
  });

  it('eligibleToolByCapabilities is the pure-arg form', () => {
    expect(eligibleToolByCapabilities(reg.current(), ['edits-anchors'])).toBe(false);
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleToolByCapabilities(r2.current(), ['edits-anchors'])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run packages/weasel-modes/src/eligibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `eligibility.ts`**

```ts
// packages/weasel-modes/src/eligibility.ts
import type { ModeRegistry } from './registry';
import type { ModeDefinition } from './modeDefinition';
import type { CapabilityTag } from './capabilities';
import { eligibleForMode } from './modeDefinition';

export interface ToolLike {
  id: string;
  capabilities?: readonly CapabilityTag[];
}

/** True iff `tool` is usable in the registry's currently active mode. */
export function eligibleTool(reg: ModeRegistry, tool: ToolLike): boolean {
  return eligibleForMode(reg.current(), tool.capabilities ?? []);
}

/** Same predicate against an explicit mode + tag list. Useful for palette
 *  preview ("if I were in mode X, would this tool be available?"). */
export function eligibleToolByCapabilities(
  mode: ModeDefinition,
  capabilities: readonly CapabilityTag[],
): boolean {
  return eligibleForMode(mode, capabilities);
}
```

- [ ] **Step 4: Re-export from index**

In `packages/weasel-modes/src/index.ts`, append:

```ts
export { eligibleTool, eligibleToolByCapabilities, type ToolLike } from './eligibility';
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/weasel-modes/src/eligibility.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-modes/src
git commit -m "feat(weasel-modes): eligibleTool / eligibleToolByCapabilities helpers"
```

---

### Task 4: Journal routing through `useScene.applyOps`

When a `Journal` is active on the scene's underlying `History`, every `ctx.applyOps(ops, label)` call must route to the journal instead of recording a parent-history entry. This is the kit-side wiring that lets soft/strict modes actually capture their work.

The approach: `useScene` already constructs the `History` and the `applyOps` function it threads through `ToolCtx`. Add an optional `journal` accessor argument (`() => Journal | null`) that `applyOps` consults on every call. If non-null, route to `journal.applyBatch`; else, the existing `history.applyBatch` path.

**Files:**
- Modify: `src/core/scene/useScene.ts`
- Test: `src/core/scene/useScene.journal.test.ts`

- [ ] **Step 1: Read the existing useScene shape**

Run: `cat src/core/scene/useScene.ts`
Note where `applyOps` is defined and how it currently dispatches into the history. The applyOps closure should be the single edit site for routing.

- [ ] **Step 2: Write the failing test**

Create `src/core/scene/useScene.journal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene } from './useScene';
import { createInsertOp } from '../ops';  // adjust import to actual op factory
import type { Journal } from '@orochi235/weasel-history';

describe('useScene journal routing', () => {
  it('without a journal accessor, applyOps records a parent-history entry', () => {
    const { result } = renderHook(() =>
      useScene({ initial: { /* minimal scene shape */ } as never })
    );
    const scene = result.current;
    act(() => {
      scene.applyOps([createInsertOp({ /* minimal op */ } as never)], 'insert');
    });
    expect(scene.history.canUndo()).toBe(true);
  });

  it('with an active journal, applyOps routes ops to the journal not the parent', () => {
    let journal: Journal | null = null;

    const { result } = renderHook(() =>
      useScene({
        initial: { /* minimal scene */ } as never,
        getActiveJournal: () => journal,
      })
    );
    const scene = result.current;
    journal = scene.history.beginJournal({ label: 'edit' });

    act(() => {
      scene.applyOps([createInsertOp({ /* op */ } as never)], 'insert');
    });

    // Parent recorded NOTHING; journal recorded the op
    expect(scene.history.entries().undo.length).toBe(0);
    expect(journal!.entries().undo.length).toBe(1);

    // Commit flushes one labeled parent entry
    journal!.commit('edit');
    expect(scene.history.entries().undo.length).toBe(1);
  });

  it('after journal closes, applyOps routes to parent again', () => {
    let journal: Journal | null = null;
    const { result } = renderHook(() =>
      useScene({
        initial: { /* minimal scene */ } as never,
        getActiveJournal: () => journal,
      })
    );
    const scene = result.current;

    journal = scene.history.beginJournal({ label: 'j' });
    journal.commit('j');
    journal = null;  // app drops its reference once committed

    const before = scene.history.entries().undo.length;
    act(() => {
      scene.applyOps([createInsertOp({ /* op */ } as never)], 'post');
    });
    expect(scene.history.entries().undo.length).toBe(before + 1);
  });
});
```

> **Note.** The exact `initial` and op-payload shapes depend on the kit's scene/op interfaces — read `src/core/ops/index.ts` and `src/core/scene/useScene.ts` for the minimum that compiles and runs. If a smaller real op (e.g., `createSetPoseOp`) is more ergonomic, swap it in; the test only cares about routing, not op content.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/core/scene/useScene.journal.test.ts`
Expected: FAIL — `getActiveJournal` option not recognised.

- [ ] **Step 4: Add the option to `useScene`**

In `src/core/scene/useScene.ts`:

1. Extend the options type with `getActiveJournal?: () => Journal | null` (import `Journal` from `@orochi235/weasel-history`).
2. Capture the accessor at hook init: `const getJournal = options.getActiveJournal ?? (() => null);`
3. In the existing `applyOps` callback body, replace the parent-history call site with a routing guard:

```ts
const applyOps = useCallback((ops: Op[], label: string) => {
  const journal = getJournal();
  if (journal) {
    journal.applyBatch(ops, label);
  } else {
    history.applyBatch(ops, label);  // or the existing equivalent path
  }
  // ... rest of the existing applyOps body (scene mutation, listeners, etc.)
}, [/* existing deps + getJournal */]);
```

> **Important.** The journal *already* drives scene mutation (see `Journal` impl in foundations). The existing `applyOps` body likely *also* drives scene mutation directly. Read carefully: you must not double-apply. If the existing flow is "(a) call history.applyBatch, (b) call adapter.mutate, (c) notify listeners," replace step (a) with the journal/history fork — leave (b) and (c) alone *unless* the journal's `applyBatch` internally calls `adapter.mutate` (it does, per foundations Task 9). In that case, the simplest correct shape is:
>
> - If a journal is active, just call `journal.applyBatch(ops, label)` — it handles mutation + its own stack.
> - Else, call the existing parent-history pathway end-to-end.
>
> Read `packages/weasel-history/src/journal.ts` and `useScene.ts` together to confirm the actual division before editing.

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/core/scene/useScene.journal.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 6: Run full kit suite for regressions**

Run: `npx vitest run`
Expected: green. Routing is opt-in via the new option; existing call sites that don't pass `getActiveJournal` keep behaving exactly as before.

- [ ] **Step 7: Commit**

```bash
git add src/core/scene/useScene.ts src/core/scene/useScene.journal.test.ts
git commit -m "feat(scene): route applyOps to active journal when getActiveJournal returns one"
```

---

### Task 5: Scoping-dim render-layer factory

When `mode.scoping === true`, out-of-target objects should render at 30% opacity and become non-interactive. Implementation: a `RenderLayer<unknown>` factory that, on each frame, asks the active mode + a caller-supplied `getTargetIds()` for the set of in-scope ids, and emits draw commands that dim everything else.

The actual "dim" effect is implemented as a *masking pass* on the existing scene-render output, not as an overlay. The cleanest shape in the current renderer is: a layer slot that pre-multiplies non-target ids with an alpha and disables their pointer hits via the existing `Canvas` hit-test override pipeline.

**Files:**
- Create: `packages/weasel-modes/src/scopingLayer.ts`
- Modify: `packages/weasel-modes/src/index.ts`
- Test: `packages/weasel-modes/src/scopingLayer.test.ts`

- [ ] **Step 1: Read the existing `RenderLayer` and the scene-render slot**

Run: `cat src/core/layers/render.ts`
Run: `grep -rn "scene.*RenderLayer\|RenderLayer<.*Scene\|standard.*scene.*slot" src/canvas/ | head -10`

The point: understand the alpha-multiplication path. If the renderer composes layers by painting them in order, the scoping layer can paint a translucent rect over non-target ids by reading their bounds — but that won't work cleanly for paths. The better shape is a *render hint* that the scene-render slot itself consumes: `{ id, alpha }` per-node opacity overrides.

- [ ] **Step 2: Decide which integration shape applies**

There are two viable shapes; pick based on what's already in the renderer:

  - **Shape A (per-id alpha multiplier).** The scene slot accepts an optional `alphaFor: (id: string) => number` and multiplies each node's alpha. The scoping layer doesn't paint anything itself — it provides this callback. Cleaner; needs a renderer change.
  - **Shape B (overlay layer).** The scoping layer is a top-of-scene `RenderLayer` that paints a semi-transparent rectangle covering the *workspace* but punches holes (composite operation `destination-out`) over in-target node bounds. Visual quality is worse for non-rectangular shapes.

Default to Shape A. If the scene-render slot doesn't yet support per-id alpha, add it here — the change is mechanical and the scoping case is the one consumer.

- [ ] **Step 3: Write the failing test**

Create `packages/weasel-modes/src/scopingLayer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createScopingDim } from './scopingLayer';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES } from './presets/default';

describe('createScopingDim', () => {
  it('returns alpha=1 for every id when active mode has scoping=false', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['a']) });
    expect(dim.alphaFor('a')).toBe(1);
    expect(dim.alphaFor('b')).toBe(1);
  });

  it('returns target alpha for in-scope ids, dim alpha for others, in path-edit', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const dim = createScopingDim({
      registry: reg,
      getTargetIds: () => new Set(['target']),
      dimAlpha: 0.3,
    });
    expect(dim.alphaFor('target')).toBe(1);
    expect(dim.alphaFor('other')).toBe(0.3);
  });

  it('reacts to mode changes (no caching across modes)', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['t']) });
    expect(dim.alphaFor('other')).toBe(1);  // normal: no scoping

    reg.setMode('path-edit');
    expect(dim.alphaFor('other')).toBe(0.3);  // path-edit: scoping
  });

  it('isPointerInteractive mirrors alphaFor === 1 (true) vs dim (false)', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['t']) });
    expect(dim.isPointerInteractive('t')).toBe(true);
    expect(dim.isPointerInteractive('x')).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/weasel-modes/src/scopingLayer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Create `scopingLayer.ts`**

```ts
// packages/weasel-modes/src/scopingLayer.ts
import type { ModeRegistry } from './registry';

export interface CreateScopingDimOptions {
  registry: ModeRegistry;
  /** Returns the set of node ids that are *in* scope for the current mode.
   *  The app computes this — typically: selection-only for path-edit,
   *  isolated subtree for isolation, empty for non-scoping modes. */
  getTargetIds: () => ReadonlySet<string>;
  /** Alpha for out-of-scope nodes. Default 0.3 (spec). */
  dimAlpha?: number;
}

export interface ScopingDim {
  /** Multiplier in [0, 1] to apply to a node's render alpha. */
  alphaFor(id: string): number;
  /** Whether the node should respond to pointer hits. */
  isPointerInteractive(id: string): boolean;
}

export function createScopingDim(opts: CreateScopingDimOptions): ScopingDim {
  const dim = opts.dimAlpha ?? 0.3;
  return {
    alphaFor(id) {
      const mode = opts.registry.current();
      if (!mode.scoping) return 1;
      return opts.getTargetIds().has(id) ? 1 : dim;
    },
    isPointerInteractive(id) {
      const mode = opts.registry.current();
      if (!mode.scoping) return true;
      return opts.getTargetIds().has(id);
    },
  };
}
```

- [ ] **Step 6: Re-export from index**

In `packages/weasel-modes/src/index.ts`, append:

```ts
export { createScopingDim } from './scopingLayer';
export type { ScopingDim, CreateScopingDimOptions } from './scopingLayer';
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run packages/weasel-modes/src/scopingLayer.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 8: Commit**

```bash
git add packages/weasel-modes/src
git commit -m "feat(weasel-modes): scoping-dim per-id alpha helper"
```

> **Renderer-side consumption (deferred to Task 8 below).** The scene-render slot must accept `alphaFor` and `isPointerInteractive`. If the slot currently has no extension point, Task 8 adds it. The factory itself is renderer-agnostic; the integration happens at the SceneCanvas wiring.

---

### Task 6: Expose `<Canvas decorationLayer={...}>` prop

Foundations builds `createModeDecorations({ registry })` which exposes a `paint()` returning draw commands for the active mode. Now `<Canvas>` needs to actually render those commands. Approach: a new optional prop `decorationLayer?: RenderLayer<unknown>` that Canvas paints above the scene-render slot and below the chrome slot.

> **Slot ordering.** Scene → scoping mask (Task 8) → **decoration** → tool overlay → chrome. Decorations live above the scene (so anchor dots are visible against any fill) and below the tool overlay (so a drag rect from the direct-select tool draws on top of the anchor dots, which is conventional).

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Test: `src/canvas/Canvas.decorationLayer.test.tsx`

- [ ] **Step 1: Locate the existing layer-slot composition in Canvas**

Run: `grep -n "RenderLayer\|slot\|layers" src/canvas/Canvas.tsx | head -30`
Identify where the existing slots are passed to the renderer.

- [ ] **Step 2: Write the failing test**

Create `src/canvas/Canvas.decorationLayer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { RenderLayer } from '../core/layers/render';

describe('Canvas decorationLayer prop', () => {
  it('invokes the decoration layer paint between scene and tool-overlay slots', () => {
    const paint = vi.fn().mockReturnValue([]);
    const decorationLayer: RenderLayer<unknown> = {
      id: 'mode-decorations',
      state: undefined,
      dirty: () => true,
      paint,
    } as never;

    render(
      <Canvas
        width={200}
        height={100}
        scene={{ /* minimal scene */ } as never}
        decorationLayer={decorationLayer}
      />
    );

    expect(paint).toHaveBeenCalled();
  });

  it('renders cleanly when decorationLayer is omitted', () => {
    expect(() =>
      render(<Canvas width={200} height={100} scene={{ /* minimal */ } as never} />)
    ).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/canvas/Canvas.decorationLayer.test.tsx`
Expected: FAIL — `decorationLayer` not a known prop.

- [ ] **Step 4: Add the prop**

In `src/canvas/Canvas.tsx`:

1. Extend `CanvasProps` with `decorationLayer?: RenderLayer<unknown>;`
2. In the slot list passed to the renderer, insert it between the scene-render slot and the tool-overlay slot. The exact insertion point depends on the current `layers` array — add it conditionally so omission is a no-op:

```tsx
const layers = useMemo(() => {
  const out: RenderLayer<unknown>[] = [];
  out.push(sceneLayer);
  if (decorationLayer) out.push(decorationLayer);
  if (toolOverlay) out.push(toolOverlay);
  // ... existing chrome slots
  return out;
}, [sceneLayer, decorationLayer, toolOverlay /* ... */]);
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/canvas/Canvas.decorationLayer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full Canvas tests**

Run: `npx vitest run src/canvas/`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.decorationLayer.test.tsx
git commit -m "feat(canvas): expose decorationLayer prop for mode-owned overlays"
```

---

### Task 7: Wire scoping-dim into the SceneCanvas render path

Make the scene-render slot consult an optional `alphaFor` and `isPointerInteractive` from props. The kit's `<SceneCanvas>` is the consumer that wires these from `createScopingDim`.

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`
- Modify: the scene-render slot factory (path-dependent; see Step 1)
- Test: `src/canvas/SceneCanvas.scoping.test.tsx`

- [ ] **Step 1: Locate the scene-render slot factory**

Run: `grep -rn "function createScene\|sceneLayer\|render.*alpha" src/canvas src/core/layers 2>/dev/null | head -10`
Identify where per-node opacity is currently determined.

- [ ] **Step 2: Write the failing test**

Create `src/canvas/SceneCanvas.scoping.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';

describe('SceneCanvas scoping', () => {
  it('passes alphaFor through to the scene-render slot', () => {
    // Render a scene with two nodes, supply alphaFor(id)=0.3 for one of them,
    // assert the rendered canvas pixels (or expose a render-trace hook) show
    // the dim alpha applied.
    //
    // If pixel comparison is too brittle, expose a test-only `__renderTrace`
    // sink Canvas can post to and assert against the trace.
    expect(true).toBe(true);
  });

  it('blocks pointer events for ids where isPointerInteractive returns false', () => {
    // Render two nodes; non-target one should not fire onPickHit when clicked.
    expect(true).toBe(true);
  });
});
```

> **Test-strategy note.** The two assertions above are placeholders because the exact hook depends on the current renderer's testing affordances. The intent is concrete: alpha multiplied into the draw, pointer hits suppressed for non-interactive ids. Replace each `expect(true).toBe(true)` with a real assertion after Step 1's recon — the simplest paths are typically (a) a render-trace sink already present in the renderer for dev tooling, or (b) hit-test exposed via `helpersRef.pickAt(x, y)` returning null for non-interactive ids.

- [ ] **Step 3: Add the props to `SceneCanvas`**

Extend `SceneCanvasProps` with:

```ts
  alphaFor?: (id: string) => number;
  isPointerInteractive?: (id: string) => boolean;
```

Thread these into the scene-render slot factory and into the hit-test predicate (so non-interactive nodes don't return from `pickAt`).

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/canvas/SceneCanvas.scoping.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run all canvas tests**

Run: `npx vitest run src/canvas/`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/SceneCanvas.tsx src/canvas/SceneCanvas.scoping.test.tsx src/core/layers
git commit -m "feat(scene-canvas): consume alphaFor + isPointerInteractive for scoping"
```

---

## Phase 2: WeaselDraw mode machine

The mode machine is the app's owner of:
- The active `ModeRegistry` instance (built from `DEFAULT_MODES`).
- Entry triggers: keyboard shortcuts, double-click on hit-kind targets, explicit menu calls.
- Exit / commit / cancel triggers: `⎋`, `↵`, `⌘⎋`.
- The journal — beginning one on mode entry, suspending or committing on exit, cancelling on discard.
- The journal cache (LRU 8).
- The composition table for `onBackgroundClick`.

It does *not* own: rendering of chrome (Phase 3), the actual painter for a mode's decorations (Phase 4 for path-edit).

### Task 8: Create the mode machine skeleton

**Files:**
- Create: `apps/draw/src/modality/machine.ts`
- Create: `apps/draw/src/modality/index.ts`
- Test: `apps/draw/src/modality/machine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/draw/src/modality/machine.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createModeMachine } from './machine';
import { DEFAULT_MODES } from '@orochi235/weasel-modes';

function fakeHistory() {
  const journals: Array<{ committed: boolean; cancelled: boolean; suspended: boolean }> = [];
  return {
    beginJournal: vi.fn((opts) => {
      const j = {
        opts,
        committed: false,
        cancelled: false,
        suspended: false,
        applyBatch: vi.fn(),
        commit(label: string) { this.committed = true; },
        cancel() { this.cancelled = true; },
        suspend() { this.suspended = true; },
        entries: () => ({ undo: [], redo: [] }),
        canUndo: () => false,
        canRedo: () => false,
        undo: vi.fn(),
        redo: vi.fn(),
      };
      journals.push(j);
      return j;
    }),
    resumeJournal: vi.fn(),
    journals,
  };
}

describe('createModeMachine', () => {
  it('starts in normal mode with no active journal', () => {
    const m = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
    expect(m.registry.current().id).toBe('normal');
    expect(m.getActiveJournal()).toBe(null);
  });

  it('enterMode("path-edit", { targetId }) starts a journal scoped to the target', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'path-1' });

    expect(m.registry.current().id).toBe('path-edit');
    expect(history.beginJournal).toHaveBeenCalledTimes(1);
    expect(history.beginJournal.mock.calls[0][0].targetId).toBe('path-1');
    expect(m.getActiveJournal()).not.toBe(null);
  });

  it('exitMode on a soft mode suspends its journal and returns to normal', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    const journal = m.getActiveJournal()!;
    m.exitMode();

    expect((journal as never as { suspended: boolean }).suspended).toBe(true);
    expect(m.registry.current().id).toBe('normal');
    expect(m.getActiveJournal()).toBe(null);
  });

  it('commitMode on a strict mode commits the journal with the mode label', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('free-transform', { targetId: 'sel' });
    const journal = m.getActiveJournal()!;
    m.commitMode();

    expect((journal as never as { committed: boolean }).committed).toBe(true);
    expect(m.registry.current().id).toBe('normal');
  });

  it('cancelMode on a strict mode cancels the journal', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('free-transform', { targetId: 'sel' });
    const journal = m.getActiveJournal()!;
    m.cancelMode();

    expect((journal as never as { cancelled: boolean }).cancelled).toBe(true);
    expect(m.registry.current().id).toBe('normal');
  });

  it('discardMode on a soft mode cancels (not suspends) the journal', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    const journal = m.getActiveJournal()!;
    m.discardMode();

    expect((journal as never as { cancelled: boolean }).cancelled).toBe(true);
    expect((journal as never as { suspended: boolean }).suspended).toBe(false);
    expect(m.registry.current().id).toBe('normal');
  });

  it('enterMode while already in a mode throws (only one active journal at a time)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'a' });
    expect(() => m.enterMode('free-transform', { targetId: 'b' })).toThrow();
  });

  it('enterMode("normal") is a no-op', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('normal', {});
    expect(m.getActiveJournal()).toBe(null);
  });

  it('targetId on the active mode is exposed for scoping queries', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    expect(m.getActiveTargetId()).toBe('p');
    m.exitMode();
    expect(m.getActiveTargetId()).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/machine.test.ts`
Expected: FAIL — file not found.

- [ ] **Step 3: Create `apps/draw/src/modality/machine.ts`**

```ts
import { createModeRegistry, type ModeRegistry } from '@orochi235/weasel-modes';
import type { ModeDefinition } from '@orochi235/weasel-modes';
import type { History, Journal } from '@orochi235/weasel-history';

export interface CreateModeMachineOptions {
  modes: readonly ModeDefinition[];
  history: History;
  initial?: string;
}

export interface EnterModeArgs {
  /** The scene id this mode is scoped to. Required for modes whose
   *  `scoping` is true; allowed for strict modes (free-transform takes
   *  the current selection's id). For non-scoping non-targeted modes,
   *  pass `null`. */
  targetId?: string | null;
}

export interface ModeMachine {
  readonly registry: ModeRegistry;
  getActiveJournal(): Journal | null;
  getActiveTargetId(): string | null;
  enterMode(id: string, args: EnterModeArgs): void;
  exitMode(): void;       // soft modes: suspend
  commitMode(): void;     // strict modes: commit
  cancelMode(): void;     // strict modes: cancel
  discardMode(): void;    // soft modes: cancel (no resume)
}

export function createModeMachine(opts: CreateModeMachineOptions): ModeMachine {
  const registry = createModeRegistry({
    modes: opts.modes,
    initial: opts.initial ?? 'normal',
  });

  let activeJournal: Journal | null = null;
  let activeTargetId: string | null = null;

  function enterMode(id: string, args: EnterModeArgs): void {
    if (id === 'normal') return;
    if (activeJournal !== null) {
      throw new Error(
        `Cannot enter mode "${id}" while mode "${registry.current().id}" is active`,
      );
    }
    const def = registry.byId(id);
    activeJournal = opts.history.beginJournal({
      targetId: args.targetId ?? undefined,
      label: def.id,
    });
    activeTargetId = args.targetId ?? null;
    registry.setMode(id);
  }

  function reset(): void {
    activeJournal = null;
    activeTargetId = null;
    registry.setMode('normal');
  }

  function exitMode(): void {
    if (!activeJournal) return;
    activeJournal.suspend();
    reset();
  }

  function commitMode(): void {
    if (!activeJournal) return;
    const def = registry.current();
    activeJournal.commit(def.id);
    reset();
  }

  function cancelMode(): void {
    if (!activeJournal) return;
    activeJournal.cancel();
    reset();
  }

  function discardMode(): void {
    if (!activeJournal) return;
    activeJournal.cancel();
    reset();
  }

  return {
    registry,
    getActiveJournal: () => activeJournal,
    getActiveTargetId: () => activeTargetId,
    enterMode,
    exitMode,
    commitMode,
    cancelMode,
    discardMode,
  };
}
```

- [ ] **Step 4: Create `apps/draw/src/modality/index.ts`**

```ts
export { createModeMachine } from './machine';
export type { ModeMachine, CreateModeMachineOptions, EnterModeArgs } from './machine';
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run apps/draw/src/modality/machine.test.ts`
Expected: PASS (9 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/modality
git commit -m "feat(apps/draw): mode machine — active mode + journal lifecycle"
```

---

### Task 9: Journal cache (LRU 8)

Soft modes default to suspend-on-exit. Re-entering the same mode on the same target consults the cache for a suspended journal; if found and not stale, the machine resumes it; if stale (or absent), a fresh journal opens.

**Files:**
- Create: `apps/draw/src/modality/journalCache.ts`
- Modify: `apps/draw/src/modality/index.ts`
- Test: `apps/draw/src/modality/journalCache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/draw/src/modality/journalCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createJournalCache } from './journalCache';

const makeJournal = (id: string) => ({ id, applyBatch: () => {}, commit: () => {}, cancel: () => {}, suspend: () => {} } as never);

describe('createJournalCache', () => {
  it('stores and retrieves a journal by (modeId, targetId)', () => {
    const cache = createJournalCache({ capacity: 8 });
    const j = makeJournal('a');
    cache.put('path-edit', 'p1', j);
    expect(cache.get('path-edit', 'p1')).toBe(j);
    expect(cache.get('path-edit', 'p2')).toBe(null);
    expect(cache.get('isolation', 'p1')).toBe(null);
  });

  it('evicts least-recently-used when capacity is exceeded', () => {
    const cache = createJournalCache({ capacity: 2 });
    cache.put('m', 'a', makeJournal('a'));
    cache.put('m', 'b', makeJournal('b'));
    cache.put('m', 'c', makeJournal('c'));  // evicts 'a'
    expect(cache.get('m', 'a')).toBe(null);
    expect(cache.get('m', 'b')).not.toBe(null);
    expect(cache.get('m', 'c')).not.toBe(null);
  });

  it('get marks an entry as most-recently-used', () => {
    const cache = createJournalCache({ capacity: 2 });
    cache.put('m', 'a', makeJournal('a'));
    cache.put('m', 'b', makeJournal('b'));
    cache.get('m', 'a');                    // bump a to MRU
    cache.put('m', 'c', makeJournal('c'));  // should evict b (now LRU)
    expect(cache.get('m', 'a')).not.toBe(null);
    expect(cache.get('m', 'b')).toBe(null);
    expect(cache.get('m', 'c')).not.toBe(null);
  });

  it('clear() removes everything (called on save/load)', () => {
    const cache = createJournalCache({ capacity: 8 });
    cache.put('m', 'a', makeJournal('a'));
    cache.clear();
    expect(cache.get('m', 'a')).toBe(null);
  });

  it('remove() drops a specific entry (called on discard)', () => {
    const cache = createJournalCache({ capacity: 8 });
    cache.put('m', 'a', makeJournal('a'));
    cache.remove('m', 'a');
    expect(cache.get('m', 'a')).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/journalCache.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `apps/draw/src/modality/journalCache.ts`**

```ts
import type { Journal } from '@orochi235/weasel-history';

export interface CreateJournalCacheOptions {
  /** Maximum entries before LRU eviction. Spec says 8 for WeaselDraw. */
  capacity: number;
}

export interface JournalCache {
  get(modeId: string, targetId: string): Journal | null;
  put(modeId: string, targetId: string, journal: Journal): void;
  remove(modeId: string, targetId: string): void;
  clear(): void;
}

export function createJournalCache(opts: CreateJournalCacheOptions): JournalCache {
  const cap = opts.capacity;
  // Insertion order in a Map is iteration order — reorder by delete+set.
  const store = new Map<string, Journal>();
  const key = (m: string, t: string) => `${m}\x00${t}`;

  return {
    get(modeId, targetId) {
      const k = key(modeId, targetId);
      const j = store.get(k);
      if (!j) return null;
      // Bump to MRU
      store.delete(k);
      store.set(k, j);
      return j;
    },
    put(modeId, targetId, journal) {
      const k = key(modeId, targetId);
      if (store.has(k)) store.delete(k);
      store.set(k, journal);
      while (store.size > cap) {
        const oldest = store.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    remove(modeId, targetId) {
      store.delete(key(modeId, targetId));
    },
    clear() {
      store.clear();
    },
  };
}
```

- [ ] **Step 4: Re-export from index**

In `apps/draw/src/modality/index.ts`, append:

```ts
export { createJournalCache } from './journalCache';
export type { JournalCache, CreateJournalCacheOptions } from './journalCache';
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run apps/draw/src/modality/journalCache.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/modality
git commit -m "feat(apps/draw): LRU journal cache for suspend/resume"
```

---

### Task 10: Wire the cache into the machine (suspend + resume + discard)

Extend `createModeMachine` so soft-mode `exitMode` caches the suspended journal and re-entry consults the cache. Strict modes (`free-transform`, `crop`) never cache. Discard removes the cache entry.

**Files:**
- Modify: `apps/draw/src/modality/machine.ts`
- Modify: `apps/draw/src/modality/machine.test.ts`

- [ ] **Step 1: Write the new failing tests**

Append to `apps/draw/src/modality/machine.test.ts`:

```ts
describe('mode machine + cache', () => {
  it('soft-mode exitMode caches the suspended journal by (modeId, targetId)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });

    m.enterMode('path-edit', { targetId: 'p1' });
    const j1 = m.getActiveJournal();
    m.exitMode();

    m.enterMode('path-edit', { targetId: 'p1' });
    // Re-entered same target — should NOT have called beginJournal a second time.
    expect(history.beginJournal).toHaveBeenCalledTimes(1);
    expect(m.getActiveJournal()).toBe(j1);
  });

  it('soft-mode exitMode does NOT cache when the target is null (non-scoping mode use)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('text-edit', { targetId: null });
    m.exitMode();
    m.enterMode('text-edit', { targetId: null });
    // No targetId means no cache key; second entry beings fresh.
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });

  it('strict-mode commitMode does not cache; subsequent entry is fresh', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('free-transform', { targetId: 'sel' });
    m.commitMode();
    m.enterMode('free-transform', { targetId: 'sel' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });

  it('discardMode removes the cache entry', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    m.discardMode();
    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);  // fresh
  });

  it('clearJournalCache() empties the cache (called on save/load)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();
    m.clearJournalCache();
    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/machine.test.ts`
Expected: FAIL (cache not wired).

- [ ] **Step 3: Wire the cache into the machine**

Edit `apps/draw/src/modality/machine.ts`:

1. Import `createJournalCache, type JournalCache`.
2. Add to the options interface:

```ts
  cacheCapacity?: number;  // default 8
```

3. Add a private `cache: JournalCache` and `clearJournalCache(): void` to the `ModeMachine` interface.
4. Construct the cache: `const cache = createJournalCache({ capacity: opts.cacheCapacity ?? 8 });`
5. Rewrite `enterMode`:

```ts
function enterMode(id: string, args: EnterModeArgs): void {
  if (id === 'normal') return;
  if (activeJournal !== null) {
    throw new Error(`Cannot enter mode "${id}" while mode "${registry.current().id}" is active`);
  }
  const def = registry.byId(id);
  const tid = args.targetId ?? null;

  // Soft mode + targetId → consult cache
  if (def.kind === 'soft' && tid !== null) {
    const cached = cache.get(id, tid);
    if (cached) {
      opts.history.resumeJournal(cached);
      activeJournal = cached;
      activeTargetId = tid;
      registry.setMode(id);
      return;
    }
  }

  activeJournal = opts.history.beginJournal({
    targetId: tid ?? undefined,
    label: def.id,
  });
  activeTargetId = tid;
  registry.setMode(id);
}
```

6. Rewrite `exitMode` to cache:

```ts
function exitMode(): void {
  if (!activeJournal) return;
  const def = registry.current();
  activeJournal.suspend();
  if (def.kind === 'soft' && activeTargetId !== null) {
    cache.put(def.id, activeTargetId, activeJournal);
  }
  reset();
}
```

7. Rewrite `discardMode` to drop from cache:

```ts
function discardMode(): void {
  if (!activeJournal) return;
  const def = registry.current();
  activeJournal.cancel();
  if (activeTargetId !== null) cache.remove(def.id, activeTargetId);
  reset();
}
```

8. Add `clearJournalCache: () => cache.clear()` to the returned interface.

- [ ] **Step 4: Run the test**

Run: `npx vitest run apps/draw/src/modality/machine.test.ts`
Expected: PASS (all 14 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/modality
git commit -m "feat(apps/draw): mode machine consults LRU cache on suspend/resume"
```

---

### Task 11: Background-click composition policy

The seam refactor's `<Canvas onBackgroundClick>` callback is wired up at the `<SceneCanvas>` level. The mode machine intercepts this and composes per-mode behavior per the spec's table. This task encapsulates the table as a pure function so the wiring (Task 19) just calls it.

**Files:**
- Create: `apps/draw/src/modality/backgroundClickPolicy.ts`
- Modify: `apps/draw/src/modality/index.ts`
- Test: `apps/draw/src/modality/backgroundClickPolicy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/draw/src/modality/backgroundClickPolicy.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleBackgroundClick } from './backgroundClickPolicy';

const ctx = {
  selection: { clear: vi.fn(), clearScoped: vi.fn() },
  commitText: vi.fn(),
};

describe('handleBackgroundClick', () => {
  beforeEach(() => {
    ctx.selection.clear.mockReset();
    ctx.selection.clearScoped.mockReset();
    ctx.commitText.mockReset();
  });

  it('normal: clears selection', () => {
    handleBackgroundClick('normal', ctx as never, vi.fn());
    expect(ctx.selection.clear).toHaveBeenCalled();
  });

  it('path-edit: swallows (no selection clear, no exit)', () => {
    const exit = vi.fn();
    handleBackgroundClick('path-edit', ctx as never, exit);
    expect(ctx.selection.clear).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('isolation: clears scoped selection, does not exit', () => {
    const exit = vi.fn();
    handleBackgroundClick('isolation', ctx as never, exit);
    expect(ctx.selection.clearScoped).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('text-edit: commits text and exits mode', () => {
    const exit = vi.fn();
    handleBackgroundClick('text-edit', ctx as never, exit);
    expect(ctx.commitText).toHaveBeenCalled();
    expect(exit).toHaveBeenCalled();
  });

  it('free-transform: swallows', () => {
    const exit = vi.fn();
    handleBackgroundClick('free-transform', ctx as never, exit);
    expect(ctx.selection.clear).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('crop: swallows', () => {
    const exit = vi.fn();
    handleBackgroundClick('crop', ctx as never, exit);
    expect(ctx.selection.clear).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/backgroundClickPolicy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `apps/draw/src/modality/backgroundClickPolicy.ts`**

```ts
export interface BackgroundClickCtx {
  selection: {
    clear: () => void;
    /** Clear only within the active isolation scope. */
    clearScoped: () => void;
  };
  /** Called when text-edit needs to finalize the in-flight text edit
   *  before the mode exits. */
  commitText: () => void;
}

/** Per-mode composition table from the spec. `exit` is the callback that
 *  performs the mode exit (machine.exitMode + any side effects). */
export function handleBackgroundClick(
  activeModeId: string,
  ctx: BackgroundClickCtx,
  exit: () => void,
): void {
  switch (activeModeId) {
    case 'normal':
      ctx.selection.clear();
      return;
    case 'path-edit':
      return;
    case 'isolation':
      ctx.selection.clearScoped();
      return;
    case 'text-edit':
      ctx.commitText();
      exit();
      return;
    case 'free-transform':
    case 'crop':
      return;
    default:
      // Unknown mode: conservative default — do nothing.
      return;
  }
}
```

- [ ] **Step 4: Re-export from index**

```ts
export { handleBackgroundClick } from './backgroundClickPolicy';
export type { BackgroundClickCtx } from './backgroundClickPolicy';
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run apps/draw/src/modality/backgroundClickPolicy.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/modality
git commit -m "feat(apps/draw): per-mode background-click composition table"
```

---

### Task 12: Double-click entry dispatcher

`<SceneCanvas>` emits double-click events with `Hit.kind`. The dispatcher maps each kind to a mode entry per the spec table:

| `Hit.kind` | Action |
|---|---|
| `path` | `enterMode('path-edit', { targetId: hit.id })` |
| `group` | `enterMode('isolation', { targetId: hit.id })` |
| `text` | `enterMode('text-edit', { targetId: hit.id })` |
| anything else | no-op |

**Files:**
- Create: `apps/draw/src/modality/doubleClickEntry.ts`
- Modify: `apps/draw/src/modality/index.ts`
- Test: `apps/draw/src/modality/doubleClickEntry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/draw/src/modality/doubleClickEntry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { dispatchDoubleClickEntry } from './doubleClickEntry';

describe('dispatchDoubleClickEntry', () => {
  it('hit.kind="path" enters path-edit with hit.id', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'path', id: 'p1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('path-edit', { targetId: 'p1' });
  });

  it('hit.kind="group" enters isolation', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'group', id: 'g1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('isolation', { targetId: 'g1' });
  });

  it('hit.kind="text" enters text-edit', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'text', id: 't1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('text-edit', { targetId: 't1' });
  });

  it('unknown kind is a no-op', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'shape', id: 's1' } as never, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });

  it('null hit is a no-op', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry(null, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/doubleClickEntry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `apps/draw/src/modality/doubleClickEntry.ts`**

```ts
import type { ModeMachine } from './machine';

export interface HitLike {
  kind: string;
  id: string;
}

export function dispatchDoubleClickEntry(
  hit: HitLike | null,
  machine: ModeMachine,
): void {
  if (!hit) return;
  switch (hit.kind) {
    case 'path':
      machine.enterMode('path-edit', { targetId: hit.id });
      return;
    case 'group':
      machine.enterMode('isolation', { targetId: hit.id });
      return;
    case 'text':
      machine.enterMode('text-edit', { targetId: hit.id });
      return;
    default:
      return;
  }
}
```

- [ ] **Step 4: Re-export from index**

```ts
export { dispatchDoubleClickEntry } from './doubleClickEntry';
export type { HitLike } from './doubleClickEntry';
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run apps/draw/src/modality/doubleClickEntry.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/modality
git commit -m "feat(apps/draw): double-click hit-kind → mode entry dispatcher"
```

---

## Phase 3: Mode chrome

### Task 13: `ModeBreadcrumb` component

Pinned to the top of `.wd-canvas-host`. Soft variant: `<Mode Name> · "<target label>" · [Exit]`. Strict variant: `<Mode Name> · [Cancel ⎋] [Commit ⏎]`. Normal mode: returns `null`.

**Files:**
- Create: `apps/draw/src/modality/chrome/ModeBreadcrumb.tsx`
- Create: `apps/draw/src/modality/chrome/ModeBreadcrumb.module.css`
- Test: `apps/draw/src/modality/chrome/ModeBreadcrumb.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/draw/src/modality/chrome/ModeBreadcrumb.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeBreadcrumb } from './ModeBreadcrumb';

describe('ModeBreadcrumb', () => {
  it('renders nothing in normal mode', () => {
    const { container } = render(
      <ModeBreadcrumb modeId="normal" modeKind="soft" targetLabel={null} onExit={vi.fn()} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the soft variant with name, label, and Exit button', () => {
    const onExit = vi.fn();
    render(
      <ModeBreadcrumb modeId="path-edit" modeKind="soft" targetLabel="Circle Path" onExit={onExit} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText(/path edit/i)).toBeTruthy();
    expect(screen.getByText('Circle Path')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it('renders the strict variant with Cancel and Commit buttons', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <ModeBreadcrumb modeId="free-transform" modeKind="strict" targetLabel={null} onExit={vi.fn()} onCommit={onCommit} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /commit/i }));
    expect(onCommit).toHaveBeenCalled();
  });

  it('omits target label when null', () => {
    render(
      <ModeBreadcrumb modeId="free-transform" modeKind="strict" targetLabel={null} onExit={vi.fn()} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByText(/·/)).toBeNull();  // separator absent without label
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/chrome/ModeBreadcrumb.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create the component**

`apps/draw/src/modality/chrome/ModeBreadcrumb.tsx`:

```tsx
import { memo } from 'react';
import styles from './ModeBreadcrumb.module.css';

export interface ModeBreadcrumbProps {
  modeId: string;
  modeKind: 'soft' | 'strict';
  targetLabel: string | null;
  onExit: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

const MODE_DISPLAY: Record<string, string> = {
  'path-edit': 'Path Edit',
  'isolation': 'Isolation',
  'text-edit': 'Text Edit',
  'free-transform': 'Free Transform',
  'crop': 'Crop',
};

export const ModeBreadcrumb = memo(function ModeBreadcrumb(props: ModeBreadcrumbProps) {
  if (props.modeId === 'normal') return null;
  const name = MODE_DISPLAY[props.modeId] ?? props.modeId;

  return (
    <div className={styles.bar} data-mode={props.modeId}>
      <span className={styles.name}>{name}</span>
      {props.targetLabel ? (
        <>
          <span className={styles.sep}>·</span>
          <span className={styles.label}>{props.targetLabel}</span>
        </>
      ) : null}
      <span className={styles.spacer} />
      {props.modeKind === 'soft' ? (
        <button type="button" className={styles.btn} onClick={props.onExit}>
          Exit
        </button>
      ) : (
        <>
          <button type="button" className={styles.btn} onClick={props.onCancel}>
            Cancel <kbd>⎋</kbd>
          </button>
          <button type="button" className={styles.btnPrimary} onClick={props.onCommit}>
            Commit <kbd>⏎</kbd>
          </button>
        </>
      )}
    </div>
  );
});
```

`apps/draw/src/modality/chrome/ModeBreadcrumb.module.css`:

```css
.bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 12px;
  color: var(--wd-text);
  pointer-events: auto;
  z-index: 5;
}

.name { font-weight: 600; }
.sep { opacity: 0.4; }
.label { opacity: 0.75; }
.spacer { flex: 1; }

.btn,
.btnPrimary {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}
.btnPrimary {
  background: var(--wd-accent, #3b82f6);
  color: white;
  border-color: transparent;
}
.btn kbd, .btnPrimary kbd {
  font-family: inherit;
  font-size: 11px;
  opacity: 0.75;
  margin-left: 4px;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run apps/draw/src/modality/chrome/ModeBreadcrumb.test.tsx`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/modality/chrome/ModeBreadcrumb.tsx apps/draw/src/modality/chrome/ModeBreadcrumb.module.css apps/draw/src/modality/chrome/ModeBreadcrumb.test.tsx
git commit -m "feat(apps/draw): ModeBreadcrumb component (soft + strict variants)"
```

---

### Task 14: `ModeStatusIndicator` component

Passive secondary indicator shown in the existing tool/sel/zoom status row. Just prints the mode display name; null in normal.

**Files:**
- Create: `apps/draw/src/modality/chrome/ModeStatusIndicator.tsx`
- Test: `apps/draw/src/modality/chrome/ModeStatusIndicator.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeStatusIndicator } from './ModeStatusIndicator';

describe('ModeStatusIndicator', () => {
  it('renders nothing in normal mode', () => {
    const { container } = render(<ModeStatusIndicator modeId="normal" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the display name in non-normal modes', () => {
    render(<ModeStatusIndicator modeId="path-edit" />);
    expect(screen.getByText(/path edit/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/chrome/ModeStatusIndicator.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create the component**

```tsx
// apps/draw/src/modality/chrome/ModeStatusIndicator.tsx
import { memo } from 'react';

const DISPLAY: Record<string, string> = {
  'path-edit': 'Path Edit',
  'isolation': 'Isolation',
  'text-edit': 'Text Edit',
  'free-transform': 'Free Transform',
  'crop': 'Crop',
};

export const ModeStatusIndicator = memo(function ModeStatusIndicator(props: { modeId: string }) {
  if (props.modeId === 'normal') return null;
  const name = DISPLAY[props.modeId] ?? props.modeId;
  return <span data-testid="mode-status">{name}</span>;
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run apps/draw/src/modality/chrome/ModeStatusIndicator.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/modality/chrome/ModeStatusIndicator.tsx apps/draw/src/modality/chrome/ModeStatusIndicator.test.tsx
git commit -m "feat(apps/draw): ModeStatusIndicator (passive status-bar text)"
```

---

### Task 15: Workspace tint CSS overlay

A `linear-gradient(to bottom, var(--wd-mode-tint) 0%, transparent 100%)` painted on `.wd-canvas-host::before`. Driven by CSS variables `--wd-mode-tint` and `--wd-mode-tint-intensity`; gradient direction via a modifier class (`.wd-canvas-host[data-tint-direction="top-down"]`). Short fade transition on entry/exit.

**Files:**
- Modify: `apps/draw/src/app.css`

> No new test file — the tint is visual chrome with no behavior beyond what CSS provides. Validation happens in Task 22 (path-edit end-to-end visual check) and via a small DOM-level test that the CSS variables are set when the machine is in path-edit (Task 19).

- [ ] **Step 1: Add the CSS**

In `apps/draw/src/app.css`, find the `.wd-canvas-host` block (line ~325) and add immediately after it:

```css
.wd-canvas-host {
  /* existing rules unchanged */
  --wd-mode-tint: transparent;
  --wd-mode-tint-intensity: 0.12;
  position: relative;
}

.wd-canvas-host::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--wd-mode-tint) calc(var(--wd-mode-tint-intensity) * 100%), transparent) 0%,
    transparent 100%
  );
  transition: background 150ms ease-out;
  z-index: 1;
}

.wd-canvas-host[data-tint-direction="top-down"]::before {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--wd-mode-tint) calc(var(--wd-mode-tint-intensity) * 100%), transparent) 0%,
    transparent 100%
  );
}

.wd-canvas-host > canvas,
.wd-canvas-host > .wd-canvas-overlay {
  position: relative;
  z-index: 2;  /* above the ::before tint */
}
```

> If `.wd-canvas-host > .wd-canvas-overlay` isn't a real selector in this codebase, drop it and just rely on the canvas's z-index. The point is the tint sits above the workspace stripes and below the page/canvas.

- [ ] **Step 2: Visual smoke test**

Run: `npm run dev --workspace=apps/draw &`
Open the dev URL printed in the console. The app should look identical (no tint, since the machine isn't wired yet). If the workspace stripes are now occluded by the tint pseudo-element, fix the z-index stacking before continuing.

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/draw/src/app.css
git commit -m "feat(apps/draw): workspace tint overlay driven by --wd-mode-tint variables"
```

---

### Task 16: Tool palette greying

In whatever component renders the tool palette (search if you're not sure: `grep -rn "ToolPalette\|tools.*map.*button" apps/draw/src/`), each button consults `eligibleTool(modeRegistry, tool)` and renders at reduced opacity + `aria-disabled="true"` + a tooltip when ineligible.

**Files:**
- Modify: app's tool palette component (search to find)
- Test: a new test asserting that an ineligible tool button is `aria-disabled`

- [ ] **Step 1: Locate the palette**

Run: `grep -rn "tool-palette\|ToolPalette\|tool.*activate\|tool\.id" apps/draw/src/ | grep -v ".test." | head -20`
Identify the file rendering the per-tool buttons. (It may be inline in `App.tsx` — that's fine.)

- [ ] **Step 2: Write the failing test**

If the palette is its own component, create a colocated test. If it's inline in `App.tsx`, create `apps/draw/src/modality/integration.palette.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// Import a small palette-renderer wrapper if available, or the whole App.
// For App-level rendering, mount with the machine forced to path-edit.

describe('tool palette greying', () => {
  it('marks selection tools aria-disabled in path-edit mode', () => {
    // Render the palette with modeRegistry.current() === 'path-edit'.
    // Assert: the select tool button has aria-disabled="true" and ~30% opacity.
    // Assert: pen tool (creates-paths) is NOT aria-disabled in normal but IS in path-edit.
  });
});
```

> Fill in the harness specifics after Step 1's recon.

- [ ] **Step 3: Add greying to the palette renderer**

For each tool button, compute:

```tsx
const enabled = eligibleTool(modeRegistry, tool);
return (
  <button
    aria-disabled={!enabled}
    title={!enabled ? `Disabled in ${MODE_DISPLAY[modeRegistry.current().id]}` : tool.id}
    style={{ opacity: enabled ? 1 : 0.3 }}
    onClick={enabled ? () => activate(tool.id) : undefined}
  >
    {/* existing button contents */}
  </button>
);
```

> **No inline styles preference** — per CLAUDE.md, avoid `style={...}`. Use a CSS module or a class with a `data-disabled` attribute. Replace the inline style above with `className={enabled ? 'tool-btn' : 'tool-btn tool-btn--ineligible'}` and add the class to `app.css`:
>
> ```css
> .tool-btn--ineligible { opacity: 0.3; cursor: not-allowed; }
> ```

- [ ] **Step 4: Run the test**

Run: `npx vitest run apps/draw/src/modality/integration.palette.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/
git commit -m "feat(apps/draw): tool palette greys ineligible tools per active mode"
```

---

## Phase 4: Path-edit end-to-end

This phase makes one mode actually work, validating every preceding mechanism: machine transitions, journal routing, cache, decoration layer, scoping dim, palette greying, workspace tint, breadcrumb, double-click entry, keyboard exit.

### Task 17: Path-edit decoration painter

The painter renders **anchor dots** at each anchor point of the target path, with **handle lines** for any anchor that has off-curve handles. This is the persistent affordance the spec calls out — visible whenever path-edit is active, independent of which sub-tool is selected.

> **Sub-tools are out of scope** here. The actual edit-anchors / add-anchor / scissors / convert-anchor *tools* are a follow-up. This task is only the decoration painter that makes path-edit *look* like a real mode. Wiring sub-tools is part of a later plan.

**Files:**
- Create: `apps/draw/src/modality/pathEditPainter.ts`
- Create: `apps/draw/src/modality/pathEditPainter.test.ts`

- [ ] **Step 1: Read the kit's anchor / path data shape**

Run: `grep -rn "interface.*Path\|anchors\?:\|handles" src/core/scene/ src/canvas/ 2>/dev/null | head -20`
Identify how to read anchor points off a scene node by id. There's likely a helper in `useSceneSelectTool` or a scene adapter accessor.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createPathEditPainter } from './pathEditPainter';

describe('createPathEditPainter', () => {
  it('returns empty draw commands when targetId is null', () => {
    const painter = createPathEditPainter({
      getTargetId: () => null,
      getAnchors: () => [],
    });
    expect(painter()).toEqual([]);
  });

  it('emits one anchor-dot command per anchor of the target', () => {
    const anchors = [
      { x: 10, y: 10 },
      { x: 50, y: 80 },
      { x: 100, y: 30 },
    ];
    const painter = createPathEditPainter({
      getTargetId: () => 'p1',
      getAnchors: (id) => (id === 'p1' ? anchors : []),
    });
    const cmds = painter();
    expect(cmds.length).toBeGreaterThanOrEqual(3);
    // At least one command should be a circle/dot per anchor.
    // Exact shape depends on the renderer's command vocabulary.
  });

  it('emits handle lines for anchors with handle data', () => {
    const anchors = [
      { x: 10, y: 10, handleIn: { x: 5, y: 5 }, handleOut: { x: 15, y: 15 } },
    ];
    const painter = createPathEditPainter({
      getTargetId: () => 'p1',
      getAnchors: () => anchors,
    });
    const cmds = painter();
    // Expect at least one line/segment command for handle-in and one for handle-out.
    const lineCmds = cmds.filter((c) => /line|stroke/i.test(JSON.stringify(c)));
    expect(lineCmds.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run apps/draw/src/modality/pathEditPainter.test.ts`
Expected: FAIL.

- [ ] **Step 4: Create `pathEditPainter.ts`**

```ts
// apps/draw/src/modality/pathEditPainter.ts
//
// Returns DrawCommand[] for the path-edit decoration overlay. Reads the
// active target id (the path being edited) and an accessor that returns
// the anchor data for an id.

export interface Anchor {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export interface CreatePathEditPainterOptions {
  getTargetId: () => string | null;
  getAnchors: (pathId: string) => readonly Anchor[];
}

// DrawCommand shape matches the kit's renderer vocabulary; adjust the
// concrete shapes (e.g., 'circle' vs 'arc') once you've checked the
// existing slot factories in src/core/layers/.
type DrawCommand =
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number };

const ANCHOR_FILL = '#ffffff';
const ANCHOR_STROKE = '#3b82f6';
const HANDLE_STROKE = '#3b82f6';

export function createPathEditPainter(
  opts: CreatePathEditPainterOptions,
): () => DrawCommand[] {
  return () => {
    const id = opts.getTargetId();
    if (id == null) return [];
    const anchors = opts.getAnchors(id);
    const out: DrawCommand[] = [];

    for (const a of anchors) {
      if (a.handleIn) {
        out.push({ kind: 'line', x1: a.x, y1: a.y, x2: a.handleIn.x, y2: a.handleIn.y, stroke: HANDLE_STROKE, width: 1 });
        out.push({ kind: 'circle', cx: a.handleIn.x, cy: a.handleIn.y, r: 2.5, fill: ANCHOR_FILL, stroke: HANDLE_STROKE });
      }
      if (a.handleOut) {
        out.push({ kind: 'line', x1: a.x, y1: a.y, x2: a.handleOut.x, y2: a.handleOut.y, stroke: HANDLE_STROKE, width: 1 });
        out.push({ kind: 'circle', cx: a.handleOut.x, cy: a.handleOut.y, r: 2.5, fill: ANCHOR_FILL, stroke: HANDLE_STROKE });
      }
      out.push({ kind: 'circle', cx: a.x, cy: a.y, r: 4, fill: ANCHOR_FILL, stroke: ANCHOR_STROKE });
    }

    return out;
  };
}
```

> **Shape verification.** The exact `DrawCommand` shape MUST match what the kit's renderer accepts. Read `src/core/layers/render.ts` and any existing painter (e.g., the selection overlay) before finalising. If the renderer uses a different vocabulary (e.g., `{ type: 'circle' }` instead of `{ kind: 'circle' }`, or different field names), adjust here.

- [ ] **Step 5: Run the test**

Run: `npx vitest run apps/draw/src/modality/pathEditPainter.test.ts`
Expected: PASS (3 cases). If the shape assertion fails, tighten the assertions to match the agreed `DrawCommand` shape.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/modality/pathEditPainter.ts apps/draw/src/modality/pathEditPainter.test.ts
git commit -m "feat(apps/draw): path-edit decoration painter (anchor dots + handle lines)"
```

---

### Task 18: Hook the painter into the mode-decoration adapter

The foundations plan ships `createModeDecorations({ registry }).register('path-edit', painter)`. In `App.tsx`, register the path-edit painter when the app boots.

**Files:**
- Modify: `apps/draw/src/App.tsx`

- [ ] **Step 1: Find the App's modality bootstrap site (or create one)**

If `apps/draw/src/App.tsx` doesn't yet construct a mode machine (it doesn't — that's this task), find the section where `useScene` and other long-lived singletons are constructed. Add the modality bootstrap as a `useMemo` adjacent to those.

- [ ] **Step 2: Add the modality bootstrap**

In `App.tsx`, add:

```tsx
import { createModeMachine, createScopingDim } from '@orochi235/weasel-modes';
import { createModeDecorations, DEFAULT_MODES } from '@orochi235/weasel-modes';
import { createModeMachine } from './modality';
import { createPathEditPainter } from './modality/pathEditPainter';

function useModality(scene: { history: History; getAnchors: (id: string) => readonly Anchor[] }) {
  const machine = useMemo(
    () => createModeMachine({ modes: DEFAULT_MODES, history: scene.history }),
    [scene.history],
  );

  const decorations = useMemo(
    () => createModeDecorations({ registry: machine.registry }),
    [machine.registry],
  );

  const scopingDim = useMemo(
    () =>
      createScopingDim({
        registry: machine.registry,
        getTargetIds: () => {
          const tid = machine.getActiveTargetId();
          return tid ? new Set([tid]) : new Set();
        },
      }),
    [machine.registry, machine],
  );

  // Register the path-edit painter once.
  useEffect(() => {
    const painter = createPathEditPainter({
      getTargetId: () => machine.getActiveTargetId(),
      getAnchors: scene.getAnchors,
    });
    decorations.register('path-edit', painter);
  }, [decorations, machine, scene.getAnchors]);

  return { machine, decorations, scopingDim };
}
```

> **`scene.getAnchors`** is whatever accessor the existing scene exposes for reading anchor data by id. Locate the actual method name in Task 17 Step 1; rename here to match.

- [ ] **Step 3: Pass `decorationLayer`, `alphaFor`, and `isPointerInteractive` to SceneCanvas**

In the JSX where `<SceneCanvas>` is rendered:

```tsx
<SceneCanvas
  /* existing props */
  decorationLayer={decorations.asLayer()}
  alphaFor={scopingDim.alphaFor}
  isPointerInteractive={scopingDim.isPointerInteractive}
/>
```

> The exact name `decorations.asLayer()` depends on what the foundations decorations adapter exposes — adjust to the actual API (`decorations.paint()` returning commands, wrapped in a `RenderLayer<unknown>` shim if needed).

- [ ] **Step 4: Pass the journal accessor into `useScene`**

In the existing `useScene` call site, add the option:

```tsx
const scene = useScene({
  /* existing options */
  getActiveJournal: () => machine.getActiveJournal(),
});
```

> **Cycle hazard.** `machine` depends on `scene.history`, but now `scene` is configured with a callback that reads `machine`. This works because the callback is invoked *lazily* per `applyOps` call, not at construction time. Compile-order: build `useScene` first with a placeholder `getActiveJournal` referencing a ref, then construct `machine`, then assign the ref. Concretely:
>
> ```tsx
> const machineRef = useRef<ModeMachine | null>(null);
> const scene = useScene({ ...other, getActiveJournal: () => machineRef.current?.getActiveJournal() ?? null });
> const machine = useMemo(() => createModeMachine({ modes: DEFAULT_MODES, history: scene.history }), [scene.history]);
> useEffect(() => { machineRef.current = machine; }, [machine]);
> ```

- [ ] **Step 5: Smoke check**

Run: `npm run dev --workspace=apps/draw &`
Open the URL. The app should look identical to before (mode is still `normal`, no chrome rendered, no tint). Verify nothing is broken.

Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/App.tsx
git commit -m "feat(apps/draw): bootstrap mode machine, decorations, scoping dim in App"
```

---

### Task 19: Wire double-click + background-click + keyboard handlers

Make `<SceneCanvas>` actually trigger entry/exit:

- Double-click on a path → `dispatchDoubleClickEntry(hit, machine)`.
- Background click → `handleBackgroundClick(machine.registry.current().id, ctx, () => machine.exitMode())`.
- `⎋` keydown → if active mode is soft, `machine.exitMode()`; if strict, `machine.cancelMode()`.
- `↵` keydown → if active mode is strict, `machine.commitMode()`.
- `⌘⎋` (Meta+Escape) → if active mode is soft, `machine.discardMode()`.

**Files:**
- Modify: `apps/draw/src/App.tsx`

- [ ] **Step 1: Add the double-click handler**

`<SceneCanvas>` should already emit double-click with `Hit.kind` post-seam-refactor. Locate the prop (likely `onDoubleClick={(hit) => ...}` or similar) and wire:

```tsx
<SceneCanvas
  /* existing */
  onDoubleClick={(hit) => dispatchDoubleClickEntry(hit, machine)}
/>
```

- [ ] **Step 2: Add the background-click handler**

```tsx
<SceneCanvas
  /* existing */
  onBackgroundClick={() =>
    handleBackgroundClick(
      machine.registry.current().id,
      {
        selection: {
          clear: () => selection.clear(),
          clearScoped: () => selection.clear(),  // refine when isolation arrives
        },
        commitText: () => { /* no-op for now; wired in text-edit follow-up */ },
      },
      () => machine.exitMode(),
    )
  }
/>
```

- [ ] **Step 3: Add the keyboard handlers**

Use the app's existing keybindings hook (`useKeybindings`?) or add a fresh `useEffect` that binds keydown:

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const mode = machine.registry.current();
    if (mode.id === 'normal') return;

    if (e.key === 'Escape') {
      if (e.metaKey && mode.kind === 'soft') {
        machine.discardMode();
        e.preventDefault();
        return;
      }
      if (mode.kind === 'soft') machine.exitMode();
      else machine.cancelMode();
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && mode.kind === 'strict') {
      machine.commitMode();
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [machine]);
```

> **Conflict hazard.** The kit's `useKeybindings.ts` may already bind `Escape` for tool-cancel. Read it (`cat src/tools/useKeybindings.ts`) and either: (a) bind the mode handler at capture phase so it runs first when a mode is active, or (b) extend the existing keybinding registry with conditional handlers gated on `machine.registry.current().id !== 'normal'`. The capture-phase approach is the least invasive.

- [ ] **Step 4: Smoke test in the dev server**

Run: `npm run dev --workspace=apps/draw &`

In the browser:
1. Draw a path with the pen tool.
2. Select the path.
3. Double-click it → app should enter path-edit (no chrome yet — Task 20). Verify in React DevTools or by adding a temp `console.log(machine.registry.current().id)`.
4. Press `⎋` → should return to `normal`.
5. Re-double-click the same path → cache should resume (verify: no new `beginJournal` call; add a temp log).

Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/App.tsx
git commit -m "feat(apps/draw): wire double-click, background-click, keyboard for modality"
```

---

### Task 20: Render the breadcrumb and status indicator

Subscribe to `machine.registry` and render `ModeBreadcrumb` inside `.wd-canvas-host`, `ModeStatusIndicator` inside the existing status row.

**Files:**
- Modify: `apps/draw/src/App.tsx`

- [ ] **Step 1: Add a `useModeId` hook**

```tsx
function useModeId(machine: ModeMachine): string {
  const [id, setId] = useState(machine.registry.current().id);
  useEffect(() => {
    return machine.registry.subscribe(() => setId(machine.registry.current().id));
  }, [machine]);
  return id;
}
```

- [ ] **Step 2: Render the breadcrumb inside `.wd-canvas-host`**

Find the `<div className="wd-canvas-host" ref={hostRef}>` (App.tsx:1205) and add the breadcrumb as the first child:

```tsx
<div className="wd-canvas-host" ref={hostRef} data-tint-direction={tintDirection}>
  <ModeBreadcrumb
    modeId={modeId}
    modeKind={machine.registry.current().kind}
    targetLabel={targetLabel}
    onExit={() => machine.exitMode()}
    onCommit={() => machine.commitMode()}
    onCancel={() => machine.cancelMode()}
  />
  {/* existing canvas etc */}
</div>
```

Compute `targetLabel`:

```tsx
const targetLabel = useMemo(() => {
  const tid = machine.getActiveTargetId();
  if (!tid) return null;
  // Read the node's display name from scene metadata; fall back to id.
  return scene.getNodeLabel?.(tid) ?? tid;
}, [machine, modeId, scene]);
```

- [ ] **Step 3: Wire the workspace-tint CSS variables**

In the same JSX, set the variables based on the active mode's `workspace`:

```tsx
const tint = machine.registry.current().workspace?.tint ?? 'transparent';
const tintIntensity = machine.registry.current().workspace?.intensity ?? 0.12;
const tintDirection = machine.registry.current().workspace?.gradient ?? 'bottom-up';

<div
  className="wd-canvas-host"
  ref={hostRef}
  data-tint-direction={tintDirection}
  // CLAUDE.md says no inline styles. CSS variables are the exception: they
  // are *data*, not styling rules, and there's no class-explosion path for
  // arbitrary per-mode colours.
  style={{
    ['--wd-mode-tint' as never]: tint,
    ['--wd-mode-tint-intensity' as never]: tintIntensity,
  }}
>
  {/* ... */}
</div>
```

> **CLAUDE.md note.** The user's coding rule says no inline styles. CSS variables for dynamic values are the documented exception in the React/CSS ecosystem (there's no other way to thread a runtime value into a CSS `var(...)`). If a class-based variant strategy is preferred ("amber-tint", "blue-tint", etc.), introduce mode-named utility classes in `app.css` and toggle them via `data-mode={modeId}` on `.wd-canvas-host` instead — that's a clean alternative and arguably better since the tint set is closed (six modes, fixed colours).

> **Recommendation:** switch to the class-based variant. Add to `app.css`:
>
> ```css
> .wd-canvas-host[data-mode="path-edit"] { --wd-mode-tint: #3b82f6; }
> .wd-canvas-host[data-mode="isolation"] { --wd-mode-tint: #8b5cf6; }
> .wd-canvas-host[data-mode="text-edit"] { --wd-mode-tint: #10b981; }
> .wd-canvas-host[data-mode="free-transform"] { --wd-mode-tint: #f59e0b; }
> .wd-canvas-host[data-mode="crop"] { --wd-mode-tint: #ef4444; }
> ```
>
> Then in JSX, set `data-mode={modeId}` and `data-tint-direction={tintDirection}` and drop the inline `style`. **Use this form.**

- [ ] **Step 4: Add `ModeStatusIndicator` to the status row**

Locate the existing status row (search: `grep -n "zoom.*%\|tool-row\|status-row" apps/draw/src/App.tsx`). Insert next to the existing tool/sel/zoom display:

```tsx
<ModeStatusIndicator modeId={modeId} />
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev --workspace=apps/draw &`

Open the URL. Draw a path, double-click it:
- Breadcrumb appears: "Path Edit · <label> · [Exit]".
- Workspace tints blue.
- Status row shows "Path Edit".

Press `⎋`:
- Breadcrumb disappears.
- Tint fades out over 150ms.
- Status row clears.

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/App.tsx apps/draw/src/app.css
git commit -m "feat(apps/draw): render breadcrumb, status indicator, and tint per active mode"
```

---

### Task 21: Verify palette greying + scoping dim end-to-end

Two visual mechanisms haven't been verified in the dev server yet:
1. **Palette greying** — when in `path-edit`, selection/creation tools should appear at 30% opacity.
2. **Scoping dim** — when in `path-edit`, all non-target nodes should render at 30% opacity and be non-interactive.

**Files:**
- (Verification + any small fixes surfaced)

- [ ] **Step 1: Run the dev server**

```
npm run dev --workspace=apps/draw &
```

- [ ] **Step 2: Verify palette greying**

1. Draw two paths.
2. Double-click one to enter path-edit.
3. Look at the palette. Pen, rect, ellipse, select, lasso, text, eyedropper should be at ~30% opacity. Hand, zoom (navigation) should be fully opaque.
4. Hover over a greyed tool — tooltip should read "Disabled in Path Edit".

If anything is wrong, fix the palette renderer (Task 16) and re-verify.

- [ ] **Step 3: Verify scoping dim**

1. Still in path-edit on path A.
2. Look at path B: it should render at ~30% opacity.
3. Try clicking path B: nothing should select it (`isPointerInteractive` returns false).
4. Press `⎋` to exit. Path B returns to full opacity.

If wrong, suspect: (a) `getTargetIds` returning the wrong set; (b) scoping not wired in `SceneCanvas`. Re-check Task 7.

- [ ] **Step 4: Verify undo/redo behavior**

This is the load-bearing journal test:

1. Re-enter path-edit on path A.
2. *Imagine* an anchor-edit op happens — we don't have a direct-select tool yet, so simulate via the browser console:
   ```js
   __weasel_test_apply_op(['movePathAnchor', { pathId: 'A', anchorIndex: 0, dx: 10, dy: 0 }], 'move anchor');
   ```
   (If this hook isn't installed, add a temporary `window.__weasel_test_apply_op = (op, label) => scene.applyOps([op], label)` in App during dev.)
3. Confirm the path mutated.
4. Press `⌘Z` (undo). The journal's internal stack undoes the anchor move; the parent history is *not* touched yet.
5. Press `⌘Z` again. Same — but eventually `journal.canUndo()` becomes false.
6. Press `⎋`. Mode exits; journal suspends.
7. Press `⌘Z` once more. *Now* the parent history pops — but there shouldn't be anything to pop since the journal had no net forward ops at suspend time. (Actually: there should be one parent entry if any net changes survived to suspend. Verify against the spec's semantics.)
8. Re-enter path-edit on path A. The cache should resume the suspended journal; redo should work within it.

If the semantics are wrong, the bug is in foundations (Journal flush) or in Task 4 (routing). Triage there.

- [ ] **Step 5: Commit any fixes**

If Step 2/3/4 surfaced issues you patched, commit each fix as its own commit with a `fix(modality): ...` message.

---

### Task 22: Stale-journal handling

The spec says re-entry consults the cache and discards stale journals (touched by intervening parent-history entries). The cache itself doesn't do staleness — that's the machine's job, consulting `history.entries()` for touches since `journal.forkedAtEntryId`.

**Files:**
- Modify: `apps/draw/src/modality/machine.ts`
- Modify: `apps/draw/src/modality/machine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `machine.test.ts`:

```ts
describe('stale-journal discard', () => {
  it('discards a cached journal if a parent-history entry since the fork-id touched its target', () => {
    const history = makeRealishHistoryStub({
      entriesSince(forkId: number) {
        // Pretend an entry touching 'p' landed after forkId
        return [{ id: forkId + 1, touchedIds: new Set(['p']) }];
      },
    });
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });

    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();

    // Simulate intervening edit by advancing history's mocked entries.
    // Re-entry should NOT resume — should begin fresh.
    history.advanceEntries(1);  // adds one entry touching 'p'

    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);  // fresh
  });

  it('resumes a cached journal when intervening entries did NOT touch the target', () => {
    const history = makeRealishHistoryStub({
      entriesSince() { return [{ id: 99, touchedIds: new Set(['unrelated']) }]; },
    });
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });

    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();
    history.advanceEntries(1);  // entry touching 'unrelated' only

    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(1);  // resumed
    expect(history.resumeJournal).toHaveBeenCalledTimes(1);
  });
});

function makeRealishHistoryStub(impl: { entriesSince: (forkId: number) => readonly { id: number; touchedIds: ReadonlySet<string> }[] }) {
  // Add advanceEntries() that bumps an internal counter; entriesSince reads from impl.
  // The journal returned by beginJournal exposes forkedAtEntryId.
  // (Implement in line with the foundations Journal's expected stub API.)
  // ...
}
```

> The exact `History` API for "entries since fork" is `history.entries()` (returns committed entries) cross-referenced against `journal.forkedAtEntryId()`. Adjust the stub to match the foundations Journal shape.

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/machine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the staleness check in `enterMode`**

In the cached-journal branch of `enterMode`, before resuming:

```ts
if (def.kind === 'soft' && tid !== null) {
  const cached = cache.get(id, tid);
  if (cached) {
    const forkId = cached.forkedAtEntryId();
    const since = opts.history.entries().undo.filter((e) => e.id > forkId);
    const touched = since.some((e) => e.touchedIds?.has(tid));
    if (touched) {
      cache.remove(id, tid);
      // fall through to fresh journal
    } else {
      opts.history.resumeJournal(cached);
      activeJournal = cached;
      activeTargetId = tid;
      registry.setMode(id);
      return;
    }
  }
}
```

> The `touchedIds` field on history entries must exist. If it doesn't, this task expands to "add `touchedIds: Set<string>` to `HistoryEntry`, populated by `applyBatch` from the ops' target ids" — that's a small foundations extension that should go in foundations rather than here. **If `touchedIds` is missing, stop and add it to foundations first.**

- [ ] **Step 4: Run the test**

Run: `npx vitest run apps/draw/src/modality/machine.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify in the dev server**

Run: `npm run dev --workspace=apps/draw &`
1. Enter path-edit on path A. Press `⎋` to suspend.
2. With the select tool, move path A.
3. Re-enter path-edit on path A. The previous edit session should be discarded (verify with a temp log: `beginJournal` should be called again).

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/modality
git commit -m "feat(apps/draw): discard cached journal when intervening edits touched its target"
```

---

### Task 23: Clear journal cache on save/load

When the user saves or loads a file, the journal cache must be cleared per spec.

**Files:**
- Modify: `apps/draw/src/App.tsx` (or wherever save/load handlers live)

- [ ] **Step 1: Locate save / load handlers**

Run: `grep -n "save\|load\|onSave\|onLoad\|exportScene\|importScene" apps/draw/src/App.tsx | head -20`

- [ ] **Step 2: Call `machine.clearJournalCache()` from each**

In every save/load callback, add a leading line:

```tsx
machine.clearJournalCache();
```

If the save/load flow goes through Redux/state-machine actions, hook into the matching event subscription.

- [ ] **Step 3: Smoke test**

In the dev server:
1. Enter path-edit on path A. `⎋` to suspend.
2. Save the file.
3. Re-enter path-edit on path A. Should be a fresh journal (verify `beginJournal` called).

- [ ] **Step 4: Commit**

```bash
git add apps/draw/src/App.tsx
git commit -m "feat(apps/draw): clear journal cache on save/load"
```

---

### Task 24: Final integration test

A single test that exercises the whole stack: enter path-edit via double-click, journal active, decoration layer painting, palette greyed, scoping dim applied, exit via `⎋`, re-enter via double-click → resume.

**Files:**
- Create: `apps/draw/src/modality/integration.endToEnd.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import App from '../App';

describe('path-edit end-to-end integration', () => {
  it('double-click on a path enters path-edit; breadcrumb visible; tools greyed; ⎋ suspends', () => {
    render(<App />);

    // (1) Draw or seed a path. The simplest is to seed via App's initial
    // scene if it accepts one; otherwise fire pen-tool gestures via
    // fireEvent.pointerDown/Move/Up on the canvas.

    // (2) Locate the path's rendered hit area and double-click.

    // (3) Assert breadcrumb is in the DOM.
    expect(screen.getByText(/path edit/i)).toBeTruthy();

    // (4) Assert a known selection tool is aria-disabled.
    expect(screen.getByRole('button', { name: /select/i })).toHaveAttribute('aria-disabled', 'true');

    // (5) Press Escape; assert breadcrumb gone.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/path edit/i)).toBeNull();
  });
});
```

> **Fill in seeding.** Replace the placeholder comments with concrete pen-tool gestures or a `useScene` initial-state injection. Reference `apps/draw/src/recorder.test.ts` for existing examples of programmatic scene seeding.

- [ ] **Step 2: Run the test**

Run: `npx vitest run apps/draw/src/modality/integration.endToEnd.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run all app + kit tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: green across the board.

- [ ] **Step 4: Commit**

```bash
git add apps/draw/src/modality/integration.endToEnd.test.tsx
git commit -m "test(modality): path-edit end-to-end integration"
```

---

## Follow-up plans (NOT this plan)

Explicitly out of scope; each is its own plan:

1. **Sub-tools for path-edit.** `useDirectSelectTool`, `useAddAnchorTool`, `useDeleteAnchorTool`, `useConvertAnchorTool`, `useScissorsTool`. Each tagged `capabilities: ['edits-anchors']`. Wires per-anchor drag/click into anchor ops.

2. **Isolation mode end-to-end.** Group-target scoping (target = group subtree). Breadcrumb segmentation (`Group › Subgroup ›`). Background-click clears scoped selection only.

3. **Free-transform mode end-to-end.** `useFreeTransformTool` with `capabilities: ['transforms-selection']`. Strict-mode commit/cancel chrome buttons wired. Transform handles painter.

4. **Text-edit mode end-to-end.** Text caret tool, commit-on-blur, integration with existing text-node rendering.

5. **Crop mode end-to-end.** Page-edit handles, strict-mode lifecycle.

6. **Isolation + free-transform nesting.** The one allowed nesting case from the spec; needs careful breadcrumb composition and journal-on-journal commit rollup.

Each becomes a fresh `docs/superpowers/plans/` plan.

---

## Self-review notes

- **Spec coverage.** Phases 1–4 cover spec §"WeaselDraw integration" + §"Mode-switch UX" except for the deferred sub-tools and the four non-path-edit modes (called out as follow-ups). Capability-tag declarations on tools cover spec §"Capability tags". Background-click composition covers spec §"Coordination with the Canvas/SceneCanvas seam refactor" → background-click table. Journal cache, staleness, save/load clear cover spec §"Suspend / resume" and §"Cache policy".
- **Placeholders.** Two acknowledged: Task 7's render-trace test bodies (depend on the renderer's testing affordances — written to be filled in after recon) and Task 16/24's palette/integration tests (depend on the App's exact JSX, which a fresh engineer fills in via the named grep step). Both are flagged in-task rather than left as silent gaps.
- **Type consistency.** `ModeMachine`, `Journal`, `ModeRegistry`, `JournalCache` names match across tasks. `applyOps` (not `applyBatch`) is used consistently at the `ToolCtx` level; `applyBatch` only appears on `Journal` / `History` (their actual method).
- **CLAUDE.md compliance.** Task 20 explicitly notes the no-inline-styles rule and recommends the class-based variant for tint colours. Task 16 also avoids inline styles via a CSS class.
- **Sequencing.** Task 1 → Task 4 → Task 7 unlocks Phase 2. Task 8 → Task 10 → Task 22 is the journal-lifecycle thread. Task 17 → 18 → 19 → 20 → 21 is the visible-functionality thread.
