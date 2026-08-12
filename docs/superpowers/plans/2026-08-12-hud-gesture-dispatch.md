# HUD Gesture Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `@weasel-js/hud` widget receive double-click, right-click, long-press and wheel, and make the HUD's exclusive claim apply per gesture kind so chrome stops swallowing gestures it doesn't take.

**Architecture:** Bottom-up in four layers. (1) `@weasel-js/gestures` — `wheel` gains a `target`, and `doubleClick`/`contextMenu` start matching on the affordance instead of the DOM target. (2) `@weasel-js/core` — a `ClaimableGesture` token set, `LayerHit.claimedKinds`, a per-kind exclusive-claim filter, and the dispatcher classifying the affordance on four more event kinds. (3) `@weasel-js/hud` — `Widget.claims` replaces `claimsPointer`, four new `HudPointerEvent` arms, four new actions and bindings. (4) Integration tests and TODO updates.

**Spec:** `docs/superpowers/specs/2026-08-12-hud-gesture-dispatch-design.md`

**Tech Stack:** TypeScript, React, vitest (unit + jsdom integration), npm workspaces. Test runner: `npx vitest run <path>` from the repo root.

**Conventions for this repo:** comments are 1–2 lines and only for things not derivable from the code (see `CLAUDE.md`). Do not add explanatory comments to code whose shape already says what it does.

---

## File Structure

**`packages/gestures/src/`**
- `ui/spec.ts` — `WheelSpec` gains `target?: TargetSpec`.
- `ui/inputEvent.ts` — `WheelEvent` gains `affordance`/`bodyTarget`/`bodyKind`; `DoubleClickEvent` gains `affordance`; `ContextMenuEvent` gains `worldX`/`worldY`/`affordance`.
- `ui/match.ts` — `case 'wheel'` gains a `matchTarget`; `doubleClick`/`contextMenu` switch from `e.target` to `e.affordance`.
- `grammar/gestures.ts` — `wheel` becomes `hasTarget: true`.
- `grammar/routeGrammar.test.ts` — targetless-gesture cases move off `wheel` onto `keyDown`.

**`packages/core/src/`**
- `affordances/types.ts` — new `ClaimableGesture` union; `LayerHit.claimedKinds`.
- `interactions/actions/invoker.ts` — `AffordanceHit.claimedKinds`.
- `interactions/dispatcher/matcher.ts` — `claimGestureOf`, per-kind `isExclusiveClaim`, `targetConsultsAffordance` honors `readsAffordance`.
- `interactions/dispatcher/predicates.ts` — body predicates carry `readsAffordance: false`.
- `canvas/SceneCanvas.tsx` — `wrappedAffordanceAt` forwards `claimedKinds`.
- `interactions/dispatcher/useGestureDispatcher.tsx` — affordance/coords onto `doubleclick`, `contextmenu` (both routes) and `wheel`.
- `interactions/dispatcher/dispatcher.ts` — immediate-invoker params for the four kinds.
- `index.ts` — export `ClaimableGesture`.

**`packages/hud/src/`**
- `widget.ts` — `claims` replaces `claimsPointer`; `PointerClaim` deleted; four `HudPointerEvent` arms.
- `attach.ts` — claim-aware hit walk, `claimedKinds` on the layer hit.
- `tool.ts` — four actions, four bindings, claim-aware target predicates.
- `widgets/{rect,text,image}.ts` — `claims: []`.
- `widgets/{button.ts,window/window.ts}` — `onPointer` returns `void`.
- `index.ts` — drop the `PointerClaim` export.

---

## Task 1: `WheelSpec` gains a target

**Files:**
- Modify: `packages/gestures/src/ui/spec.ts:97-102`
- Modify: `packages/gestures/src/ui/inputEvent.ts:66-73`
- Modify: `packages/gestures/src/ui/match.ts:341-348`
- Test: `packages/gestures/src/ui/match.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe` in `packages/gestures/src/ui/match.test.ts` (put it next to the other wheel cases around line 171):

```ts
describe('wheel target', () => {
  const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

  it('matches a kindOf predicate against the wheel affordance', () => {
    const e: InputEvent = {
      kind: 'wheel', deltaX: 0, deltaY: 10, clientX: 5, clientY: 5,
      affordance: { kind: 'layer:weasel-hud' }, ...noMods,
    };
    const spec = {
      kind: 'wheel' as const,
      target: { kindOf: (t: any) => t?.kind === 'layer:weasel-hud' },
    };
    expect(matchSpec(e, spec, false)).toBe(true);
  });

  it('declines when the affordance does not match', () => {
    const e: InputEvent = {
      kind: 'wheel', deltaX: 0, deltaY: 10, clientX: 5, clientY: 5, ...noMods,
    };
    const spec = {
      kind: 'wheel' as const,
      target: { kindOf: (t: any) => t?.kind === 'layer:weasel-hud' },
    };
    expect(matchSpec(e, spec, false)).toBe(false);
  });

  it('a targetless wheel spec still matches any wheel', () => {
    const e: InputEvent = {
      kind: 'wheel', deltaX: 0, deltaY: 10, clientX: 5, clientY: 5,
      affordance: { kind: 'layer:weasel-hud' }, ...noMods,
    };
    expect(matchSpec(e, { kind: 'wheel' }, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/gestures/src/ui/match.test.ts -t "wheel target"`
Expected: FAIL — TypeScript rejects `target` on `WheelSpec`, and/or the first case returns `false`.

- [ ] **Step 3: Add the `target` field to `WheelSpec`**

In `packages/gestures/src/ui/spec.ts`, replace the `WheelSpec` interface:

```ts
export interface WheelSpec {
  kind: 'wheel';
  direction?: 'up' | 'down' | '*';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}
```

- [ ] **Step 4: Add the classification fields to `WheelEvent`**

In `packages/gestures/src/ui/inputEvent.ts`, replace the `WheelEvent` interface:

```ts
/** A scroll-wheel / trackpad scroll, with raw deltas and client coords. */
export interface WheelEvent extends EventModifiers {
  kind: 'wheel';
  deltaX: number;
  deltaY: number;
  clientX: number;
  clientY: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}
```

`BodyTarget` and `BodyKind` are already imported in this file — do not add imports.

- [ ] **Step 5: Match the target in the wheel case**

In `packages/gestures/src/ui/match.ts`, replace `case 'wheel'`:

```ts
    case 'wheel': {
      if (e.kind !== 'wheel') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      const direction = spec.direction ?? '*';
      if (direction === 'up' && !(e.deltaY < 0)) return false;
      if (direction === 'down' && !(e.deltaY > 0)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run packages/gestures/src/ui/match.test.ts`
Expected: PASS, all cases in the file.

- [ ] **Step 7: Commit**

```bash
git add packages/gestures/src/ui/spec.ts packages/gestures/src/ui/inputEvent.ts packages/gestures/src/ui/match.ts packages/gestures/src/ui/match.test.ts
git commit -m "feat(gestures): a wheel spec can name a target"
```

---

## Task 2: `doubleClick` and `contextMenu` match on the affordance

**Files:**
- Modify: `packages/gestures/src/ui/inputEvent.ts:209-225`
- Modify: `packages/gestures/src/ui/match.ts:361-371`
- Test: `packages/gestures/src/ui/match.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/gestures/src/ui/match.test.ts`:

```ts
describe('doubleClick / contextMenu resolve kindOf against the affordance', () => {
  const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const isHud = { kindOf: (t: any) => t?.kind === 'layer:weasel-hud' };

  it('doubleClick reads the affordance, not the DOM target', () => {
    const e: InputEvent = {
      kind: 'doubleclick', target: { dom: true },
      affordance: { kind: 'layer:weasel-hud' }, ...noMods,
    };
    expect(matchSpec(e, { kind: 'doubleClick' as const, target: isHud }, false)).toBe(true);
  });

  it('contextMenu reads the affordance, not the DOM target', () => {
    const e: InputEvent = {
      kind: 'contextmenu', target: { dom: true },
      affordance: { kind: 'layer:weasel-hud' }, ...noMods,
    };
    expect(matchSpec(e, { kind: 'contextMenu' as const, target: isHud }, false)).toBe(true);
  });

  it('a body-class predicate still reads bodyTarget on both kinds', () => {
    const isBodyish = { kindOf: (_t: any, body?: string) => body === 'selected-body' };
    const dbl: InputEvent = {
      kind: 'doubleclick', bodyTarget: 'selected-body' as const, ...noMods,
    };
    const ctx: InputEvent = {
      kind: 'contextmenu', bodyTarget: 'selected-body' as const, ...noMods,
    };
    expect(matchSpec(dbl, { kind: 'doubleClick' as const, target: isBodyish }, false)).toBe(true);
    expect(matchSpec(ctx, { kind: 'contextMenu' as const, target: isBodyish }, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/gestures/src/ui/match.test.ts -t "resolve kindOf against the affordance"`
Expected: FAIL — the first two cases return `false` (the predicate is handed `{ dom: true }`).

- [ ] **Step 3: Add `affordance` / coords to the two event types**

In `packages/gestures/src/ui/inputEvent.ts`, replace `DoubleClickEvent` and `ContextMenuEvent`:

```ts
/** A double click. `worldX`/`worldY` carry the same meaning as on {@link ClickEvent}. */
export interface DoubleClickEvent extends EventModifiers {
  kind: 'doubleclick';
  target?: unknown;
  worldX?: number;
  worldY?: number;
  /** Affordance the originating press landed on, replayed from it. */
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}

/** A context-menu (right-click) request. */
export interface ContextMenuEvent extends EventModifiers {
  kind: 'contextmenu';
  target?: unknown;
  /** World-space position of the request. */
  worldX?: number;
  worldY?: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
}
```

- [ ] **Step 4: Switch both match cases onto the affordance**

In `packages/gestures/src/ui/match.ts`, replace `case 'doubleClick'` and `case 'contextMenu'`:

```ts
    case 'doubleClick': {
      if (e.kind !== 'doubleclick') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'contextMenu': {
      if (e.kind !== 'contextmenu') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }
```

- [ ] **Step 5: Run the whole gestures suite**

Run: `npx vitest run packages/gestures`
Expected: PASS. If a pre-existing case asserted a `kindOf` reading the DOM target on either kind, update it to pass `affordance` instead — that is the intended change, recorded in the spec's §2.

- [ ] **Step 6: Commit**

```bash
git add packages/gestures/src/ui/inputEvent.ts packages/gestures/src/ui/match.ts packages/gestures/src/ui/match.test.ts
git commit -m "fix(gestures): doubleClick and contextMenu resolve kindOf against the affordance"
```

---

## Task 3: `wheel` gains a route-grammar target slot

**Files:**
- Modify: `packages/gestures/src/grammar/gestures.ts:49`
- Modify: `packages/gestures/src/grammar/gestures.test.ts:16-17`
- Modify: `packages/gestures/src/grammar/routeGrammar.test.ts` (lines using `wheel` as the targetless example)

- [ ] **Step 1: Flip the descriptor**

In `packages/gestures/src/grammar/gestures.ts`, replace the `wheel` row:

```ts
  { name: 'wheel',         hasTarget: true,  arg: { name: 'direction', values: ['up', 'down', '*'], default: '*' } },
```

- [ ] **Step 2: Run the grammar tests to see exactly what breaks**

Run: `npx vitest run packages/gestures/src/grammar`
Expected: FAIL in `gestures.test.ts` ("wheel has no target…") and in `routeGrammar.test.ts` at the cases that use `wheel` as the canonical targetless gesture — parsed wheel routes now carry `target: '*'`, and `parseRoute('[initial] wheel(up) => foo')` no longer throws.

- [ ] **Step 3: Repoint the targetless assertions onto `keyDown`**

In `packages/gestures/src/grammar/gestures.test.ts`, replace the wheel descriptor test:

```ts
  it('wheel has a target and a direction arg with default "*"', () => {
    const d = getGestureDescriptor('wheel');
    expect(d.hasTarget).toBe(true);
    expect(d.arg).toEqual({ name: 'direction', values: ['up', 'down', '*'], default: '*' });
  });

  it('keyDown has no target', () => {
    expect(getGestureDescriptor('keyDown').hasTarget).toBe(false);
  });
```

In `packages/gestures/src/grammar/routeGrammar.test.ts`, make these three edits:

Around line 99–104, the "omitted argSlot resolves to descriptor default" case now expects a wildcard target:

```ts
  it('omitted argSlot resolves to descriptor default for wheel', () => {
    expect(parseRoute('[initial] wheel')).toEqual({
      phases: [self('initial')], gesture: 'wheel', arg: '*', target: '*',
    });
  });
```

Around line 110–114, the "targetless gesture accepts modifiers without a target" case moves to `keyDown`:

```ts
  it('targetless gesture (keyDown) accepts modifiers without a target', () => {
    expect(parseRoute('[initial] keyDown(a) +mod')).toEqual({
      phases: [self('initial')], gesture: 'keyDown', arg: 'a', mods: ['mod'],
    });
  });
```

Around line 153, the "no target" throw case moves to `keyDown`:

```ts
    expect(() => parseRoute('[initial] keyDown(a) => foo')).toThrow(/keyDown.*no target/i);
```

Do not change the phase-parsing cases that merely use `wheel` as a filler gesture (lines 58, 62, 80, 188–201) — they assert on `phases`, not on targets, and still pass.

- [ ] **Step 4: Re-run and confirm the expected shapes**

Run: `npx vitest run packages/gestures/src/grammar`
Expected: PASS. If `parseRoute('[initial] wheel(up) +mod')` still fails, compare its actual value against the expectation and add `target: '*'` — every `hasTarget` gesture gets the wildcard when the slot is elided.

- [ ] **Step 5: Commit**

```bash
git add packages/gestures/src/grammar
git commit -m "feat(gestures): wheel routes carry a target slot"
```

---

## Task 4: `ClaimableGesture` and `LayerHit.claimedKinds`

**Files:**
- Modify: `packages/core/src/affordances/types.ts:179-195`
- Modify: `packages/core/src/interactions/actions/invoker.ts:43-79`
- Modify: `packages/core/src/index.ts`

No test in this task — it is a type-only addition consumed by Task 5, which tests it.

- [ ] **Step 1: Add the union and the field**

In `packages/core/src/affordances/types.ts`, insert above `LayerHit` and extend it:

```ts
/**
 * Gesture kinds an affordance claim can bar, in the spec vocabulary bindings
 * are written in. `'pointer'` is one token because `pointerDown` / `click` /
 * `drag` are a single press protocol — at the event level the first two are
 * the same `kind: 'pointerdown'`, told apart only by `stage`.
 */
export type ClaimableGesture =
  | 'pointer'
  | 'doubleClick'
  | 'contextMenu'
  | 'longPress'
  | 'wheel';

export interface LayerHit<TScratch = unknown> extends AffordanceBinding<TScratch> {
  /** CSS cursor while the pointer is over this hit. Reaches the hover-cursor
   *  pump as `AffordanceHit.cursor`, the same path kit chrome uses. */
  cursor?: string;
  /** `'exclusive'` bars every binding whose target doesn't consult the
   *  affordance. Omitted means `'shared'` — today's behavior. Same name and
   *  meaning as `AffordanceHit.strength`, which it becomes. */
  strength?: 'exclusive' | 'shared';
  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];
}
```

- [ ] **Step 2: Carry it on `AffordanceHit`**

In `packages/core/src/interactions/actions/invoker.ts`, add the field to `AffordanceHit` directly below `strength`:

```ts
  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];
```

Add the import at the top of the file, next to the existing type imports:

```ts
import type { ClaimableGesture } from '../../affordances/types';
```

Check the file's existing import style first and match it — if it imports from `'affordances/types'` (baseUrl-relative) rather than a relative path, use that spelling.

- [ ] **Step 3: Export from the barrel**

In `packages/core/src/index.ts`, find the existing export of `LayerHit` and add `ClaimableGesture` to the same `export type { … }` list.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/affordances/types.ts packages/core/src/interactions/actions/invoker.ts packages/core/src/index.ts
git commit -m "feat(core): a layer claim can name the gestures it bars"
```

---

## Task 5: The exclusive-claim filter goes per-kind

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/matcher.ts:100-123`
- Test: `packages/core/src/interactions/dispatcher/matcher.claims.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/dispatcher/matcher.claims.test.ts`. Read the top of that file first for its existing helpers (`dragOn`, the `ScopedBinding` shape) and reuse them; the wheel helper below is new:

```ts
describe('per-kind claims', () => {
  const wheelOn = (affordance: unknown): InputEvent => ({
    kind: 'wheel', deltaX: 0, deltaY: 10, clientX: 0, clientY: 0,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    affordance,
  } as InputEvent);

  const hudDrag: ScopedBinding = {
    binding: { spec: { kind: 'drag', target: 'affordance:layer:weasel-hud' }, actionId: 'hud.drag' },
    scope: 'ambient', ownerToolId: null,
  };
  const viewportZoom: ScopedBinding = {
    binding: { spec: { kind: 'wheel' }, actionId: 'viewport.zoom' },
    scope: 'ambient', ownerToolId: null,
  };

  it('a claim that lists only pointer does not bar a wheel binding', () => {
    const e = wheelOn({
      kind: 'layer:weasel-hud', strength: 'exclusive', claimedKinds: ['pointer'],
    });
    const out = matchSorted(e, [viewportZoom], false);
    expect(out.map(m => m.binding.actionId)).toEqual(['viewport.zoom']);
  });

  it('a claim that lists wheel bars a wheel binding that ignores the affordance', () => {
    const e = wheelOn({
      kind: 'layer:weasel-hud', strength: 'exclusive', claimedKinds: ['pointer', 'wheel'],
    });
    const out = matchSorted(e, [viewportZoom], false, undefined, () => {});
    expect(out).toEqual([]);
  });

  it('omitted claimedKinds bars every kind, as before', () => {
    const e = dragOn({ kind: 'layer:weasel-hud', strength: 'exclusive' });
    const out = matchSorted(e, [hudDrag], false);
    expect(out.map(m => m.binding.actionId)).toEqual(['hud.drag']);

    const wheelE = wheelOn({ kind: 'layer:weasel-hud', strength: 'exclusive' });
    expect(matchSorted(wheelE, [viewportZoom], false, undefined, () => {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/matcher.claims.test.ts -t "per-kind claims"`
Expected: FAIL — the first case returns `[]` because the claim currently bars every kind.

- [ ] **Step 3: Implement `claimGestureOf` and the new filter**

In `packages/core/src/interactions/dispatcher/matcher.ts`, replace `claimOf` and `isExclusiveClaim`:

```ts
function claimOf(e: InputEvent): {
  owner?: string;
  strength?: 'exclusive' | 'shared';
  claimedKinds?: readonly ClaimableGesture[];
} | undefined {
  return ('affordance' in e ? e.affordance : undefined) as {
    owner?: string;
    strength?: 'exclusive' | 'shared';
    claimedKinds?: readonly ClaimableGesture[];
  } | undefined;
}

/** Event kind → the claim token that covers it. `null` for events a
 *  positional claim has no opinion about (keys, drops, pastes, multitouch). */
function claimGestureOf(e: InputEvent): ClaimableGesture | null {
  switch (e.kind) {
    case 'pointerdown':
    case 'click': return 'pointer';
    case 'doubleclick': return 'doubleClick';
    case 'contextmenu': return 'contextMenu';
    case 'longpress': return 'longPress';
    case 'wheel': return 'wheel';
    default: return null;
  }
}

/** `'exclusive'` when the event carries a claim that bars unnamed bindings
 *  for this event's gesture. */
function isExclusiveClaim(e: InputEvent): boolean {
  const claim = claimOf(e);
  if (claim?.strength !== 'exclusive') return false;
  const gesture = claimGestureOf(e);
  if (gesture === null) return false;
  return claim.claimedKinds === undefined || claim.claimedKinds.includes(gesture);
}
```

Add `ClaimableGesture` to the type imports at the top of the file:

```ts
import type { ClaimableGesture } from '../../affordances/types';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/interactions/dispatcher/matcher.claims.test.ts`
Expected: PASS, all cases in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interactions/dispatcher/matcher.ts packages/core/src/interactions/dispatcher/matcher.claims.test.ts
git commit -m "feat(core): an exclusive claim bars the gestures it names"
```

---

## Task 6: Body predicates declare that they ignore the affordance

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/predicates.ts:13-29`
- Modify: `packages/core/src/interactions/dispatcher/matcher.ts` (`targetConsultsAffordance`)
- Test: `packages/core/src/interactions/dispatcher/matcher.claims.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/dispatcher/matcher.claims.test.ts`. Add `import { isBody, isResizeHandle } from './predicates';` to the file's imports:

```ts
describe('body predicates do not survive an exclusive claim', () => {
  it('targetConsultsAffordance is false for the kit body predicates', () => {
    expect(targetConsultsAffordance({ kindOf: isBody })).toBe(false);
  });

  it('stays true for a predicate that reads the hit', () => {
    expect(targetConsultsAffordance({ kindOf: isResizeHandle })).toBe(true);
  });

  it('an isBody doubleClick binding is barred by a chrome claim', () => {
    const e = {
      kind: 'doubleclick',
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      bodyTarget: 'selected-body',
      affordance: {
        kind: 'layer:weasel-hud', strength: 'exclusive',
        claimedKinds: ['pointer', 'doubleClick'],
      },
    } as unknown as InputEvent;
    const enterPathEdit: ScopedBinding = {
      binding: { spec: { kind: 'doubleClick', target: { kindOf: isBody } }, actionId: 'enterPathEdit' },
      scope: 'ambient', ownerToolId: null,
    };
    expect(matchSorted(e, [enterPathEdit], false, undefined, () => {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/matcher.claims.test.ts -t "do not survive"`
Expected: FAIL — `targetConsultsAffordance` returns `true` for any object with a `kindOf`, so `enterPathEdit` survives the filter and matches.

- [ ] **Step 3: Mark the four body predicates**

In `packages/core/src/interactions/dispatcher/predicates.ts`, replace the body-class section:

```ts
// ─── Body-class predicates (read the second arg) ───────────────────────

/** A predicate that resolves from `bodyTarget` alone. The exclusive-claim
 *  filter reads this: without it, a body predicate looks like it consults the
 *  affordance and survives a claim it should have been barred by. */
type BodyPredicate = ((target: unknown, bodyTarget?: string) => boolean)
  & { readsAffordance: false };

function bodyPredicate(fn: (target: unknown, bodyTarget?: string) => boolean): BodyPredicate {
  return Object.assign(fn, { readsAffordance: false as const });
}

/** Matches any body hit — selected or unselected node body. */
export const isBody: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'selected-body' || bodyTarget === 'unselected-body');

/** Body hit specifically already in the selection. */
export const isSelectedBody: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'selected-body');

/** Body hit specifically NOT in the selection. */
export const isUnselectedBody: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'unselected-body');

/** Empty-canvas hit — no node beneath cursor. */
export const isEmpty: BodyPredicate = bodyPredicate((_target, bodyTarget) =>
  bodyTarget === 'empty');
```

- [ ] **Step 4: Honor the marker in the filter**

In `packages/core/src/interactions/dispatcher/matcher.ts`, replace `targetConsultsAffordance`:

```ts
/**
 * True when a spec's target actually consults the affordance hit rather than
 * only the body classification. `kindOf` predicates are handed the hit;
 * `affordance:<k>` matches on its `kind`. The body-class strings (`'empty'`,
 * `'selected-body'`, `'unselected-body'`) and the `kind:` forms resolve from
 * `bodyTarget` / `bodyKind` and never see it — which is why chrome floating
 * over empty canvas used to read as empty canvas.
 *
 * A predicate carrying `readsAffordance: false` says the same thing about
 * itself; the kit's own body predicates do. Shape is still the fallback for
 * predicates that declare nothing.
 */
export function targetConsultsAffordance(specTarget: unknown): boolean {
  if (specTarget === undefined) return false;
  if (typeof specTarget === 'object' && specTarget !== null && 'kindOf' in specTarget) {
    const kindOf = (specTarget as { kindOf?: { readsAffordance?: boolean } }).kindOf;
    return kindOf?.readsAffordance !== false;
  }
  return typeof specTarget === 'string' && specTarget.startsWith('affordance:');
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/interactions/dispatcher/`
Expected: PASS. `predicates.test.ts` should be unaffected — the predicates' call behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/interactions/dispatcher/predicates.ts packages/core/src/interactions/dispatcher/matcher.ts packages/core/src/interactions/dispatcher/matcher.claims.test.ts
git commit -m "fix(core): the kit's body predicates declare that they ignore the affordance"
```

---

## Task 7: `SceneCanvas` forwards `claimedKinds`

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:2242-2266`

- [ ] **Step 1: Forward the field**

In `packages/core/src/canvas/SceneCanvas.tsx`, in `wrappedAffordanceAt`, add one spread line to the object built from a layer hit — directly after the `strength` line:

```ts
        return {
          kind: `layer:${extra.layerId}`,
          owner: extra.layerId,
          strength: claim.strength ?? 'shared',
          ...(claim.claimedKinds !== undefined ? { claimedKinds: claim.claimedKinds } : {}),
          ...(claim.cursor !== undefined ? { cursor: claim.cursor } : {}),
          ...(claim.initialScratch !== undefined ? { payload: claim.initialScratch } : {}),
        };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If `extra.hit` is typed as something narrower than `LayerHit`, widen that type rather than casting.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/canvas/SceneCanvas.tsx
git commit -m "feat(core): SceneCanvas carries a layer's claimed kinds onto the hit"
```

---

## Task 8: The affordance reaches `doubleclick`

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:1008-1019`
- Test: `packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`. Read the file's existing helpers first — it already has a harness for mounting the hook with an `affordanceAt` and firing pointer events; reuse it rather than building a second one. The assertion:

```ts
it('a doubleclick carries the affordance the press landed on', async () => {
  const seen: unknown[] = [];
  // Mount the dispatcher with `affordanceAt` returning a chrome hit and a
  // binding whose kindOf records what it was handed.
  //   spec: { kind: 'doubleClick', target: { kindOf: (t) => { seen.push(t); return true; } } }
  // Fire: down/up, down/up within DOUBLE_CLICK_MAX_MS at the same point.
  // ...harness wiring per this file's existing pattern...
  expect(seen.at(-1)).toEqual({ kind: 'handle:top-left' });
});
```

Write the harness wiring concretely by copying the nearest existing double-click or click test in the file. If no double-click test exists, copy the closest click test and add the second down/up pair.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx -t "doubleclick carries the affordance"`
Expected: FAIL — the predicate receives `undefined`.

- [ ] **Step 3: Copy the affordance onto the event**

In `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx`, in the `dblEv` literal, add one line after `shiftKey`:

```ts
          const dblEv: InputEvent = {
            kind: 'doubleclick',
            target: e.target,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            worldX: wClick.x,
            worldY: wClick.y,
            ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
            ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
            ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
          };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx
git commit -m "fix(core): a doubleclick replays the affordance from its press"
```

---

## Task 9: The affordance and world coords reach `contextmenu`

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:1066-1081` (real right-click)
- Modify: `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:421-448` (`fireLongPress` fallback)
- Test: `packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`, following the same harness pattern as Task 8:

```ts
it('a right-click classifies the affordance at its position', async () => {
  const seen: unknown[] = [];
  // affordanceAt returns { kind: 'layer:weasel-hud' } for any point.
  // Binding: { kind: 'contextMenu', target: { kindOf: (t) => { seen.push(t); return true; } } }
  // Fire a `contextmenu` MouseEvent on the canvas.
  expect(seen.at(-1)).toMatchObject({ kind: 'layer:weasel-hud' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx -t "right-click classifies"`
Expected: FAIL — the predicate receives `undefined`.

- [ ] **Step 3: Classify at the right-click position**

In `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx`, replace the body of `onContextMenu` up to and including the `ev` literal:

```ts
    const onContextMenu = (e: MouseEvent) => {
      // Suppress native menu so tools/actions own the right-click UX.
      e.preventDefault();
      const screenPoint = { x: e.clientX, y: e.clientY };
      // A secondary button never reaches `onPointerDown`, so unlike click and
      // long-press there is no press to replay the classification from.
      const affordance = affordanceAtRef.current?.(screenPoint) ?? undefined;
      const menuBody = classifyTargetRef.current?.(screenPoint);
      const w = toWorld(e.clientX, e.clientY);
      const ev: InputEvent = {
        kind: 'contextmenu',
        target: e.target,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        worldX: w.x,
        worldY: w.y,
        ...(affordance !== undefined ? { affordance } : {}),
        ...(menuBody?.body !== undefined ? { bodyTarget: menuBody.body } : {}),
        ...(menuBody?.kind !== undefined ? { bodyKind: menuBody.kind } : {}),
      };
      dispatch(ev);
    };
```

The local was named `worldPoint` and held client coords; both `affordanceAt` and `classifyTarget` take client coords and convert internally, so the rename is a correction, not a behavior change.

- [ ] **Step 4: Replay the affordance on the long-press fallback**

In the same file, in `fireLongPress`, replace the `shared` object and the fallback dispatch:

```ts
      const shared = {
        target: down.target,
        altKey: down.altKey,
        ctrlKey: down.ctrlKey,
        metaKey: down.metaKey,
        shiftKey: down.shiftKey,
        ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
        ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
        ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
      };

      const result = dispatch({
        kind: 'longpress',
        x: down.worldX,
        y: down.worldY,
        clientX: down.clientX,
        clientY: down.clientY,
        ...shared,
      } as InputEvent);

      if (result === 'unhandled') {
        dispatch({
          kind: 'contextmenu',
          worldX: down.worldX,
          worldY: down.worldY,
          ...shared,
        } as InputEvent);
      }
```

The `affordance` spread moved into `shared` — remove the now-duplicate spread from the `longpress` dispatch literal.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/interactions/dispatcher/`
Expected: PASS, including `longPress.integration.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx
git commit -m "fix(core): a contextmenu classifies its position and carries world coords"
```

---

## Task 10: The affordance reaches `wheel`

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:534-563`
- Test: `packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx`, same harness pattern:

```ts
it('a wheel classifies the affordance at the cursor', async () => {
  const seen: unknown[] = [];
  // affordanceAt returns { kind: 'layer:weasel-hud' }.
  // Binding: { kind: 'wheel', target: { kindOf: (t) => { seen.push(t); return true; } } }
  // Fire a `wheel` event on the canvas with deltaY: 10.
  expect(seen.at(-1)).toMatchObject({ kind: 'layer:weasel-hud' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx -t "wheel classifies"`
Expected: FAIL — the predicate receives `undefined`.

- [ ] **Step 3: Classify at the wheel position**

In `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx`, replace the `ev` construction inside `onWheel`:

```ts
      const affordance = affordanceAtRef.current?.({ x: e.clientX, y: e.clientY }) ?? undefined;
      const body = classifyTargetRef.current?.({ x: e.clientX, y: e.clientY });
      const ev: InputEvent = {
        kind: 'wheel',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        clientX: localX,
        clientY: localY,
        ...(affordance !== undefined ? { affordance } : {}),
        ...(body?.body !== undefined ? { bodyTarget: body.body } : {}),
        ...(body?.kind !== undefined ? { bodyKind: body.kind } : {}),
      };
```

`clientX`/`clientY` stay canvas-local (`localX`/`localY`) — that is what wheel consumers anchor against. Only the classifier calls take the raw client coords, matching `onPointerDown`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/interactions/dispatcher/`
Expected: PASS, including `viewport.integration.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx packages/core/src/interactions/dispatcher/useGestureDispatcher.test.tsx
git commit -m "fix(core): a wheel classifies the affordance under the cursor"
```

---

## Task 11: Immediate-invoker params for the four kinds

**Files:**
- Modify: `packages/core/src/interactions/dispatcher/dispatcher.ts:920-973`
- Test: `packages/core/src/interactions/dispatcher/dispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/dispatcher/dispatcher.test.ts`, reusing the file's existing registry/dispatch harness:

```ts
describe('immediate params for affordance-carrying kinds', () => {
  it('a contextmenu invoker sees world coords and the affordance', () => {
    // Register an immediate action bound to { kind: 'contextMenu' } that
    // records its params; dispatch a contextmenu event with
    // worldX: 3, worldY: 4, affordance: { kind: 'k' }.
    expect(params).toMatchObject({ worldX: 3, worldY: 4, affordance: { kind: 'k' } });
  });

  it('a wheel invoker sees the affordance alongside the deltas', () => {
    expect(params).toMatchObject({ deltaX: 0, deltaY: 10, affordance: { kind: 'k' } });
  });

  it('a doubleclick invoker sees the affordance', () => {
    expect(params).toMatchObject({ worldX: 3, worldY: 4, affordance: { kind: 'k' } });
  });

  it('a longpress invoker sees world coords and the affordance', () => {
    expect(params).toMatchObject({ worldX: 3, worldY: 4, affordance: { kind: 'k' } });
  });
});
```

Fill in the harness wiring by copying the nearest existing immediate-invoker test in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/interactions/dispatcher/dispatcher.test.ts -t "immediate params for affordance"`
Expected: FAIL — `contextmenu` and `longpress` fall through to the bare `resolved` branch (no position at all), and `wheel`/`doubleclick` carry no affordance.

- [ ] **Step 3: Extend the param builder**

In `packages/core/src/interactions/dispatcher/dispatcher.ts`, replace the `wheel` and click/doubleclick branches and add one for `contextmenu`/`longpress`:

```ts
          if (event.kind === 'wheel') {
            params = {
              deltaX: event.deltaX,
              deltaY: event.deltaY,
              clientX: event.clientX,
              clientY: event.clientY,
              affordance: event.affordance,
              ...resolved,
            };
          } else if (event.kind === 'click' || event.kind === 'doubleclick') {
            params = {
              worldX: event.worldX,
              worldY: event.worldY,
              affordance: event.affordance,
              // Press point as well as release point — an action that places
              // geometry at the click wants the former. See `ClickEvent`.
              ...(event.kind === 'click'
                ? { pressX: event.pressX, pressY: event.pressY }
                : {}),
              mods: modifiersOf(event),
              ...resolved,
            };
          } else if (event.kind === 'contextmenu') {
            params = {
              worldX: event.worldX,
              worldY: event.worldY,
              affordance: event.affordance,
              bodyTarget: event.bodyTarget,
              mods: modifiersOf(event),
              ...resolved,
            };
          } else if (event.kind === 'longpress') {
            params = {
              worldX: event.x,
              worldY: event.y,
              affordance: event.affordance,
              bodyTarget: event.bodyTarget,
              mods: modifiersOf(event),
              ...resolved,
            };
          } else if (event.kind === 'pointerdown') {
```

The `affordance` for `click` moved out of the inner conditional and up beside `worldX`/`worldY`, which is where `doubleclick` needs it too — the value is identical for `click`, so nothing changes for existing consumers.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/interactions/dispatcher/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interactions/dispatcher/dispatcher.ts packages/core/src/interactions/dispatcher/dispatcher.test.ts
git commit -m "feat(core): immediate invokers see position and affordance on four more kinds"
```

---

## Task 12: The widget protocol

**Files:**
- Modify: `packages/hud/src/widget.ts`
- Modify: `packages/hud/src/index.ts:9`

No new test in this task — Tasks 13–15 exercise it. This task must leave the package typechecking, so it lands together with the widget updates in Task 15 if the compiler demands it; commit at the end of Step 5 either way.

- [ ] **Step 1: Replace `PointerClaim` and `claimsPointer`**

In `packages/hud/src/widget.ts`, delete the `PointerClaim` type and replace the `Widget` interface's pointer fields:

```ts
import type { ClaimableGesture } from '@weasel-js/core';

/** What a widget consumes when it declares nothing: chrome is opaque to
 *  every pointer-family gesture except the wheel, which stays with the
 *  viewport unless a widget asks for it. */
export const DEFAULT_WIDGET_CLAIMS: readonly ClaimableGesture[] =
  ['pointer', 'doubleClick', 'contextMenu', 'longPress'];

export interface Widget {
  readonly id: string;
  readonly bounds: WidgetBounds;
  readonly hidden: boolean;
  draw(ctx: HudDrawCtx): DrawCommand[];
  content?(ctx: HudContentCtx): DrawCommand[];
  readonly contentRect?: WidgetBounds;
  hitTest(x: number, y: number): boolean;
  /** Which gestures this widget consumes. Absent means
   *  {@link DEFAULT_WIDGET_CLAIMS}; `[]` is decoration, and the hit-test walk
   *  descends past it to whatever is beneath. Anything not listed falls
   *  through to the scene. */
  readonly claims?: readonly ClaimableGesture[];
  cursorAt?(x: number, y: number): string;
  onPointer(evt: HudPointerEvent): void;
  dispose(): void;
}
```

Keep the existing JSDoc on `draw`, `content`, `contentRect` and `cursorAt` — only the pointer fields change.

- [ ] **Step 2: Add the four event arms**

In the same file, replace the `HudPointerEvent` union:

```ts
export type HudPointerEvent =
  | { type: 'down'; x: number; y: number; native: PointerEvent | null }
  | { type: 'move'; x: number; y: number; native: PointerEvent | null }
  | { type: 'up'; x: number; y: number; native: PointerEvent | null }
  | { type: 'cancel'; native: PointerEvent | null }
  | { type: 'hovermove'; x: number; y: number; native: PointerEvent | null }
  | { type: 'hoverleave'; native: PointerEvent | null }
  | { type: 'doubleclick'; x: number; y: number; native: PointerEvent | null }
  | { type: 'contextmenu'; x: number; y: number; native: PointerEvent | null }
  | { type: 'longpress'; x: number; y: number; native: PointerEvent | null }
  | { type: 'wheel'; x: number; y: number; deltaX: number; deltaY: number; native: PointerEvent | null };
```

Leave the existing doc comment above the union in place, and extend its last sentence to note that the four new arms also arrive through the dispatcher and therefore carry `native: null`.

- [ ] **Step 3: Add a helper for resolving a widget's claims**

In the same file, below `DEFAULT_WIDGET_CLAIMS`:

```ts
export function claimsOf(w: Widget): readonly ClaimableGesture[] {
  return w.claims ?? DEFAULT_WIDGET_CLAIMS;
}
```

- [ ] **Step 4: Update the barrel**

In `packages/hud/src/index.ts`, remove `PointerClaim` from the exported type list and add `DEFAULT_WIDGET_CLAIMS` and `claimsOf` to the value exports (`claimsOf` is used by `attach.ts` and `tool.ts` and is useful to consumers writing their own widgets).

- [ ] **Step 5: Commit (after Task 15 makes the package compile)**

This task leaves `packages/hud` failing to typecheck until Task 15 updates the widgets. Either run Tasks 12–15 as one unit and commit once at the end of Task 15, or commit here with `--no-verify` if a pre-commit hook typechecks. Prefer the former.

---

## Task 13: `attach.ts` — claim-aware hit walk

**Files:**
- Modify: `packages/hud/src/attach.ts:38-49, 81-104`
- Test: `packages/hud/src/attach.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/hud/src/attach.test.ts`, reusing the file's existing fake-`CanvasExtensionApi` harness:

```ts
it('the hit walk descends past a widget that claims nothing', () => {
  // Two overlapping widgets at the same bounds; the upper one has claims: [].
  // The layer's hitTest at a shared point resolves the LOWER widget.
  expect((hit?.initialScratch as { widget: Widget }).widget.id).toBe('under');
});

it('the layer hit carries the widget claim set', () => {
  // A widget with claims: ['pointer', 'wheel'].
  expect(hit?.claimedKinds).toEqual(['pointer', 'wheel']);
});

it('a widget declaring nothing carries the default claim set', () => {
  expect(hit?.claimedKinds).toEqual(['pointer', 'doubleClick', 'contextMenu', 'longPress']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/attach.test.ts`
Expected: FAIL — `claimedKinds` is undefined and the walk keys off `claimsPointer`.

- [ ] **Step 3: Update the walk and the hit**

In `packages/hud/src/attach.ts`, replace `findTopmostHit` and the `hitTest` return:

```ts
  const findTopmostHit = (sx: number, sy: number): Widget | null => {
    const list = hud.widgets();
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      // Decoration is skipped rather than downgraded: a hit at all would let
      // the HUD consume the press, and the walk has to keep descending to
      // whatever is beneath — another widget, or the scene.
      if (claimsOf(w).length === 0) continue;
      if (!w.hidden && w.hitTest(sx, sy)) return w;
    }
    return null;
  };
```

```ts
      return {
        initialScratch: { widget: hit },
        strength: 'exclusive',
        claimedKinds: claimsOf(hit),
        ...(hit.cursorAt ? { cursor: hit.cursorAt(sx, sy) } : {}),
      } satisfies LayerHit<HudHitPayload>;
```

Update the import line to bring in `claimsOf`:

```ts
import { claimsOf, type Widget, type HudPointerEvent } from './widget';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/hud/src/attach.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (with Tasks 12, 14, 15)**

See Task 12 Step 5 — the package typechecks only once Task 15 lands.

---

## Task 14: `tool.ts` — four actions and four bindings

**Files:**
- Modify: `packages/hud/src/tool.ts`
- Test: `packages/hud/src/tool.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/hud/src/tool.test.ts`, reusing its existing fake-widget helper:

```ts
describe('the non-pointer gestures', () => {
  it('routes a doubleClick to the widget', () => {
    const { widget, seen } = fakeWidget();   // per this file's existing helper
    const c = createHudContribution();
    const action = c.actions!.find(a => a.id === 'hud.doubleClick')!;
    action.invoker!.run!({}, {
      worldX: 5, worldY: 6,
      affordance: { kind: HUD_AFFORDANCE_KIND, payload: { widget } },
    });
    expect(seen).toEqual([{ type: 'doubleclick', x: 5, y: 6, native: null }]);
  });

  it('binds all four kinds gated on the hud affordance', () => {
    const kinds = createHudContribution().bindings!.map(b => b.spec.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      'pointerDown', 'click', 'drag', 'doubleClick', 'contextMenu', 'longPress', 'wheel',
    ]));
  });

  it('a widget that does not claim wheel fails the wheel binding target', () => {
    const { widget } = fakeWidget({ claims: ['pointer'] });
    const wheelBinding = createHudContribution().bindings!
      .find(b => b.spec.kind === 'wheel')!;
    const kindOf = (wheelBinding.spec as { target: { kindOf: (t: unknown) => boolean } }).target.kindOf;
    expect(kindOf({ kind: HUD_AFFORDANCE_KIND, payload: { widget } })).toBe(false);
  });

  it('a widget that claims wheel passes it', () => {
    const { widget } = fakeWidget({ claims: ['pointer', 'wheel'] });
    const wheelBinding = createHudContribution().bindings!
      .find(b => b.spec.kind === 'wheel')!;
    const kindOf = (wheelBinding.spec as { target: { kindOf: (t: unknown) => boolean } }).target.kindOf;
    expect(kindOf({ kind: HUD_AFFORDANCE_KIND, payload: { widget } })).toBe(true);
  });
});
```

If `fakeWidget` in this file doesn't accept overrides, extend it to take a `Partial<Widget>`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hud/src/tool.test.ts`
Expected: FAIL — `hud.doubleClick` doesn't exist.

- [ ] **Step 3: Add the claim-aware target predicate**

In `packages/hud/src/tool.ts`, replace `isHudHit` and add the factory:

```ts
import { claimsOf, type Widget, type HudPointerEvent } from './widget';
import type { ClaimableGesture } from '@weasel-js/core';

function isHudHit(hit: unknown): boolean {
  return (hit as { kind?: string } | null | undefined)?.kind === HUD_AFFORDANCE_KIND;
}

/** A target that matches a HUD hit only when the widget under it consumes
 *  this gesture. Without the claim half, a widget that declines a kind would
 *  still win it: declining leaves the claim non-exclusive, which puts the
 *  scene's binding and the HUD's own in contention at once. */
function hudHitClaiming(gesture: ClaimableGesture): (hit: unknown) => boolean {
  const kindOf = (hit: unknown): boolean => {
    if (!isHudHit(hit)) return false;
    const widget = widgetIn(hit);
    return widget !== null && claimsOf(widget).includes(gesture);
  };
  return Object.assign(kindOf, { readsAffordance: true as const });
}
```

- [ ] **Step 4: Add the four actions**

In the same file, below `dragAction`:

```ts
/** The three point gestures share a shape: resolve the widget, convert the
 *  world point to screen, deliver one event. */
function pointAction(
  id: string,
  label: string,
  type: 'doubleclick' | 'contextmenu' | 'longpress',
): Action {
  return {
    id,
    label,
    requires: ['view'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as { worldX?: number; worldY?: number; affordance?: unknown } | undefined;
        const widget = widgetIn(p?.affordance);
        if (!widget || p?.worldX === undefined || p.worldY === undefined) return;
        const [x, y] = toScreen(deps, p.worldX, p.worldY);
        widget.onPointer({ type, x, y, native: null } satisfies HudPointerEvent);
      },
    },
  };
}

function wheelAction(): Action {
  return {
    id: 'hud.wheel',
    label: 'HUD — wheel over widget',
    invoker: {
      timing: 'immediate' as const,
      run: (_deps, params) => {
        const p = params as {
          clientX?: number; clientY?: number;
          deltaX?: number; deltaY?: number; affordance?: unknown;
        } | undefined;
        const widget = widgetIn(p?.affordance);
        if (!widget || p?.clientX === undefined || p.clientY === undefined) return;
        // Wheel `clientX`/`clientY` are already canvas-local, the space
        // widgets lay out in — no view conversion, unlike the point gestures.
        widget.onPointer({
          type: 'wheel',
          x: p.clientX, y: p.clientY,
          deltaX: p.deltaX ?? 0, deltaY: p.deltaY ?? 0,
          native: null,
        } satisfies HudPointerEvent);
      },
    },
  };
}
```

- [ ] **Step 5: Register them in the contribution**

Replace the returned object in `createHudContribution`:

```ts
  return {
    id: 'weasel-hud',
    eligibility: { claimed: true },
    actions: [
      pressAction(), releaseAction(), dragAction(),
      pointAction('hud.doubleClick', 'HUD — double-click widget', 'doubleclick'),
      pointAction('hud.contextMenu', 'HUD — right-click widget', 'contextmenu'),
      pointAction('hud.longPress', 'HUD — long-press widget', 'longpress'),
      wheelAction(),
    ],
    bindings: [
      { spec: { kind: 'pointerDown', target: { kindOf: hudHitClaiming('pointer') }, mods: MODS_ANY }, actionId: 'hud.press' },
      { spec: { kind: 'click', target: { kindOf: hudHitClaiming('pointer') }, mods: MODS_ANY }, actionId: 'hud.release' },
      { spec: { kind: 'drag', target: { kindOf: hudHitClaiming('pointer') }, mods: MODS_ANY }, actionId: 'hud.drag' },
      { spec: { kind: 'doubleClick', target: { kindOf: hudHitClaiming('doubleClick') }, mods: MODS_ANY }, actionId: 'hud.doubleClick' },
      { spec: { kind: 'contextMenu', target: { kindOf: hudHitClaiming('contextMenu') }, mods: MODS_ANY }, actionId: 'hud.contextMenu' },
      { spec: { kind: 'longPress', target: { kindOf: hudHitClaiming('longPress') }, mods: MODS_ANY }, actionId: 'hud.longPress' },
      { spec: { kind: 'wheel', target: { kindOf: hudHitClaiming('wheel') }, mods: MODS_ANY }, actionId: 'hud.wheel' },
    ],
  };
```

Update the function's doc comment: it says "Three bindings" — make it seven, and say that each gates on both the affordance kind and the widget's claim set.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run packages/hud/src/tool.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit (with Tasks 12, 13, 15)**

See Task 12 Step 5.

---

## Task 15: Update the five widgets

**Files:**
- Modify: `packages/hud/src/widgets/rect.ts:62-63`
- Modify: `packages/hud/src/widgets/text.ts:58-59`
- Modify: `packages/hud/src/widgets/image.ts:58-59`
- Modify: `packages/hud/src/widgets/button.ts:97-121`
- Modify: `packages/hud/src/widgets/window/window.ts:159+`
- Modify: `packages/hud/src/widgets/label.ts`

- [ ] **Step 1: Decoration widgets claim nothing**

In each of `rect.ts`, `text.ts` and `image.ts`, replace the two lines:

```ts
    claims: [],
    onPointer(_evt: HudPointerEvent): void {},
```

and drop `PointerClaim` from that file's import list.

- [ ] **Step 2: `button` drops its return values**

In `packages/hud/src/widgets/button.ts`, change the signature to `onPointer(evt: HudPointerEvent): void {` and delete every `return 'claim';` / `return 'pass';` inside it. The `case 'down'` arm becomes:

```ts
        case 'down':
          pressed = true;
          opts.onChange?.();
          break;
```

Apply the same `break` treatment to `move`, `up`, `cancel`, `hovermove` and `hoverleave`. Add a `default: break;` arm so the four new event types compile without a button reacting to them — a double-click on a button already fired two presses, and there is nothing further to do.

Drop `PointerClaim` from the import list.

- [ ] **Step 3: `window` drops its return values**

Apply the same treatment in `packages/hud/src/widgets/window/window.ts`: `onPointer(evt: HudPointerEvent): void`, `break` in place of every `return`, a `default: break;` arm, and `PointerClaim` out of the import list.

- [ ] **Step 4: `label`**

`packages/hud/src/widgets/label.ts` has no `claimsPointer` and no `PointerClaim`. Confirm its `onPointer` (if any) typechecks against the `void` return; if it declares a return type, drop it.

- [ ] **Step 5: Typecheck and run the whole hud suite**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run packages/hud`
Expected: no type errors, all tests pass. `packages/hud/src/tool.test.ts:14` types its fake as `(evt): PointerClaim` — update it to `(evt): void`.

- [ ] **Step 6: Commit Tasks 12–15 together**

```bash
git add packages/hud/src
git commit -m "feat(hud): a widget declares which gestures it consumes"
```

---

## Task 16: Integration — the two user-visible claims

**Files:**
- Modify: `packages/hud/src/integration.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `packages/hud/src/integration.test.tsx`, reusing its existing `<SceneCanvas>` + `useHud` mount harness:

```ts
it('a right-click on chrome does not reach a scene binding', async () => {
  // Mount a SceneCanvas with one node under a HUD button, plus an ambient
  // contextMenu binding on `{ kindOf: isBody }` that records invocations.
  // Right-click at the button's center.
  expect(sceneBindingRuns).toEqual([]);
  expect(widgetEvents.map(e => e.type)).toContain('contextmenu');
});

it('a right-click off chrome still reaches the scene binding', async () => {
  // Same mount; right-click well clear of the button.
  expect(sceneBindingRuns).toHaveLength(1);
});

it('a wheel over a widget that does not claim it still zooms', async () => {
  // Same mount, plus an ambient `{ kind: 'wheel' }` binding standing in for
  // viewport.zoom. Wheel over the button (default claims exclude wheel).
  expect(zoomRuns).toHaveLength(1);
  expect(widgetEvents.map(e => e.type)).not.toContain('wheel');
});

it('a wheel over a widget that claims it reaches the widget, not the scene', async () => {
  // Widget created with claims: ['pointer', 'wheel'].
  expect(zoomRuns).toEqual([]);
  expect(widgetEvents.map(e => e.type)).toContain('wheel');
});
```

Fill in the harness by copying the nearest existing test in the file — it already mounts a canvas, attaches a HUD and dispatches pointer events, which is most of the wiring.

- [ ] **Step 2: Run to verify they fail, then pass**

Run: `npx vitest run packages/hud/src/integration.test.tsx`
Expected: the four new cases fail before the earlier tasks' code is in place and pass after. If they already pass at this point, they do — every layer they exercise landed in Tasks 1–15; confirm by temporarily reverting `claimedKinds: claimsOf(hit)` in `attach.ts` and watching case 3 fail.

- [ ] **Step 3: Commit**

```bash
git add packages/hud/src/integration.test.tsx
git commit -m "test(hud): chrome bars a right-click and passes an unclaimed wheel"
```

---

## Task 17: Full gate and TODO updates

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Run the full release gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. This is the gate CI applies (see the "Run prepublishOnly before pushing main" convention); `tsup build` is only needed before a push.

- [ ] **Step 2: Update the P2 entry**

In `docs/TODO.md`, replace the "**(P2) Gesture dispatch over HUD elements.**" bullet with:

```markdown
- **(P3) HUD widgets have no keyboard focus.** The pointer family shipped
  2026-08-12 (spec `docs/superpowers/specs/2026-08-12-hud-gesture-dispatch-design.md`):
  a widget declares `claims` over `ClaimableGesture`, the exclusive claim
  applies per gesture kind, and double-click / right-click / long-press /
  wheel all reach widgets. What is left is focus — a focused-widget model on
  `Hud`, Tab order, a key arm on the widget protocol, focus-ring painting, and
  a precedence rule against the canvas's window-level key listeners.
```

- [ ] **Step 3: Delete the two closed P3s**

Remove these two bullets entirely (git log is the archive, per the repo's TODO retention policy):

- "**(P3) An exclusive claim doesn't bar `contextmenu` or `doubleclick`.**"
- "**(P3) `PointerClaim` is dead, and now has a live twin.**"

- [ ] **Step 4: Rewrite the two partially-addressed entries**

Replace the "**(P2) `targetConsultsAffordance` is syntactic…**" bullet with:

```markdown
- **(P3) `targetConsultsAffordance` still guesses from shape.** The kit's four
  body predicates now carry `readsAffordance: false` and the filter honors it
  (2026-08-12), so the counterexamples the kit ships are handled. A consumer
  predicate that reads only `bodyTarget` and declares nothing still survives a
  claim it should be barred by. The open question is whether the filter should
  stop inferring at all — require the declaration, or have `TargetSpec` carry
  the answer instead of the predicate.
```

Replace the "**(P3) `Widget.claimsPointer` is static.**" bullet with:

```markdown
- **(P3) `Widget.claims` is static.** A widget that is decoration in one mode
  and interactive in another can't change what it consumes without being
  swapped out. `claimsPointer` folded into `claims` on 2026-08-12, so this is
  one field rather than two, but it is still a declaration read at hit-test
  time. Revisit when a stateful-claims widget appears.
```

- [ ] **Step 5: Update the "Next up" index**

In the "### Next up" block at the top of `docs/TODO.md`, remove the
`targetConsultsAffordance` line (it is P3 now) and remove the
"Gesture dispatch over HUD elements" reference from the P2 index further down.

- [ ] **Step 6: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: HUD gesture dispatch ships; keyboard focus is what remains"
```

---

## Self-Review Notes

Spec coverage check, section by section:

| Spec section | Task |
|---|---|
| §1 affordance onto four kinds | 8 (doubleclick), 9 (contextmenu ×2), 10 (wheel); longpress already had it |
| §1 param builder | 11 |
| §2 wheel target | 1, 3 |
| §2 doubleClick/contextMenu match on affordance | 2 |
| §2a body predicates declare | 6 |
| §3 claim carries the kinds | 4 (types), 5 (filter), 7 (SceneCanvas plumbing) |
| §4 widget protocol | 12 |
| §4 attach.ts | 13 |
| §4 tool.ts | 14 |
| §4 widget updates | 15 |
| Testing section | tests inline in 1–16 |
| TODO entries settled | 17 |

Known ordering constraint: Tasks 12–15 are one compiling unit and commit together (Task 15 Step 6). Every other task compiles and commits on its own.
