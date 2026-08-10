# Claims and Precedence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an affordance hit a full claim — naming its owner, its strength, and its cursor — and let an exclusive claim outrank the dispatcher's scope tier, so chrome a registered layer owns cannot be swallowed by whatever tool happens to be active.

**Architecture:** `AffordanceHit` gains `owner` and `strength`. Kit chrome fills them with `strength: 'shared'`, which is exactly today's behavior. Registered layers, which currently return a bare `AffordanceBinding` from `RenderLayer.hitTest` and get flattened to a kind string, return a `LayerHit` that can also carry `cursor` and `claim`. `matchSorted` gains a pre-pass: when the event carries an exclusive claim, only bindings whose `target` actually consults the affordance are candidates; scope ordering then applies within that filtered set unchanged.

**Tech Stack:** TypeScript, React, vitest, `@testing-library/react`. Packages touched: `@weasel-js/core`, `@weasel-js/hud`, `apps/draw` (one test expectation).

**Spec:** `docs/superpowers/specs/2026-08-10-contributor-registry-design.md`

---

## Background an implementer needs

**The bug this fixes.** `matchSorted` (`packages/core/src/interactions/dispatcher/matcher.ts:167`) loops scope tiers outermost — `hotkey`, then `active`, then `ambient`. Specificity only orders bindings *within* one tier. So an `active`-scope binding as vague as `{ kind: 'drag' }` beats an `ambient`-scope binding as precise as `{ kind: 'drag', target: { kindOf: isHudHit } }`. `@weasel-js/hud` mounts ambient, so a HUD window will not drag while `rect`, `ellipse`, `polygon`, `star`, `hand`, `pen` or `lasso` is active.

**Why not just add a predicate to those seven tools.** That was done once already, for `select` (commit `4457351f`), and it is a workaround: each tool has to know that chrome exists and decline it by hand. Task 5 deletes that workaround, which is the proof the general rule replaced it.

**Two hit-test paths reach the same place.** Kit chrome goes through `buildAffordanceAt` → `hitAffordanceRegions` → `toAffordanceHit` (`packages/core/src/canvas/affordanceAt.ts`). Consumer layers go through `CanvasExtensionApi.hitTestExtras` → a hand-built object literal in `SceneCanvas.tsx:2255`. The second path is where `cursor` gets dropped.

**Vocabulary.** *Claim* = what an `AffordanceHit` now is: who owns this point and how strongly. *Exclusive* = nothing may act on this point unless its binding names the claim. *Shared* = today's behavior, the default.

---

## File Structure

**Modified:**
- `packages/core/src/interactions/actions/invoker.ts` — `AffordanceHit` gains `owner`, `strength`.
- `packages/core/src/affordances/types.ts` — new `LayerHit` interface.
- `packages/core/src/affordances/index.ts` — export `LayerHit`.
- `packages/core/src/core/layers/render.ts` — `RenderLayer.hitTest` returns `LayerHit | null`.
- `packages/core/src/canvas/canvasExtension.ts` — `hitTestExtras` returns `{ layerId, binding: LayerHit }`.
- `packages/core/src/canvas/affordanceAt.ts` — `toAffordanceHit` fills `owner` / `strength`.
- `packages/core/src/canvas/SceneCanvas.tsx:2255` — layer branch builds a full claim.
- `packages/core/src/interactions/dispatcher/matcher.ts` — `targetConsultsAffordance` + the pre-pass.
- `packages/core/src/index.ts` — export `LayerHit`.
- `packages/hud/src/widget.ts` — `Widget.cursorAt?`.
- `packages/hud/src/widgets/window/window.ts` — implement `cursorAt`.
- `packages/hud/src/attach.ts` — layer `hitTest` returns an exclusive claim carrying the cursor.
- `packages/hud/src/tool.ts` — drop the repeated `kindOf` guard.
- `packages/core/src/tools/builtin/select/useSelectTool.ts` — revert the workaround.
- `apps/draw/src/dev/registryProbe.test.tsx` — expectation follows the revert.

**Created:**
- `packages/core/src/interactions/dispatcher/matcher.claims.test.ts`
- `packages/core/src/canvas/SceneCanvas.layerClaim.test.tsx`
- `.changeset/claims-and-precedence.md`

---

### Task 1: `AffordanceHit` carries owner and strength

Kit chrome fills both. `strength` is `'shared'` everywhere in this task, so nothing changes behaviorally — this task only makes the claim expressible.

**Files:**
- Modify: `packages/core/src/interactions/actions/invoker.ts:43-71`
- Modify: `packages/core/src/canvas/affordanceAt.ts:130-146`
- Test: `packages/core/src/canvas/affordanceAt.cursor.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/canvas/affordanceAt.cursor.test.ts`:

```ts
describe('AffordanceHit carries its owner and claim strength', () => {
  const affordanceAt = buildAffordanceAt({
    getChromeState: () => makeState(),
    getView: () => VIEW,
  });

  it('names the affordance that produced the hit as its owner', () => {
    expect(affordanceAt({ x: 0, y: 0 })?.owner).toBe('corner-resize');
  });

  it('claims shared, so kit chrome keeps competing on scope as it always has', () => {
    expect(affordanceAt({ x: 0, y: 0 })?.strength).toBe('shared');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/core/src/canvas/affordanceAt.cursor.test.ts`
Expected: FAIL — `expected undefined to be 'corner-resize'`.

If the first assertion fails on the *value* rather than on `undefined`, read the `id` field of the affordance returned by `createCornerResizeAffordance` in `packages/core/src/affordances/cornerResize.ts` and use that string instead. `affordanceId` is whatever that factory set as its `id`.

- [ ] **Step 3: Add the fields to the type**

In `packages/core/src/interactions/actions/invoker.ts`, inside `interface AffordanceHit`, directly after the `kind` field:

```ts
  /** Id of whatever produced this hit — a kit affordance's `id`, or the
   *  registered layer's id. Bindings name it; the dispatcher ranks by it. */
  owner?: string;
  /** `'exclusive'` means no binding may act on this point unless its target
   *  consults the affordance. `'shared'` (the default) competes on scope and
   *  specificity as bindings always have. */
  strength?: 'exclusive' | 'shared';
```

- [ ] **Step 4: Fill them for kit chrome**

In `packages/core/src/canvas/affordanceAt.ts`, in `toAffordanceHit`, add two properties to the returned object literal immediately after `kind`:

```ts
    kind: hit.region.hitKind ?? `${hit.affordanceId}:${hit.regionId}`,
    owner: hit.affordanceId,
    strength: 'shared',
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/core/src/canvas/affordanceAt.cursor.test.ts`
Expected: PASS, all assertions in the file.

- [ ] **Step 6: Run the surrounding suites to confirm nothing moved**

Run: `npx vitest run packages/core/src/canvas packages/core/src/interactions`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/interactions/actions/invoker.ts \
        packages/core/src/canvas/affordanceAt.ts \
        packages/core/src/canvas/affordanceAt.cursor.test.ts
git commit -m "feat(core): affordance hits name their owner and claim strength"
```

---

### Task 2: `LayerHit` — a registered layer produces a real claim

Today `RenderLayer.hitTest` returns `AffordanceBinding`, which holds only `initialScratch`, and `SceneCanvas` flattens it to `{ kind, payload }`. A layer cannot report a cursor even though the hover pump would consume one.

**Files:**
- Modify: `packages/core/src/affordances/types.ts`
- Modify: `packages/core/src/affordances/index.ts`
- Modify: `packages/core/src/core/layers/render.ts:80-95`
- Modify: `packages/core/src/canvas/canvasExtension.ts:44`
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:2250-2265`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/canvas/SceneCanvas.layerClaim.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/SceneCanvas.layerClaim.test.tsx`:

```tsx
/**
 * A registered layer's declared cursor reaches `canvas.style.cursor`.
 *
 * Assert through the hover-cursor pump, NOT on `hitTestExtras` — that return
 * value passes the layer's object through verbatim and was never broken. The
 * defect is one layer downstream, where `wrappedAffordanceAt` rebuilds the hit
 * and drops everything it doesn't name.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { SceneCanvasApi } from './canvasExtension';
import type { RenderLayer } from 'core/layers/render';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

interface Empty { id: string }

const claimLayer: RenderLayer<unknown> = {
  id: 'test-claimer',
  label: 'Test claimer',
  space: 'screen',
  draw: () => [],
  hitTest: () => ({
    initialScratch: { note: 'hi' },
    cursor: 'nwse-resize',
    strength: 'exclusive',
  }),
};

function Harness({ apiOut }: { apiOut: { ref: React.RefObject<SceneCanvasApi | null> } }) {
  const ref = React.useRef<SceneCanvasApi>(null);
  apiOut.ref = ref;
  const scene = useScene<Empty>({ items: [] });
  React.useEffect(() => ref.current?.registerLayer(claimLayer), []);
  return <SceneCanvas ref={ref} width={200} height={200} scene={scene} layers={{}} />;
}

/** jsdom's PointerEvent constructor drops clientX/clientY; synthesize. */
function makePointerEvent(type: string, init: Record<string, unknown> = {}): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

describe('a registered layer produces a full claim', () => {
  it('reports its cursor through the hover-cursor pump', async () => {
    const apiOut = { ref: { current: null } as React.RefObject<SceneCanvasApi | null> };
    const { container } = render(<Harness apiOut={apiOut} />);
    await act(async () => {});

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    });

    expect(canvas.style.cursor).toBe('nwse-resize');
  });

  it('carries strength through hitTestExtras', async () => {
    // Passthrough only: `strength` gets its first runtime consumer in Task 3.
    const apiOut = { ref: { current: null } as React.RefObject<SceneCanvasApi | null> };
    render(<Harness apiOut={apiOut} />);
    await act(async () => {});

    expect(apiOut.ref.current!.hitTestExtras(10, 10)!.binding.strength).toBe('exclusive');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/core/src/canvas/SceneCanvas.layerClaim.test.tsx`
Expected: FAIL — `expected 'default' to be 'nwse-resize'`.

**Do not expect vitest to surface a type error.** It transforms with esbuild and never typechecks, so a `cursor` field TypeScript would reject still runs fine; type errors surface only under `npx tsc --noEmit` from the repo root (the per-package `tsc -p .` excludes test files). That is why the cursor assertion must be behavioral — it is the one that can fail for the right reason. Asserting on `hitTestExtras().binding.cursor` would not: that return value passes the layer's own object through verbatim and was never broken.

- [ ] **Step 3: Add the `LayerHit` type**

Append to `packages/core/src/affordances/types.ts`:

```ts
/**
 * What a **registered layer's** `hitTest` returns. Extends `AffordanceBinding`
 * so existing implementations keep typechecking; the added fields are how a
 * consumer's own chrome says the things kit chrome says through
 * `AffordanceRegion` — which cursor to show, and whether it owns the point
 * outright.
 */
export interface LayerHit<TScratch = unknown> extends AffordanceBinding<TScratch> {
  /** CSS cursor while the pointer is over this hit. Reaches the hover-cursor
   *  pump as `AffordanceHit.cursor`, the same path kit chrome uses. */
  cursor?: string;
  /** `'exclusive'` bars every binding whose target doesn't consult the
   *  affordance. Omitted means `'shared'` — today's behavior. Same name and
   *  meaning as `AffordanceHit.strength`, which it becomes. */
  strength?: 'exclusive' | 'shared';
}
```

- [ ] **Step 4: Export it**

In `packages/core/src/affordances/index.ts`, add `LayerHit` to the existing `export type { ... } from './types'` list.

In `packages/core/src/index.ts`, find the existing affordance type re-exports (search for `AffordanceRegion`) and add `LayerHit` alongside them.

- [ ] **Step 5: Widen the two contracts that carry it**

In `packages/core/src/core/layers/render.ts`, change `hitTest`'s return type:

```ts
  ) => import('../../affordances/types').LayerHit | null;
```

In `packages/core/src/canvas/canvasExtension.ts`, change the `hitTestExtras` signature and its import:

```ts
  hitTestExtras(worldX: number, worldY: number): { layerId: string; binding: LayerHit } | null;
```

Update the file's `import type { AffordanceBinding }` to import `LayerHit` instead (it has no other use of `AffordanceBinding`; if the compiler says otherwise, import both).

- [ ] **Step 6: Build the full claim in SceneCanvas**

In `packages/core/src/canvas/SceneCanvas.tsx`, replace the layer branch inside `wrappedAffordanceAt`:

```ts
      const extra = canvasApiRef?.current?.hitTestExtras?.(worldPoint.x, worldPoint.y);
      if (extra) {
        const claim = extra.binding;
        return {
          kind: `layer:${extra.layerId}`,
          owner: extra.layerId,
          strength: claim.strength ?? 'shared',
          ...(claim.cursor !== undefined ? { cursor: claim.cursor } : {}),
          ...(claim.initialScratch !== undefined ? { payload: claim.initialScratch } : {}),
        };
      }
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run packages/core/src/canvas/SceneCanvas.layerClaim.test.tsx`
Expected: PASS.

- [ ] **Step 8: Typecheck, since this changed two published contracts**

Run: `npx tsc --noEmit`
Expected: no errors. A `RenderLayer.hitTest` implementation returning an object literal with only `initialScratch` still satisfies `LayerHit`.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/affordances/types.ts packages/core/src/affordances/index.ts \
        packages/core/src/core/layers/render.ts packages/core/src/canvas/canvasExtension.ts \
        packages/core/src/canvas/SceneCanvas.tsx packages/core/src/index.ts \
        packages/core/src/canvas/SceneCanvas.layerClaim.test.tsx
git commit -m "feat(core): registered layers report cursor and claim strength"
```

---

### Task 3: An exclusive claim outranks the scope tier

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/matcher.ts`
- Test: `packages/core/src/interactions/dispatcher/matcher.claims.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/interactions/dispatcher/matcher.claims.test.ts`:

```ts
/**
 * Scope is the outermost sort key, so an active-scope binding as vague as
 * `{ kind: 'drag' }` beats an ambient-scope binding that names its target
 * precisely. That is why a HUD window wouldn't drag while `rect` was active.
 * An exclusive claim reverses it: only bindings that consult the affordance
 * are candidates at all.
 */
import { describe, expect, it } from 'vitest';
import { matchSorted, type ScopedBinding } from './matcher';
import type { InputEvent } from '@weasel-js/gestures';

const vagueActive: ScopedBinding = {
  binding: { spec: { kind: 'drag' }, actionId: 'insert' },
  scope: 'active',
  ownerToolId: 'rect',
};

const namedAmbient: ScopedBinding = {
  binding: {
    spec: {
      kind: 'drag',
      target: { kindOf: (h: unknown) => (h as { owner?: string })?.owner === 'weasel-hud' },
    },
    actionId: 'hud.drag',
  },
  scope: 'ambient',
  ownerToolId: 'weasel-hud',
};

function dragOn(affordance: unknown): InputEvent {
  return {
    kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    affordance,
  } as unknown as InputEvent;
}

const BINDINGS = [vagueActive, namedAmbient];

describe('exclusive claims outrank the scope tier', () => {
  it('lets an exclusive claim reach its owner past a vague active binding', () => {
    const hit = { kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' };
    const sorted = matchSorted(dragOn(hit), BINDINGS, false);
    expect(sorted.map(m => m.binding.actionId)).toEqual(['hud.drag']);
  });

  it('leaves shared claims on today’s scope ordering', () => {
    const hit = { kind: 'handle:top-left', owner: 'corner-resize', strength: 'shared' };
    const sorted = matchSorted(dragOn(hit), BINDINGS, false);
    expect(sorted[0]?.binding.actionId).toBe('insert');
  });

  it('leaves unclaimed presses on today’s scope ordering', () => {
    const sorted = matchSorted(dragOn(undefined), BINDINGS, false);
    expect(sorted[0]?.binding.actionId).toBe('insert');
  });

  it('drops a body-only target from contention under an exclusive claim', () => {
    // `target: 'empty'` reads bodyTarget and never sees the affordance, so a
    // marquee must not win a press on chrome floating over empty canvas.
    const bodyOnly: ScopedBinding = {
      binding: { spec: { kind: 'drag', target: 'empty' }, actionId: 'areaSelect' },
      scope: 'active',
      ownerToolId: 'select',
    };
    const e = { ...dragOn({ kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' }), bodyTarget: 'empty' } as unknown as InputEvent;
    const sorted = matchSorted(e, [bodyOnly, namedAmbient], false);
    expect(sorted.map(m => m.binding.actionId)).toEqual(['hud.drag']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/matcher.claims.test.ts`
Expected: FAIL on the first and fourth cases — `insert` / `areaSelect` sort ahead of `hud.drag` because `active` precedes `ambient`.

- [ ] **Step 3: Add the target classifier**

In `packages/core/src/interactions/dispatcher/matcher.ts`, after `targetRank`:

```ts
/**
 * True when a spec's target actually consults the affordance hit rather than
 * only the body classification. `kindOf` predicates are handed the hit;
 * `affordance:<k>` matches on its `kind`. The body-class strings (`'empty'`,
 * `'selected-body'`, `'unselected-body'`) and the `kind:` forms resolve from
 * `bodyTarget` / `bodyKind` and never see it — which is why chrome floating
 * over empty canvas used to read as empty canvas.
 */
export function targetConsultsAffordance(specTarget: unknown): boolean {
  if (specTarget === undefined) return false;
  if (typeof specTarget === 'object' && specTarget !== null && 'kindOf' in specTarget) return true;
  return typeof specTarget === 'string' && specTarget.startsWith('affordance:');
}

function specTargetOf(spec: GestureSpec): unknown {
  return 'target' in spec ? spec.target : undefined;
}

/** `'exclusive'` when the event carries a claim that bars unnamed bindings. */
function isExclusiveClaim(e: InputEvent): boolean {
  const hit = ('affordance' in e ? e.affordance : undefined) as
    { strength?: 'exclusive' | 'shared' } | undefined;
  return hit?.strength === 'exclusive';
}
```

- [ ] **Step 4: Apply the pre-pass in `matchSorted`**

In `matchSorted`, immediately after `const engaged = engagedChannels ?? EMPTY_ENGAGED;`:

```ts
  // An exclusive claim outranks the scope tier. Scope is the outermost sort
  // key below, so without this a vague active binding beats the claim owner's
  // precise ambient one — the whole reason chrome got swallowed by whichever
  // tool was active.
  const pool = isExclusiveClaim(e)
    ? bindings.filter(sb => targetConsultsAffordance(specTargetOf(sb.binding.spec)))
    : bindings;
```

Then change the inner loop's iterand from `bindings` to `pool`:

```ts
    for (const sb of pool) {
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/core/src/interactions/dispatcher/matcher.claims.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 6: Run the whole dispatcher suite — this is the regression surface**

Run: `npx vitest run packages/core/src/interactions`
Expected: PASS. Nothing produces `strength: 'exclusive'` yet, so `pool === bindings` on every existing path and ordering is untouched. A failure here means something already sets `strength`; find it before continuing.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/interactions/dispatcher/matcher.ts \
        packages/core/src/interactions/dispatcher/matcher.claims.test.ts
git commit -m "feat(core): an exclusive claim outranks the dispatcher's scope tier"
```

---

### Task 4: The HUD claims exclusively and reports its cursor

**Files:**
- Modify: `packages/hud/src/widget.ts`
- Modify: `packages/hud/src/widgets/window/window.ts`
- Modify: `packages/hud/src/attach.ts:77-93`
- Modify: `packages/hud/src/tool.ts:141-151`
- Test: `packages/hud/src/integration.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/hud/src/integration.test.tsx`. The existing file already defines `Harness`, `mount`, `makePointerEvent` and `HarnessApi` — reuse them; add `rect` to the harness's `SceneCanvas` by giving it `active="rect"` in a second harness:

```tsx
describe('a HUD window is reachable while a drawing tool is active', () => {
  it('drags the window instead of starting a rect insert', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null } };
    const { container } = await mount(apiOut, { initialActiveTool: 'rect' });

    const win = apiOut.hudRef.current!.window({
      id: 'w1', x: 20, y: 20, w: 100, h: 80, title: 'Loupe',
    });
    await act(async () => {});

    const canvas = container.querySelector('canvas')!;
    // Press on the titlebar, drag 30px right, release.
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 60, clientY: 26 }));
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 90, clientY: 26 }));
      canvas.dispatchEvent(makePointerEvent('pointerup',   { clientX: 90, clientY: 26 }));
    });

    expect(win.bounds.x).toBe(50);
  });
});
```

Change `Harness` and `mount` to accept an options object so the starting tool is
settable. The prop is `initialActiveTool` (`SceneCanvas.tsx:571`) — there is no
`active` prop on `SceneCanvas`:

```tsx
function Harness({ apiOut, initialActiveTool }: { apiOut: HarnessApi; initialActiveTool?: string }) {
  // ...unchanged body...
  return (
    <SceneCanvas
      ref={ref}
      width={200}
      height={200}
      scene={scene}
      layers={{}}
      ambient={[hudTool]}
      {...(initialActiveTool ? { initialActiveTool } : {})}
    />
  );
}

async function mount(apiOut: HarnessApi, opts: { initialActiveTool?: string } = {}) {
  const r = render(<Harness apiOut={apiOut} initialActiveTool={opts.initialActiveTool} />);
  await act(async () => {});
  return r;
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/hud/src/integration.test.tsx`
Expected: FAIL — `expected 20 to be 50`. The window never moved: `rect`'s bare `{ kind: 'drag' }` won on active scope.

- [ ] **Step 3: Let a widget answer for its cursor**

In `packages/hud/src/widget.ts`, add to `interface Widget`, after `hitTest`:

```ts
  /** CSS cursor for a point inside this widget, in screen space. Resolved per
   *  point rather than read off hover state, because the layer's `hitTest`
   *  runs for a point and hover state may lag it. */
  cursorAt?(x: number, y: number): string;
```

- [ ] **Step 4: Implement it on the window**

In `packages/hud/src/widgets/window/window.ts`, add to the returned object literal, next to the existing `get cursor()`:

```ts
    cursorAt(x, y) { const z = zoneAt(bounds, m, x, y); return z ? cursorForZone(z) : 'default'; },
```

- [ ] **Step 5: Return a claim from the HUD layer**

In `packages/hud/src/attach.ts`, replace the `return` at the end of the layer's `hitTest`:

```ts
      // Exclusive: hud chrome floats over the scene, so a press on it is not a
      // press on whatever sits underneath. Bindings that don't consult the
      // affordance are barred from it by the dispatcher.
      return {
        initialScratch: { widget: hit },
        strength: 'exclusive',
        ...(hit.cursorAt ? { cursor: hit.cursorAt(sx, sy) } : {}),
      } satisfies LayerHit<HudHitPayload>;
```

In the same file's import block (`attach.ts:2`), change `AffordanceBinding` to `LayerHit`. `HudHitPayload` is already imported from `./tool` on line 8; leave it.

- [ ] **Step 6: Drop the now-redundant guard**

In `packages/hud/src/tool.ts`, the three bindings each carry `target: { kindOf: isHudHit }`. The claim now bars everything else, but these bindings still need a target that *consults* the affordance — a bare spec would be filtered out by its own claim. Keep `isHudHit`, and delete the stale sentence in the `createHudTool` doc block that says ambient scope is safe because "kit tools decline presses that landed on chrome". Replace that paragraph's last sentence with:

```ts
 * All three gate on the affordance kind, so they fire only for presses the
 * HUD's own layer hit-test claimed. That gate is also what keeps them in
 * contention: the layer claims exclusively, and an exclusive claim bars every
 * binding whose target doesn't consult the affordance.
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run packages/hud/src/integration.test.tsx`
Expected: PASS — `win.bounds.x` is 50.

- [ ] **Step 8: Run the hud suite**

Run: `npx vitest run packages/hud`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/hud/src/widget.ts packages/hud/src/widgets/window/window.ts \
        packages/hud/src/attach.ts packages/hud/src/tool.ts \
        packages/hud/src/integration.test.tsx
git commit -m "feat(hud): widgets claim their point exclusively and report a per-zone cursor"
```

---

### Task 5: Delete select's workaround

The general rule replaced it. Reverting is the proof.

**Files:**
- Modify: `packages/core/src/tools/builtin/select/useSelectTool.ts:503-517`
- Modify: `apps/draw/src/dev/registryProbe.test.tsx:113`

- [ ] **Step 1: Restore the plain binding**

In `packages/core/src/tools/builtin/select/useSelectTool.ts`, replace the commented `kindOf` block added by commit `4457351f` with:

```ts
          { spec: { kind: 'drag' as const, target: 'empty' as const }, actionId: 'areaSelect' },
```

- [ ] **Step 2: Follow the change in the route probe**

In `apps/draw/src/dev/registryProbe.test.tsx:113`, `areaSelect` is no longer a predicate-target drag:

```ts
    expect(predicateDrags.map((d) => d.actionId)).toEqual(['resize', 'rotate', 'move']);
```

- [ ] **Step 3: Run both affected suites**

Run: `npx vitest run packages/hud/src/integration.test.tsx apps/draw/src/dev/registryProbe.test.tsx`
Expected: PASS. The HUD test is the one that matters — it passed in Task 4 with select's workaround still in place, and must still pass without it.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/builtin/select/useSelectTool.ts \
        apps/draw/src/dev/registryProbe.test.tsx
git commit -m "refactor(core): drop select's chrome-declining predicate for the dispatcher rule"
```

---

### Task 6: Documentation and changeset

**Files:**
- Modify: `docs/taxonomy.md` (the `### Affordance` section)
- Modify: `docs/TODO.md`
- Create: `.changeset/claims-and-precedence.md`

- [ ] **Step 1: Update the Affordance section of the taxonomy**

In `docs/taxonomy.md`, append to the `### Affordance` section:

```markdown
An affordance hit is a **claim**: `{ kind, owner, strength, cursor?, payload? }`.
`owner` names what produced it — a kit affordance's id, or a registered layer's
id. `strength: 'exclusive'` bars every binding whose `target` doesn't consult
the affordance, which is how chrome floating over the scene stays reachable
regardless of the active tool; `'shared'` is the default and competes on scope
and specificity as bindings always have.
```

While in this file, fix the stale sentence in the same section's neighbor `### Tool`, which still describes channel handlers and `claimsAll(ctx)` — both removed when the phase-table pipeline was deleted. Replace that final sentence with:

```markdown
A Tool's entire input surface is its `bindings` array; the dispatcher matches
them at the scope its slot implies.
```

- [ ] **Step 2: Update the TODO**

In `docs/TODO.md`, the P2 entry **"Active tools swallow drags on HUD chrome"** is now fixed — delete the whole block per the repo's retention policy.

In the P2 entry **"Cursor and gesture dispatch over HUD elements"**, the cursor half is done. Replace that entry's body with:

```markdown
- **(P2) Gesture dispatch over HUD elements.** Only the three bindings in
  `createHudTool` reach widgets, so a HUD element can be pressed, dragged and
  hovered and nothing else — no double-click, no wheel, no long-press, no
  right-click, no keyboard focus. A widget wanting any of them has no way to
  ask. The cursor half of this item shipped 2026-08-10: widgets answer
  `cursorAt(x, y)` and the claim carries it to the hover pump. Recorded
  2026-08-09.
```

- [ ] **Step 3: Write the changeset**

Create `.changeset/claims-and-precedence.md`:

```markdown
---
"@weasel-js/core": minor
"@weasel-js/hud": minor
---

Affordance hits are claims, and an exclusive claim outranks the scope tier.

`AffordanceHit` gains `owner` (what produced the hit) and `strength`. Kit chrome
claims `'shared'` — today's behavior, competing on scope and specificity.
Registered layers, which previously flattened to a bare kind string, now return
a `LayerHit` that can also carry `cursor` and `claim`, so a consumer's own
chrome says the things kit chrome already said through `AffordanceRegion`.

**Behavior change:** when a press carries an exclusive claim, only bindings
whose `target` consults the affordance — a `kindOf` predicate or the
`affordance:<kind>` string form — are candidates. Scope ordering applies within
that filtered set, unchanged. Body-class targets (`'empty'`, `'selected-body'`,
`'unselected-body'`) and `kind:` targets resolve from the body classification
and never see the affordance, so they no longer win presses on chrome that
floats over the body they name.

This is the dispatcher rule the previous release's changeset said was the real
fix. `select`'s hand-written predicate declining chrome affordances is deleted;
`rect`, `ellipse`, `polygon`, `star`, `hand`, `pen` and `lasso` keep their bare
`{ kind: 'drag' }` bindings and stop swallowing drags on HUD chrome anyway,
which is the point — seven copies of a predicate was the alternative.

`@weasel-js/hud` claims exclusively, and `Widget` gains an optional
`cursorAt(x, y)`. `hud.window()` implements it, so hovering a resize band shows
`nwse-resize` instead of the active tool's cursor.
```

- [ ] **Step 4: Verify the docs claims against the tree**

Run: `grep -n "claimsAll" docs/taxonomy.md`
Expected: no output — the stale reference is gone.

Run: `grep -rn "swallow drags on HUD chrome" docs/TODO.md`
Expected: no output — the fixed entry is deleted.

- [ ] **Step 5: Commit**

```bash
git add docs/taxonomy.md docs/TODO.md .changeset/claims-and-precedence.md
git commit -m "docs: claims, the precedence rule, and the TODO entries it closes"
```

---

## Final verification

- [ ] **Run the release gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both pass. `vitest` alone does not typecheck production code, and this plan changed two published contracts.

- [ ] **See it in the app**

Run: `npm run dev:kit`, open the loupe demo, activate the `rect` tool, and drag the loupe's titlebar. It moves. Hover a corner — the cursor is `nwse-resize`, not the crosshair.

---

## Notes for the implementer

**What this plan deliberately does not do.** Which gesture *kinds* a widget accepts is not part of the claim. A widget can't author bindings, so double-click, wheel and long-press on widgets means `@weasel-js/hud` growing more bindings and `HudPointerEvent` growing more arms. That stays a separate TODO item, narrowed in Task 6.

**If Task 3's Step 6 fails.** Something already sets `strength: 'exclusive'` and the pre-pass is filtering a path it shouldn't. Find the producer before proceeding — the pre-pass is only safe because it is inert until Task 4 opts the HUD in.

**Plan 2** covers the contribution record, eligibility as a set of conditions, single-registry assembly, and bundles. It depends on nothing here except the vocabulary.
