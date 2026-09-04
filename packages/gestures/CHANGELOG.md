# @weasel-js/gestures

## 1.4.0

## 1.4.0-pre.1

## 1.4.0-pre.0

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

## 2.0.0-pre.0

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

### Patch Changes

- d2a9049: Six backlog entries, all in the input and hit-test layers.

  Tool overlays can say where they sit. `Contribution.overlay` takes a
  `RenderLayer` or an array of them, and a new `overlayPosition` (`'top'` — the
  default — / `'before-selection'` / `'after-selection'`) anchors them against
  the selection chrome instead of always landing on top; with no selection layer
  in the stack the anchored positions fall back to the tail.
  `getActiveOverlays(position?)` partitions, and `placeToolOverlays` in
  `canvas/layerOrder.ts` does the splice, so the ordering is testable without a
  GL context.

  `drop` and `paste` are route-grammar gesture names. They shipped without them,
  so the inspector reported `undefined` for every ingestion binding. Both are
  targetless and carry the spec's MIME-glob filter as their arg — `drop(image/*)`.

  An unhandled paste stays the page's. `onPaste` now dispatches first and calls
  `preventDefault` only on `'handled'`, the shape `onWheel` already used.
  Clipboard items materialize synchronously, so unlike `onDrop` the result is
  known while the default can still be suppressed.

  Marquee and lasso see the shape a node actually draws. `hitTestArea` asked the
  _pose_ for a silhouette, which meant the kit's own inserted shapes — geometry
  on `node.data.path` behind a plain `{x,y,w,h}` pose — took the AABB path and
  kept every false positive the silhouette test exists to drop. It now asks
  `findShapeSilhouette` for the drawn world-frame boundary. Paying for that is a
  containment short-circuit: a node the rect marquee swallows whole is a hit no
  silhouette can overturn, so neither the kernel nor the painter runs. Net
  against the committed bench baseline, polygon-pose scenes gain (1.25x at 1000
  nodes / 100% area) and plain-rect scenes lose ~8% on the two rows that scan
  everything. The short-circuit is marquee-only, behind `hitTestAreaPolygon`'s
  `areaIsRect` flag, because a node inside a lasso hull's bounding box can still
  miss the hull.

  Layout siblings reflowing mid-drag render opaque. `OngoingHandle.previewOpaqueIds()`
  names the subset of `previewIds()` that skips the ghost alpha; `moveAction`
  fills it from the destination and source reflow ids. A ghost means "in flight
  under the pointer", which a sibling settling into its destination slot is not.

  `LayoutStrategy.acceptsDrop(container, dragged)` rejects a drag before any
  drop-target work, so a type-aware container falls through to whatever sits
  under it rather than swallowing everything in its bounds.

  `flipAction` reads `params.pivot`. `'each'` (the default, unchanged) mirrors
  every pose about its own AABB; `'union'` mirrors about the selection envelope
  so items swap sides, and the `geometryProjection` data op follows the same
  pivot.

## 1.0.1

### Patch Changes

- e367165: One enumeration of the `TargetSpec` forms. `@weasel-js/gestures` now exports
  `parseTargetSpec`, which resolves a target spec to a discriminated
  `TargetSpecForm` (`body` / `kind` / `affordance` / `predicate`), and the three
  places that used to re-derive the string prefixes independently — `matchTarget`,
  and `targetRank` / `targetConsultsAffordance` in core's dispatcher matcher —
  switch on it exhaustively. Adding a form to `TargetSpec` is now a compile error
  at every site that has to handle it.

  For consumers: `matchTarget`'s `specTarget` parameter and core's
  `targetConsultsAffordance` take `TargetSpec | undefined` instead of `unknown`,
  so a target string that is no known form is a type error rather than a silent
  no-match. The predicate form has a name, `TargetPredicate`, carrying the
  `readsAffordance` flag the exclusive-claim filter reads. Runtime behavior is
  unchanged.

## 1.0.0

### Minor Changes

- 40dd97d: A widget declares which gestures it consumes, and a claim bars only those.

  A HUD widget could be pressed, dragged and hovered and nothing else. The gap
  was in the dispatcher: `affordanceAt` ran on `pointerdown` and hover only, so
  `doubleclick`, `contextmenu` and `wheel` carried no affordance and no binding
  could gate on one. All four now do — `doubleclick` replays it from its press,
  `contextmenu` classifies its own position (a secondary button never reaches
  `onPointerDown`, so there is nothing to replay from) and gains world
  coordinates it never carried, and `wheel` classifies the point under the
  cursor. The immediate-invoker param bag, which forwarded position for `click`
  and `pointerdown` only, now covers `contextmenu`, `longpress` and the
  affordance on all four.

  **Behavior change, and the reason for the rest of this entry.** An exclusive
  claim previously meant _this pixel is mine_. Under that rule, giving `wheel` an
  affordance would have killed scroll-to-zoom over every floating panel. It now
  means _these gestures are mine_: `LayerHit` and `AffordanceHit` gain
  `claimedKinds`, a set over the new `ClaimableGesture` union (`'pointer'` —
  covering `pointerDown` / `click` / `drag`, one press protocol — plus
  `'doubleClick'`, `'contextMenu'`, `'longPress'`, `'wheel'`). Omitting it bars
  everything, which is what an exclusive claim did before.

  `Widget.claims` is that set. Absent means every kind but `wheel`, so
  right-clicking or double-clicking HUD chrome stops acting on the scene
  underneath while scroll-to-zoom over a panel is unchanged; a widget that wants
  the wheel asks for it. `claims: []` is decoration and replaces `claimsPointer`,
  which is removed. `HudPointerEvent` gains `doubleclick`, `contextmenu`,
  `longpress` and `wheel` arms.

  `PointerClaim` and `onPointer`'s return type are removed. The return was
  discarded at every call site, and it cannot be made live: the claim filter runs
  at match time, before any widget is consulted, so there is no later moment at
  which returning `'pass'` could restore a binding the filter already dropped.

  **Two matcher fixes this depends on.** `doubleClick` and `contextMenu` passed
  the DOM target to `matchTarget` where `click`, `drag` and `longPress` pass the
  affordance; a `kindOf` predicate on either kind therefore received an element
  no predicate in the kit expects. They now match the others. And the kit's body
  predicates — `isBody`, `isSelectedBody`, `isUnselectedBody`, `isEmpty` — carry
  `readsAffordance: false`, which `targetConsultsAffordance` honors. Each has a
  `kindOf` but reads only `bodyTarget`, so the filter inferred that they consult
  the hit and let them survive a claim; with `doubleclick` now carrying one,
  `enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit mode
  on a double-click over chrome.

  `WheelSpec` gains `target`, and `wheel` gains a route-grammar target slot —
  a wheel binding could not gate on anything at all before.

## 0.8.0

### Minor Changes

- e0ab60e: Device profile: the kit stops assuming a mouse.

  `DeviceProfile` is one object holding pointer coarseness, hover capability and
  pixel density, resolved once per `<SceneCanvas>` and published to its subtree.
  Two things read it. The chrome-caps rule layer gains `coarsePointer:` and
  `canHover:` selectors (plus matching fluent atoms), so consumers can gate
  chrome on the device. And every handle size and hit radius — six independent
  literal `8`s and one `24` before this — now derives from one base module times
  `DeviceProfile.targetScale`, so a coarse pointer gets 14px handles and a 42px
  rotation distance without paint and hit-test ever drifting apart. The public
  `DEFAULT_HANDLE_SIZE` / `DEFAULT_ROTATION_HANDLE_DISTANCE` constants keep
  their unscaled values.

  `longPress` is a real gesture kind: spec, event, matcher, and route grammar.
  The dispatcher synthesizes it for touch and pen presses held 500ms without
  crossing the drag threshold — never for a mouse, and cancelled by movement,
  release, cancel, or a second finger landing. An unmatched long-press
  re-dispatches as `contextmenu`, so existing `contextMenu` bindings become
  reachable by touch with no consumer change.

  Also fixes a density bug: `useCanvasSize` read `devicePixelRatio` only inside
  its `ResizeObserver` callback, so moving a window to a different-density
  display without resizing it left the snapshot stale. Density now comes from
  the profile, which watches a re-armed resolution media query.

  Override any of it with the new `<SceneCanvas device={{ coarsePointer: true }}>`
  prop — for tests, for demos that want touch-sized chrome on a desktop, and for
  hybrid devices where the media query guesses wrong.

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
