# Keybindings-as-Routes Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the per-tool `keybinding` / `hotkey` declarations and the bespoke `useKeybindings` runtime into the existing route + action-registry pipeline. After this lands, every keyboard activation in the kit (tool-switch taps, held-hotkey triggers, in-tool key routes) is expressed as a route string and surfaces uniformly in the inspector.

**Architecture:**
- Add `keyHeld` as a first-class engaging gesture in the route grammar — keyboard analog of `drag`. Engagement advances the channel from `initial` → `engaged` on keydown, restores to `initial` on keyup, with engaged-phase routes firing in between.
- Introduce an optional `scope: 'hotkey'` hint on `Action`. The dispatcher's ambient-scope walker uses this hint to route an action's default binding into the `hotkey` BindingScope instead of `ambient`, preserving `hotkey > active > ambient` precedence without per-tool special fields.
- Migrate every built-in tool that declared `keybinding` to register a `tool.select.<id>` ambient action with `scope: 'hotkey'` and a `keyDown` default binding. Migrate every tool that declared `hotkey` to register a `tool.hold.<id>` action with a `keyHeld` default binding (the existing action exists; it just changes its spec from `key-held` to a `keyHeld` route).
- Remove `ToolDef.keybinding`, `ToolDef.hotkey`, the `KeyBinding` interface, and the `useKeybindings` keydown→switchTool path. Inspector consumers (`ToolPalette`, `ToolkitBuilder`, `HotkeyTriggerDetail`) read shortcuts from the action registry instead.

**Tech Stack:** TypeScript, React, Vitest, the weasel route grammar (`@orochi235/weasel-gestures`), the actions registry (`src/interactions/actions/`), the dispatcher (`src/interactions/dispatcher/`).

---

## File Structure

**New files:**
- `packages/weasel-gestures/src/grammar/gestures.test.ts` — extended to cover `keyHeld` descriptor (existing test file).
- `src/interactions/actions/defaults/toolSelect.ts` — factory `makeToolSelectAction(toolId, key, opts)` for tap-style tool switches.
- `apps/draw/src/dev/keybindingsView.ts` — pure helper that derives a "what key activates this tool" lookup from the action registry, replacing direct reads of `ToolDef.keybinding`.

**Modified — grammar + dispatcher:**
- `packages/weasel-gestures/src/grammar/gestures.ts` — add `keyHeld` to `GestureName` and `GESTURE_DESCRIPTORS`.
- `packages/weasel-gestures/src/ui/spec.ts` — already has `KeyHeldSpec`; verify `keyRouteToSpec` covers the new route gesture.
- `packages/weasel-gestures/src/ui/match.ts` — already matches `key-held` events; no code change expected. Add a test crossing the route grammar boundary.
- `packages/weasel-gestures/src/grammar/describeRoute.ts` — extend `actionClause` to phrase `keyHeld` as "holds {key}".
- `src/interactions/actions/types.ts` (or wherever `Action` is defined) — add `scope?: 'hotkey'` field.
- `src/interactions/dispatcher/dispatcher.ts:282-326` — in `assembleScopedBindings`, branch ambient-walker on `action.scope === 'hotkey'` to land bindings in the hotkey scope.
- `src/interactions/dispatcher/keyHeldEngagement.ts` (new) — wire keyHeld engagement into the dispatcher's channel-phase state machine, mirroring how drag advances `[initial]` → `[engaged]`.

**Modified — actions:**
- `src/interactions/actions/defaults/toolHold.ts:15-35` — swap the `key-held` spec for a `keyHeld` route via `keyRouteToSpec`. Set `scope: 'hotkey'`.
- `src/interactions/actions/defaults/index.ts` — export `makeToolSelectAction` and register it for every built-in tool that previously set `keybinding`.

**Modified — tools (remove fields):**
- `src/tools/types.ts:144-145` — delete `keybinding?: KeyBinding` and `hotkey?: HotkeyTrigger` from `ToolDef`.
- `src/tools/builtin/use{Select,Rect,Ellipse,Line,Polygon,Pencil,Lasso,Text,Hand,Pen}Tool/*.ts` — delete the `keybinding:` / `hotkey:` literals. Each tool whose key needs preserving gets a `defaultActions` export consumed by the canvas mount.
- `src/tools/useKeybindings.ts` — delete entirely (its job is now done by the action registry + dispatcher).
- `src/interactions/keyHelpers.ts` — delete `KeyBinding` interface; keep any unrelated helpers.

**Modified — inspector:**
- `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx:122` — read shortcut chips from a passed-in `lookupShortcut(toolId)` prop instead of `tool.keybinding`.
- `packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts` — keep `keyGlyph` + `formatShortcutParts`; drop the `KeyBinding` import dependency by switching to a `{ key, mod, alt, shift }`-shaped input.
- `apps/draw/src/dev/ToolkitBuilder.tsx:217` — call the new `keybindingsView.lookupShortcut(toolId)` helper.
- `apps/draw/src/dev/registryData.ts:259, 428-430` — `HotkeyTriggerEntry` now lists each `tool.hold.*` action's `keyHeld` arg, derived from the action registry. (The entry stays — it remains a useful "what global hotkeys exist" facet.)
- `apps/draw/src/dev/RegistryDetail.tsx:356-358` — `HotkeyTriggerDetail` renders the matching action's route via `RouteBadge` for parity with the rest of the inspector.

---

## Phase 1 — Foundations: `keyHeld` Grammar Gesture

### Task 1: Register `keyHeld` in the gesture taxonomy

**Files:**
- Modify: `packages/weasel-gestures/src/grammar/gestures.ts:11-52`
- Test: `packages/weasel-gestures/src/grammar/gestures.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/weasel-gestures/src/grammar/gestures.test.ts — append
import { describe, it, expect } from 'vitest';
import { getGestureDescriptor, isKnownGestureName, GESTURE_DESCRIPTORS } from './gestures';

describe('keyHeld gesture', () => {
  it('is registered with the same shape as keyDown/keyUp', () => {
    expect(isKnownGestureName('keyHeld')).toBe(true);
    const d = getGestureDescriptor('keyHeld');
    expect(d).toEqual({
      name: 'keyHeld',
      hasTarget: false,
      arg: { name: 'key', values: 'free' },
    });
  });

  it('appears in GESTURE_DESCRIPTORS exactly once', () => {
    const matches = GESTURE_DESCRIPTORS.filter((d) => d.name === 'keyHeld');
    expect(matches).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/weasel-gestures/src/grammar/gestures.test.ts -t 'keyHeld gesture' --reporter=default`
Expected: FAIL with `unknown gesture: keyHeld` or `isKnownGestureName` returning false.

- [ ] **Step 3: Add `keyHeld` to GestureName union + descriptors**

```ts
// packages/weasel-gestures/src/grammar/gestures.ts:11-20 — extend GestureName
export type GestureName =
  | 'click'
  | 'pointerDown'
  | 'dblTap'
  | 'drag'
  | 'wheel'
  | 'keyDown'
  | 'keyUp'
  | 'keyHeld'
  | 'contextMenu'
  | 'multiTouchTap';

// packages/weasel-gestures/src/grammar/gestures.ts:42-52 — extend descriptors
export const GESTURE_DESCRIPTORS: readonly GestureDescriptor[] = [
  { name: 'click',         hasTarget: true  },
  { name: 'pointerDown',   hasTarget: true  },
  { name: 'dblTap',        hasTarget: true  },
  { name: 'drag',          hasTarget: true  },
  { name: 'wheel',         hasTarget: false, arg: { name: 'direction', values: ['up', 'down', '*'], default: '*' } },
  { name: 'keyDown',       hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'keyUp',         hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'keyHeld',       hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'contextMenu',   hasTarget: true  },
  { name: 'multiTouchTap', hasTarget: false, arg: { name: 'fingers',   values: ['2', '3', '4'] } },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/weasel-gestures/src/grammar/gestures.test.ts -t 'keyHeld gesture' --reporter=default`
Expected: PASS (2 new tests).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gestures/src/grammar/gestures.ts packages/weasel-gestures/src/grammar/gestures.test.ts
git commit -m "feat(gestures): add keyHeld as a first-class gesture descriptor"
```

---

### Task 2: Round-trip parseRoute/formatRoute for keyHeld

**Files:**
- Test: `packages/weasel-gestures/src/grammar/routeGrammar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/weasel-gestures/src/grammar/routeGrammar.test.ts — append in the parse/format suites
it('parses keyHeld with a key arg', () => {
  expect(parseRoute('[initial] keyHeld(Space)')).toEqual({
    phases: [{ channel: '&', phase: 'initial' }],
    gesture: 'keyHeld',
    arg: 'Space',
    target: undefined,
    modifiers: {},
  });
});

it('round-trips keyHeld through format → parse', () => {
  const route = '[*:initial] keyHeld(Space) +shift';
  expect(formatRoute(parseRoute(route))).toBe(route);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run packages/weasel-gestures/src/grammar/routeGrammar.test.ts -t 'keyHeld' --reporter=default`
Expected: FAIL — initially passes if parser is taxonomy-driven, but verify no special-case suppression. If they already pass after Task 1, that's correct — note in commit that the parser is taxonomy-driven and required no change. Otherwise add handling.

- [ ] **Step 3: Implement parser support if missing**

The grammar parser at `packages/weasel-gestures/src/grammar/routeGrammar.ts:118-125` reads the gesture name and looks it up via `isKnownGestureName`. After Task 1 the lookup succeeds, so no parser change is expected. If the tests fail, the cause is downstream (likely `getGestureDescriptor` consumers that pattern-match on gesture names) — add `keyHeld` handling next to `keyDown` / `keyUp` wherever it's missed.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run packages/weasel-gestures/src/grammar/routeGrammar.test.ts --reporter=default`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gestures/src/grammar/routeGrammar.test.ts
git commit -m "test(gestures): cover keyHeld in route grammar round-trip"
```

---

### Task 3: Wire `keyHeld` into `describeRoute`

**Files:**
- Modify: `packages/weasel-gestures/src/grammar/describeRoute.ts:67-99`
- Test: same file's eventual `.test.ts` (create if missing — `packages/weasel-gestures/src/grammar/describeRoute.test.ts`)

- [ ] **Step 1: Write the failing test**

```ts
// packages/weasel-gestures/src/grammar/describeRoute.test.ts — new file
import { describe, it, expect } from 'vitest';
import { parseRoute } from './routeGrammar';
import { describeRoute } from './describeRoute';

describe('describeRoute — keyHeld', () => {
  it('phrases keyHeld as "holds {key}"', () => {
    expect(describeRoute(parseRoute('[initial] keyHeld(Space)'))).toBe(
      'Fires when the user holds Space, while the tool is idle.',
    );
  });

  it('combines modifiers into the keyHeld phrase', () => {
    expect(describeRoute(parseRoute('[initial] keyHeld(Space) +mod'))).toBe(
      'Fires when the user holds Mod and holds Space, while the tool is idle.',
    );
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run packages/weasel-gestures/src/grammar/describeRoute.test.ts --reporter=default`
Expected: FAIL — `describeRoute` currently has no `keyHeld` arm in `actionClause`, so it falls through to `undefined` / the catchall.

- [ ] **Step 3: Add keyHeld arm to `actionClause`**

```ts
// packages/weasel-gestures/src/grammar/describeRoute.ts — extend the switch in actionClause
case 'keyDown':
case 'keyUp':
case 'keyHeld': {
  const verb = parsed.gesture === 'keyDown' ? 'presses'
    : parsed.gesture === 'keyUp' ? 'releases'
    : 'holds';
  const key = parsed.arg ?? 'any key';
  return required.length > 0
    ? `the user holds ${joinAnd(required)} and ${verb} ${key}`
    : `the user ${verb} ${key}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/weasel-gestures/src/grammar/describeRoute.test.ts --reporter=default`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gestures/src/grammar/describeRoute.ts packages/weasel-gestures/src/grammar/describeRoute.test.ts
git commit -m "feat(gestures): describeRoute phrasing for keyHeld"
```

---

### Task 4: Inspector rendering for `keyHeld`

**Files:**
- Modify: `apps/draw/src/dev/RegistryDetail.tsx` (`RouteBadge` and `routeToPowerline` already branch on `desc.arg?.name === 'key'`, so this should be automatic — verify with a story-level snapshot test or visual review).
- Modify: `apps/draw/src/dev/RoutePowerline.stories.tsx` — add a "Held key gestures" section.

- [ ] **Step 1: Add the story section**

```tsx
// apps/draw/src/dev/RoutePowerline.stories.tsx — insert a new <Section> between
// the existing "Key gestures" and "Multi-touch tap" sections
<Section
  title="Held key gestures — keyHeld lifecycle (drag-shaped)"
  routes={[
    '[initial] keyHeld(Space)',
    '[initial] keyHeld(Space) +mod',
    '[*:initial] keyHeld(Space)',
    '[engaged] keyHeld(Escape)',  // contrived but legal — exercises engaged-phase routing on a held key
  ]}
/>
```

- [ ] **Step 2: Verify the route renders with a KeyCap and the existing RouteBadge test still passes**

Run: `npx vitest run apps/draw/src/dev/RegistryDetail.test.tsx --reporter=default`
Expected: PASS — `argIsKey` is gesture-agnostic, so `keyHeld(Space)` inherits KeyCap rendering for free.

- [ ] **Step 3: Add a focused test for keyHeld + KeyCap rendering**

```tsx
// apps/draw/src/dev/RegistryDetail.test.tsx — append to RouteBadge v3 describe
it('renders keyHeld arg as a minimal KeyCap (same path as keyDown)', () => {
  const { container } = render(<RouteBadge route="[initial] keyHeld(Space)" />);
  const cap = container.querySelector('kbd[data-variant="minimal"]');
  expect(cap?.textContent).toBe('␣');
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run apps/draw/src/dev/RegistryDetail.test.tsx --reporter=default`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/dev/RoutePowerline.stories.tsx apps/draw/src/dev/RegistryDetail.test.tsx
git commit -m "feat(inspector): keyHeld in route badge, Powerline catalog, story"
```

---

## Phase 2 — Dispatcher Engagement for `keyHeld`

### Task 5: Dispatcher advances channel phase on keyHeld engage/disengage

**Files:**
- Create: `src/interactions/dispatcher/keyHeldEngagement.ts`
- Modify: `src/interactions/dispatcher/dispatcher.ts` (integration point — find the drag-engagement call site by grepping for `engagedChannels` or `pushHotkey` and add the symmetric keyHeld branch)
- Test: `src/interactions/dispatcher/keyHeldEngagement.test.ts`

- [ ] **Step 1: Reconnaissance**

Read these files in order before writing code:
- `src/interactions/dispatcher/dispatcher.ts:330-400` — find where drag transitions a channel from `initial` to `engaged`.
- `packages/weasel-gestures/src/ui/match.ts:230-260` — see how `key-held` events are matched today.
- `src/interactions/actions/defaults/toolHold.ts:15-35` — the existing push/popHotkey integration for held-key actions.

Note: weasel's drag engagement lives in the gesture-channel state machine; keyHeld must mirror it but on the keyboard channel (one per key id, not one per pointer).

- [ ] **Step 2: Write the failing test**

```ts
// src/interactions/dispatcher/keyHeldEngagement.test.ts — new file
import { describe, it, expect, vi } from 'vitest';
// Use existing dispatcher test scaffolding — read dispatcher.test.ts for harness imports.
import { makeRegistry, runDispatcher, keydownEvent, keyupEvent } from './dispatcher.test'; // adjust to actual test helpers

describe('keyHeld engagement', () => {
  it('advances the tool channel to engaged on keydown and back to initial on keyup', () => {
    const onEngage = vi.fn();
    const onDisengage = vi.fn();
    // Register a tool with a keyHeld route and matching engaged-phase route.
    // Run a keydown(Space), assert onEngage called and tool phase = engaged.
    // Run a keyup(Space), assert onDisengage called and tool phase = initial.
    // (Exact harness invocations depend on dispatcher.test.ts conventions.)
    expect(onEngage).toHaveBeenCalledOnce();
    expect(onDisengage).toHaveBeenCalledOnce();
  });

  it('a [engaged] route can fire while a keyHeld is active', () => {
    // Register: [initial] keyHeld(Space) and [engaged] click handle.
    // Sequence: keydown(Space), then click(handle), then keyup(Space).
    // Assert the click handler ran.
    expect(true).toBe(true); // placeholder — replace with real harness call
  });

  it('engagement is sticky — pressing a modifier mid-hold does not disengage', () => {
    // Register: [initial] keyHeld(Space). Track engage/disengage.
    // Sequence: keydown(Space), keydown(Shift), assert still engaged
    //           (disengage not called). Then keyup(Space), assert disengage fires.
    // Modifier changes during a hold should never end the hold; only the paired
    // keyup of the held key disengages.
    expect(true).toBe(true); // placeholder
  });

  it('mid-hold modifier press hot-swaps which [engaged] route matches', () => {
    // Register: [initial] keyHeld(Space), [engaged] drag, [engaged] drag +shift.
    // Sequence: keydown(Space), pointerdrag (no mods), pointerdrag (with shift).
    // Assert: first pointerdrag fires the no-mod [engaged] drag handler;
    // second pointerdrag fires [engaged] drag +shift. Hold itself remains active.
    expect(true).toBe(true); // placeholder
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npx vitest run src/interactions/dispatcher/keyHeldEngagement.test.ts --reporter=default`
Expected: FAIL — engagement logic not yet present.

- [ ] **Step 4: Implement keyHeld engagement helper**

```ts
// src/interactions/dispatcher/keyHeldEngagement.ts — new file
import type { ScopedBinding, MatchResult } from './matcher';

/** Tracks which keys are currently held with an engaging route. One entry
 *  per (ownerToolId, key) pair so two tools can each track their own
 *  Space-held route without aliasing. */
export interface KeyHoldState {
  ownerToolId: string;
  key: string;
  /** Action invoked on disengage. Mirrors how drag stores its end-callback. */
  disengage: () => void;
}

/** Engage a keyHeld route. Called by the dispatcher when a keydown matches
 *  a keyHeld binding. Stores the disengage callback to be invoked when the
 *  matching keyup arrives, and returns the channel-phase mutation the
 *  dispatcher should apply (move ownerToolId's channel from 'initial' to
 *  'engaged'). */
export function engageKeyHeld(
  match: MatchResult,
  invokeEnd: () => void,
  state: Map<string, KeyHoldState>,
): { ownerToolId: string } | null {
  if (!match.ownerToolId) return null;
  const key = keyOfBinding(match.binding);
  if (key === null) return null;
  const stateKey = `${match.ownerToolId}:${key}`;
  state.set(stateKey, { ownerToolId: match.ownerToolId, key, disengage: invokeEnd });
  return { ownerToolId: match.ownerToolId };
}

/** Disengage a keyHeld route — called by the dispatcher on the paired
 *  keyup. Invokes the stored end-callback and returns the channel-phase
 *  mutation (move back to 'initial'). */
export function disengageKeyHeld(
  ownerToolId: string,
  key: string,
  state: Map<string, KeyHoldState>,
): { ownerToolId: string } | null {
  const stateKey = `${ownerToolId}:${key}`;
  const entry = state.get(stateKey);
  if (!entry) return null;
  entry.disengage();
  state.delete(stateKey);
  return { ownerToolId };
}

function keyOfBinding(b: { spec: { kind: string; key?: string } }): string | null {
  return b.spec.kind === 'key-held' ? (b.spec.key ?? null) : null;
}
```

- [ ] **Step 5: Hook into the dispatcher**

Open `src/interactions/dispatcher/dispatcher.ts`. Grep for `'drag'` to find where drag engagement integrates with channel-phase tracking. Add a parallel branch:
- On keydown event match where `match.binding.spec.kind === 'key-held'`: call `engageKeyHeld` and emit the channel-phase advance.
- On keyup event for a tracked held key: call `disengageKeyHeld` and emit the channel-phase restore.

Store the `KeyHoldState` map alongside other per-channel dispatcher state.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/interactions/dispatcher --reporter=default`
Expected: PASS (existing + new). If any existing tests fail, the engagement branch is firing for keyDown routes that aren't keyHeld — verify the `kind === 'key-held'` guard.

- [ ] **Step 7: Commit**

```bash
git add src/interactions/dispatcher/keyHeldEngagement.ts src/interactions/dispatcher/keyHeldEngagement.test.ts src/interactions/dispatcher/dispatcher.ts
git commit -m "feat(dispatcher): keyHeld engagement advances channel phase like drag"
```

---

## Phase 3 — Action `scope` Hint

### Task 6: Add `scope?: 'hotkey'` to `Action`

**Files:**
- Modify: `src/interactions/actions/types.ts` (find the `Action` interface — search for `export interface Action`)
- Test: `src/interactions/dispatcher/dispatcher.test.ts:438-545` already covers ambient + active precedence; extend to cover the new hint.

- [ ] **Step 1: Locate the Action interface**

Run: `grep -rn "export interface Action " src/interactions/actions/ --include="*.ts"`
Open the file containing the result. Confirm the current shape (`id`, `defaultBinding`, `run`, etc.).

- [ ] **Step 2: Write the failing test**

```ts
// src/interactions/dispatcher/dispatcher.test.ts — append in the precedence describe
it("an Action with scope:'hotkey' wins over the active tool's binding on the same key", () => {
  const ambientRun = vi.fn();
  const activeRun = vi.fn();
  const activeBinding = binding({ kind: 'key', key: 'v' });
  const activeAction = immediateAction('active', 'a', activeRun);
  activeAction.defaultBinding = activeBinding;
  const hotkeyAction = {
    ...immediateAction('hotkey-select', 'b', ambientRun),
    defaultBinding: { kind: 'key', key: 'v' } as const,
    scope: 'hotkey' as const,
  };
  const registry = makeRegistry([activeAction, hotkeyAction]);
  // Build a dispatcher with activeAction.binding on the active tool and
  // hotkeyAction in the registry, then fire a keyDown(v) event.
  // Assert: ambientRun was called, activeRun was not.
  expect(ambientRun).toHaveBeenCalledOnce();
  expect(activeRun).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npx vitest run src/interactions/dispatcher/dispatcher.test.ts -t 'hotkey' --reporter=default`
Expected: FAIL — Action has no `scope` field, dispatcher's ambient walker drops the binding in `ambient` scope.

- [ ] **Step 4: Add the field**

```ts
// src/interactions/actions/types.ts (or wherever Action is defined)
export interface Action {
  // ... existing fields ...
  /** When set to `'hotkey'`, this action's defaultBinding rides the hotkey
   *  BindingScope instead of the ambient scope — meaning it beats any
   *  active-tool binding on the same input shape. Use for tool-switch
   *  shortcuts and global held-key triggers. Default: ambient. */
  scope?: 'hotkey';
}
```

- [ ] **Step 5: Honor the field in `assembleScopedBindings`**

```ts
// src/interactions/dispatcher/dispatcher.ts:303-323 — replace the inner push
// in the ambient walk
const targetScope: BindingScope = action.scope === 'hotkey' ? 'hotkey' : 'ambient';
result.push({ binding: defaultBinding, scope: targetScope, ownerToolId: null });
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/interactions/dispatcher/dispatcher.test.ts --reporter=default`
Expected: PASS — all existing precedence tests still hold (they used scope='hotkey' implicitly via the hotkeyStack source; now the registry can produce hotkey bindings too).

- [ ] **Step 7: Commit**

```bash
git add src/interactions/actions/types.ts src/interactions/dispatcher/dispatcher.ts src/interactions/dispatcher/dispatcher.test.ts
git commit -m "feat(actions): Action.scope hint promotes registry bindings into hotkey scope"
```

---

## Phase 4 — Tool-Switch Action Factory

### Task 7: Create `makeToolSelectAction`

**Files:**
- Create: `src/interactions/actions/defaults/toolSelect.ts`
- Test: `src/interactions/actions/defaults/toolSelect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/interactions/actions/defaults/toolSelect.test.ts — new file
import { describe, it, expect, vi } from 'vitest';
import { makeToolSelectAction } from './toolSelect';

describe('makeToolSelectAction', () => {
  it('produces an action with id `tool.select.<id>` and scope hotkey', () => {
    const a = makeToolSelectAction('rect', { key: 'r' });
    expect(a.id).toBe('tool.select.rect');
    expect(a.scope).toBe('hotkey');
  });

  it("defaultBinding is a keyDown(<key>) route", () => {
    const a = makeToolSelectAction('rect', { key: 'r' });
    expect(a.defaultBinding).toEqual({ kind: 'key', key: 'r' });
  });

  it('respects modifier flags in the key spec', () => {
    const a = makeToolSelectAction('selectMod', { key: 'a', mod: true });
    expect(a.defaultBinding).toEqual({ kind: 'key', key: 'a', mod: true });
  });

  it('run() calls setActive(toolId) on the supplied tool-active context', () => {
    const setActive = vi.fn();
    const a = makeToolSelectAction('rect', { key: 'r' });
    a.run({ activeTool: { setActive } } as any);
    expect(setActive).toHaveBeenCalledWith('rect');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/interactions/actions/defaults/toolSelect.test.ts --reporter=default`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/interactions/actions/defaults/toolSelect.ts
import type { Action } from '../types';
import type { KeySpec } from '@orochi235/weasel-gestures';

export interface ToolSelectKeyOpts {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Build a tool-switch action: pressing `key` (with optional modifiers)
 *  activates the tool with id `toolId`. Registers under id
 *  `tool.select.<toolId>` with scope:'hotkey' so a tap on the bound key
 *  always wins over the currently active tool's own keyDown bindings. */
export function makeToolSelectAction(toolId: string, keyOpts: ToolSelectKeyOpts): Action {
  const spec: KeySpec = {
    kind: 'key',
    key: keyOpts.key,
    ...(keyOpts.mod !== undefined && { mod: keyOpts.mod }),
    ...(keyOpts.alt !== undefined && { alt: keyOpts.alt }),
    ...(keyOpts.shift !== undefined && { shift: keyOpts.shift }),
  };
  return {
    id: `tool.select.${toolId}`,
    defaultBinding: spec,
    scope: 'hotkey',
    run: (ctx) => {
      ctx.activeTool.setActive(toolId);
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/interactions/actions/defaults/toolSelect.test.ts --reporter=default`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/defaults/toolSelect.ts src/interactions/actions/defaults/toolSelect.test.ts
git commit -m "feat(actions): makeToolSelectAction factory for tool-switch shortcuts"
```

---

### Task 8: Convert `makeToolHoldAction` to a `keyHeld` route spec

**Files:**
- Modify: `src/interactions/actions/defaults/toolHold.ts:15-35`
- Test: existing test file for `toolHold` — `src/interactions/actions/defaults/toolHold.test.ts` (or co-located).

- [ ] **Step 1: Write the failing test**

```ts
// src/interactions/actions/defaults/toolHold.test.ts — append
it('uses scope:"hotkey" so the hold action beats the active tool', () => {
  const a = makeToolHoldAction('hand', ' ');
  expect(a.scope).toBe('hotkey');
});

it("defaultBinding is a key-held spec — the dispatcher's keyHeld engagement covers it", () => {
  const a = makeToolHoldAction('hand', ' ');
  expect(a.defaultBinding).toEqual({ kind: 'key-held', key: ' ' });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/interactions/actions/defaults/toolHold.test.ts --reporter=default`
Expected: FAIL — `scope` not set on the existing action.

- [ ] **Step 3: Set scope and confirm spec shape**

```ts
// src/interactions/actions/defaults/toolHold.ts:15-35 — modify the returned action object
export function makeToolHoldAction(toolId: string, key: string): Action {
  return {
    id: `tool.hold.${toolId}`,
    defaultBinding: { kind: 'key-held', key },
    scope: 'hotkey',
    run: (ctx) => { ctx.activeTool.pushHotkey(toolId); },
    onEnd: (ctx) => { ctx.activeTool.popHotkey(); },
  };
}
```

(Spec shape is unchanged from today — the runtime `key-held` event matches it via match.ts:251-255. After Phase 2, this same spec also gets keyHeld engagement semantics, so existing held-trigger behavior is preserved.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/interactions/actions/defaults/toolHold.test.ts --reporter=default`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/defaults/toolHold.ts src/interactions/actions/defaults/toolHold.test.ts
git commit -m "feat(actions): makeToolHoldAction declares scope:'hotkey'"
```

---

## Phase 5 — Migrate Built-in Tools

### Task 9: Per-tool migration (run once per tool)

Repeat the per-tool checklist below for each tool that currently declares `keybinding`. The list of tools (from the reconnaissance report):
- `useSelectTool` (V)
- `useRectTool` (R)
- `useEllipseTool` (E)
- `useLineTool` (\\)
- `usePolygonTool` (G)
- `usePencilTool` (N)
- `useLassoTool` (L)
- `useTextTool` (T)
- `useHandTool` (H — plus a `hotkey: 'space'` field for held-Space)
- `usePenTool` (P)

**Per-tool checklist (do this for each tool):**

- [ ] **Step 1: Delete the keybinding declaration**

In `src/tools/builtin/use<Name>Tool/use<Name>Tool.ts` (or `.tsx`), remove the `keybinding:` field from the tool definition object.

- [ ] **Step 2: Delete the hotkey declaration (Hand only)**

In `src/tools/builtin/useHandTool/useHandTool.ts`, also remove the `hotkey: 'space'` field.

- [ ] **Step 3: Register the action(s) at the canvas-mount layer**

Find where built-in tools are registered into the canvas mount (search: `grep -rn "useSelectTool\|useRectTool" src/ | grep -v test`). Add to the same setup site:

```ts
import { makeToolSelectAction } from '@orochi235/weasel/actions';
// For each migrated tool:
actions.register(makeToolSelectAction('rect', { key: 'r' }));
// For Hand (held-Space) also:
actions.register(makeToolHoldAction('hand', ' '));
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run --reporter=default 2>&1 | tail -20`
Expected: PASS. Any failures point to consumers that still read `tool.keybinding` directly — those get cleaned up in Phase 6.

- [ ] **Step 5: Commit (once per tool)**

```bash
git add src/tools/builtin/use<Name>Tool
git commit -m "refactor(tools): migrate <Name> tool key activation to action registry"
```

(Do not batch all tools into one commit — one commit per tool keeps blast radius small.)

---

### Task 10: Remove `ToolDef.keybinding`, `ToolDef.hotkey`, and `KeyBinding`

**Files:**
- Modify: `src/tools/types.ts:144-145`
- Modify: `src/interactions/keyHelpers.ts:10-35`
- Delete: `src/tools/useKeybindings.ts` (entire file)

Pre-req: Task 9 complete for every tool. No remaining code reads these fields.

- [ ] **Step 1: Confirm nothing reads the fields**

Run: `grep -rn "\.keybinding\b\|\.hotkey\b" src/ apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."`
Expected: only inspector-side reads in `apps/draw/src/dev/ToolkitBuilder.tsx` and `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx` — those are handled in Phase 6.

If any other read survives, return to Task 9 for that tool.

- [ ] **Step 2: Delete `ToolDef.keybinding` and `ToolDef.hotkey`**

```ts
// src/tools/types.ts:144-145 — remove the two fields. Also delete any
// `HotkeyTrigger` type if it lives in this file.
```

- [ ] **Step 3: Delete `KeyBinding` interface**

```ts
// src/interactions/keyHelpers.ts:10-35 — remove `export interface KeyBinding {...}`.
// Keep any other helpers in the file.
```

- [ ] **Step 4: Delete `useKeybindings.ts`**

Run: `git rm src/tools/useKeybindings.ts`

If `useKeybindings` is imported anywhere outside the deleted file, those callers must be removed too (they were the old wiring for tool-switch). Verify with `grep -rn "useKeybindings" src/ apps/ packages/`.

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot 2>&1 | tail -10`
Expected: PASS / no type errors.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(tools): drop ToolDef.keybinding / .hotkey / KeyBinding / useKeybindings"
```

---

## Phase 6 — Inspector Consumers

### Task 11: Derive shortcut chips from the action registry

**Files:**
- Create: `apps/draw/src/dev/keybindingsView.ts`
- Modify: `apps/draw/src/dev/ToolkitBuilder.tsx:217`
- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx:122` (and its props interface)
- Modify: `packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts` — drop the `KeyBinding` import; accept a plain `{ key, mod?, alt?, shift? }` object.

- [ ] **Step 1: Write the failing test for `keybindingsView`**

```ts
// apps/draw/src/dev/keybindingsView.test.ts — new file
import { describe, it, expect } from 'vitest';
import { lookupShortcutByToolId } from './keybindingsView';

describe('lookupShortcutByToolId', () => {
  it('returns the keyDown spec from the tool.select.<id> action when present', () => {
    const actions = [
      { id: 'tool.select.rect', defaultBinding: { kind: 'key', key: 'r' } },
      { id: 'tool.select.hand', defaultBinding: { kind: 'key', key: 'h' } },
    ];
    expect(lookupShortcutByToolId('rect', actions as any)).toEqual({ key: 'r' });
    expect(lookupShortcutByToolId('hand', actions as any)).toEqual({ key: 'h' });
  });

  it('returns undefined when no tool.select.* action exists for the id', () => {
    expect(lookupShortcutByToolId('pen', [] as any)).toBeUndefined();
  });

  it('includes modifier flags when set on the action binding', () => {
    const actions = [
      { id: 'tool.select.rect', defaultBinding: { kind: 'key', key: 'r', mod: true } },
    ];
    expect(lookupShortcutByToolId('rect', actions as any)).toEqual({ key: 'r', mod: true });
  });
});
```

- [ ] **Step 2: Implement**

```ts
// apps/draw/src/dev/keybindingsView.ts
import type { KeySpec } from '@orochi235/weasel-gestures';

export interface KeyShortcut {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Look up the keyDown shortcut for activating a tool. Reads the
 *  `tool.select.<toolId>` action from the registry — returns undefined
 *  if no such action exists or its binding isn't a single-key spec. */
export function lookupShortcutByToolId(
  toolId: string,
  actions: readonly { id: string; defaultBinding?: unknown }[],
): KeyShortcut | undefined {
  const a = actions.find((x) => x.id === `tool.select.${toolId}`);
  const b = a?.defaultBinding as KeySpec | undefined;
  if (!b || b.kind !== 'key') return undefined;
  const { key, mod, alt, shift } = b;
  return { key, ...(mod !== undefined && { mod }), ...(alt !== undefined && { alt }), ...(shift !== undefined && { shift }) };
}
```

- [ ] **Step 3: Update `formatShortcut.ts` to accept the lighter input**

```ts
// packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts
import { keyGlyph } from '../Keycaps/keyGlyph';

export interface ShortcutInput {
  key: string | readonly string[];
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

export function formatShortcutParts(b: ShortcutInput | undefined): readonly string[] | undefined {
  if (!b) return undefined;
  const rawKey = Array.isArray(b.key) ? b.key[0] : (b.key as string);
  const parts: string[] = [];
  if (b.mod) parts.push('⌘');
  if (b.shift === true) parts.push('⇧');
  if (b.alt) parts.push('⌥');
  parts.push(keyGlyph(rawKey));
  return parts;
}

export function formatShortcut(b: ShortcutInput | undefined): string | undefined {
  const parts = formatShortcutParts(b);
  return parts ? parts.join('') : undefined;
}
```

- [ ] **Step 4: Update `ToolPalette.tsx` to take a `lookupShortcut` prop**

```tsx
// packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx — add to props
export interface ToolPaletteProps {
  // ... existing ...
  /** Optional shortcut lookup. Receives a tool id, returns the activation
   *  shortcut (key + modifier flags) or undefined. Replaces the old
   *  `tool.keybinding` direct read. */
  lookupShortcut?: (toolId: string) => { key: string; mod?: boolean; alt?: boolean; shift?: boolean | 'optional' } | undefined;
}

// In the render body around line 122, replace
//   formatShortcut(tool.keybinding)
// with
//   formatShortcut(lookupShortcut?.(tool.id))
```

- [ ] **Step 5: Wire `lookupShortcut` from the canvas mount**

Find every site that mounts `<ToolPalette>` (`grep -rn "<ToolPalette" apps/ src/ --include="*.tsx"`). Pass `lookupShortcut={(id) => lookupShortcutByToolId(id, actions.list())}`.

- [ ] **Step 6: Update `ToolkitBuilder.tsx:217` similarly**

```tsx
// apps/draw/src/dev/ToolkitBuilder.tsx:217 — replace
//   formatShortcutParts(d.keybinding)
// with
//   formatShortcutParts(lookupShortcutByToolId(d.id, actions.list()))
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run --reporter=dot 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/draw/src/dev/keybindingsView.ts apps/draw/src/dev/keybindingsView.test.ts packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx apps/draw/src/dev/ToolkitBuilder.tsx
git commit -m "refactor(inspector): shortcut chips read from action registry, not ToolDef.keybinding"
```

---

### Task 12: `HotkeyTriggerEntry` reflects `tool.hold.*` actions

**Files:**
- Modify: `apps/draw/src/dev/registryData.ts:259, 428-430`
- Modify: `apps/draw/src/dev/RegistryDetail.tsx:356-358` — render the action's route as a Powerline.

- [ ] **Step 1: Update `collectHotkeyTriggers`**

```ts
// apps/draw/src/dev/registryData.ts:428-430 — replace the static
// HOTKEY_TRIGGER_KEYS implementation
export function collectHotkeyTriggers(actions: readonly { id: string; defaultBinding?: unknown }[]): readonly HotkeyTriggerEntry[] {
  return actions
    .filter((a) => a.id.startsWith('tool.hold.'))
    .map((a) => {
      const spec = a.defaultBinding as { kind: string; key?: string } | undefined;
      const key = spec?.kind === 'key-held' ? (spec.key ?? '?') : '?';
      const toolId = a.id.slice('tool.hold.'.length);
      return { kind: 'hotkeyTrigger', id: toolId, label: `${toolId} (${key})` };
    });
}
```

- [ ] **Step 2: Update every caller to pass the actions list**

`grep -rn "collectHotkeyTriggers" apps/ --include="*.ts" --include="*.tsx"` and update each call site to thread the registry through.

- [ ] **Step 3: `HotkeyTriggerDetail` renders the corresponding Powerline**

```tsx
// apps/draw/src/dev/RegistryDetail.tsx:356-358 — extend HotkeyTriggerDetail
function HotkeyTriggerDetail({ entry, actions }: { entry: HotkeyTriggerEntry; actions: readonly ActionEntry[] }) {
  const action = actions.find((a) => a.id === `tool.hold.${entry.id}`);
  // Derive the route string from the action's keyHeld defaultBinding.
  const route = action ? `[*:initial] keyHeld(${(action.defaultBinding as { key: string }).key})` : null;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      {route && <Powerline {...routeToPowerline(route)} />}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run apps/draw/src/dev/ --reporter=default 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/dev/registryData.ts apps/draw/src/dev/RegistryDetail.tsx
git commit -m "refactor(inspector): HotkeyTriggerEntry sources from tool.hold.* actions"
```

---

## Phase 7 — Cleanup + Docs

### Task 13: Remove the legacy `KeyBinding` import from `formatShortcut.ts`

Pre-req: Task 11 already swapped the input type to `ShortcutInput`. Verify no consumer still imports `KeyBinding`:

- [ ] **Step 1: Confirm**

Run: `grep -rn "KeyBinding" src/ apps/ packages/ --include="*.ts" --include="*.tsx"`
Expected: no results.

If any survive, fix or delete them.

- [ ] **Step 2: Final verification**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot && npx tsup build`
Expected: clean / no failures. (Matches the user's prepublishOnly memory: `tsc --noEmit && vitest run && tsup build`.)

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore(tools): final sweep — KeyBinding fully retired"
```

---

### Task 14: Update docs

**Files:**
- Modify: `docs/TODO.md` — strike through the keybinding-migration line if one exists; add a one-line entry under "Recent changes" pointing at this plan.
- Modify: `docs/concepts.md` or wherever the actions registry is documented — add a section explaining that `keybinding` is now expressed as `tool.select.<id>` actions with `scope: 'hotkey'`, and that held-key activations use `keyHeld` routes.

- [ ] **Step 1: Edit docs**

Find the actions / interactions section in `docs/concepts.md`. Add a subsection under "Actions registry":

```markdown
### Keyboard activations are actions

Tool-switch shortcuts (`V` → Select) and held-key activations (Space → Hand) are
registered as actions, not as ToolDef fields. The factories in
`src/interactions/actions/defaults/` produce them:

- `makeToolSelectAction(toolId, { key, mod?, alt?, shift? })` — tap-to-switch.
  Registers under id `tool.select.<toolId>` with `scope: 'hotkey'` and a
  `keyDown(<key>)` default binding.
- `makeToolHoldAction(toolId, key)` — hold-to-activate. Registers as
  `tool.hold.<toolId>` with a `keyHeld(<key>)` default binding; the
  dispatcher's keyHeld engagement mirrors drag's `[initial]` → `[engaged]`
  lifecycle.

Inspector surfaces (ToolPalette shortcut chips, HotkeyTriggerEntry) derive
their views from the action registry — there is no per-tool keybinding
field.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md docs/concepts.md
git commit -m "docs: keybindings-as-routes migration concepts"
```

---

## Self-Review Checklist (for the executor)

Before declaring the migration done, verify:

- [ ] `grep -rn "ToolDef.keybinding\|ToolDef.hotkey\|interface KeyBinding\|useKeybindings" src/ apps/ packages/ --include="*.ts" --include="*.tsx"` returns no results.
- [ ] Every previously-bound tool still activates on its key (manual smoke in WeaselDraw).
- [ ] Held Space still pans (Hand tool engages, panning works, releases on keyup).
- [ ] The inspector's `Route Powerline` story includes a keyHeld section and renders.
- [ ] `RouteBadge` / `Powerline` render keyHeld(Space) with the KeyCap.
- [ ] `describeRoute` for `[initial] keyHeld(Space)` reads "Fires when the user holds Space, while the tool is idle (i.e. not in the middle of a drag or other synchronous operation)."
- [ ] `npx tsc --noEmit && npx vitest run && npx tsup build` passes — matches the project's prepublishOnly gate.

---

## Open Questions for Mike

These came up during plan-writing and should be settled before execution (or noted as deferred):

1. **`keyHeld` engagement granularity.** Today's `drag` engages a single channel per pointer. Multiple held keys (e.g. simultaneously holding Space and Shift) — should each engaged key get its own channel slot, or is "the keyboard channel" singular? The plan's `KeyHoldState` map keys on `(ownerToolId, key)` which supports both, but the dispatcher integration in Task 5 needs to commit to a model.

   Specifically: modifier keys (Shift/Alt/Mod/Ctrl/Meta) should **not** be valid `keyHeld` route args — they're consumed by the modifier matcher, not the key-arg slot. The grammar already accepts any string for `keyHeld(_)`, so this is a runtime convention; document it in the gestures package, and either reject modifier-key route registrations at parse time or trust authors. Mid-hold modifier presses are tested in Task 5 as **sticky-engagement** invariants — pressing Shift while Space is held doesn't disengage Space, it just changes which `[engaged]` routes match on subsequent events. This matches drag's existing behavior (modifiers on follow-up pointermove events drive engaged-route selection without ending the drag).

2. **Held-key behavior on focus loss.** When the window loses focus mid-hold, browsers don't always deliver keyup. Today's `makeToolHoldAction` may already have a recovery path. Verify in Task 5 that keyHeld engagement releases on blur (or document the gap).

3. **Action `scope` extensibility.** I made `scope?: 'hotkey'` (the only non-default value). If we expect more scopes later (e.g. `'app-global'`), widen the type to a union now to avoid a breaking change.

4. **Per-tool init ordering for action registration.** Task 9 registers `makeToolSelectAction` at the canvas-mount site. If a user reorders the tools' shortcuts (e.g. config-driven), that wiring becomes more dynamic. Acceptable for now since shortcuts have always been built-in literals — confirm.

---

## Post-implementation note (2026-05-22)

`makeToolSelectAction` / `tool.select.<id>` was split into two layered actions:

- **`makeToolActivateAction(toolId)`** → `tool.activate.<toolId>` — the effect,
  no binding, no scope. Invoked by name from any surface.
- **`makeToolShortcutAction(toolId, keyOpts, trigger)`** → `tool.shortcut.<toolId>` —
  the hotkey binding; its `run` calls `trigger('tool.activate.<toolId>')` via a
  closure over `registry.trigger`. No dep-bag required; the registry isn't in
  `DepSchema` and wasn't added — the closure approach avoids that.

`useKeybindings` now registers both actions per tool. Inspector surfaces
(`lookupShortcutByToolId` in `keybindingsView.ts`) filter on `tool.shortcut.*`
to read the binding. `docs/concepts.md` updated to reflect the split.
