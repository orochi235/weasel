# @weasel-js/history

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 312eb35: Themes can be edited. `forkTheme`, `setThemeValue` (by a `ThemePath` such as
  `['roles', 'accent', 'fill']` or `['series', 2]`), `addThemeRole`, `renameThemeRole`, and
  `removeThemeRole` return a new theme and leave the one given alone, so a shipped theme is never
  changed; `editableTheme` forks a shipped theme and passes a custom one through. `DiagramTheme` takes
  `roleLabels`, the names of roles beyond the shipped six, and `themeRoles(theme)` lists every role
  with its name. A removed role's shapes are drawn in the default role. `parseDiagramTheme` and
  `themeToJson` read and write `.weasel-theme.json` files, and a bad file comes back as errors naming
  each bad value by its path. `applyDiagramTheme` takes `{ coalesceKey, from }`.
  
  Applying a theme whose font size differs from the scene's moves existing text by the step between
  them: shape rows, titles, and connector labels keep their offset from the body size.
  `setDiagramFontSize(scene, ids, size)` sets a shape's or connector's text size by hand and records
  it in the trait's new `ownFont` (`FontField`), which a theme's size change then leaves and choosing
  a role keeps. A body whose text changes size is laid out again in the same undo entry: it grows
  to fit its rows and never shrinks. A body built from text rows alone records how it stacks them
  as `DiagramNode.body`, its rows carrying `bodyRow`; `relayoutBodies` lays such bodies out again,
  and `rendererMeasure` measures text from the registered font as the renderer draws it.
  
  Core's `scene.batch(label, fn, { coalesceKey })` folds a batch into the undo entry before it when
  that one was recorded under the same key and nothing came between, so a run of batches, such as a
  color dragged, undoes as one entry back to the state before the first. Unlike an op's own key it
  needs no `coalesceWindowMs`; `scene.history.seal()` ends the run. `@weasel-js/history`'s
  `recordEntry` takes the same `coalesceKey`.
  
  weaselchart's Format › Theme › Edit Theme… opens a Theme panel: every role's colors, with roles
  added, renamed, and removed (not the default), the connector, label, container, lane, page, and
  series colors, and the font. The Style panel gains Text size. The chart recolors as a color is dragged, and one undo takes back the
  drag. The first edit to a shipped theme copies it into the chart as "<name> (edited)". Import
  Theme… and Export Theme… move a theme between charts.
- 2eb0370: The devtools hook serves two more requests, still under protocol 1. `get-registry` describes what a
  canvas has registered: its tools and preset contributions with their bindings, its actions, the dep
  names its registry answers, and its node routing kinds. `get-history` hands back the scene's history
  steps since a cursor — each push, merge, undo, redo or jump, with the ops it carried and where the
  history stood — from a rolling buffer of 200 that records in dev builds and in production while a
  panel is connected. `changed` reports both as the new `registry` and `history` areas. See
  `docs/devtools.md`.
  
  `History` gains `observe(listener)`, which hears what each change to the stacks was, and
  `touchedIdsFromOps` is exported from `@weasel-js/history`. A hand-written `History` implementation
  must add `observe`. `DepRegistry` gains an optional `list()` naming every dep it answers.
- @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 681c3f9: `createHistory`'s `coalesceWindowMs` also takes a function, called at each push, so the window can change after the history is made; a journal the history begins reads the same function. `PrefSchemaEditor` passes one, so a change to the `history.coalesceMs` kit setting reaches an editor that is already open instead of waiting for it to remount.
- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0

## 1.10.1

### Patch Changes

- b8bfb2d: History and its journals, `createSelectionStore`, a record cache's `subscribe` and `onOverruled`, `createPaintedCursorState`, and `useFrameClock` notify through `createEmitter()` from `@weasel-js/registry`, as every other store in the kit does. Each of these packages now depends on `@weasel-js/registry`.
  
  What changes for a consumer: a listener that throws no longer throws into whatever caused the notify, such as `applyOps`, `setSelection`, `set`, or a frame of the clock. The error goes to `console.error`, and the listeners after it still run. A notify also walks the listeners held when it began, so one added during a pass waits for the next.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- b3f1e4a: history: `swapOp` builds an op that swaps one whole value for another and carries both as `args`, so a serialized history can rebuild the step. `@weasel-js/core` re-exports it with `SwapArgs` and `SwapOpOptions`. `PrefSchemaEditor`'s own swap is now a call to it.
  
  forge: the CSS Vars panel keeps an undo history of a trial's edits. Undo and Redo sit beside the filter, and Mod+Z / Shift+Mod+Z step from anywhere in the panel except the filter's text. Typing a value is one step, and so is a scale edit with every token it regenerates. The steps are kept with the trial, so they outlive a reload, held to the last 100. Saving scales into the theme forgets them. A trial's scale edits are kept with the trial now (`fg-css-vars-scales` was lab-wide), so a scale edited in one trial no longer shows in another.
- 5996856: core: an undo entry now holds the scene's own ops whichever way the edit was made. `scene.applyBatch`, `scene.history.apply`, and a scene journal record the `kit:*` ops their ops caused, and beside them any op that wrote no scene state, such as a selection change. Undo and redo of such an entry restore what was written and no longer call the adapter the batch was applied with.
  
  Breaking:
  
  - `scene.carry` is removed. A pose an adapter writes beside the one it was asked for is an ordinary `scene.setPose`, and the entry holds it.
  - `scene.applyBatch` inside `scene.batch` joins that batch's entry. It used to push an entry of its own ahead of the batch's.
  - A journal opened on a history other than the scene's reverts in place. Its undo, redo, and cancel used to replay through the adapter and leave `setPose` and `update` entries on the scene's undo stack.
  - `scene.serializeHistory()` returns a `SerializedSceneHistory`, which carries `form: 2`, and `scene.restoreHistory` drops a snapshot without it. A history persisted by an earlier version is not restored.
  
  history: an `Op` may define `caused()`, which names the ops its entry records in its place once it has applied. An entry's `touchedIds` now also reads `args.nodes[].id`.

## 1.9.4

### Patch Changes

- 41a4b4e: An op that gives a container its layout by calling `adapter.setLayout` itself now arranges the container in the same undo step, on a scene that had no layout before; only `createSetLayoutOp` did. `Op` gains `elideNoop`: an op carrying it is left out of the recorded entry when its first apply reports a no-op, which is how the scene's arrange op stays out of edits that needed no arranging.
- b48fd2c: A branching history with a `historyLimit` (or after `prune`) offered branches from a state it could no longer return to: with the undo stack emptied down to the evicted entries, `branches()` listed futures that forked from the original start, and redoing one applied it on top of the evicted edits. The history now tracks the floor the evictions leave. An evicted entry takes along the branches that forked from the state before it and keeps the ones that fork from the state it leaves, which is the reverse of what eviction dropped before. `SerializedHistory` gains an optional `floor` so a restored history files those branches in the same place; a snapshot without it reads as before.
- a97ba6f: `serialize()` left an entry with a nameless op out of the snapshot and kept the entries on its far side, so after `restore` an undo stepped underneath a change that was still applied and could no longer be undone. The snapshot is now cut there: it keeps the undo entries newer than the last such entry, the redo entries nearer than the first, and the branches that fork from an entry it kept, and `droppedEntries` counts everything left out. A history holding a nameless entry reloads with less to undo than it did before.
- fb297fb: An undo, redo, or `goto` whose op threw used to drop the entry from both stacks and leave the ops that had already run applied, so the edit could be neither undone nor redone. A step is now all-or-nothing: the ops that ran are inverted, the entry stays on the stack it was on, and the error still propagates. `applyOps` does the same for a batch that throws partway, and `scene.undo`, `scene.redo`, and `scene.jumpToHistoryIndex` also revert the scene writes of an op that threw partway through its own.
- f26bf6f: A journal whose pushes coalesced committed an entry that undid only the last of them: two same-key edits inside the coalesce window, then `commit`, then undo on the parent, stopped at the value between the two. `Journal.commit` now hands the parent both halves of each entry, so undo returns to the state the session opened on and redo to the one it closed on.
- cae90d2: The docs for `History.serialize()` and `SerializedHistory` called the snapshot structured-clone-safe. It is only as serializable as the op `args` it carries by reference: a scene's remove entry holds a node's live functions, which `JSON.stringify` drops and IndexedDB rejects with `DataCloneError`. The docs now say so.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

### Patch Changes

- 412e53a: `createHistory(adapter, { branching: true })` keeps the redo future when a push is made while there is one, instead of dropping it. Undo and redo still walk one line, the current branch; `branches()` lists the futures forking from the current entry, and `switchBranch(id)` makes one of them the redo future, keeping the one it replaces. An entry evicted by `historyLimit` or `prune` evicts the branches forking from it, each through `onEvict`, and `serialize()`/`restore()` carry them. Off by default, where nothing changes.
- 6d800fb: A history can now be read and moved by time, using each entry's `timestamp` (taken from `now()`, which a caller can point at any clock). `timestampAt(i)` reads an entry's stamp in time order without allocating, `depthAt(t)` gives the undo depth at time `t`, so `goto(depthAt(t))` seeks either way, and `prune(t)` evicts undo entries stamped before `t` through `onEvict`, never touching redo. Serialized entries now carry `timestamp`, which `restore()` used to reset to 0. `goto` to the depth it is already at no longer notifies subscribers.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

No changes in this release.

## 1.7.0

### Patch Changes

- 7c3cc5d: A `Journal` can now be observed and coalesces like its parent. It gains `subscribe` and `getVersion` (ready for `useSyncExternalStore`), which fire on every apply, undo, redo and coalesce inside the session and on each lifecycle transition, and `seal`, which ends a coalescing run as `History.seal` does. A journal now inherits its parent's `coalesceWindowMs`, clock and debug logger, so a session whose ops carry a `coalesceKey` merges rapid edits where it previously never did; pass `coalesceWindowMs: 0` to `beginJournal` to keep every push separate.
  
  `HistoryEntry.pushes` says how many pushes an entry holds: 1 when pushed once, plus one for each push coalesced into it. It round-trips through `serialize`/`restore`; snapshots written before it read as 1.
  
  The journals a `Scene` hands out forward all three new members.

## 1.6.1

No changes in this release.

## 1.6.0

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.

## 1.5.1

### Patch Changes

- 229a16a: Add `scene.untracked(fn)`, which applies scene mutations without recording them, for writes that are not edits, such as a simulation stepping poses each frame. It notifies once, reverts on throw, and refuses `applyBatch` and `history.apply` / `applyOps`. Undo never restores an untracked write; undoing the next recorded change lands on the pose the untracked writes left.
  
  Add `History.seal()`, which ends the current coalescing run so the next entry is pushed fresh. This adds a member to the `History` interface, so a hand-written implementation of it must add `seal`.

## 1.5.0

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

### Patch Changes

- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.

## 1.2.0

### Patch Changes

- 7c202d2: Put the selection on the scene, and restore it on undo.

  `scene.getSelection()` / `scene.setSelection()` own the transient set of active
  ids. It is not document content — `toJSON` never carries it — but every history
  entry now records the selection its edit was made under, so undo and redo put
  back what was selected. Changing the selection is still never an undo step of
  its own.

  Undoing a boolean op used to leave the selection pointing at the result node
  undo had just deleted; deleting a multi-selection and undoing left it empty.

  `useSelection({ scene })` keeps the selection on the scene rather than in the
  hook. `<SceneCanvas>` does that by default, so every view over one scene shares
  a selection; a `<CanvasView>` opts out with `selection` / `selectionOptions`.

  `@weasel-js/history` gains `CreateHistoryOptions.selection`, a get/set pair the
  engine reads and writes on the way past — supply it and entries carry
  `selectionBefore` / `selectionAfter`, omit it and the engine touches selection
  never. `recordEntry` takes the pre-batch selection as an option, because by the
  time it runs the live selection has already moved on.

  `defaultCommitAdapter` carries `getSelection` / `setSelection` now, so
  selection-carrying ops replay without splicing `SelectionApi.adapterMethods`
  over it.

## 1.1.0

## 1.0.4

### Patch Changes

- bd42540: Fixes seven correctness faults found by review of the pure-logic packages.

  **geom.** `pathToMultiPolygon` handed every ring to `polygon-clipping` as its
  own polygon, and the polygons of a MultiPolygon are unioned — so a path with
  holes arrived at the clipper solid, and the path's `fillRule` was never read at
  all. Rings are now grouped into outer + hole polygons by containment, under
  either fill rule. `flattenCubic` could not terminate on a non-finite control
  point or a non-positive tolerance; it now treats a non-finite deviation as flat
  and caps subdivision at 16 levels, which is far beyond what any terminating
  call reaches, so flattened geometry is unchanged. `approxEq` called every
  finite number equal to an infinity while calling two identical infinities
  unequal. `invert` judged the determinant against an absolute epsilon, rejecting
  a well-conditioned uniform 1e-7 scale while accepting a large matrix whose
  determinant is pure cancellation; the test is now relative to the squared
  column norms, and a non-finite matrix returns null instead of NaNs.

  **history.** Coalescing merged into whatever entry the undo stack left on top,
  so an edit made after an undo could rewrite an older entry in place — leaving
  one entry, still under the older label, that a single undo stepped past. A
  merge target is now the entry the last push created and nothing else.
  `resumeJournal` ignored which journal was active, letting two journals write to
  the same adapter with independent inner histories; it now refuses while another
  is active.

  **gestures.** `parseRoute` fills an omitted arg slot with the `'*'` wildcard for
  gestures whose descriptor declares no default. `formatRoute` re-emitted it
  (`[*:*] drop` came back as `[*:*] drop(*)`, so format ∘ parse was not
  idempotent) and `describeRoute` printed it literally ("the user drops \* content
  onto the canvas"). Both now treat it as the wildcard it is. `LongPressEvent` and
  `LongPressSpec` — the one arm of the public `InputEvent` / `GestureSpec` unions
  the barrel never named — are exported.

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

## 0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
