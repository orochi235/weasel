# @weasel-js/gestures

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
