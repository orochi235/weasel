# Contribution Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the kit's `Tool` into a `Contribution` — a registry entry that declares what it contributes and when it is eligible — so a focus-driven tool is one case of it, `@weasel-js/hud` stops casting itself into a shape it isn't, and one assembly point sees every binding.

**Architecture:** `Contribution` carries independently-optional roles (bindings, actions, overlay, affordances, cursor, presentation). `Tool<TScratch>` narrows it to `eligibility.focus` plus the fields only a focus-driven mode uses. Eligibility becomes a *set of conditions* — `focus`, `offhand`, `always`, `claimed` — because one entry holds several at once, and the dispatcher's `BindingScope` tier is derived from whichever condition is live rather than from which argument the consumer passed the entry in. `@weasel-js/modes` capabilities fold in as a filter on the same object. `useContributions` assembles everything, including the action `defaultBinding`s that `ActionsRegistry` assembles separately today.

**Tech Stack:** TypeScript, React, vitest. Packages: `@weasel-js/core`, `@weasel-js/modes`, `@weasel-js/hud`, `@weasel-js/ui`.

**Spec:** `docs/superpowers/specs/2026-08-10-contributor-registry-design.md`
**Depends on:** plan 1 (`docs/superpowers/plans/2026-08-10-claims-and-precedence.md`), merged. This plan uses its vocabulary — *claim*, `strength`, `owner` — and does not change it.

---

## Read this before starting

**Plan 1 was executed and five of its tests had to be rewritten** because they asserted on a seam the change didn't touch. Two examples, so you recognize the shape: a test asserted `hitTestExtras().binding.cursor`, but that function passes the layer's object through verbatim and was never broken — the defect was one layer downstream. Another asserted `hitTestExtras().layerId` to cover `owner: extra.layerId`, a *different line in a different file* — mutating `owner` to a literal still passed.

So for every test in this plan: **revert the production change, run it, confirm it fails, restore.** Paste both outputs in your report. If a test passes with the change reverted, that is a finding, not a formality — stop and report it.

**Two verification facts from plan 1**, so you don't rediscover them:
- `vitest` transforms with esbuild and never typechecks. A type error will not fail a test run. Type errors surface only under `npx tsc --noEmit` from the repo root; the per-package `tsc -p .` excludes test files.
- `packages/theme/src/generated/determinism.test.ts` intermittently times out at 5000ms shelling to `npm run gen:tokens`. Unrelated and load-dependent. Note it and move on.

**Shared checkout.** Another session may be working here. Stage explicit paths (`git add <path>`, never `-A` or `.`). Never amend or rebase a commit — always add a new one.

---

## The shape of what exists

`Tool<TScratch>` (`packages/core/src/tools/types.ts`) already carries `bindings`, `actions`, `overlay`, `cursor`, `presentation`, `capabilities`, `keybinding`, plus focus-only fields: `initScratch`, `onActivate`/`onDeactivate`, `previewPose`, `previewBounds`, `previewIds`.

`useTools({ active, registry, ambient })` (`packages/core/src/tools/useTools.ts`) holds slot state and rolls up overlays. `assembleScopedBindings` (`packages/core/src/interactions/dispatcher/dispatcher.ts:684-738`) walks exactly three sources — `ctx.hotkeyStack`, `ctx.activeToolId`, `ctx.ambientToolIds` — so **a merely-registered tool contributes no bindings at all.** Verify this yourself before relying on it; plan 1 shipped a wrong claim about it.

Two facts that shape the eligibility design:
1. **The hand tool is both** palette-selectable and space-held. So eligibility cannot be one enum value.
2. **`ToolDef.hotkey` is reflection-only.** Its own doc says setting it "does NOT automatically engage the held-key behavior" — the behavior lives in the consolidated `tool.offhand` action, which the host registers separately via `buildToolOffhandBindings` + `BUILTIN_OFFHAND_ACTIONS` (`packages/core/src/interactions/actions/defaults/toolOffhand.ts`).

---

## File Structure

**Created:**
- `packages/core/src/contributions/types.ts` — `Contribution`, `Eligibility`.
- `packages/core/src/contributions/eligibility.ts` — condition → `BindingScope` resolution.
- `packages/core/src/contributions/eligibility.test.ts`
- `packages/core/src/contributions/useContributions.ts` — assembly.
- `packages/core/src/contributions/useContributions.test.ts`
- `packages/core/src/contributions/merge.ts` — `mergeContributions`.
- `packages/core/src/contributions/merge.test.ts`
- `packages/core/src/contributions/index.ts`

**Modified:**
- `packages/core/src/tools/types.ts` — `Tool` narrows to `Contribution`.
- `packages/core/src/tools/useTools.ts` — shim over `useContributions`.
- `packages/core/src/interactions/dispatcher/dispatcher.ts` — `assembleScopedBindings` reads declared conditions.
- `packages/modes/src/eligibility.ts` — `eligibleTool` accepts a contribution.
- `packages/core/src/index.ts`, `packages/hud/src/tool.ts`, `packages/ui/src/components/ToolPalette/ToolPalette.tsx`.

---

### Task 1: `Contribution` and `Eligibility` types

Types only — no behavior, no consumers yet. The next tasks give them meaning.

**Files:**
- Create: `packages/core/src/contributions/types.ts`, `packages/core/src/contributions/index.ts`
- Test: none (a type-only task; Task 2 is where behavior starts)

- [ ] **Step 1: Write the types**

Create `packages/core/src/contributions/types.ts`:

```ts
import type { RenderLayer } from 'core/layers/render';
import type { GestureBinding } from '../interactions/actions/binding';
import type { Action } from '../interactions/actions/registry';
import type { CapabilityTag } from '@weasel-js/modes';
import type { HotkeyTrigger, ToolCtx, ToolPresentation } from '../tools/types';

/**
 * When an entry's bindings are live. A set, not one value: the hand tool is
 * palette-selectable AND engaged by holding space, and both hold at once.
 */
export interface Eligibility {
  /** Selectable as the focused entry — exclusive, one at a time. */
  focus?: boolean;
  /** Also live while this key is held. */
  offhand?: HotkeyTrigger;
  /** Live regardless of what is focused. */
  always?: boolean;
  /** Live only for input this entry's own affordances produced. */
  claimed?: boolean;
  /** Modality filter, applied wherever it would otherwise be live. */
  capabilities?: CapabilityTag[];
}

/**
 * A registry entry: what it contributes, and when it is eligible. Every role
 * is optional and independent — an entry that only routes input declares only
 * `bindings` and `actions`.
 */
export interface Contribution {
  id: string;
  eligibility: Eligibility;
  bindings?: GestureBinding[];
  actions?: Action[];
  overlay?: RenderLayer<unknown>;
  cursor?: string | ((ctx: ToolCtx) => string);
  presentation?: ToolPresentation;
  /** Reflection escape hatch — the authored form, when there was one. */
  def?: unknown;
}
```

Create `packages/core/src/contributions/index.ts`:

```ts
export type { Contribution, Eligibility } from './types';
```

- [ ] **Step 2: Export from the barrel**

In `packages/core/src/index.ts`, add alongside the existing tool-type exports:

```ts
export type { Contribution, Eligibility } from './contributions';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `@weasel-js/modes` or `interactions/actions/registry` can't be imported from this path, match the import style used by `packages/core/src/tools/types.ts` — it imports the same things.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/contributions/types.ts packages/core/src/contributions/index.ts \
        packages/core/src/index.ts
git commit -m "feat(core): a contribution declares what it contributes and when it is eligible"
```

---

### Task 2: Eligibility resolves to a binding scope

The dispatcher's `BindingScope` (`'hotkey' | 'active' | 'ambient'`) stays exactly as it is. What changes is that the tier is *derived* from a declaration rather than from which argument the consumer passed an entry in.

**Files:**
- Create: `packages/core/src/contributions/eligibility.ts`
- Test: `packages/core/src/contributions/eligibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/contributions/eligibility.test.ts`:

```ts
/**
 * One entry can satisfy several conditions at once — the hand tool is
 * palette-selectable and space-held — so this resolves to the HIGHEST-priority
 * live tier, matching the dispatcher's existing hotkey > active > ambient walk.
 */
import { describe, expect, it } from 'vitest';
import { liveScope } from './eligibility';
import type { Eligibility } from './types';

const state = { focusedId: 'hand', heldTriggers: new Set<string>() };

describe('liveScope', () => {
  it('gives the focused entry active scope', () => {
    const e: Eligibility = { focus: true };
    expect(liveScope('hand', e, state)).toBe('active');
  });

  it('gives an unfocused focus-only entry no scope at all', () => {
    const e: Eligibility = { focus: true };
    expect(liveScope('rect', e, state)).toBeNull();
  });

  it('gives an always-on entry ambient scope regardless of focus', () => {
    expect(liveScope('viewport', { always: true }, state)).toBe('ambient');
  });

  it('gives a claimed-only entry ambient scope', () => {
    expect(liveScope('weasel-hud', { claimed: true }, state)).toBe('ambient');
  });

  it('prefers hotkey over active when both conditions are live', () => {
    // The hand tool, focused AND space-held. The dispatcher walks hotkey first,
    // so reporting 'active' here would change which tier its bindings land in.
    const held = { focusedId: 'hand', heldTriggers: new Set(['space']) };
    expect(liveScope('hand', { focus: true, offhand: 'space' }, held)).toBe('hotkey');
  });

  it('gives an offhand entry no scope while its trigger is up', () => {
    expect(liveScope('hand', { offhand: 'space' }, state)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/core/src/contributions/eligibility.test.ts`
Expected: FAIL — `Failed to resolve import "./eligibility"`.

- [ ] **Step 3: Implement**

Create `packages/core/src/contributions/eligibility.ts`:

```ts
import type { BindingScope } from '../interactions/dispatcher/matcher';
import type { Eligibility } from './types';

/** What the registry knows at dispatch time. */
export interface EligibilityState {
  focusedId: string | null;
  heldTriggers: ReadonlySet<string>;
}

/**
 * The scope tier an entry's bindings are live at, or null when none are.
 * Ordered hotkey > active > ambient to match the dispatcher's own walk.
 */
export function liveScope(
  id: string,
  eligibility: Eligibility,
  state: EligibilityState,
): BindingScope | null {
  if (eligibility.offhand && state.heldTriggers.has(eligibility.offhand)) return 'hotkey';
  if (eligibility.focus && state.focusedId === id) return 'active';
  if (eligibility.always || eligibility.claimed) return 'ambient';
  return null;
}
```

Export it from `packages/core/src/contributions/index.ts`:

```ts
export { liveScope } from './eligibility';
export type { EligibilityState } from './eligibility';
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/core/src/contributions/eligibility.test.ts`
Expected: PASS, all six.

- [ ] **Step 5: Prove the test is real**

Change the `offhand` line to run *after* the `focus` line, run the suite, and confirm the "prefers hotkey over active" case fails. Restore. Paste both outputs — the ordering is the whole content of that function and a test that doesn't pin it is worthless.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/contributions/eligibility.ts \
        packages/core/src/contributions/eligibility.test.ts \
        packages/core/src/contributions/index.ts
git commit -m "feat(core): derive a binding's scope tier from declared eligibility"
```

---

### Task 3: `capabilities` folds into eligibility

`Tool.capabilities` + `eligibleForMode` is a second eligibility mechanism answering "when is this usable" in a system that answers the same question with slots. This makes it one filter on one object. `eligibleForMode`'s predicate does not change — only where the tags are read from.

**Files:**
- Modify: `packages/modes/src/eligibility.ts`
- Modify: `packages/core/src/contributions/eligibility.ts`
- Test: `packages/core/src/contributions/eligibility.test.ts`, `packages/modes/src/eligibility.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/contributions/eligibility.test.ts`:

```ts
describe('liveScope honors the capability filter', () => {
  const focused = { focusedId: 'pen', heldTriggers: new Set<string>() };

  it('withholds scope from an entry the active mode disallows', () => {
    const e: Eligibility = { focus: true, capabilities: ['creates-paths'] };
    expect(liveScope('pen', e, { ...focused, allows: () => false })).toBeNull();
  });

  it('grants scope when the mode allows the entry', () => {
    const e: Eligibility = { focus: true, capabilities: ['creates-paths'] };
    expect(liveScope('pen', e, { ...focused, allows: () => true })).toBe('active');
  });

  it('ignores the filter when the entry declares no capabilities', () => {
    expect(liveScope('pen', { focus: true }, { ...focused, allows: () => false })).toBe('active');
  });
});
```

That last case matters: an entry declaring no capabilities must not be silently withheld. `eligibleForMode` returns `false` for an empty tag list, which is the opposite of what a capability-less contribution wants, so the filter must apply only when tags are present.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/core/src/contributions/eligibility.test.ts`
Expected: FAIL — `allows` is not part of `EligibilityState`, so it is ignored and the first case returns `'active'`.

- [ ] **Step 3: Implement**

In `packages/core/src/contributions/eligibility.ts`, add to `EligibilityState`:

```ts
  /** Whether the active mode allows these capability tags. Omitted → allow. */
  allows?: (tags: readonly CapabilityTag[]) => boolean;
```

and at the top of `liveScope`, before any tier check:

```ts
  const tags = eligibility.capabilities;
  if (tags && tags.length > 0 && state.allows && !state.allows(tags)) return null;
```

Import `CapabilityTag` from `@weasel-js/modes`.

- [ ] **Step 4: Widen the modes-side accessor**

In `packages/modes/src/eligibility.ts`, `ToolLike` already asks only for `{ id, capabilities }`, so a `Contribution` satisfies it structurally — but `Contribution` keeps its tags on `eligibility.capabilities`, not at the top level. Add a sibling that reads the nested shape, leaving `eligibleTool` in place for existing callers:

```ts
/** True iff a contribution is usable in the registry's active mode. */
export function eligibleContribution(
  reg: ModeRegistry,
  entry: { id: string; eligibility?: { capabilities?: readonly CapabilityTag[] } },
): boolean {
  return eligibleForMode(reg.current(), entry.eligibility?.capabilities ?? []);
}
```

Export it from `packages/modes/src/index.ts`.

- [ ] **Step 5: Run both suites**

Run: `npx vitest run packages/core/src/contributions packages/modes`
Expected: PASS.

- [ ] **Step 6: Prove the third case is real**

Delete the `tags.length > 0` guard, run, and confirm the "ignores the filter when the entry declares no capabilities" case fails. Restore. Paste both outputs.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/contributions/eligibility.ts \
        packages/core/src/contributions/eligibility.test.ts \
        packages/modes/src/eligibility.ts packages/modes/src/index.ts
git commit -m "feat(modes): read capability tags off a contribution's eligibility"
```

---

### Task 4: `Tool` narrows to `Contribution`

**Files:**
- Modify: `packages/core/src/tools/types.ts`
- Test: `packages/core/src/tools/types.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/tools/types.test.ts`:

```ts
import type { Contribution } from '../contributions/types';

describe('Tool is a Contribution', () => {
  it('accepts a focus-declaring tool wherever a contribution is wanted', () => {
    const t: Tool<null> = {
      id: 'rect',
      eligibility: { focus: true, capabilities: ['creates-shapes'] },
      bindings: [],
    };
    const c: Contribution = t;
    expect(c.id).toBe('rect');
  });

  it('accepts a bindings-only entry as a contribution without casting', () => {
    // `createHudTool` used `as unknown as Tool<null>` to get here.
    const c: Contribution = { id: 'weasel-hud', eligibility: { claimed: true }, bindings: [] };
    expect(c.eligibility.claimed).toBe(true);
  });
});
```

- [ ] **Step 2: Run `tsc`, not vitest**

Run: `npx tsc --noEmit`
Expected: FAIL — `eligibility` does not exist on `Tool`. **vitest will pass this test regardless**, because it strips types without checking them; that is why this step uses `tsc`.

- [ ] **Step 3: Implement**

In `packages/core/src/tools/types.ts`, make `Tool` extend `Contribution` and drop the fields it now inherits (`id`, `bindings`, `actions`, `overlay`, `cursor`, `presentation`, `def`, `capabilities`). Keep the focus-only fields:

```ts
export interface Tool<TScratch = unknown> extends Contribution {
  initScratch?: () => TScratch;
  onActivate?: (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  previewPose?: (id: string) => unknown;
  previewBounds?: (id: string) => ToolBounds | null;
  previewIds?: () => Iterable<string> | null;
  keybinding?: ToolKeybinding;
}
```

`cursor` is redeclared because `Contribution`'s is `ToolCtx` (unparameterized) and a tool's closes over its own scratch. If TypeScript rejects the narrowing, keep `cursor` only on `Tool` and drop it from `Contribution` — say so in your report; that is a real signal about where the field belongs.

Keep `Tool.capabilities` as a deprecated alias forwarding to `eligibility.capabilities`, or migrate every declaration site in one pass — **your call, but pick one and say which.** There are roughly a dozen sites under `packages/core/src/tools/builtin/`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean.
Run: `npm run test:kit` — pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/types.ts packages/core/src/tools/types.test.ts \
        packages/core/src/tools/builtin
git commit -m "refactor(core): Tool is the focus-declaring case of a contribution"
```

---

### Task 5: `useContributions` assembles one registry

**Files:**
- Create: `packages/core/src/contributions/useContributions.ts`, `useContributions.test.ts`
- Modify: `packages/core/src/tools/useTools.ts`, `packages/core/src/interactions/dispatcher/dispatcher.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/contributions/useContributions.test.ts`:

```ts
/**
 * Assembly reads declared eligibility, so an entry lands in a scope tier
 * because of what it says about itself — not because of which argument the
 * consumer passed it in.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useContributions } from './useContributions';
import type { Contribution } from './types';

const rect: Contribution = {
  id: 'rect', eligibility: { focus: true },
  bindings: [{ spec: { kind: 'drag' }, actionId: 'insert' }],
};
const hud: Contribution = {
  id: 'weasel-hud', eligibility: { claimed: true },
  bindings: [{ spec: { kind: 'drag', target: { kindOf: () => true } }, actionId: 'hud.drag' }],
};

describe('useContributions', () => {
  it('scopes a focused entry active and a claimed entry ambient', () => {
    const { result } = renderHook(() => useContributions({ entries: [rect, hud], focused: 'rect' }));
    const scoped = result.current.scopedBindings();
    expect(scoped.find(s => s.ownerToolId === 'rect')?.scope).toBe('active');
    expect(scoped.find(s => s.ownerToolId === 'weasel-hud')?.scope).toBe('ambient');
  });

  it('omits an unfocused focus-only entry entirely', () => {
    const { result } = renderHook(() => useContributions({ entries: [rect, hud], focused: 'other' }));
    expect(result.current.scopedBindings().some(s => s.ownerToolId === 'rect')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/core/src/contributions/useContributions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `useContributions.ts` returning `{ entries, focused, setFocused, scopedBindings(), overlays() }`. `scopedBindings()` maps each entry through `liveScope` and emits `ScopedBinding[]` (`{ binding, scope, ownerToolId }`) for every entry with a live tier. `overlays()` is the roll-up `useTools.getActiveOverlays` does today, in the same order: focused, then held, then ambient.

Read `useTools.ts` first and preserve its behaviors: first-mount-wins focus sync, memoized return identity (consumers use it as an effect dep and it loops otherwise), and the dev-only `reportRouteConflicts` call.

- [ ] **Step 4: Fold in the action `defaultBinding`s**

`ActionsRegistry` assembles these separately, which is why `reportRouteConflicts` sees tool bindings and never action defaults — a tool binding colliding with an action's default goes unreported. Have `useContributions` include them in what it hands the conflict reporter.

Add a test: a contribution binding that collides with an action `defaultBinding` is reported. **Verify it fails before the change** — this is the P3 gap this task closes, and a test that passes either way proves nothing.

- [ ] **Step 5: Shim `useTools`**

Rewrite `useTools({ active, registry, ambient })` over `useContributions`: `registry` entries get `focus: true`, `ambient` entries `always: true`, a `ToolDef.hotkey` declaration becomes `offhand`. Its public `ToolsApi` shape does not change.

- [ ] **Step 6: Point the dispatcher at declared scope**

`assembleScopedBindings` (`dispatcher.ts:684-738`) walks `hotkeyStack` / `activeToolId` / `ambientToolIds`. Have it consume `scopedBindings()` instead. **Confirm the three-source claim yourself first** by reading the function — plan 1 shipped a wrong assertion about this exact code.

- [ ] **Step 7: Verify hard**

Run: `npm run test:kit`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

This task rewires every gesture in the kit. Any dispatcher test failing here is a real regression — do not adjust a test to fit. Report and stop.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/contributions packages/core/src/tools/useTools.ts \
        packages/core/src/interactions/dispatcher/dispatcher.ts
git commit -m "feat(core): assemble one registry from declared eligibility"
```

---

### Task 6: `offhand` becomes load-bearing

`ToolDef.hotkey` is declared, read by the inspector, and wires nothing. Assembly is the one place that can read the declaration and register the binding.

**Files:**
- Modify: `packages/core/src/contributions/useContributions.ts`
- Modify: `packages/core/src/tools/useKeybindings.ts`
- Test: `packages/core/src/contributions/useContributions.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test asserting that an entry declaring `eligibility.offhand: 'space'` produces a `tool.offhand` binding in the assembled set, without the host calling `buildToolOffhandBindings` itself.

- [ ] **Step 2: Run it and confirm it fails**

Expected: FAIL — declaring `offhand` wires nothing today.

- [ ] **Step 3: Implement**

Have `useContributions` synthesize the `tool.offhand` `BoundGesture` for each entry declaring `offhand`, using `buildToolOffhandBindings` + `makeToolOffhandAction` (`packages/core/src/interactions/actions/defaults/toolOffhand.ts`). Remove the now-duplicated host-side registration from `useKeybindings.ts` — **check `BUILTIN_OFFHAND_ACTIONS` for double-registration before and after**; space-for-hand engaging twice is the failure mode.

- [ ] **Step 4: Verify**

Run: `npm run test:kit`, then manually confirm space-drag still pans in the app (`npm run dev:kit`).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/contributions/useContributions.ts \
        packages/core/src/tools/useKeybindings.ts \
        packages/core/src/contributions/useContributions.test.ts
git commit -m "feat(core): a declared offhand trigger registers its own binding"
```

---

### Task 7: `mergeContributions`, and hud stops casting

**Files:**
- Create: `packages/core/src/contributions/merge.ts`, `merge.test.ts`
- Modify: `packages/hud/src/tool.ts`

- [ ] **Step 1: Write the failing test**

Create `merge.test.ts`: merging two bundles concatenates entries in order; a duplicate id throws naming the id (silently dropping one is how a feature loses its bindings with no diagnostic).

- [ ] **Step 2: Run it and confirm it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `mergeContributions(...bundles: Contribution[][]): Contribution[]`**

- [ ] **Step 4: Drop hud's cast**

In `packages/hud/src/tool.ts`, `createHudTool` currently ends `} as unknown as Tool<null>;`. Return a `Contribution` with `eligibility: { claimed: true }` and no cast. Keep all three `kindOf: isHudHit` guards — they must consult the affordance or the HUD's own exclusive claim filters them out.

Rename to `createHudContribution` with `createHudTool` kept as a deprecated alias, **or** keep the name — say which and why.

- [ ] **Step 5: Verify**

Run: `npx vitest run packages/hud`, `npm run test:kit`, `npx tsc --noEmit`.

The HUD integration tests from plan 1 are the real check: a window must still drag while `rect` is active, and with `select` active.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/contributions/merge.ts packages/core/src/contributions/merge.test.ts \
        packages/core/src/contributions/index.ts packages/hud/src/tool.ts
git commit -m "feat(hud): the HUD is a contribution, not a tool wearing a cast"
```

---

### Task 8: Docs and changeset

**Files:**
- Modify: `docs/taxonomy.md`, `docs/extending.md`, `docs/TODO.md`
- Create: `.changeset/contribution-registry.md`

- [ ] **Step 1: Taxonomy**

`docs/taxonomy.md`'s **Tool** and **Tool registry** sections describe the slot model. Rewrite around `Contribution`: what an entry contributes, the four eligibility conditions, and that `Tool` is the focus-declaring case. Say it once — the design doc argues it, the taxonomy states it.

- [ ] **Step 2: `extending.md`**

Its tool-authoring guidance says to pass tools via `registry`/`ambient`. Update to declared eligibility.

- [ ] **Step 3: TODO**

Close **Plugin/bundling convention v1** — `mergeContributions` is its v1. Close the P3 **"Route-conflict detection can't see tool-vs-action collisions"** if Task 5 closed it; if not, say why. Check whether the P3 **"ambient rotate-tool mount is near-vestigial"** entry is now decidable — an entry declaring no bindings and no overlay is visible as such in one registry.

- [ ] **Step 4: Changeset**

Cover: `Contribution` and `Eligibility`; `Tool` narrowed; `useTools` shimmed with an unchanged public shape; capabilities read from `eligibility`; `offhand` now wiring itself; `mergeContributions`; hud's cast gone. Name every behavior change a consumer could trip on, in plain terms — plan 1's changeset had to be corrected twice for overclaiming, so state what the change does *not* do as well.

- [ ] **Step 5: Verify the docs against the code**

Grep for every symbol the docs name and confirm it exists. Plan 1's docs asserted `claimsAll` and `WindowWidget.cursor` after both were deleted.

- [ ] **Step 6: Commit**

```bash
git add docs/taxonomy.md docs/extending.md docs/TODO.md .changeset/contribution-registry.md
git commit -m "docs: contributions, declared eligibility, and one registry"
```

---

## Final verification

- [ ] `npx tsc --noEmit && npm test && npm run lint && npm run build` — all clean.
- [ ] Launch the app (`npm run dev:kit`) and confirm by hand: tool palette switches tools; space-drag pans; a HUD window drags while `rect` is active; the loupe still works.

---

## Notes for the implementer

**Out of scope, deliberately.** The `targetConsultsAffordance` P2 (`docs/TODO.md`) — the exclusive filter infers "consults the affordance" from the presence of a `kindOf` key, and `predicates.ts`'s `isBody`/`isEmpty` family has that shape while reading only `bodyTarget`. It is a real hole and it is not this plan's. Do not fix it here; do not build on the assumption that it's fixed.

**The riskiest task is 5.** It rewires every gesture in the kit through a new assembly path. If it starts sprawling, stop and report rather than pushing through — splitting it (assembly first, dispatcher swap second) is a legitimate outcome and better than a half-migrated dispatcher.
