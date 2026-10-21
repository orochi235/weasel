# Leader keymaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A leader key opens a keymap for the next input, or while held; bindings anywhere can be rebound by id.

**Architecture:** The open-keymap stack is a small synchronous store owned by each `useGestureDispatcher` and read through `DispatcherContext`. The dispatcher routes an input first against the innermost open keymap alone, then decides by the `gestures.leader.unbound` setting whether to swallow it or let it cascade. Binding overrides are a map from binding id to spec, applied where `walk.ts` assembles bindings.

**Tech Stack:** TypeScript, React, vitest (`npx vitest run --project=<p>`), npm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-20-leader-scopes-design.md`

## Global Constraints

- Changesets are `patch`, always.
- Names: **keymap**, **leader**. Never "chord", "scope" or "layer" for these.
- `gestures.leader.unbound`: `'modal' | 'cascade'`, default `'modal'`.
- Escape always closes the innermost keymap; a keymap may not bind Escape.
- Nothing bakes in `{x, y}`: a keymap's pointer bindings resolve through the same deps as any binding.
- No file over 400 lines, no function over 120 (`npm run check:size`).

## Deviations from the spec, decided while planning (2026-10-20)

- Each keymap gets its own leader action, `keymap.<id>`, rather than one consolidated `keymap.open`
  with a `keymapId` param. That gives every leader its own palette label ("Open Loupe keys"), its own
  `trigger`, and its own binding id to rebind. The spec is updated to match.
- Capture covers keys (`key` and `key-held`) only. Pointer capture is a TODO entry.

## Review Focus

- Key/key-held twin: one keydown dispatches `key` then `key-held`. A once-keymap must not close between
  the two, or the second reaches a normal binding (L then Space engaging the hand tool).
- Autorepeat of a held leader must not count as "input while held".
- A leader pressed mid-drag must open without ending the drag; the drag's pointermove/up must not
  close a once-keymap.
- Window blur and dispatcher teardown must close every open keymap, or the hint is left showing.
- An override naming an unknown binding id must do nothing, not throw.

---

### Task 1: Key sugar in `@weasel-js/gestures`

**Files:**
- Create: `packages/gestures/src/ui/keySugar.ts`, `packages/gestures/src/ui/keySugar.test.ts`
- Modify: `packages/gestures/src/index.ts` (export), `packages/routing/src/contributions/modeShortcuts.ts` (drop `modeShortcutSpec`'s body, call `key`)

**Interfaces — Produces:**
- `key(shortcut: string): KeySpec` — `'Mod+Shift+K'`; modifiers case-insensitive: `meta|cmd|command`, `ctrl|control`, `alt|option`, `shift`, `mod`; key names `Space`→`' '`, `Esc`→`'Escape'`, others verbatim; throws on an unknown modifier or no key.
- `held(shortcut: string): KeyHeldSpec` — same parse, `kind: 'key-held'`.
- `unbound(): null`.
- `bindingSpec(input: string | GestureSpec | null): GestureSpec | null` — a route string (`'[*:*] keyDown(=) +mod'`) through `routeToSpec(parseRoute(s))`, a spec as-is, `null` as-is.
- `keySpecRoute(spec: KeySpec | KeyHeldSpec): string` — the route string `bindingSpec` reads back to an equal spec.

- [ ] Tests: `key('Mod+Shift+K')` → `{ kind: 'key', key: 'K', mods: { mod: true, shift: true } }`; `key('Space')` → `{ kind: 'key', key: ' ' }`; `key('Hyper+K')` throws `/unknown modifier "Hyper"/`; `held('Space').kind === 'key-held'`; `bindingSpec('[*:*] keyDown(=) +mod')` equals `key('Mod+=')`; `bindingSpec(keySpecRoute(key('Alt+2')))` equals `key('Alt+2')`. Existing `modeShortcuts` tests stay green.
- [ ] Run `npx vitest run --project=core packages/gestures/src/ui/keySugar.test.ts packages/routing/src/contributions` (find the owning project with `npm run check:test-projects` first); see it fail, implement, see it pass.
- [ ] Commit: "add key, held and unbound sugar for gesture specs".

### Task 2: Binding ids and overrides

**Files:**
- Create: `packages/routing/src/interactions/actions/bindingOverrides.ts` + test
- Modify: `invoker.ts` (`BindingOpts.id?: string`), `walk.ts` (`assembleScopedBindings`), `dispatcherApi.ts` (`DispatcherContext.bindingOverrides?`), `registry.ts` (`overrideBindings`, `bindingOverrides`), `useGestureDispatcher.tsx` (pass it), `packages/core/src/canvas/SceneCanvas/props.ts` + a `useBindingOverrides` hook beside `useActionTunings.ts` + `canvasPassThrough.ts`.

**Interfaces — Produces:**
- `type BindingOverrideInput = string | GestureSpec | null` (route string, spec or unbind).
- `type BindingOverrides = Readonly<Record<string, BindingOverrideInput>>`.
- `bindingId(b: GestureBinding, ownerId: string | null, index: number): string` — `b.opts?.id`, else `` `${ownerId ?? b.actionId}#${index}` ``.
- `applyBindingOverrides(bindings: readonly ScopedBinding[], overrides: ReadonlyMap<string, GestureSpec | null>): ScopedBinding[]` — replaces `spec`, drops `null`; unknown ids ignored.
- `ActionsRegistry.overrideBindings(map: BindingOverrides): () => void` and `.bindingOverrides(): ReadonlyMap<string, GestureSpec | null>` — several holders merge in registration order, later wins per id; scope tiers resolve as tunings do (own, yoke, root, inner wins).
- `<SceneCanvas bindingOverrides={...}>`.

- [ ] Tests (`bindingOverrides.test.ts`): derived ids; `opts.id` wins; replace; `null` drops; unknown id is a no-op; two holders, later wins; a dispatcher test that `key('=')` reaches an action whose default was `2` after override and `2` no longer does, for both an action `defaultBinding` and a contribution binding.
- [ ] Implement; run `npx vitest run --project=core packages/routing/src/interactions`.
- [ ] Commit: "rebind any action or contribution binding by id".

### Task 3: The keymap stack

**Files:**
- Create: `packages/routing/src/keymaps/keymapStack.ts` + test, `packages/routing/src/keymaps/index.ts`

**Interfaces — Produces:**
```ts
type KeymapUnbound = 'modal' | 'cascade';
interface OpenKeymap { id: string; label: string; held: boolean; heldBy?: string; usedWhileHeld: boolean }
interface KeymapStack {
  open(): readonly OpenKeymap[];            // outermost first
  innermost(): OpenKeymap | null;
  push(id: string, label: string, heldBy?: string): void;   // heldBy: the leader's gesture id
  release(heldBy: string): void;            // leader up: close that level and above if used, else turn it into once
  closeInnermost(): void;                   // Escape
  consumed(): void;                         // a binding in the innermost keymap took this input
  missed(kind: 'key' | 'pointer'): void;    // unbound input; caller has applied the unbound rule
  closeAll(): void;                         // blur, teardown
  batch<T>(fn: () => T): T;                 // defer closes to the end of one raw input
  subscribe(fn: () => void): () => void;
  getVersion(): number;
}
function createKeymapStack(): KeymapStack;
```
Close rules (from the spec): `consumed()` marks every held level used and closes once-levels down to the innermost held one. `missed('pointer')` closes once-levels only; held levels stay. `missed('key')` is only called under `'cascade'` and closes like `consumed`. All closes queued inside `batch` apply when the outermost `batch` returns.

- [ ] Tests: tap (push, release with no input) leaves a once-level; hold-and-use (push, consumed, release) closes; once + consumed closes; nested held-outer/once-inner + consumed leaves outer open; Escape closes one; batch defers; `closeAll` empties and notifies once.
- [ ] Implement; run its test file. Commit: "add the keymap stack".

### Task 4: Dispatcher routing through open keymaps

**Files:**
- Modify: `contributions/types.ts` (`Eligibility.keymap?: true | { unbound?: KeymapUnbound }`), `contributions/eligibility.ts` (`liveScope`: a keymap entry is `'hotkey'` only when it is the innermost open id, else `null`), `contributions/assemble.ts` (`AssemblyInputs.openKeymap?: string | null`), `dispatcherApi.ts` (`DispatcherContext.keymaps?: KeymapStack`, `keymapOnly?: boolean`, `leaderUnbound?: KeymapUnbound`), `walk.ts` (with `keymapOnly`, assemble only the innermost keymap's bindings), new `interactions/dispatcher/keymapRoute.ts` (the two-pass rule), `dispatchCore.ts` (`dispatch` runs inside `keymaps.batch`; new `dispatchInput(evs: InputEvent[], on?, reach?)` for the keyboard twin), `channels/keyboard.ts` (`press` dispatches the twin through `dispatchInput`), `attachInput.ts` (blur and teardown `closeAll`), `useGestureDispatcher.tsx` (own a stack, `depRegistry.register('keymaps', …)`, read `gestures.leader.unbound`), `kitSettings.ts` (`leader: { unbound: KeymapUnbound }`), `packages/core/src/kitSettingsSchema.ts` (`pref.enum('Keys outside a keymap', 'modal', ['modal', 'cascade'])`), `index.ts` (`DepSchema.keymaps?: KeymapStack`).

**Interfaces — Consumes:** Task 3's stack. **Produces:** `routeThroughKeymap(raw: () => 'handled'|'unhandled' per event…)` — exact shape is the builder's; behavior below.

Behavior per raw input, when `keymaps.innermost()` is non-null and the event is not a pump of a gesture already in flight, not hover, and not a bare modifier keydown:
1. A plain Escape `key` closes the innermost keymap: handled.
2. Pass 1: dispatch with `keymapOnly`. If it fires: `consumed()`, handled.
3. Key, `'modal'` (the keymap's own `unbound` wins over the setting): handled, nothing else runs.
4. Key, `'cascade'`: `missed('key')`, then pass 2 normally.
5. Pointer gesture event (`pointerdown` that starts a gesture, `click`, `doubleclick`, `longpress`, `contextmenu`, `multitouch*`): pass 2 normally, then `missed('pointer')` — except a `click` while the keymap binds `doubleclick`, which leaves it open.
6. Wheel or pinch the keymap doesn't bind: pass 2, keymap untouched.

- [ ] Tests (`dispatcher.keymap.test.ts`, driving `createDispatcher` with a hand-built ctx and stack): bound key fires and closes once-keymap; unbound key swallowed under modal and keymap stays open; under cascade the outside binding fires and keymap closes; per-keymap `unbound` beats the setting; Escape closes without reaching an outside Escape binding; pointer click outside closes; the key/key-held twin inside one `batch` never reaches an outside `key-held` binding; keymap bindings outrank an outside hotkey-tier binding on the same key; with no keymap open nothing changes (existing dispatcher suite green).
- [ ] Hook test (`useGestureDispatcher.keymap.test.tsx`): window blur closes; unmount closes.
- [ ] Implement; run `npx vitest run --project=core packages/routing`. Commit: "route input through the innermost open keymap first".

### Task 5: `keymapContribution` and the leader action

**Files:**
- Create: `packages/routing/src/keymaps/keymapContribution.ts` + test; export from `keymaps/index.ts` and the routing barrel; re-export from core's barrel by name.

**Interfaces — Produces:**
```ts
interface KeymapDef {
  id: string; label: string;
  leader: GestureSpec | GestureSpec[];      // key-held specs; a key spec is converted to key-held
  bindings: GestureBinding[];               // the keymap's own
  actions?: Action[];
  unbound?: KeymapUnbound;
}
function keymapContribution(def: KeymapDef): Contribution<never>[];  // [keymap entry, leader entry]
```
The leader entry is `always`-eligible and carries action `keymap.<id>` (label `Open <label> keys`, scope `'hotkey'`, `requires: ['keymaps']`, ongoing): `start` pushes with `heldBy` = its gesture id, `onEnd` calls `release`. No phase restriction, so it opens mid-gesture. Its binding ids are `keymap.<id>.leader` (and `#n` for several). Throws if `bindings` contains a plain Escape key.

- [ ] Tests: tap L then 2 fires; hold L, press 2 twice, both fire, release closes; L mid-drag opens and the drag still commits on pointerup; leader rebound by `overrideBindings({ 'keymap.loupe.leader': key('M') })`; Escape in `bindings` throws.
- [ ] Implement; run. Commit: "build a keymap and its leader from one definition".

### Task 6: Chips and the hint

**Files:**
- Modify: `packages/menu/src/entries.ts` (`MenuShortcut.leader?: readonly { label: string; shortcut: MenuShortcut }[]`), `packages/gestures/src/ui/formatShortcut.ts` (prefix `Label ▸ ` per level), `packages/routing/src/interactions/actions/actionShortcuts.ts`
- Create: `packages/routing/src/keymaps/describeKeymap.ts` + test, `packages/routing/src/keymaps/useOpenKeymap.ts` (in `@weasel-js/routing/react`), `packages/ui/src/components/KeymapHint/{KeymapHint.tsx,KeymapHint.module.css,index.ts,KeymapHint.stories.tsx}` + test

**Interfaces — Produces:**
- `describeKeymap(entry: Contribution, actions: ActionSource, overrides: ReadonlyMap<string, GestureSpec|null>): { id; label; rows: { shortcut?: MenuShortcut; gesture?: string; label: string }[] }` — Escape row first ("Close"), then bindings in declaration order, pointer rows described by `describeRoute`.
- `keymapShortcuts(def or entry, leaderShortcut): Map<actionId, MenuShortcut[]>` with `leader` set, for menus/palettes.
- `useOpenKeymap(): ReturnType<typeof describeKeymap> | null` — subscribes to the `keymaps` dep.
- `<KeymapHint />` — renders the innermost keymap's label and rows; nothing when closed; tokens only, no inline styles.

- [ ] Tests: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'L' } }] })` → `'Loupe ▸ 2'`; describeKeymap row order and override applied; KeymapHint renders rows when open and nothing when closed.
- [ ] Commit: "show an open keymap's keys and label leader shortcuts".

### Task 7: Capture

**Files:** Create `packages/routing/src/keymaps/captureKey.ts` + test.

**Interfaces — Produces:** `captureKey(target: EventTarget, opts?: { held?: boolean; signal?: AbortSignal }): Promise<KeySpec | KeyHeldSpec | null>` — resolves on the next non-modifier keydown with its modifiers; Escape or abort resolves `null`; `preventDefault`s what it takes.

- [ ] Tests: `Mod+K` (metaKey on mac) → `key('Mod+K')`-equal on Apple platform; Escape → null; abort → null.
- [ ] Commit: "capture the next keystroke as a binding".

### Task 8: Demo, docs, changeset, TODO

- [ ] A terse demo under `apps/site/demos/` (find the neighboring layout first): a canvas with a keymap "Shape" behind `Mod+K`: `R` rect, `E` ellipse, a click binding, and `<KeymapHint />`.
- [ ] `docs/taxonomy.md`: Keymap and Leader under Contribution's eligibility list and under Interaction; binding overrides under Action beside tuning.
- [ ] Spec: apply the deviations above; mark built. Then, at merge, delete spec and plan per CLAUDE.md, moving anything durable into taxonomy.
- [ ] `docs/TODO.md`: pointer capture; the loupe moving its keys under a keymap (pointer to the loupe spec).
- [ ] `.changeset/leader-keymaps.md`, every touched package `patch`.
- [ ] `npm run typecheck`, `npm run check:size`, `npm run test:gate`, `npm run test:fleet` on the branch; merge to `main` locally (no push); `npm run test:fleet` on main in the background.
