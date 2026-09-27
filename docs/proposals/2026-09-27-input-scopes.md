# Input scopes and buses

Status: **design, unbuilt** (2026-09-27). Nothing below exists in the tree yet.

For whoever builds it, or reviews a change to `@weasel-js/routing`'s actions
registry, dep registry or gesture dispatcher. It answers two questions: how a
canvas's input stays its own when several canvases sit under one provider, and
how canvases share input when they mean to.

## The bug

Two canvases under one `ActionsProvider` cannot be told apart. The registry
keeps one stack per action id and one per dep name, and the newest entry
answers every lookup (`ActionsProvider.tsx`, `depRegistry.tsx`). Nothing on an
entry says which canvas registered it.

On forge's `labkit/Canvas/CanvasStack` index page, three canvases share the
index trial's scope. Each keeps its own DOM listeners, but every one resolves
`view` and the pan, zoom and tap actions to the last-mounted canvas. A drag on
the top canvas moves the bottom camera. Nothing warns: `warnSharedScope` fires
only from `setDispatcher`, which `CameraInput` never calls. `SceneCanvas` has
the same flaw under a shared provider; its `ActionsScope` filters what it sees
but registers into the shared store.

The index page is where it showed up, not what is wrong. Any host that puts two
canvases under one provider gets it.

## The model

Every registration lives in exactly one tier, and every lookup reads the tiers
innermost first.

| Tier | What mounts it | Holds | Example |
|---|---|---|---|
| **Scope** | Every canvas: `SceneCanvas`, `CanvasStack`, `Stage`, `MinimapCanvas` — always, whatever is above it | What is this canvas's own: `view`, `rootView`, `pointer`, `hostSize`, and the actions it binds | a `CanvasStack`'s pan, zoom and tap |
| **Bus** | `<InputBus>`, which scopes join on purpose | What several canvases share: the active tool, an in-flight ongoing action, history, bus-wide actions | two views of one drawing sharing a tool and one undo stack |
| **Root** | The outermost `ActionsProvider` / `DepRegistryProvider` | App-wide actions and deps, as today | the command palette's actions, app hotkeys |

**Registration** goes to the innermost tier in scope at the registering
component. A canvas registers into its scope; a toolbar mounted inside an
`<InputBus>` but outside any canvas registers into the bus; anything else, the
root.

**Lookup** is made on behalf of a scope: `list(scope)` and `get(name, scope)`
answer each name from the scope's own entry, then its bus's, then the root's.
Another scope's entries are never visible. Within one tier, two registrants of
one id still stack newest-first, as `pushOwner` does now.

The split-viewport overlay (`views[].deps`, applied by `withViewDeps`) stays,
one tier further in: a view's deps sit in front of its canvas's scope. It was
the first instance of this rule — one authority per dep, with the narrower
thing claiming only what is genuinely its.

Shared *state* still shares the way it does now: a `SelectionContextProvider`
above two canvases hands both the same selection, and each scope registers
that same object. Buses share *input*: bindings, the tool, the gesture in
flight, and history.

## Where input with no pointer goes

Chrome calls `trigger` and `begin` without a scope — `ActionBar`,
`CommandPalette`, `LabZoom`, draw's `LoupeControls`, `useOngoingAction`. Today
those reach the newest-mounted canvas via the `setDispatcher` stack. They
should reach the **active scope**: the one that last took a pointerdown or
focus, tracked per bus and at the root. That is what a user means by "the
canvas I am working in", and mount order is not.

Keys follow the same rule. Today every dispatcher listens on `window` and the
first to claim a key wins (`keyboard: 'first'` exists to jump that queue). With
scopes, a keystroke dispatches in the active scope, then its bus, then the
root, and an inactive scope does not hear it.

Undo is the same question and gets the same answer: `Mod+Z` runs the active
scope's history, found scope → bus → root. That is also what forge's per-story
undo needs — a story's state hook registers history in the cell's scope.

## Sharing on purpose

**Joining a bus.** A canvas takes `bus={handle}`; its scope then falls through
to that bus. Canvases on one bus can sit anywhere in the tree, including in
different trials, because the handle, not the tree, says who shares.

**A second dispatcher on one scope.** The trial loupe runs its own dispatcher
on its own element, but acts on the camera's actions and `view`
(`TrialLoupe.tsx`). Today it finds them by accident — it gets the newest
registration. Under this design it *attaches* to the camera's scope: one scope,
two dispatchers, two elements. The trial overview is the same. Both reach the
camera's scope through the trial's camera registry, which is already keyed by
trial and would hold scopes instead of bare `CameraView`s.

That removes `CameraScopeContext` and the shared `WeaselProvider` that `Trial`
mounts only so the camera, loupe and overview land in one scope.

## What goes away

| Now | After |
|---|---|
| `ActionsScope` and its `mute` filter | A scope registers only what it binds; there is nothing to mute |
| `ActionsProviderIfRoot`, `DepRegistryProviderIfRoot` deferring to a parent | A canvas always mounts a scope |
| The `setDispatcher` / `setDepRegistry` stacks and `warnSharedScope` | Each scope owns its dispatchers; `begin` goes to the active scope |
| `CameraScope`, `CameraScopeContext` | Loupe and overview attach to the camera's scope |
| `keyboard: 'first'` as the way to win a key | Keys go to the active scope; `'first'` may survive for chrome that owns a key outright |

## Building it

One arc, in a worktree, in this order, each step green before the next:

1. **Failing tests first.** Two `CanvasStack`s under one provider: a drag on
   the first moves the first camera, and a tap reports to the first's
   `onTap`. The same for two `SceneCanvas`es. Both fail today.
2. **Tiers in the registries.** `register` and `useDepSource` read the nearest
   scope from context; `list`/`get` take one. With no scope in scope, both
   behave exactly as now, so everything stays green.
3. **Canvases mount scopes.** `SceneCanvas`, `CameraInput`, `MinimapCanvas`.
   Step 1's tests pass here.
4. **Active scope.** Pointerdown and focus set it; `trigger`, `begin` and the
   keyboard path read it. Delete the `setDispatcher` stack.
5. **Attach.** Loupe and overview attach through the camera registry; delete
   `CameraScope`.
6. **Buses.** `<InputBus>` and `bus=`; the tool, ongoing actions and history
   move to bus tier where one is joined.
7. **Delete** `ActionsScope`, the `IfRoot` wrappers and `warnSharedScope`, and
   update `docs/taxonomy.md`.

## Open questions

- **The name "bus".** "Channel" is taken twice: `useGestureDispatcher`'s
  `channels` option (which DOM streams to attach) and
  `docs/proposals/interaction-channels.md` (a tool's handler streams).
- **Handle or name.** A bus joined by an object handle cannot collide and needs
  no registry of names, but has to be passed down. A bus joined by string
  crosses subtrees with no plumbing and can collide. The draft above assumes a
  handle.
- **Which tier the tool lives in when there is no bus.** Per scope is the
  honest default — two unrelated canvases should not share a tool — but it
  changes what a toolbar at the root reaches today.
