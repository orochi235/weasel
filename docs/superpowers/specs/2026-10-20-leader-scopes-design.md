# Leader keymaps — design

**Status (2026-10-20): designed, not built.** This doc is for whoever builds it, in `@weasel-js/routing`
and `@weasel-js/gestures`. It answers how one key can open a set of bindings for the next input,
or for as long as that key is held. Weaselforge's loupe will use it first
(`2026-10-20-forge-loupe-design.md`, "Keys"), but it is engine surface for any host, 2D or kernel3d.

## Why

Asked for on 2026-10-20: "an action that activates loupe shortcuts for the next stroke or something."
A key route today is one key plus modifiers (`packages/gestures/src/grammar/keyRouteGrammar.ts`). A
sequence like "L, then 2" cannot be expressed. A feature with a dozen controls either spends a dozen
top-level keys or hides them behind modifier chords.

## Terms

- **Keymap**: a `Contribution` whose bindings are live only while it is *open*. Its bindings can be
  any gesture (keys, clicks, drags, wheel), not keys alone. Its label comes from `presentation.label`.
- **Leader**: a binding to the `keymap.open` action that opens a keymap. It is an ordinary action
  binding, listed like any other.

"Chord" is not used: in this repo it means a modifier combination (`BROWSER_RESERVED_CHORDS`).
"Scope" is not used either, because `BindingScope` and `<InputScope>` already have it.

## Behavior

**Declaring one.** An entry declares `eligibility: { keymap: true }`. Add that condition to
`Eligibility`, `packages/routing/src/contributions/types.ts`. An entry with nothing else declared is
dead until it is opened. While it is open, `liveScope` returns `'hotkey'` for it, so its bindings
outrank the active tool and ambient bindings, the same way a held offhand tool's do.

**Opening it.** `keymap.open` is one consolidated action, shaped like `tool.offhand`
(`packages/routing/src/interactions/actions/toolOffhand.ts`). The binding's `params.keymapId` says
which keymap it opens. A single leader key gives both lifetimes (tap-or-hold, my call):

| What the user does | Lifetime |
|---|---|
| Taps the leader and releases it with no other input in between | **Once**: open until the next input, then closed |
| Holds the leader and uses other input while it is down | **Held**: open until the leader comes up |

So the leader opens on keydown either way. On keyup, the keymap closes if any input reached it while
the key was down, whether a binding took that input or the keymap swallowed it. Otherwise it stays
open for one more input. That second case covers the loupe's open
question: hold the leader to give the pointer to the loupe's bindings, release it to give the pointer
back to the story.

**What closes a once-keymap** (my calls):
- a key or gesture one of its bindings takes;
- under `'cascade'`, a key it doesn't bind;
- a pointer press it doesn't bind.

The pointer case closes when the recognizer resolves the press, not at `pointerdown`, so the keymap's
click, double-click and long-press bindings can still match. For a double-click, the keymap stays open
across the first click while one of its bindings could still take the second.

None of these count:
- a bare modifier keydown (so `L`, then `Shift+2`, works);
- hover;
- autorepeat of the leader key itself.

Once the bound input's action has run, a once-keymap closes. For an ongoing action, such as a drag,
the keymap closes when the gesture starts, not when it ends. The gesture keeps the binding it started
with.

**Escape always closes.** Every open keymap answers Escape with "close", at the top of its own
bindings, ahead of anything else bound to Escape while it is open. The keymap's author does not
declare it and cannot remove it. If a keymap binds Escape itself, that is a route conflict.

**A held keymap** closes only when its leader comes up, or on Escape or window blur. A pointer press
it doesn't bind routes normally, but the keymap stays open. That is what lets a held loupe leader
survive a stray click on the story.

**A key the keymap doesn't bind** is governed by a kit setting, `gestures.leader.unbound`, in
`GestureKitSettings` (`packages/routing/src/kitSettings.ts`), with a per-keymap override
(`keymap: { unbound }`, my call):

| Value | A key the keymap doesn't bind |
|---|---|
| `'modal'` (default) | is swallowed (`preventDefault`, no other binding sees it). The keymap **stays open**. Only Escape, a bound input, or releasing a held leader closes it. |
| `'cascade'` | closes the keymap, then dispatches as if it had never been open |

A pointer press a once-keymap doesn't bind closes it and routes normally, in both modes. That is how
a menu treats a click outside it (my call). Being modal therefore only constrains keys; clicking away
always works.

**Nesting.** A keymap may bind a leader of its own (`L`, then `C`, then `1`). The open keymaps form a
stack. Only the innermost one is live; Escape closes one level. A once-keymap's bound input closes every
once-level down to the innermost held one, and that held one stays open until its key comes up. Nesting costs almost nothing, because `keymap.open` is just another action.

**A leader opens mid-gesture too (2026-10-20).** A registered leader takes precedence over whatever a
drag's own tool does with that key; leaders usually carry modifiers, so they rarely collide with one.
So unlike `tool.offhand`, a leader binding has no between-gestures phase. Opening a keymap leaves the
drag in flight running: it keeps its binding and the pointer, and its moves and its release are not
"the next input". Keys pressed while the keymap is open reach the keymap ahead of the drag's tool. That
includes Escape, which closes the keymap first; a second Escape cancels the drag (my call).

**Where it applies.** A keymap opens in the input scope whose dispatcher took the leader, and only
that scope's dispatcher reads it. Window blur closes every open keymap, the same way blur releases held
keys today (`attachInput.ts`). A keymap's bindings may carry `opts: { over: true }` like any other key
binding.

## Seeing it

- **State**: routing publishes the open keymap stack: each keymap's id, label, lifetime, and its live
  bindings in display order, Escape first. It is subscribable, so a UI can redraw on open and close.
  How it is published (a dep, or a store on the dispatcher) is the builder's call. A 3D host reads it
  the same way.
- **Hint**: a stock component shows the innermost open keymap's label and its rows, in the form a menu
  row's shortcut chip already uses (`actionShortcuts`, `formatShortcut`). Escape is the first row, and
  pointer bindings get a row too, described the way `describeRoute` describes them. It sits in
  `@weasel-js/ui` unless the builder finds a better owner. Where it docks is the host's choice.
- **Binding labels**: wherever a shortcut chip is drawn for an action reached through a keymap, it
  reads `Loupe ▸ 2`: each level's keymap label, then `▸`, then the inner key. The leader's own key is
  in the hint's title and a tooltip. Carry the path as a list of levels, each with its label and its
  leader's shortcut, on an optional field of `ActionShortcut` / `MenuShortcut`, rather than
  formatting a string in each UI. `actionShortcuts` reads only an action's own bindings
  (`actionShortcuts.ts`), so whatever builds these chips also has to read the keymap entries, and
  which leader opens each one.

## Rebinding (in this arc, 2026-10-20)

Rebinding a keymap's own keys ships with keymaps, and the leader keys rebind the same way. Today
`ActionsRegistry.tune` (`tuning.ts`) can only add a binding after an action's own `defaultBinding`. It
cannot replace or remove one, and it cannot reach bindings declared on a `Contribution`, which is
where a keymap's live.

The design (my call): **one override path for every binding, whether it sits on an action or on a
contribution.**

- **Binding id.** Each rebindable binding has a stable id: an explicit `id` on the binding, or one
  derived from its owner and its position. Explicit ids are what a host persists against. A derived
  id breaks when the defaults reorder, so kit-shipped bindings declare one.
- **Override.** A binding override maps a binding id to a replacement gesture, or to `null` to unbind
  it. An override names a binding, never a key, and applies to that binding's declared default, never
  to another override's result, so overrides don't chain. Several sources (an app's own, a user's
  saved prefs) merge into one flat map before use, later sources winning per id. Overrides apply wherever the dispatcher builds its bindings (`walk.ts`, `assembleEntries`), so
  ranking, conflict reporting and the hint all see the rebound key. Adding a key beside the
  defaults stays `tune`'s job; replacing and removing are this path's.
- **How an override is written.** A route string in the existing grammar
  (`packages/gestures/src/grammar/routeGrammar.ts`), such as `'[*:*] keyDown(=) +mod'`, a spec
  object, or `null`. Route strings are what a host should persist: they read in a diff and in prefs.
- **Sugar for the common cases**, so nobody needs the route grammar to rebind a key. Each returns
  what the override map takes:
  - `key('Mod+Shift+K')`: a keystroke in the familiar `Mod+…` form, with modifiers spelled as
    `modeShortcutSpec` already accepts them (`Cmd`, `Ctrl`, `Alt`/`Option`, `Shift`, `Mod`).
  - `held('Space')`: the same, for a key held down.
  - `unbound()`: `null`, by name.

  `key` is `modeShortcutSpec` (`contributions/modeShortcuts.ts`) promoted to the shared helper in
  `@weasel-js/gestures`. Mode shortcuts call it too, so there is one parser for that form.
  The capture helper's result renders back to both forms: a route string to store, `Mod+…` to show.
- **Storage.** The host persists the overrides; the engine only takes them. Hand them over the same
  way tunings are (`<SceneCanvas>` prop and a registry method).
- **Conflicts.** A rebound key that collides inside the same keymap, or at the top level, is reported
  by `reportRouteConflicts` like any other collision. A keymap's Escape can't be rebound.
- **Labels follow.** `Loupe ▸ 2` reflects overrides, both halves.
- **Capture.** A headless helper turns the next key or gesture into a gesture spec, for a binding
  editor to call. Escape cancels the capture. The editor UI itself is the host's; forge's
  binding panel belongs to the loupe work.

## Constraints

- The open-keymap stack is read synchronously at dispatch time, not through React state. The
  dispatcher's `hotkeyStack` arrives through `useLatest` (`useGestureDispatcher.tsx`) and lags a
  render. A fast `L`, `2`, and a `'cascade'` re-dispatch in the same event, both need the stack as it
  is now.
- Don't put keymap ids on the active-tool context's hotkey stack. `useTools` treats the top of that
  stack as the engaged *tool* (`useTools.ts`, `hotkeyStack.at(-1)`), so a keymap there would disengage
  a held offhand tool. Keep a separate stack and feed it into `EligibilityState.engagedIds`, or into a
  sibling field.
- The once-close has to see every input kind, so it hooks in where all channels dispatch
  (`dispatchCore.ts`), not inside the keyboard channel. The keydown that opened the keymap must not
  also close it.
- Nothing in the model takes `{x, y}`. A pointer binding inside a keymap resolves its point through the
  same deps any binding does.
- Taxonomy: add **Keymap** and **Leader** to `docs/taxonomy.md` under Contribution (eligibility) and
  Interaction, and add `keymap` to the eligibility list there.

## Non-goals

- Key sequences inside the route grammar (`"L 2"` as one route string). A keymap is a contribution, so
  it can hold pointer bindings, carry a label, and be listed; a route string can do none of that.
- The loupe's own keymap and key choices: those belong to the loupe session.
- A per-keymap timeout. Leave it out; Escape and the hint make a forgotten keymap visible and easy to
  get out of.

## Left to the builder

- How the open-keymap state is published, and the hint component's exact API.
- How binding ids are derived when none is declared, and the override store's exact API.
- Whether `keymap.open` reuses `buildToolOffhandBindings`'s spec helpers (`heldKeySpec`) or has its own.
- The route-conflict rule for a keymap that binds Escape.
- The demo, which must build on the keymap system rather than around it (CLAUDE.md, "Demo conventions").
