# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work, see `git log` and the dated specs under
`docs/superpowers/specs/`. Plans are deleted when their work merges.

When work merges, retire its entry here in the same change.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P1.5)** — ranked between P1 and P2
- **(P2)** — broad reuse, or friction-likely
- **(P3)** — specialized, or resting on a foundation not built yet

---

## Tools & gestures

- **(P2) A canvas's keyboard shortcuts claim keys page-wide.** The gesture dispatcher listens on
  `window`, and a page with one canvas has it as the active scope, so held Space pans that canvas
  from anywhere on the page — a read-only canvas in a side panel takes Space from a page that wants
  it (the blits playground's space-to-play listens in the capture phase to get there first). Keys
  aimed at an editable field, or Space/Enter on a focused button or link
  (`activatesFocusedControl`), are already left alone, and `enableKeybindings={false}` turns a
  canvas's keys off. Ruled 2026-10-11: a key that reaches the body goes to the last canvas the user
  clicked or scrolled, and to no canvas before the first such interaction. That leaves a lone canvas
  becoming the active scope only on pointer interaction, the rule that already settles two canvases,
  and WeaselDraw, whose shortcuts work from the body today before anything in it has been clicked.

- **(P2) `features` names two things.** The `<SceneCanvas features>` prop composes behavior presets
  (`canvas/SceneCanvas/features.ts`); `packages/core/src/features/<name>/` is a source directory
  bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a "feature" too. The
  two are unrelated and both names stand for now, with the taxonomy saying so. Ruled 2026-10-11: the
  directory and the taxonomy's term take a new word, and the prop keeps `features`; the new word is
  not chosen yet. That leaves choosing it, then renaming the one path, its imports, and the section
  of the taxonomy.

- **(P3) A canvas without `ingest` is still a drop target.** `SceneCanvas` attaches the
  dispatcher's drop listeners whatever `features` says, so an OS drag over a bare or `edit`-only
  canvas shows the copy cursor and `weasel-dropover`, and the drop is swallowed with nothing
  inserted. `DispatcherChannels.ingest` covers drop and paste together and would need splitting,
  which also decides whether a consumer's own drop binding works without the preset. Beside it:
  `SceneCanvasApi.ingest()` is a silent no-op without the `ingest` preset, because it triggers an
  action that was never registered.

- **(P3) `Widget.claims` is static.** A widget that is decoration in one mode
  and interactive in another can't change what it consumes without being
  swapped out. `claimsPointer` folded into `claims` on 2026-08-12, so this is
  one field rather than two, but it is still a declaration read at hit-test
  time. Fine while `rect` / `text` / `image` are unconditionally decorative;
  revisit when a stateful-claims widget appears.

- **(P3) apps/draw binds no mode-entry shortcut.** `modeShortcuts` (routing) binds a
  mode's `entry` chord when the consumer passes `enter`, and draw passes only the
  leaving roles. PATH_EDIT's Enter can't simply enter the machine's mode: the
  anchor editing it exists for keys off the kit's `editAnchors.editingId`, which only
  `enterPathEdit`'s double-click sets, so Enter would light the mode with no editable
  anchors. Draw also still enters every mode from `SceneCanvas`'s `onDoubleClick`
  observer rather than from `entry.trigger`, which nothing reads.

- **(P3) A press on empty canvas can't be an ambient binding beside the select tool.**
  `select.pick` binds `pointerDown` on empty space at active scope, and active
  outranks ambient, so an ambient contribution's `pointerDown` never fires while
  select is active. With no base tool it works: `CustomShaderDemo` spawns its
  ripple from an ambient binding on a bare canvas.

- **(P3) `targetConsultsAffordance` still guesses from shape.** The kit's four body predicates now
  carry `readsAffordance: false` and the filter honors it (2026-08-12), so the counterexamples the
  kit itself ships are handled — which they had to be, since `doubleclick` now carries an affordance
  and `enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit mode on a
  double-click over HUD chrome. A *consumer* predicate that reads only `bodyTarget` and declares
  nothing still survives a claim that should bar it. Ruled 2026-10-11: the filter stops inferring,
  and every target predicate must declare whether it reads the affordance hit. That leaves requiring
  the declaration on the predicate type, which the kit's body predicates get from one helper in
  `packages/routing/src/interactions/dispatcher/predicates.ts`, and deleting the guess in
  `matcher.ts` beside it.

- **(P3) SVG-file ingestion — follow-ups.** Shipped 2026-07-04: `kit:svg`
  content handler (`packages/core/src/features/ingestion/svgHandler.ts`, priority -90 —
  ahead of `kit:image`, behind consumer handlers) matching `image/svg+xml`
  plus `.svg`-extension sniff for empty-MIME files. Default keeps a dropped
  SVG as **one embedded-image node** (`data:image/svg+xml` URI, bytes
  verbatim; measured via an `Image` element since `createImageBitmap`
  rejects SVG blobs, 300×150 fallback for no-intrinsic-size files).
  `ingestion={{ svg: { unpack: unpackSvgFiles } }}` parses to native scene nodes
  instead (`@weasel-js/svg`'s `unpack.ts`: kit-painter-native path/text leaves under
  containers mirroring `<g>` structure, multi-root files wrapped in one
  container, pose-only fit-clamp + drop-point placement, one undoable
  batch per file). weaseldraw runs with `unpack` on, and its file-menu import
  and export carry `<image>` as an image object. An embedded SVG
  re-rasterizes at its drawn size (see `features/images/README.md`).
  Remaining: check in a browser that it actually looks sharp at zoom — so far
  only jsdom has.

- **(P3) External-content ingestion — follow-ups.** Shipped 2026-07-03 (spec
  `docs/superpowers/specs/2026-07-03-content-ingestion-design.md`): drop/paste
  gesture kinds (`DropSpec`/`PasteSpec`, MIME-glob `types`), dispatcher DOM
  channels (drop/dragover/dragenter/paste + `weasel-dropover` class), ambient
  `ingest` action, content-handler registry (`packages/core/src/features/ingestion/`,
  refcounted kit-handler registration), kit `image/*` handler (data-URI embed
  / `resolveSrc` override, fit-clamp, cascade), `openFilePicker`,
  `SceneCanvasApi.ingest`, `<SceneCanvas ingestion={…}>`. Remaining:
  (a) richer drag-over feedback (insertion ghost / per-handler accept cursor —
  v1 is the class toggle); (b) SVG-file drop → shipped 2026-07-04, see the
  SVG-file ingestion entry above; (c) kit `text/plain` handler → text-node
  insert. Unblocked 2026-07-23: `text` is now a kit-native insert kind
  (`useInsertDepSource` `case 'text'` mints `{ text }`, defaulting content to
  `''` and reading `extras.text` when present). Remaining for the handler
  itself: a dropped/pasted string has no drag rect, so the handler must choose
  a **box size** — either measure the string (needs a text-measure context) or
  default to a fixed box and let edit reflow it. Whether we even want
  drop/paste-text-to-canvas is an open question.
  Closed 2026-08-16: (d) `drop` and `paste` are route-grammar gesture names,
  targetless, carrying the MIME-glob filter as their arg (`drop(image/*)`);
  (e) paste now dispatches first and `preventDefault`s only on `'handled'`,
  wheel's shape — clipboard items materialize synchronously, so unlike drop the
  result is known while the default can still be suppressed, and a paste no
  binding wanted stays the page's.

- **(P3) The image and SVG drop handlers could leave core.** `kitImageHandler`
  / `embedFilesAsImageNodes`, `kitSvgHandler` (which reuses the image embed) and
  `openFilePicker` in `packages/core/src/features/ingestion/` are about 310 lines
  no kernel path needs; the registry, the `ingest` action, the `ingestion` dep
  and the weasel-JSON handler stay, since Cmd+V of the canvas's own content runs
  through them. Moving them makes a file drop do nothing on a bare
  `<SceneCanvas>` until the consumer installs the handlers. Deferred 2026-09-28
  because the package would be thin and no name is settled (`ingest` was turned
  down).

- **(P3) The action pipeline's coordinates are 2D, so another kernel can't
  reuse it.** World points arrive as `{x, y}` or flat scalars in
  `InvocationCtx`, the dep payloads, the pick functions and
  `@weasel-js/gestures`' pointer events, and the camera is the 2D `View`. Tools
  themselves carry no geometry. **No longer a Phase 2 prerequisite**: the 3D lab
  (`packages/labkit/examples/3d-lab`) drives core's dispatcher over a WebGL
  viewport with core unchanged, because the deps rebuild the ray from a camera
  they close over and the pipeline keeps passing two numbers. What is left is
  ordinary type hygiene, not a blocker. Findings in
  `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.

- **(P3) `apps/theme-editor` cannot become a `<Lab>` without being rebuilt.**
  Not a stale consumer: `<Lab>` is the trial runtime — it requires a non-empty
  `instruments` list, seeds a trial, and renders `children` into the header
  while its body is fixed as the surface buffers plus a `Workspace` of trials.
  PaletteLab's page *is* the shell body, flexing to fill `.lk-shell-body`, and
  the `#/theme` workbench beside it is a second bare `LabShell` page. Moving
  them in means making each an instrument and running it in a trial pane, with
  labkit's per-trial store and persistence beside its own, and a trial
  titlebar beside its own `PropertyPanel`. Worth doing only as its
  own arc, and worth asking first whether labkit should support a lab with no
  trials at all.

- **(P3) One dep still names a plane, not ten.** The count came from reading
  signatures for 2D-looking types; read for what a camera-bearing host can
  actually implement, the ten are: `geometryProjection` alone, whose
  `transform(node, m: Mat3)` has no 3D form (its own entry below, and core
  builds the `Mat3` at four call sites before the dep is consulted, so widening
  the type does not free it). `view` is not an obstruction but the design —
  viewport deps are per-kernel, and `kernel3d` declares `camera3d`.
  `editAnchors` and `booleansAdapter` are 2D *features* — anchor editing and
  path booleans — that a 3D kernel simply does not declare. The remaining six —
  `snap`, `lassoSelect`, `poseDescriptor`, `slice`, `ingestion`, `pointer` — are
  satisfiable as typed, because every coordinate in them is a screen point
  under the identity `clientToWorld` a 3D host passes. Re-measured 2026-09-13,
  dep by dep; `pointer` was removed 2026-09-18 and came back 2026-09-25 as the
  pointer store (a world `{ worldX, worldY, viewId }`), and has not been
  re-measured since.

  The routing package itself declares `View` in `tools/types.ts` (`ToolCtx`) and
  in its barrel. `RuleCtx` no longer does: it carries `zoom?: number`, so a host
  whose viewport is a camera can supply eligibility instead of leaving
  `getRuleCtx` unset and silently skipping every rule — which is what the 3D lab
  was doing. What is left is `ToolCtx`, and only `<Canvas>` ever builds one.
  `Point2` is orientation-free, and none of `dispatcher.ts`, `matcher.ts`,
  `invoker.ts`, `action.ts`, `buildDeps.ts` or `depRegistry.tsx` names a 2D type
  at all.

- **(P3) `geometryProjection` cannot hold a 3D transform.** `transform(node,
  m: Mat3)` names a plane in its signature, so a kernel with a camera has
  nothing to implement it with. `PoseDescriptor`, which was the same complaint,
  is closed: `forNode` hands it the node, and `remapBounds`/`fromBounds` resolve
  a screen rectangle at the pose's own depth (2026-09-13) rather than throwing.
  Whatever replaces `Mat3` here is the remaining piece of that family.

- **(P2) Corner resize handles cover the whole body of a selection about 16 px across or smaller.**
  Each corner's hit square is 16 px (`hitRadiusPx` 8 in
  `packages/core/src/affordances/cornerResize.ts`), tested in screen space, so on a 12 x 12 px
  selection every point of the body is inside a handle and a drag there resizes; the node cannot be
  moved by its body. `hitAffordanceRegions` picks the nearest corner but nothing reserves the body.
  Ruled 2026-10-11: the handles stay at every size, and when the target is under about four hit
  radii on an axis only the outward half of each corner's hit square takes a press, which leaves the
  body free to move by. That leaves narrowing the hit in `cornerResize.ts`. Not confirmed against
  the dispatcher that a handle hit outranks the body binding.

- **(P2) Pen tool: nodes are minted and committed beside the `insert` dep.** `usePenTool`
  (`packages/core/src/tools/builtin/pen/usePenTool.ts`) creates a path through
  `options.adapter.addNode(pose)` plus `wrapPath`, needs a third hook, `makeNode`, for the join
  case, and there builds `createInsertOp` / `createDeleteOp` and applies them itself. A consumer who
  overrides the `insert` dep to stamp its own node shape, the documented route for every other shape
  tool, gets pen paths that ignore it, and a new path is committed and then selected by two separate
  consumer calls, so whether that is one undo step is up to the consumer. Route the commit through
  `insert` with a path request and drop `adapter.addNode` / `makeNode`; this changes
  `UsePenToolOptions`.

- **(P2) `resizeAction` / `rotateAction`: a selected group's children are not transformed.** With
  the default absolute poses, Cmd+G two rects and drag a resize or rotation handle on the group: one
  transform op is written for the container and the children stay put, and since the group's shown
  pose is derived from its children nothing changes on screen. `nudge`, `clone`, and `move` now take
  their write set from `translateTargets`
  (`packages/core/src/interactions/actions/selectionSubtree.ts`), but a resize has to remap each
  leaf inside the group's box and a rotate has to orbit each leaf about the group's center, which a
  translation helper cannot express. Resize already has that path behind `resizePolicy.expandIds`;
  the options are to make the default `expandIds` (`packages/core/src/canvas/deps/resizePolicy.ts`)
  expand a container to its leaves, or to have both actions expand containers themselves. `flip`,
  `align`, and `distribute` have no descendant handling either and need the same read.

- **(P2) `moveAction`: a layout drop or a behavior-claimed commit leaves a dragged container's
  children behind.** Under absolute poses, drag a container with children into a layout container
  (`tileGrid`), or with a behavior such as `snapToContainer` that answers `onEnd` with ops: the
  container lands where the layout or behavior put it and each child keeps its old world pose,
  though the preview showed the subtree moving. The reparent-on-drop branch is fixed; these two
  return before the descendant translate in `commitMove`
  (`packages/core/src/interactions/actions/defaults/move.ts`). The delta the children need there is
  the dragged node's landed pose minus its start pose, not the drag delta, so the fix is a pass over
  the committed ops rather than a call to `translateCommitOps`.

- **(P3) `snapToContainer`: with several nodes dragged, the preview shows one slot.** The commit
  gives each dragged node the slot `findTarget` answers for its id
  (`packages/core/src/interactions/actions/move/behaviors/snapToContainer.ts`), but a move
  behavior's `onMove` can return one pose, which `moveAction` turns into a translation of the whole
  group. So the first node previews in its slot, and the others ride along at their offsets and
  jump to their own slots on release. Needs `BehaviorResult` to carry a pose per dragged id.

- **(P3) `cloneByAltDrag` and the `CloneBehavior` contract are unreachable.** `cloneAction.start`
  ignores `opts`, so no clone behavior ever runs, and the hook that consumed `CloneBehavior` is
  gone. `cloneByAltDrag` is still exported from `@weasel-js/core`. Either run behaviors in
  `cloneAction` the way move, rotate, and insert do, or remove the behavior and the type.

- **(P3) Shift-extend of a hit list into the selection is written three times.**
  `defaults/areaSelect.ts`, `defaults/lassoSelect.ts`, and `selectFromLasso.ts` each merge hits into
  the current selection.

- **(P3) `moveAction` applies a second drag threshold.** The dispatcher buffers a press until
  `DRAG_THRESHOLD_PX` before `start` runs, and `moveAction.onMove` checks `dragThresholdPx` again;
  resize, rotate, and clone have only the first. With `dragThresholdPx` raised, a drag that never
  engaged still runs its behaviors' `onEnd`, with `onGestureStart` and `onGestureEnd` never fired.

- **(P3) `PoseDescriptor.forNode` is honored by some actions and not others.** `rotateAction`
  measures with the per-node descriptor and writes with the unspecialized one; `moveAction`
  specializes in its layout pass only; `resize`, `clone`, `nudge`, and `duplicate` never call
  `poseDescriptorForNode`. With `@weasel-js/kernel3d`'s descriptor the selection chrome is drawn
  from specialized bounds while resize anchors on the default box. Resolve the descriptor per node
  once, where start poses are captured.

- **(P3) `GestureContext.pointer.clientX` / `clientY` are always 0.** Every default action fills
  them with a literal, so a behavior reading them gets a plausible wrong answer. Remove the fields
  from `PointerState`, or carry the client point through `InvocationCtx`.

- **(P3) `move.ts` is 1,400 lines doing four jobs.** The layout drop pass, reparent-on-drop, the
  reflow-glide bookkeeping, and the translate gesture share one file, with `commitMove` a 250-line
  closure branching across all of them. Its inline "selected roots plus descendants, less ids a
  moving frame carries" walk is the same decision `translateTargets` now makes for nudge and clone,
  and should become that call when the file is split.

- **(P3) `liveInsertScratch` is module-global.** With two canvases in separate input scopes, an
  insert drag live in one is rotated by `insert.adjustRotation` routed in the other
  (`packages/core/src/interactions/actions/defaults/insert.ts`). Hold the live scratch on a dep in
  the invocation's scope.

- **(P3) `useDragHandle`: a drag canceled while the button is still down, then released over its
  source row, delivers a click to the row.** The click guard is removed on cancel so it cannot eat a
  later click; telling "canceled, release still to come" from "canceled, pointer already gone" needs
  the pointer session to say which.

- **(P3) Long-press: a browser that sends its own `contextmenu` on a touch hold may fire the menu
  twice.** `useGestureDispatcher`
  (`packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx`) synthesizes `longpress`
  after 500 ms and falls back to dispatching `contextmenu`; its `onContextMenu` listener also
  dispatches `contextmenu` for the native event. Android Chrome sends a native `contextmenu` on a
  touch hold, so a `contextMenu` binding could run from both. Not reproduced: it needs a real touch
  device, since jsdom sends no native event. If real, drop the native event while a touch pointer
  whose long-press fired is still held.

- **(P2) Modes: "is this tool allowed in this mode" is answered three ways with two different
  rules.** `eligibleForMode` in `packages/modes/src/modeDefinition.ts` allows a tool when any of its
  capability tags is allowed and refuses a tool with no tags; `isToolEligible` in
  `packages/core/src/canvas/SceneCanvas.tsx` is a hand copy of it; the dispatcher
  (`assembleScopedBindings` in `packages/routing/src/interactions/dispatcher/dispatcher.ts`, with
  `liveScope` in `packages/routing/src/contributions/eligibility.ts`) requires every tag to be
  allowed and lets a tool with no tags through. So a tool tagged `['navigation', 'creates-shapes']`
  in a mode without `creates-shapes` shows enabled in `ToolPalette`, activates, and then has all its
  bindings dropped: active and dead. A tool with no `capabilities` is the reverse: grayed out and
  unactivatable, but live if already active or ambient. Every built-in tool carries one tag, so only
  a consumer tool hits it. Decide any-versus-every and the empty case once, as one predicate over
  `(allowedCapabilities, tags)` in `@weasel-js/modes`, and have all three call it.

- **(P3) Contributions: `ContributionsApi.scopedBindings()` is a second binding assembly the
  dispatcher never calls.** `packages/routing/src/contributions/useContributions.ts` builds its own
  snapshot: it walks hotkey-held entries oldest-first where the dispatcher walks newest-first,
  passes no capability gate, and has neither the view filter nor the action bindings. Its only
  caller is its own test, but `overlays()` reads the same snapshot, so with two tools held the
  overlay order disagrees with routing, and a tool the mode bars keeps drawing its overlay after the
  dispatcher dropped its bindings. `docs/taxonomy.md` ("Contribution registry") says "The dispatcher
  matches against that, so one place decides eligibility", which is not true. Export one assembly
  function from routing (order, capability gate, view filter) for the dispatcher and `overlays()`
  both, delete `scopedBindings()` or make it that function, and correct the taxonomy paragraph.

- **(P3) Painted cursors do not survive the hover-cursor pump.** Two latent cases, since no kit tool
  or action uses a painted cursor yet. An action declaring `activeCursor: { glyph, worldRadius }`:
  `inFlightCursor()` in `packages/routing/src/interactions/dispatcher/dispatcher.ts` returns
  `resolveCursor(...)`, which is the string `'none'` for a painted spec, and the pump in
  `useGestureDispatcher.tsx` treats `'none'` as a CSS cursor and clears the painted override, so
  there is no cursor at all mid-gesture. And a painted base cursor with the pointer over a handle
  whose cursor is CSS: the pump sets the CSS cursor and `setOverride(null)`, and
  `PaintedCursorState.current()` is `override ?? base`, so the painted base keeps drawing under the
  native arrow. Return the `CursorSpec` from `inFlightCursor`, and give the painted state an
  explicit "suppressed" override for a CSS-tier hover cursor.

- **(P3) `ActionsRegistry.trigger` does not ask `enabled`.** `trigger('delete')` runs while
  `delete.enabled()` reports a disabled reason, which the dispatcher honors for the same action on
  a key (`packages/routing/src/interactions/actions/ActionsProvider.tsx`). Whether a palette or
  toolbar is expected to gate before calling is the design call: either `trigger` gates on
  `evaluateEnabled`, or its contract says the caller gates. `trigger` has no event, so it cannot
  pass `enabled` the `at` point the dispatcher does, and an action that only applies at a point
  would refuse every `trigger`. `Action.enabled`'s JSDoc
  (`packages/routing/src/interactions/actions/action.ts`) still says keystroke dispatch is
  unaffected by it, which stopped being true when the dispatcher began gating.

- **(P3) Key bindings match `event.key` only, so they depend on the keyboard layout.** `matchKey` in
  `packages/gestures/src/ui/match.ts` compares `event.key`, and `KeySpec` has no `code` form. `{
  key: ']', mods: { mod: true, alt: true } }` cannot match on a US Mac, where Option turns `]` into
  `‘`; core lists the glyph per binding (`key: [']', '‘']` in
  `packages/core/src/interactions/actions/defaults/reorder.ts`), which is right for one layout. A
  layout that types `[` with AltGr reports `ctrlKey` and `altKey`, which the strict modifier match
  rejects. Left and right Shift also share one `key-held-Shift` gesture id, so releasing either ends
  the hold. Let a key spec name a `code` and match it before `key`.

- **(P3) Route-conflict check: two kinds of real tie are never compared.** In
  `packages/routing/src/tools/routing/reflection/conflicts.ts`, `ArrowLeft` with `shift: 'optional'`
  and plain `ArrowLeft` land in different buckets (`canonicalModifiers` keeps `optional` distinct)
  though both match an unshifted press at equal specificity; bucket by the set of modifier states a
  spec accepts. And `multiTouch` has no route gesture, so `entryFor` in `reflection/registry.ts`
  returns `null` and two `fingers: 2` bindings are never compared; give it a row.

- **(P3) The two dispatcher files are about 1,700 lines each and mix owners.**
  `packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx` holds keyboard, wheel,
  WebKit pinch, pointer and multitouch synthesis, click and double-click, long-press, the
  hover-cursor pump, drop and paste, and tool lifecycle in one effect closure; `dispatcher.ts` holds
  dev tracing, per-kind context building, ranking, the walk, the record projection, and UI-driven
  handles. Several bugs fixed in these files came from state one channel keeps that another needs
  (which gesture a lifting finger ends, which view a held key belongs to). Split into one module per
  channel around a shared dispatch and routing core, and move tracing and record building out of
  `dispatcher.ts`.

### Cursor package follow-ups

All four arcs of `docs/superpowers/specs/2026-09-03-cursor-system-design.md`
have shipped. What remains:

- **(P3) Cursor rasterization is unmeasured in Safari.** Chrome and headed
  Firefox are measured (spec, "Measured browser behavior"); the baker's plain
  SVG `url()` is right for both. `node probe.mjs <dir> --browser safari` in
  `packages/cursor/scripts/probe/` is the instrument, and on studio on
  2026-09-30 it could not be trusted: its first run drew the arrow control
  and then the crosshair for every case after it, and every later run drew
  the crosshair even for the arrow — with the page frontmost, over HTTP
  (`--page http`) as well as `data:`, stepping by reload as well as by hash.
  Safari's cursor is not following the page under this driver, and why is
  the open question. A finding lands in `bake.ts`.

---

## Viewport

- **(P3) A controlled consumer's own `setState` cannot interrupt a glide.**
  Every view write that goes through the canvas cancels the camera runner, via
  the `onViewChange` it fires on both branches. A consumer who owns `view` in
  state and writes it directly does not go through the canvas: the prop change
  arrives asynchronously, after the runner has lowered the flag that
  distinguishes its own frames, so it is indistinguishable from one. Comparing
  the incoming prop against the last value written would work only for
  consumers who store the view by reference — one who normalizes or clamps it
  would have every frame of their own glide cancelled. Wants a real design.

- **(P3) Views do not nest.** A view paints and routes the surface's own stack,
  never another view, and a loupe magnifies the canvas's camera — aimed over a
  `<CanvasView>` panel it shows and edits the canvas's world, not the panel's.
  Composing would mean a view's camera derived from the view under its aim, and
  a resolver that descends rather than picking one rect.

- **(P2) `renderDebugSnapshot`: a y-up view throws.** A canvas with `view.scale.y < 0` (valid per
  `core/viewport/view.ts`) reaches `planPixelRender` with a negative `sourceRect.height` and
  `scale.y`, which throws "sourceRect.height must be a positive finite number"
  (`packages/core/src/canvas/renderDebugSnapshot.ts`, `renderSceneToPixels.ts`). So a flipped scene
  cannot be rasterized headlessly. Options: let `planPixelRender` take a signed scale (size from the
  magnitude, the view keeps the sign and offsets its origin), which changes `renderSceneToPixels`'s
  contract, or keep the limit and say so in both docs.

- **(P3) Canvas hosts: the renderer writes inline `width` and `height` style on a `<canvas>` it
  owns.** `WeaselRenderer`'s constructor and `resize` set `canvas.style.width`/`height`, so a
  `<SceneViewCanvas className>` or `<DrawCanvas className>` that sizes the element (`width: 100%`)
  loses to the inline style after the first paint. The docs now say so. Ruled 2026-10-11: the
  renderer sets only the canvas's backing-store size, and every host sizes its element by class.
  That leaves dropping both style writes, checking every host for a layout that depends on them, and
  taking the caveat back out of the docs.

- **(P3) `Canvas.tsx` is 1,610 lines and holds the scene-layer builders.** Its header says "Canvas
  owns NO scene-shaped state", and it exports `buildSceneLayer`/`buildSceneLayers`, which walk the
  scene tree, apply `toPose`, cull, and record debug bounds. Move them beside
  `packages/core/src/canvas/sceneLayerPaint.ts` (re-exported from `Canvas.tsx` until importers
  move), and take the uncontrolled/controlled view state (`viewRef`, `setView`, `subscribeView`, the
  controlled-prop notification) out as a hook.

- **(P3) Scene layer list: `<Canvas>` learns of a layer change by polling at paint.**
  `useSceneLayerList` (`packages/core/src/canvas/useSceneLayerList.ts`) re-reads
  `adapter.getLayers()` on every paint and queues a render when the ids differ, because the adapter
  contract has no layer-list subscription. That costs one skipped frame per change. If
  `CanvasAdapter` gains a layer-list version or subscription, key the layer memo on that and drop
  the poll.

- **(P3) `useHostAnchor`: a host that moves without resizing is not followed.** Unverified, from
  reading `packages/core/src/canvas/useHostAnchor.ts`: it recomputes on scroll, window resize, and a
  size change of the host or panel, so a sibling collapsing beside the host shifts it with none of
  those firing, and the dev HUDs stay where the host was. The doc says it tracks reflows.

---

## Paths & booleans

- **(P3) `@container` in `@weasel-js/svg` stylesheets.** `packages/svg/src/cascade.ts` evaluates `@media`, `@supports` and `@layer`, but skips a `@container` block whole, so its rules never apply. That is deliberate for now: a static parse lays nothing out, so no element is a size container and no query can hold. Applying them needs container sizes from somewhere — the root's viewport as the one container, or boxes supplied by the caller.

- **(P3) svg import: a skewed, non-uniformly scaled, or mirrored-and-rotated `<text>` or `<image>`
  keeps only its position, rotation, and uniform scale.** `applyOwnTransform`
  (`packages/svg/src/placeBox.ts`) warns and drops the rest, because `SvgTextNode` and
  `SvgImageNode` are a box plus a rotation. `<text transform="scale(4 1)">` imports at twice the
  size instead of four times as wide. Ruled 2026-10-11: text and image nodes carry a full transform,
  and such text stays editable text. That leaves a `transform` on the two node types and on the kit
  text and image poses they become, honored wherever those poses are read.

- **(P3) svg import: `em` and `ex` on a length are read as bare user units.** `<circle r="2em">`
  imports with r = 2, and the same holds for `stroke-width` and the root `width`. Each warns
  (`packages/svg/src/lengths.ts`, `properties.ts`'s `length`, `parse.ts`'s `parseRootLength`);
  converting needs the element's computed font size at the point the length is read, and nothing
  computes one today: a percentage `font-size` is resolved against the 16px default (`parse.ts`),
  and the readers in `properties.ts` see only the value string.

- **(P2) geom: whether an open subpath fills is answered three ways.** For `<polyline points="0,0
  100,0 100,100" fill="red"/>` (no `Z`), `tessellate` (`packages/geom/src/tessellate/tessellate.ts`)
  triangulates the closed triangle and `pathSignedArea` (`paths/winding.ts`) counts it as closed
  "the way a fill closes it", while `pointInPath` (`pathHitTest.ts`, `flatSubpaths`) files the run
  under `open` and returns false, and `path.ts` documents that open subpaths "don't contribute to
  fills". So the triangle paints and cannot be clicked. The options are SVG's rule (a fill closes
  every subpath implicitly), which means `flatSubpaths` treats an open run of three or more points
  as closed for the fill test and `path.ts` says so; or the kit rule (open never fills), which means
  `tessellate` skips open contours and `pathSignedArea` returns 0 for them, and SVG import has to
  close filled open shapes itself. SVG's rule cannot land in `pointInPath` alone: `containsInFrame`
  (`packages/core/src/canvas/SceneCanvas/poseGeometry.ts`) calls it without knowing whether the
  node has a fill, so every unfilled open stroke would become pickable across the area its ends
  enclose.

- **(P3) svg unpack: a clipped group arrives unclipped.** `parseSvg` puts a `<g clip-path>` on
  `SvgGroupNode.clip`, but `svgNodesToKitDrafts` (`packages/svg/src/unpack.ts`) builds the container
  draft without it and has no warning channel to say so, so a dropped file shows the whole group.
  Either the container draft carries the clip into whatever the scene's containers use for clipping,
  or `svgNodesToKitDrafts` gains a way to report what it dropped. A container's clip is
  `clipFromPose`, a function stored by registry key, so a fixed clip path has no serializable form
  to be carried in yet.

- **(P3) svg import: `<tspan>` positioning beyond line breaks is not read.** A `<tspan>` with its
  own `x` and a `dy` or new `y` now starts a line (`packages/svg/src/tspanLines.ts`), but the line
  pitch the `dy` states is discarded in favor of the default 1.2 line height, and `dx`, `rotate`,
  and list-valued per-glyph `x` / `y` are ignored (a list on `<text>` warns; one on a `<tspan>` does
  not). Kerned text exported as one `<tspan>` per glyph run imports with the glyphs run together.

- **(P3) svg import: hidden content is dropped, not imported hidden.** `display="none"` and
  `visibility="hidden"` content is now left out of `parseSvg`'s result, matching what a renderer
  shows and what `svgFromKit` does with a hidden node on export. A file's hidden layers are
  therefore lost on import. Keeping them needs a `hidden` flag on `SvgNode` that `unpack` maps to
  the scene's own hidden state.

- **(P3) svg: `shapes.ts` re-implements geom's `transformPath`.** `packages/svg/src/shapes.ts` has
  its own `transformPath` with a different axis-aligned test (`< 1e-9` against geom's `=== 0`) and
  its own identity short-circuit, beside `packages/geom/src/paths/transformPath.ts`. `parse.ts`'s
  `pathAabb` and `serialize.ts`'s `pathBounds` both wrap `boundsOfPath`, which already returns a
  rect's own box. Fold each pair into the geom function; the rect-reconstitution tests in
  `roundtrip.test.ts` are what would notice a tolerance change.

- **(P3) svg and geom: two files hold several owners.** `packages/svg/src/parse.ts` is about 1,450
  lines holding the document walk, shape lowering, text, images, clip paths, and marker ingestion;
  text, image, and marker reading each split out cleanly (`placeBox.ts`, `lengths.ts`,
  `tspanLines.ts`, and `metricScale.ts` are already their own modules).
  `packages/geom/src/booleans/splitBySegment.ts` is 878 lines of crossing detection, loop tracing,
  and region assembly.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Outline.** Stroke-to-fill silhouette — needs proper offsetting with joins/caps/self-intersection cleanup. No lightweight JS lib without major deps. The same offsetting would let `textToPath` embolden synthetic-bold text, which it refuses today with `reason: 'synthetic-bold'`.
- **(P3) Trim and Merge.** Remove hidden portions / Trim + same-color reunion — need per-path style awareness, which the kit deliberately doesn't have since `data` is opaque. Wait on a compound-path-with-styles model.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Boolean ops on stroked paths.** Treat a stroke as a filled region, then clip. Blocked on stroke-to-fill (round/bevel/miter joins, end caps — its own design problem).

---

## Rendering & paint

- **(P3) A minimap's framing ignores pose overrides.** `<SceneViewCanvas>` and
  `<MinimapCanvas>` paint override poses as of 2026-08-25, but `computeFitView`
  still derives framing from document poses, so a node overridden outside the
  document bounds paints outside the fitted frame. Deliberate — recomputing the
  fit per frame would rescale the whole minimap through a drag or a settle, and
  costs an O(nodes) bounds sweep every frame. Revisit only if a consumer wants
  framing that tracks a simulation.

- **(P3) `GradientHandles` still draws its handles at a literal radius.**
  `MeshHandles` sizes its corners and controls from `--wzl-handle-size-lg` and
  `--wzl-handle-size`; `GradientHandles` keeps `HANDLE_RADIUS = 7`, so a ramp's
  endpoints are 14px across while a mesh corner beside them is 10px. Moving it
  onto the family is a visual call that wants a browser — it shrinks every
  gradient handle.

- **(P3) Pattern fills: what the tile picker left open.** The texture half of
  fill-mode expansion shipped 2026-08-12 — patterns tile, carry a serializable
  `TilePatternSpec`, round-trip through SVG `<pattern>`, and have a picker in
  WeaselDraw. What it deliberately did not do:

  - **Image-upload patterns.** The picker covers the four built-in tiles only.
    A user-supplied bitmap needs a payload variant that persists the image
    itself (data URI, or a document-scoped asset table), which is a storage
    question rather than a paint one.

  The gradient half's own gap is closed: a conic gradient serializes as a
  `<wzl:conicGradient>` def in `urn:weasel-js:svg` and reads back losslessly,
  and every reference to a paint SVG cannot express carries SVG's own paint
  fallback color so an unresolvable one paints flat. See
  `docs/proposals/2026-09-17-paint-kinds-beyond-svg.md` for what a richer kind
  writes inside that envelope.

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three uses now exercise it (plasma / ripple / voronoi panels), which is enough to have validated the surface. Array uniforms take one flat value (`u_ripples: [x, y, t, …]`), and a re-registered source recompiles on each renderer's next frame. Left before stabilization: how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) No marker icons.** `defaultNodeProperties`'s `markerStart` /
  `markerMid` / `markerEnd` leaves use a labelled `select`, where the sibling
  stroke enums (`cap`, `join`, `align`, `dash`) are icon toggles — authoring
  eight glyphs to this repo's icon standard is its own piece of work and was
  deferred out of the stroke-markers arc.

- **(P3) Images: nothing calls `releaseImage`.**
  `packages/core/src/features/images/imageCache.ts` keeps every decoded `ImageBitmap` keyed by its
  `src` (a multi-megabyte `data:` URI for a pasted image) until `releaseImage(src)` is called, and
  the kit never calls it. It needs an owner: the scene when the last node using a `src` passes the
  undo horizon, or a byte bound on the cache. A bound has to spare what the current frame draws: a
  scene showing more than the bound would otherwise evict and reload on every paint.

- **(P3) Patterns: `resolvePatternSpec` registers a GL texture per distinct spec and never frees
  one.** `packages/core/src/features/patterns/resolveSpec.ts` documents session lifetime, but a
  color control scrubbing a hatch fill's `color` makes each intermediate color a new spec and a new
  texture. Bounding the map (least recently used out, unregistering the evicted handle) is the
  option; whether draw's pattern controls commit live or on release has not been checked. A bound
  has to spare every handle a live draw command still holds: `registerTexture` has no unregister,
  each renderer's `GLTextureCache` keeps its own copy by id, and a scene with more distinct specs
  than the bound would draw the evicted ones blank ("pattern TextureHandle not registered").

- **(P3) Chrome caps: `useHoverTracking` never attaches if its canvas ref is empty on the first
  effect run.** The effect in `packages/core/src/features/chrome-caps/useHoverTracking.ts` reads
  `canvasRef.current` once and has no dependency that changes when the element arrives, so a canvas
  mounted a render later is never tracked. Taking the element (or a callback ref) instead of a ref
  object would fix it and changes the hook's arguments.

- **(P2) Renderer: a translucent `ImageBitmap` is multiplied by its alpha twice.** A
  half-transparent white bitmap drawn with an image command onto a cleared canvas reads back as
  `(64, 64, 64, 128)` in headless Chromium where `(128, 128, 128, 128)` is correct, whether the
  bitmap came from `ImageData`, a PNG blob, or a canvas. Every PNG with soft edges shows a dark
  fringe. `createImageBitmap` with no options holds premultiplied pixels and `texImage2D` uploads
  them as they are, while `GLImageCache` and the batch shader
  (`packages/core/src/renderer/shaders/batchFill.ts`, `vec4(mapped.rgb * a, a)`) assume straight
  texels. A pattern texture registered from an `ImageBitmap` goes through `GLTextureCache` the same
  way, and an `HTMLImageElement` source uploads straight, so the two source types disagree. Two ways
  out: create every kit bitmap with `{ premultiplyAlpha: 'none' }` (`features/images/imageCache.ts`,
  `features/ingestion/imageHandler.ts`, the loupe) and document that requirement on
  `ImageDrawCommand.image`, which leaves a consumer's default bitmap wrong; or make image textures
  premultiplied by convention, set `UNPACK_PREMULTIPLY_ALPHA_WEBGL` for the non-bitmap sources, and
  have the shader unpremultiply before the color matrix, which fixes every source and filters better
  at edges.

- **(P3) Renderer: the transform stack is single precision.** `mat3.create` returns a `Float32Array`
  and `GroupState` composes in it, so at world x = 262,144 and 64x zoom the view translation is near
  1.68e7, where a float32 step is 1 to 2 pixels. Batched geometry (corners computed in JS) would pan
  in whole-pixel steps, and own-draw meshes (`u_model * a_position` in the shader) would round per
  vertex, so a path's batched stroke could separate from its own-drawn fill. Not measured. Fix: keep
  `GroupState` transforms in doubles and convert at the uniform upload, and fold the translation
  into a camera-relative offset on the CPU for own-draw meshes.

- **(P3) Renderer: `draw.ts` is about 2,700 lines with several owners.** It holds the per-frame
  uniform cache, custom-shader uniform upload, group effects and the fullscreen quad, the clip stack
  and its stencil helpers, batch staging and `flushBatch`, gradient coordinate math, the path fill
  and stroke painters, text, the scratch-paint pass, and image and sprite staging. Two state leaks
  fixed this month (the stencil test left on for effect passes, a texture unit clobbered by a
  uniform upload) were contracts between sections of this one file. Split along those owners,
  leaving `dispatch` in `draw.ts`; the fill and stroke sections move together, since the
  bind-half/draw-half rule in CLAUDE.md spans them.

- **(P3) Renderer: `PathDrawCommand` accepts `FillStyle` shapes the renderer cannot draw.** A
  hand-built command with `fill: { fill: 'pattern', pattern: { tile: 'hatch', color: '#000' } }`
  draws nothing and warns `pattern TextureHandle "undefined" not registered`, because `bindPattern`
  (`packages/core/src/renderer/draw.ts`) casts `fill.pattern` to a `TextureHandle`. A gradient with
  `units: 'bounds'` is painted in screen space with no warning. The node painter resolves both
  before the renderer; a consumer-built command skips that. Ruled 2026-10-11: the command's fill
  type narrows to what the renderer takes, a resolved pattern handle and world or local gradient
  units, so a tile spec or `units: 'bounds'` on a command is a type error, not a blank draw. That
  leaves the narrower type and whatever emit sites it turns up.

- **(P3) Layers: `LayerGroup.alpha` without `effects` fades each member, not the group.** Its doc
  (`packages/core/src/core/layers/render.ts`) says the opacity applies "to the group's composited
  result, not to each member", but `wrapGroup` emits a plain group command, whose alpha multiplies
  into every child, so overlapping members show through each other. With `effects` set the group is
  composited as one surface. Either route an alpha-only group through an isolated buffer or correct
  the doc.

---

## Text

- **(P3) `.dfont` machine faces still can't reach the outline tier.** The
  *silence* closed 2026-08-16 — `isDataForkFont` recognizes a Macintosh
  resource fork by its header offsets and `sfntFromCollection` throws by name,
  so the face degrades to the SDF tier saying why. Actually reading the `sfnt`
  resources out of the map is unwritten and unreachable on current macOS (204
  `.ttf` / 128 `.ttc` / 38 `.otf`, no `.dfont`). Design record for the whole
  tier: `docs/concepts.md` ("Font outlines"); the settled argument for
  keeping container unpacking in `sfnt.ts` rather than upstreaming it or
  adopting fontkit is in that file's own header.

- **(P3) The edit overlay's text lands on whole CSS pixels; the canvas's does
  not.** Every tier now hangs its baseline where CSS does, so the overlay's
  measured `baselineDrop` is only rounding, but the overlay still cannot
  follow a fractional canvas baseline: moving its `top` by 0.4px moved its
  ink by exactly 1px in Chromium at DPR 1, and the matrix rows show the same
  jump in WebKit, Firefox and at DPR 2. On top of that sits a steady ink bias,
  overlay above canvas, of about -0.35px at DPR 1 and -0.17px at DPR 2
  (derived from Chromium's rows), of unknown origin. Together they are the whole of
  `dy` in `scripts/measure-overlay-alignment.config.ts` (mean |dy| about
  0.2px, max 0.75), and why `overlayAlignment.browser.test.tsx` allows
  `DY_TOLERANCE = 0.85`. Candidates: carry the fraction on a transform, snap
  the canvas's text baseline to device pixels as browsers do, or find the
  bias first. Recorded 2026-09-29.

- **(P3) WebKit at DPR 1 fails one overlay-alignment case, because it paints
  text on whole pixels.** `"Hgd" Inter 72px small caps` reports `dRight -0.79`
  against the 0.75 bound in `npx vitest run -c
  scripts/measure-overlay-alignment.config.ts`; Chromium and Firefox pass it at
  both DPRs, and so does WebKit at DPR 2. CI runs Chromium only, so nothing gates
  on it. It is not advances, small-caps synthesis or `text-rendering`: WebKit's
  DOM width of `GDGDGDGDGD` matches the atlas to 0.001px at 54.024px (the
  small-caps size) under both `geometricPrecision` and `auto`, and turning off
  `font-variant`, kerning or `geometricPrecision` on the overlay moves no pixel.
  What differs is where a text box starts painting. The small capitals sit in
  their own span, which starts at x 73.5; WebKit paints it from 73, so `G` and
  `D` land 0.44 and 0.69px left of the canvas's. Moving the overlay right by
  `f` (0 to 0.875 in eighths) moves WebKit's `H` ink by `-f` at DPR 1 and by
  `-(f mod 0.5)` at DPR 2, so a box's paint origin is floored to the
  device-pixel grid; Chromium's `H` stays within 0.08px throughout. Not
  compensable from the overlay as far as measured: a WebKit-only half-device-
  pixel `translate` (floor into round) fixes this case but moves WebKit DPR 1's
  matrix mean `dx` from -0.14 to +0.36 and fails three other cases, and a
  0.492px nudge on the small-caps span alone moved `D` a whole pixel and `G`
  not at all — WebKit picks a pixel either way. Measured 2026-10-07 on macOS
  (Playwright WebKit).

- **(P3) The character strip has no "no fill" chip.** WeaselDraw's text objects carry `fill: null`
  through its SVG export and import, and the sidebar's Fill leaf already offers None for a text
  node. What is missing is a None chip beside the strip's Color field. The strip is range-scoped,
  and a run cannot be unfilled today (`StyledRun.fill` is `FillStyle`, no `null`). Ruled 2026-10-11:
  a run can carry no fill, so the chip unfills only the selected range. That leaves `fill: null` on
  a run through `resolveRuns` (which reads a run's `null` as "inherit" today, `run.fill ??
  style.fill`), the DOM overlay, the range algebra, and `@weasel-js/svg`'s `<tspan>` output, and
  then the chip.

- **(P3) At 12px with a script, the atlas tier's ink still sits ~0.55px off
  the overlay's at DPR 1, and the sign follows the sub-pixel phase.** `dx` is
  −0.5 at `x` 20 and +0.5 at 20.5 in every engine; DPR 2 agrees within 0.06.
  The stems of a 7.2px `H` are ~0.65px wide, and the shader reads coverage from
  the distance at each pixel's center, so a stem centered on a pixel carries
  about twice the ink of one straddling two, and the centroid leans toward
  whichever stem is on the grid. Center-sampled coverage cannot do better; area
  coverage would need several field taps per fragment on small glyphs. The same
  rows show `dy` of ±0.45, which predates this and is unexplained. The
  `super`/`sub` 12px rows of `npx vitest run -c
  scripts/measure-overlay-alignment.config.ts` show both.

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/text/src/layout/layoutRuns.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs. Shaping is also what real small caps needs: `fontVariantCaps: 'small-caps'` is synthesized today (capitals scaled by x-height over cap height), and a face with an `smcp` feature should get its own small-cap glyphs instead.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `packages/text/src/runs.ts`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

- **(P3) Text edit: an edit that changes text ending in a newline drops that newline.**
  `trimCaretHolder` (`packages/core/src/features/text/useTextEdit.ts`) removes one trailing `\n` on
  the assumption the browser added it as the caret's holder, so a node whose text is `"abc\n"`
  becomes `"xabc"` when an `x` is typed at its start. An edit that changes nothing writes nothing,
  so open-and-close is safe. Whether a browser adds a holder to seeded text that already ends in
  `\n` has not been observed, and the fix turns on it.

- **(P3) Text edit: typed text is inserted by hand in `beforeinput`.** Every `insertText` is
  `preventDefault`-ed and inserted at the window selection
  (`packages/core/src/features/text/useTextEdit.ts`, `onBeforeInput`). No `input` event follows, so
  the `onInput` re-place that keeps a center- or bottom-aligned overlay from jumping a frame late
  runs only for paste and delete. Two further effects are inferred and not observed in a browser:
  input carrying its own target range (macOS double-space period, text replacement) would land at
  the caret, and typing would not be on the native undo stack. The alternative is to intercept only
  while a pending style is armed and normalize in `onInput` otherwise.

- **(P3) Text edit: pasted rich text reads back with the wrong line breaks, and offsets drift after
  it.** `domToRuns` (`packages/core/src/features/text/domRuns.ts`) adds a newline per `<br>` and per
  non-first `<div>` and none for `<p>`, while the character-offset walkers count text nodes only, so
  after such an element every caret offset is short by one per break. `useTextEdit` has no `paste`
  handler; inserting `text/plain`, or sanitizing to run spans, would keep the overlay to what
  `runsToDom` writes. Which elements each browser inserts on paste has not been observed.

- **(P2) Text nodes: right-to-left text lays out reversed, because no kit entry point hands
  `layoutRuns` a bidi engine.** A text node holding `שלום` paints, picks, and places its caret in
  logical order. `layoutRuns` reorders only when `opts.bidi` is set, and none of its kit callers set
  it: `drawText` (`packages/core/src/renderer/draw.ts`), `textPoseLayoutInput`
  (`packages/text/src/layout/textPoseLayout.ts`), `measureTextBounds`
  (`packages/text/src/measure/measureTextBounds.ts`), and `textToPath`
  (`packages/core/src/features/text/textToPath.ts`). `TextStyle.direction` reaches `resolveAlign`
  and nothing else. The console warning tells the consumer to "add it to the layout options", which
  a `<SceneCanvas>` consumer does not have. The engine itself is finished and conformance-tested,
  and `layoutRuns` now handles paragraphs, hanging spaces, and the cache key correctly when one is
  passed, so what is left is the wiring; `packages/text/src/layout/bidiSeam.ts` says outright that
  text must not depend on `@weasel-js/bidi`. For an omitted `direction`, bidi analysis uses `'auto'`
  (first strong character) while `start`/`end` alignment uses `'ltr'`, so Hebrew with no `direction`
  gets a right-to-left paragraph aligned left. Ruled 2026-10-11: an omitted `direction` means auto
  for both, so the first strong character sets the paragraph's direction and its alignment, and the
  engine arrives through one registration point in `@weasel-js/text` (`registerBidi(engine)`, or a
  `bidi` dep) that `layoutRuns` falls back to when `opts.bidi` is absent, which fixes every caller
  at once and keeps the seam. That leaves the registration point, passing `style.direction` through
  as `direction`, moving `resolveAlign`'s `'ltr'` fallback to auto, and rewording the warning to
  name the real fix. `docs/TODO.md`'s HarfBuzz entry lists reordering as missing; it is implemented
  and unwired.

- **(P2) Text editing: caret stops fall inside grapheme clusters.** `layoutRuns` emits one
  `LaidOutCell` per code point and the cell contract says a caret stop is a cell's `x`, so
  `caretIndexAt` (`packages/core/src/features/text/hitTest.ts`) can return an offset between a base
  letter and its combining mark (`"éx"` written as `e` + U+0301: a click in the right half of `e`
  returns offset 1), between the code points of `👨‍👩‍👧`, or before a variation selector or skin-tone
  modifier. `sourceClusters` there merges only cells sharing a source span. The fix spans both
  packages: mark cluster-closing cells in layout (`graphemeEnds` is already computed when tracking
  is on; it would need computing always) and have every caret consumer stop only there. It adds a
  field to the public `LaidOutCell`.

- **(P2) Canvas font tier: a web font that loads after first use never replaces the fallback face it
  was measured with.** `getDynamicFace` and `requestGlyph`
  (`packages/font/src/dynamic/dynamicAtlas.ts`) cache face metrics and each glyph's bitmap and
  advance on first request and never invalidate. If `registerCanvasFont('Roboto')` runs while Roboto
  is a CSS web font still loading, canvas draws its fallback face, and the text keeps those shapes
  and advances for the session; nothing in `packages/font` listens for `document.fonts`
  `loadingdone`. This rests on canvas using a fallback for a not-yet-loaded face, which has not been
  measured here: a `*.browser.test.ts` that registers a canvas font, lays out, adds the `FontFace`,
  and compares advances would settle it. The fix (drop the affected faces on `loadingdone` and call
  `notifyGlyphReady()`) depends on the eviction entry below, since dropped faces currently leave
  their atlas rects allocated.

- **(P2) Canvas font tier: a full dynamic atlas is permanent.** `ShelfPacker`
  (`packages/font/src/dynamic/shelfPack.ts`) has no free, `bake` in `dynamicAtlas.ts` returns early
  once the four 1024-pixel pages are full, and `unregisterCanvasFont` deletes faces but leaves their
  rects allocated. A font picker previewing many canvas families, or CJK text through the canvas
  tier, fills the pages; after that every new glyph in any canvas font, including single code points
  escalated from an atlas font, is invisible until reload, with one console warning. Options: reset
  the packer and every face's `charMap` wholesale when full and bump the glyph generation, so only
  what is on screen re-bakes; or a real per-rect free list with eviction by last use.

- **(P2) Text: emoji paint as flat silhouettes, and multi-code-point emoji paint as their parts.**
  The canvas tier keeps only the alpha channel (`packages/font/src/dynamic/glyphRasterizer.ts`), and
  `layoutRuns` looks glyphs up one code point at a time, so `👍🏽` is a thumb plus a swatch, `🇨🇦` is
  two letters, and `👨‍👩‍👧` is three people, all in the run's fill color. Needs grapheme segmentation
  before glyph lookup and a color (RGBA) atlas page drawn untinted for clusters with emoji
  presentation. Shares the cluster work with the caret entry above.

- **(P3) Outline fonts: a `.ttc` member that does not match by PostScript name is used silently.**
  `sfntFromCollection` (`packages/font/src/outline/sfnt.ts`) falls back to the collection's first
  member and returns `matched: false`, on purpose and with a test; `createOpenTypeParser`
  (`opentypeParser.ts`) drops the flag. When `queryLocalFonts` reports a name the `name` table
  spells differently, bold text tessellates the first member (usually Regular) above the outline
  threshold while the canvas tier draws real bold below it, so the text gets lighter as you zoom in.
  Options: reject on a mismatch so the registry leaves the run on the SDF tier with its usual
  warning, or keep the fallback and warn once naming both spellings.

- **(P3) Text layout: a tab has no layout of its own.** `layoutRuns` treats only U+0020 as a space,
  so U+0009 goes to glyph lookup: an atlas has none, the canvas tier measures `'\t'` as whatever
  canvas returns, and under the `'none'` policy it is zero-width with a "no glyph" warning. There
  are no tab stops and a trailing tab does not hang. Wants a tab size on the layout options and an
  advance to the next multiple of it.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** The Canvas-level synthesis tier this entry used to describe is gone — `Canvas.tsx` no longer takes `items`/`setItems`/`createDefault`/`poseBounds`/`intersectsRect`, and only `toPose` survives as a layer-config override. `arrayAdapter`, `useArrayAdapter` and `sceneToAdapter` are still three separate wirings. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

- **(P2) Scene history: an entry that names a node removed by an untracked edit can never be
  undone.** `scene.add(n)`, `scene.setPose(n, p)`, then `scene.untracked(() => scene.remove(n))`,
  which is what `reconcileSpecs` does when outside data drops a node
  (`packages/core/src/core/scene/reconcileSpecs.ts`, called from
  `packages/diagram/src/DiagramView.tsx`). `scene.undo()` throws `Scene: unknown node id "n"` and
  the entry stays on top of the undo stack, so every later undo throws the same way and the entries
  beneath it are unreachable. The stacks and the scene stay consistent; the stack is just stuck.
  Options: have an untracked removal drop or neutralize the entries that touch the removed ids; have
  kit ops whose target is gone report `'noop'` on replay instead of throwing (the policy restored
  external ops already follow in `bindOpToHistoryAdapter`); or have `reconcileSpecs` clear history
  when it removes a node. The second option alone does not cover a gesture's entry: a live external
  op (`createTransformOp` bound by `bindOpToAdapter`) replays through `adapter.setPose` into
  `scene.setPose`, which throws in `requireNode` before any kit op runs (read from the code, not
  run). Nor does it cover the reverse case, an id that an untracked edit re-added: undoing an older
  `kit:remove` of that id overwrites the live node and attaches it a second time.

- **(P3) Scene: the selection keeps ids of nodes a removal took.** After `scene.setSelection([z])`
  and `scene.remove(z)`, `scene.getSelection()` still returns `['z']`, so every reader guards
  `scene.get(id)`. `kit:remove`'s apply in `packages/core/src/core/scene/scene.ts` could filter the
  selection the way `kit:setLayerLocked` does, but `reconcileSpecs` replaces a node by removing and
  re-adding its id, and filtering there would deselect a node the user sees as unchanged. The call
  is whether selection is a set of ids (stale ids are the reader's problem) or a set of live nodes
  (then a replace has to carry the selection across). `loadState` already drops ids the snapshot
  does not hold, but `setSelection` keeps an id no node has (`reachable` filters on locks only, and
  `scene.selection.test.ts` selects ids it never added), so today it is a set of ids.

- **(P3) `packages/core/src/core/scene/scene.ts` is one 2,100-line closure holding seven jobs.**
  `createScene` contains the node store and kit op table, the layer stack, the arrival window and
  layout settle, the lock guard, the atomic-revert log, the `History` facade and journal wrapper,
  the render-order walks with their cache, and serialization. Bugs fixed here were one of these
  reaching into another's variables: `loadState` writing the batch depth, the function-field cache
  keyed by id while incarnations are keyed by object. Split along those owners, each closing over a
  small shared state record; the kit op table and the history facade are the cleanest first cuts.

- **(P2) Derived paths: drawn from local poses under a composing pose strategy, picked from world
  poses.** With `poseComposition` set, a container at (100, 100) holding two children and an edge
  with `dependsOn: [a, b]` paints the children at their composed world poses, but `withDerivedPaths`
  (`canvas/derivedPath.ts`, wired in `canvas/sceneSlotWiring.ts` and `canvas/sceneViewRender.ts`)
  resolves the edge through `sceneDepLookup(scene)` → `effectivePose`, which composes nothing, so
  the edge paints 100 units up and left of the nodes it connects. Picking (`scenePickSource` in
  `canvas/pickWalk.ts`) derives the same edge from `adapter.getWorldPose`, so the clickable edge is
  where it should have been drawn. Read from the code, not reproduced. The render walk's dep lookup
  needs the same world-pose resolver the pick source uses, under its own memo slot (the two share
  the default `kit:derivedPath` slot today and evict each other). The comments at
  `canvas/derivedPath.ts` ("the render walks hand `getPose` straight to `drawOne`, composing
  nothing") and `core/scene/scene.ts:149-151` predate frames and should go with the fix.

- **(P2) Clipboard: a pasted derived edge is an invisible node, and a pasted layout container loses
  its layout.** `snapshotSelection` in `canvas/sceneAdapter.ts` keeps a derivation only for
  `dependsOn: 'children'` ("an id list would still name the originals"), so copying two nodes and
  the edge between them pastes the edge as a plain leaf with the original's zero-sized placeholder
  pose: it paints nothing, is selected with the rest, and one more accumulates per paste.
  `commitPaste` already builds the old-to-new `idMap` a remap needs. Ruled 2026-10-11: an edge is
  pasted, with its id list remapped, only when every node it depends on was copied too; otherwise it
  is dropped, and the paste reports what it left out and why, so an app can show it, which draw does
  with a toast. That leaves the remap, the drop, the report from the paste, and draw's toast.
  Separately `layout` is not copied though `clipFromPose` is, so pasted children stop being
  arranged. Both also need the wire format (`interactions/actions/clipboard/wireFormat.ts`), which
  drops function-valued fields, to carry registry keys the way scene serialization does. Not
  checked: whether duplicate and Alt-drag clone go through these two functions.

- **(P2) Container-pose cascade: a batch that poses a container and its descendants does not undo.**
  Through `sceneToAdapter(scene, { cascadeContainerPose: true })` (what `<SceneCanvas>` uses without
  a composing strategy), `adapter.applyOps([move(A), move(B), move(C)], 'Move')` with B inside A and
  C inside B applies correctly, but `scene.undo()` runs the inverses in reverse and each container's
  inverse cascades again: with A, B, and C at x = 0, 100, and 200 moved by 5, undo leaves them at 0,
  95, and 190 (measured). The kit's own move action builds this shape of batch (roots plus
  `cascadeIds`) but commits through `moveGestureAdapter`, which does not cascade, so only a consumer
  routing `applyOps` to the canvas adapter hits it. Belongs with "Container-pose cascade as a
  scene-primitive semantic": a cascade inside `setPose` cannot know what else the batch poses.

- **(P3) Default node properties: the marker pickers never list a consumer's registered marker.**
  `canvas/SceneCanvas/defaultNodeProperties.ts` builds `options: markerOptions()` inside
  `shapeSchema`, which runs once when `defaultNodeProperties` and `inferredNodeProperties` are built
  at module load, before any consumer code can call `registerMarker`. The comment above
  `markerOptions` says the opposite. An enum's `options` in `packages/prefs/src/schema.ts` is a
  static array, so this needs either options the schema resolves lazily or a schema rebuilt when the
  marker registry changes.

- **(P3) Scene adapters: three implementations of the same scene-backed mutators.**
  `canvas/sceneAdapter.ts`, `interactions/actions/defaultCommitAdapter.ts`, and
  `interactions/actions/move/gestureAdapter.ts` each restate `insertNode`, `setParent`,
  `getChildren`, and `setChildOrder` over a `Scene`, and have drifted: `getPose` is `effectivePose`
  in one and `documentPose` in two, `getNodes` filters hidden layers in one, `setChildOrder` opens a
  `scene.batch` in two, and only one cascades container poses. `rotateAction` hands behaviors the
  gesture adapter and commits their ops through the default one, while `moveAction` uses the gesture
  adapter for both, so a behavior's delete op captures its removal closure under rotate and not
  under move. The copies exist to avoid an
  `interactions → canvas → interactions` import cycle; moving the mutators into `core/scene`, below
  both, removes the reason.

- **(P3) Derived paths: one memo slot per `toPose` identity is never released.**
  `sceneDerivedPathOf(scene, toPose)` in `canvas/derivedPath.ts` mints `kit:derivedPath:toPose:<n>`
  per function identity, and every derived node keeps a `PathMemo` under each name until a
  pose-keyed drop or a memo generation bump. A scene slot whose `toPose` is an inline arrow gets a
  new slot name each time the slot config changes identity. Not traced: how often that happens in
  `<SceneCanvas>`.

### Derived geometry follow-ups

Left open by the derived-path and derived-pose arcs (`dependsOn` / `derivePath` /
`derivePose` / `SceneRegistry`; the seam is documented in `docs/extending.md`).
Arcs 1, 1b, 2, 3, 5, 6 and most of 4 are in — a derived node is picked and
clipped where it paints, follows a live drag, and can drive its own pose; stroke
markers ship; and `@weasel-js/diagram` holds the `DiagramNode` trait, ports on
the outline, the body builder, edges routed by `straight` / `orthogonal` /
`bezier`, the connect gesture, `layered` / `tree` / `force` layout, edge labels,
and a live run of any of them.

A derivation is handed its dependencies' resolved paths as well as their poses
(`DerivedDep.path`, lazy and memoized), which is what an edge label reads;
`usePoseRun` publishes a frame of poses to the override channel and commits the
run as one batch; and `SceneNode.pickable: false` keeps a body's own label from
intercepting the press that drags the body.

- **(P3) The preview channel still carries pose twice.** `move` / `resize` /
  `rotate` publish each frame to the scene's pose overrides *and* keep their own
  `previews` map behind `previewIds` / `previewPose`. The overrides are what the
  scene reads (derived geometry, picking); the map is what the ghost layer and
  the selection-chrome bounds read. Collapsing them means teaching those two
  readers to resolve through `effectivePose`, after which the map is redundant
  for pose. It cannot go entirely: `previewData` — a path-anchor drag's
  in-flight `data` — has no override equivalent, and `PoseOverride` is
  `{ pose?, alpha? }`. Decide whether overrides grow a `data` field or the two
  channels stay split by what they carry rather than by who writes them.

- **(P3) A derived node is unpickable through a bare adapter.** The
  scene-backed half of this landed: `NodeShapeEntry.silhouette` takes a `NodeSilhouetteCtx`
  carrying `derivedPath`, `kit:derived` reports it plus its `ink`, and
  `PickSource.derivedPathOf` / `buildSceneTree`'s optional argument resolve it
  where a scene is in scope. What is left is the other side of that split:
  `adapterPickSource` and `Canvas`'s bare-adapter render path cannot derive —
  it needs the dependencies' poses — so a derived node there still answers from
  its own placeholder pose. Closing it means giving the adapter surface a
  dependency read, which is a bigger decision than picking.

- **(P3) A derived path's pull covers poses only.** `resolveDerivedPath`
  value-compares its dependencies' poses on a memo hit, so a moved dependency
  re-routes with nothing pushed behind it. But a derivation is handed
  `DerivedDep`, so it can read a dependency's `data` and its `layer` too, and
  those still ride on the scene's pushed invalidation on `kit:setData` and
  `kit:setLayer`. Widening the pull to those means deciding what a derivation
  is allowed to read, not just how a pose is compared.

- **(P2) What diagram groups still cannot do.** `DiagramData.groups` draws a box around its
  members, and `layered` and `tree` keep them together (`cluster.ts`). Three things are left:
  - **Nesting.** A group is never a member of another, so a subsystem inside a system has no
    shape. The column packer would recurse: lay a group's members out as a block, then pack that
    block as one item of its parent.
  - **`force` ignores groups.** It wants an attraction toward each group's centroid, and a
    repulsion between boxes rather than only between nodes.
  - **The box cannot be dragged.** It is `pickable: false`, because a drag would write a pose
    its derivation overwrites on the next read. Dragging it should move its members, and that is
    a move action reading the box's `dependsOn`.

- **(P3) `ForceGraphDemo` is a second force-graph pipeline.** It runs d3-force through
  `useSimulation` and paints with its own render layer, beside `@weasel-js/diagram`'s `force` layout
  and `DiagramView`. `force.ts` reserves that route for graphs too big for a scene node per edge,
  but the demo has 24 nodes. Ruled 2026-10-11: it stays as its own example, of the simulation loop,
  and is not rebuilt on `DiagramView`. That leaves a graph large enough to show why the route
  exists, and a registry blurb that names the bypass.

### `useScene` follow-ups

- **(P3) Scene layout: what the first cut left.** A container declares its layout
  on its node (`ContainerNode.layout`), and the scene's one layout pass
  (`core/scene/layoutPass.ts`, run through the arrival window) applies it to every
  arrival, departure, reorder and resize, and to a layout swapped in by
  `scene.setLayout` / `createSetLayoutOp`. Still open: a declared layout is measured by
  `UseSceneOptions.layoutFrame` unless a canvas installs its handler, so a scene whose
  canvas composes poses or uses a custom descriptor states that twice — folds away once
  composition is a scene property (see the cascade entry below); and whether the `layouts` prop, now a second way to name a container's layout, should
  be retired in favor of the node declaration. Also: an op-driven edit opens the
  arrival window on a layout-less scene only when it carries a `setLayout` op, so a
  custom op that calls `adapter.setLayout` itself sets the layout and arranges nothing until
  the container's next change (reproduced 2026-10-11). Opening the window for every op-driven
  edit fixes it and breaks coalescing: the appended arrange op stays in the entry when it does
  nothing, and `scene.test.ts`'s key-multiset test fails. Wants a no-op arrange op dropped
  from the recorded entry first.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today it is adapter-level
  configuration, two mutually exclusive ways: `sceneToAdapter({ cascadeContainerPose: true })`
  translates every descendant by a container's delta through the pose descriptor, and
  `poseComposition` makes a container's pose a frame its children are relative to. `Scene.setPose`
  itself still stores absolute poses. Ruled 2026-10-11: the scene owns composition: a child's pose
  is relative to its container's frame, and moving a container writes one pose. That leaves building
  it into the scene, deciding where the composition is supplied to the `useScene` constructor, and
  settling what becomes of `cascadeContainerPose`.

### Container layout strategies

- **(P3) Reparent-on-layout-drop lives in `moveAction`, not the strategies' `commitDrop`** (which are pose-only), as does choosing the destination container (`<SceneCanvas layoutDropTarget>`, `LayoutStrategy.dropRegion`). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.
- **(P3) Nothing scrolls a `'scroll'` tile grid.** `tileGrid({ overflow: 'scroll' })` places its
  overflow past the container's last visible line and reports the region through
  `LayoutStrategy.contentExtent`, but no kit host reads it: the overflow just sits past the
  container's bounds. Ruled 2026-10-11: a container's scroll offset is view state, part of the frame
  the container gives its children, and the document never moves. An absolute-pose scene has no
  container frame today, so this waits on "Container-pose cascade as a scene-primitive semantic"
  making composition the scene's own. That leaves the offset itself, folded in by painting, picking,
  selection chrome, move, resize, and snapping with the rest of the frame, and a host that reads
  `contentExtent` and scrolls.
- **(P3) Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **(P3) Quadtree / packing layouts.** Niche enough not to belong in the generic kit; stays in eric or a future plugin.
- **(P3) Slot-based layout strategy** (rows / grid / ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle.

### Units

- **(P3) Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node.
- **(P3) Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
- **(P3) Per-axis units** — x and y carrying different units (timeline charts where x is time and y is value).

---

## Animation

- **(P2) An animated insert records a stray `'animate'` op.** In the order the site demo uses,
  `animateLifecycle(animateOnSetPose(base))`, an insert's `adapter.setPose(id, start)`
  (`packages/core/src/animation/wrappers/animateLifecycle.ts`) goes through the animating wrapper,
  which records a transform op from the final pose to the start pose before the entry tween
  interrupts it. Run 2026-10-11: one insert calls the base adapter's `applyOps` once. The lifecycle
  wrapper has no way to write a pose the wrapper beneath it will pass straight through; it needs
  one, or an entry tween that takes its start pose and writes it on registration.

- **(P2) `stagger`: delays run on wall-clock timers, so a hidden tab or a global pause collapses the
  cascade.** `CompositeHandle.schedule` (`packages/core/src/animation/stagger.ts`) uses `setTimeout`
  through the animator's `setTimer` option. The timers keep firing while the frame loop is suspended
  or the animator is paused, each factory registers a child that cannot tick, and on return every
  remaining item starts on the same frame; `animator.setTimeScale(0.5)` halves the children and
  leaves the delays alone. Only the stagger's own `pause()` (and now `pauseKey`) freezes them. The
  fix is to count each delay in the supervisor entry's virtual time and fire from its tick, which
  makes `UseAnimatorOptions.setTimer` / `clearTimer` dead public options and replaces the pause
  bookkeeping in `CompositeHandle`.

- **(P3) Timeline: a frame that skips whole laps fires them under `loop: n` and not under
  `loop: true`.** In `packages/core/src/animation/timeline/createTimeline.ts`, a frame long enough
  to skip whole laps fires every skipped lap's events under `loop: n` but none under `loop: true`,
  where `booking.ts` says crossings fire "nothing of the laps in between". Which of the two is
  meant is undecided.

- **(P3) `momentum`: a coast is not stopped by undo or by deleting its node.** A new drag of the
  coasting node now stops the coast, but an undo or a delete while it runs leaves the decay writing
  poses each frame and committing a `'flick'` transform when it rests
  (`packages/core/src/animation/behaviors/momentum.ts`). It needs a signal from the scene that the
  node's pose was written by someone else.

### Timelines and rigging

Design: `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`.
Arc context: `docs/superpowers/specs/2026-08-22-game-audio-animation-decomposition.md`.

- [x] **Timeline primitive and hierarchical rig — landed 2026-08-22.**
  `animator.timeline(opts)` (`packages/core/src/animation/timeline/`) registers
  in the animator's table, with sampled / event / nested tracks. The rig
  (`packages/core/src/animation/rig/`) ships `blendPoses`, `resolveSkeleton`,
  `IDENTITY_JOINT`, and `useRig` / `bindRig`, which drive bound scene nodes
  through pose overrides; animating one is a `SampledTrack<Pose>`. Demos:
  `apps/site/demos/TimelineDemo.tsx`, `RigDemo.tsx`.

  The follow-ups below are what is left.

- **(P3) Skinning** — per-vertex bone weights deforming path geometry. The
  renderer flattens paths to meshes, so weights must reach the vertex shader or
  be applied on the CPU per frame. Needs the hierarchical rig first.
- **(P3) Serializable clips** — follows from tracks being typed callbacks rather
  than data. Revisit with the editor's experience in hand.

### Combining animations

- **(P3) The animator on blits** — weasel has no model for two animations on one property; every
  case is last-writer-wins. Proposal: `docs/proposals/2026-09-30-animator-on-blits.md`, which keeps
  the animator's control surface and moves every value computation onto blits. Built: pose
  overrides fold through a mix (step 2), and tweens, springs, physics, decay and keyframe
  sampling compute in blits (step 3), at about 3× today's tween frame for 10k nodes, which Mike
  accepted on 2026-10-04, and 2.5–3.5× today's keyframe sampling, which Mike accepted on 2026-10-08
  (the rest of that gap is blits' read path).
  Left: steps 4–6, each needing a plan.

### Earlier deferrals

All from `docs/specs/2026-05-04-animation-primitive-design.md`. The timeline arc's
decomposition meant to absorb the first; it has not landed:

- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.

---

### labkit presentation mode

`<Lab present>`, `?present` and `usePresentation()` show one trial without any
chrome, for portfolio embeds, with a refit view, play controls and `gestures`;
README "Presenting a lab" and `packages/labkit/docs/AGENTS.md` cover it. What
is left:

- **(P2) agnew and rosee on `<Lab>`: built, waiting on a labkit release.** Each repo has an
  unpushed `lab-onto-labkit-lab` branch that mounts `<Lab>` and serves its `?bare` embed
  through presentation, with its smoke test passing. agnew's runs on labkit 1.9.2 as it is.
  rosee's needs the release carrying `<Lab clock>`, `opening`, and the empty-sidebar fix: it
  plays every tile on the lab's clock, and its `@weasel-js/labkit` range must be raised to
  that release before it can merge. agnew still plays from its own transport, because its
  three.js view advances the pen itself and holds a finished curve before redrawing it;
  moving it onto a lab clock is an agnew library change, and the owner's call.
- **(P3) A still for poster capture, and `postMessage` play/pause** so a host
  page's play control can reach a live lab.

### labkit's deprecated snapshot undo

- **(P3) Delete `packages/labkit/src/undo/undoStack.ts` and its exports**
  (`emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`, `UndoStack`) once
  sherpa's studio (`apps/studio/src/Studio.tsx`), the last user, moves its
  document undo onto `createHistory`. labkit's own trials left it 2026-10-06.

## Audio

Design: `docs/superpowers/specs/2026-08-22-audio-engine-design.md`.

- [x] **`@weasel-js/audio` — shipped, published at 1.2.0.** A leaf package with
  no weasel dependencies: lookahead scheduling on its own one-shot timer, voices
  with handles and `cancelKey`, buses with gain/mute/solo, `spatialize()`, and
  analyser taps with `bands(n)`. Registered in `build:leaves` and the `fixed`
  group. Consumed by `AudioDemo`, `SceneScrollerDemo` and `platformer/sfx.ts`.

  Its plan file has every box unchecked too; the CHANGELOG and registry are the
  record. The follow-ups below are what is left.
- **(P3) The side-scroller's music bed as engine voices.** Its footsteps and
  landings are `playNoise` voices now; the bed is still hand-written PCM
  (`platformer/sfx.ts`, `bed`). Its struck metal is expressible as `{ partials }`
  and its chugs and bass as harmonic partials with a `decay`, but the bed is an
  arrangement as much as a timbre: every hit lands late by its own amount, the
  whole loop drifts sharp and back, and the four bars are peak-normalized
  together. `createPatternPlayer` has no per-event timing offset or pitch drift,
  so a port needs those first, and a check that its busiest moments fit the
  music bus's voice limit — a lid, a lead note and a drum each ring for five or
  six sixteenths, and each metal hit is seven sources.

- **(P3) Trope-aware generative scoring.** Builds on `playNote` and `createPatternPlayer`.
  Screen scoring for factual content — news packages, documentaries — runs on a
  small, highly codified set of devices, and each one is reachable from a few
  nearly-orthogonal parameters: mode, tempo, subdivision density, articulation
  (sustained vs plucked), register spread, harmonic rhythm, and the consonance
  of added intervals. Dread is sustained low tones a minor second or tritone
  apart with no pulse; investigation is a minor ostinato that adds layers;
  wonder is Lydian with open voicings and a soft attack; urgency is driving
  sixteenths on stacked fourths and fifths. Because the parameters are few and
  mostly independent, a consumer-facing surface could be two or three axes —
  valence, tension, urgency — mapped onto them, with the score generated
  continuously rather than selected from clips.

  The mapping is tight enough to hit by accident: this demo's first music bed
  was four pure sine tones with slow envelopes, written only to loop without
  clicking, and it landed squarely on the dread cue — reported unprompted as
  "creepy" (2026-08-22). That is the evidence the vocabulary is learnable.

  Worth naming what it is: these devices work by bypassing the viewer's
  argument, which is precisely their function in the genre. Anything built here
  should let a consumer see which cue is being applied, not just hear it.

- **(P3) AudioWorklet scheduling** — immune to main-thread jank; costs a worklet
  module, cross-thread messaging and a bundling story. Revisit if jank proves
  audible.

- **(P3) audio: `onDone` fires for some endings of a voice and not others.** `PlayOptions.onDone`
  (`packages/audio/src/types.ts`, undocumented) is called only from the source's `onended` in
  `createAudioEngine.ts`, so it fires after a natural end, `stop()`, and a fade, and never when the
  voice is dropped because the context is locked or the engine disposed, when it is stopped before
  it came due, when its sound is not ready, when it fails to start, when it is stolen before
  starting, or on the stale-backlog path after a resume. A consumer sequencing one sound after
  another through it stalls silently on any of those. Ruled 2026-10-11: `onDone` means the source
  ended, and a second signal reports a voice that never played. That leaves documenting `onDone`
  that way and adding the second signal, raised from each of those paths.

---

## Selection, actions & UI panels

- **(P3) Range selection on the canvas.** `@weasel-js/select` ranges over an `order` the caller
  supplies, and a canvas has none of its own, so core's `useSelection` never ranges and keeps no
  anchor. The order could be z-order, tree order, or a layer panel's row order handed across;
  which one is the open question, not the plumbing.

- **(P3) Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.

- **(P3) apps/site never loads the kit's faces.** It imports no
  `@weasel-js/theme/faces.css` or `fonts.css`, so `--wzl-font-ui`'s Oswald and
  `--wzl-font-numeric`'s Oswald Tabular fall back to system faces in every demo.
  Left as is for now by decision; draw loads `fonts.css` since the
  numeric-helper branch.

- **(P3) Are `ToggleBar`, `ButtonBar` and `OptionsBar` one component?** They
  differ only in what a segment does, yet `ToggleBar` keeps its own copy of the
  segmented-control styles (`ToggleBar.module.css`) while the other two share
  `components/segmentedControl.module.css`. The two files agree again on
  every rule they share (`segmentedControl.browser.test.tsx` measures the
  shared one), but a fix made in one still has to be made in the other.
  What `ToggleBar` adds is a `.segmentMixed` state, a `.variant_minimal` that
  genuinely diverges (bordered box, square corners, inner dividers, `gap: 0`)
  and a `.variant_flat`. Folding the files makes the shared module a base that
  `ToggleBar` overrides through descendant selectors, which `composes` handles
  badly, so decide the component question first.

- **(P3) `@weasel-js/quantity` has no composites and no styling.** A value is one number, so a
  range (`1/64–1/2`, which `BandEditor`'s bands would want to report) or a vector readout has no
  display of its own yet; `Slider`'s thumbs still take bare numbers where `BandEditor`'s bands take
  tagged ones; and nothing styles the `data-part` spans the HTML form emits, so `PropertyField`
  still draws its suffix from its own `unit` prop.

- **(P2) Redesign the stop color/opacity swatches under `GradientEditor`.** Each stop gets
  a `ColorField` with an alpha slider in a row beneath the track (`GradientEditor.tsx`). The
  owner wants that row redesigned; the shape it should take is still open.

- **(P3) labkit's `LabSwitcher.less` menu is a fork of the weasel-ui popover skin.** It copies
  `MenuButton`'s menu and items, but with an opaque surface and a different shadow from
  `components/listbox.module.css`, which `MenuButton`, `Select`, `ComboBox` and `PaintField`
  share. Decide whether those differences are intended; if not, it wants the shared skin — and
  its items are links, which `MenuButton` has no way to render yet.

- **(P3) labkit and the apps hand-build what weasel-ui already draws.** Each differs a little
  from the ui component, so swapping changes pixels and needs a call on which look wins:
  labkit's `.lk-viewport-controls__button`, `.lk-toolbar-button` and `.lk-titlebar-button`
  against `Button`'s ghost icon button; labkit's `StatusBar` and `DragGhost` against the ui
  ones of the same name; `SidebarRegion`'s section head and undock button against
  `SidebarPanel`; `LabHeader`'s bare "Add trial" button beside the `MenuButton` it becomes
  with more than one instrument; the theme editor's
  swatch tabs against `ToggleBar`'s flat variant and its hex and number inputs against `Input`
  and `NumberField`.

- **(P3) The site's chrome colors come from its own `--ckd-*` palette, not theme tokens.**
  `canvas-kit-demo.css` declares `--ckd-*`, and it and the demos' stylesheets read them directly, so
  the site ignores light mode and any theme a reader picks. Its `:root` block already feeds most of
  them into `--wzl-*` (`--ckd-text` → `--wzl-fg`, `--ckd-muted` → `--wzl-fg-muted`, …), but
  `--ckd-bg` and `--ckd-surface-2` have no counterpart there, and `--ckd-accent` /
  `--ckd-accent-dim` split what `--wzl-accent` means. Ruled 2026-10-11: the site follows the
  reader's mode and theme through the theme tokens, and gives up its fixed dark look. That leaves
  picking tokens for those four, moving the stylesheets off `--ckd-*`, and dropping the
  `color-scheme: dark` that pins `canvas-kit-demo.css`.

- **(P3) Overlays still set React Aria's deprecated `UNSTABLE_portalContainer`.**
  Its replacement, `UNSAFE_PortalProvider`, is exported by `react-aria` but not
  re-exported by `react-aria-components` 1.18, and depending on `react-aria`
  directly risks a second copy whose context the overlays never read — which
  fails silently, as an unthemed overlay. Switch `useOverlayPortal`
  (`packages/ui/src/overlays/portalHost.tsx`) to the provider once RAC exports it.
  The same switch lets a contained `ToastRegion` drop its own region for RAC's,
  which would make it an F6 landmark again. Still absent from RAC's index at
  1.21.1 (still `latest`) and at nightly `3.0.0-nightly-99e610236-261006`,
  checked 2026-10-07.

- **(P3) The grammar names no hover gesture.** The loupe now routes its peek key
  and its wheel through the dispatcher, but aiming the lens is still a plain
  `pointermove` listener in `packages/labkit/src/loupe/useLoupe.ts`, because
  `GESTURE_DESCRIPTORS` has no continuous-motion entry. Every other consumer that
  wants to follow the pointer without a press — a coordinate readout, an
  eyedropper preview, a hover ruler, `CustomShaderDemo`'s cursor-following
  panels — hand-attaches the same listener. Adding one
  is an input-taxonomy change: it has no press to own, so it cannot be an ongoing
  action, and `docs/taxonomy.md` would need to say what a hover binding claims.

- **(P3) Split `Properties.module.css`.** It is 73 KB and styles the panel, list, rows, group,
  subpanel, cards, and every field in one file, with three generated stance blocks inside it. Its
  header says the rules that cross components (`.listPairs > .subpanel`,
  `.groupBody > :not(.rowColor)`) are why it is one module. Wants those few shared names in one
  small module the rest compose from, and each component's rules beside the component, as
  `PropertyHelp.module.css` already is.

- **(P3) An isolated forge story may still log react-aria's "`<Focusable>` child must be
  focusable".** The warning fires when a `Focusable` mounts under `visibility: hidden`, which is
  how forge held a story until its first paint; a story in the workshop page is now held by
  opacity instead. `.fg-frame-view[data-pending]` still hides an isolated story's iframe by
  visibility, and whether that reaches the check inside the frame was not looked at.

- **(P3) labkit's palette drag-drop runs its own pointer session.** A trial's
  pan, zoom, tap and loupe route through weasel's dispatcher (`CameraInput`),
  but dragging a palette item onto a canvas is `useDragDrop`
  (`packages/labkit/src/dragdrop/DragDropRuntime.tsx`): a press in the sidebar
  that ends over the canvas, which no binding on the canvas's dispatcher sees
  begin. Routing it needs a drag that starts on one element and drops on
  another — the same shape `ingest` answers for an OS drag.

- **(P2) Things that look duplicated in this engine and are not.** Left from the
  2026-08-29 duplicated-cascade audit, whose findings all landed — `git log` and
  `.changeset/` are the record. This list is the other half: pairs a future audit
  will flag again, and the reason each one stays two.

  Local- vs world-space bounds, and `nodeAtPoint` vs `pickBest`, are different
  questions. Miter apex vs capsule, and butt cap vs half-disc, are a defensible hit
  model over shared base geometry. `unionBounds` stays rotation-free beside
  `unionAABB` for commit-time actions that write poses back in the unrotated frame.
  SVG's `#000000` initial fill is a spec default, not drift. `resolveNodeFill`'s
  split between `kit:path` and `kit:shape` is documented and correct.
  `useBuiltinShapeTools`' nine hook calls are not a list, and are already
  compiler-linked through the return type. `arrayAdapter` has no `setChildOrder`
  because its root order *is* the item array's order. `sceneToAdapter`'s area walk
  returns containers where the live marquee dep does not — one flag on the shared
  walk, because a bare-adapter consumer has no selection parent-folding to fold
  them back in.

  From the 2026-09-28 geom-adoption audit of labkit, modes, d3, paint and ui:
  labkit's camera (`worldToScreen`, `zoomAt`, `centerOn`, `clampZoomAbout`) is a
  pan/zoom/`yDir` view model, not affine kernel math. labkit's `fitView` anchors at
  the origin where `TrialOverview`'s `fitRect` centers with padding. `toShape`
  collapses a zero-size axis to 0 where `boxToBox` keeps scale 1, and Plot2D's
  `modelToPlot` fails on a zero range where `boxToBox` would silently not scale.
  `toDeviceRect` is a y-flip plus device-pixel snap. Badge's `polygonSampler`
  parameterizes a polygon by CSS-pixel arc length under the viewBox's anisotropic
  scale, and Powerline carries its own normals. paint's `lerpHueDeg` is CSS Color 4
  hue interpolation, not angle geometry. CurveEditor's Catmull-Rom and monotone
  splines are curves geom does not have, and its bezier easing already goes through
  geom's `cubicBezierEasing` (via core). The scalar `Math.max(lo, Math.min(hi, v))` clamps
  scattered through ui and labkit are not geometry; geom has no scalar clamp. d3
  and modes do no geometry at all.

- **(P3) Confirm Safari's trackpad pinch in real Safari.** `useGestureDispatcher`
  dispatches WebKit `gesturechange` as a `pinch` gesture, which `viewport.zoom`
  binds, and swallows ctrl+wheel while a claimed gesture is live. All of it is
  tested in jsdom against a stand-in event. Unverified: that Safari fires
  `gesturestart` before the first ctrl+wheel copy (if it does not, that first
  sample zooms once through the wheel binding), and that preventing
  `gesturestart` / `gesturechange` stops the page zoom in the Safari versions
  that send both channels.

- **(P3) Reconcile `BandEditor` with `Slider`.** `BandEditor` (bands: a contiguous tiling of an axis, seams draggable, each band carrying a payload) ships alongside `Slider` (a thumb list on an axis, `constraint: 'ordered'`, `onAddThumb`/`onRemoveThumb`, `renderTrack`). Under a contiguous tiling the two are the same control — N seams determine N+1 bands, so seams *are* an ordered thumb list — and they were kept separate deliberately: bridging them means teaching `Slider` about the region *between* thumbs (payload, hit-testing, selection), which is the wider change the reconciliation actually requires. The other trigger is `Slider` needing a non-linear axis. A third option arrived with `windease` 1.0 (2026-08-20): its `LayoutStrategy` is public API — `layout()` returns placements plus affordances, `reduce()` folds a gutter drag into strategy state — so a band control is a strategy you write rather than a control you build, and it brings widened gutter grab targets, `affects` for lock suppression, and — as of 1.2.0 — keyboard-operable gutters with it (`role="separator"` with the value triple, arrows plus Home/End, each keypress synthesized into the same drag event the pointer sends so the strategy clamps once). It ships no band strategy of its own: the two built-ins are `gridStrategy` and `stripStrategy`, and strip is `LayoutStrategy<void>` whose gutters are single-child `resize-x` affordances writing pixel `placement.size`. Mapping domain values onto seams is still the consumer's. Note `Slider` is the former `RangePicker`; its spec carries a banner saying so.

- **(P3) The color literals with no token equivalent.** Arc 4 tokenized what had a token and
  left the rest rather than inventing a mapping — `check-design-tokens` covers size, weight,
  radius and the stray danger reds, but not color generally, for that reason. What remains is
  `Badge`'s status palette (`#7ab8d4`, `#d4a574`), the `GradientHandles` and `Keycaps` literals,
  and roughly 70 `rgba()` values that are depth geometry (box-shadow insets, gloss gradient
  stops, the dialog scrim) for which the theme ships no shadow, gloss or scrim token. Each needs
  a semantic name before it can become one.

- **(P3) `<ToggleBar>` polish.** Shipped to `@weasel-js/ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

- **(P3) Two CurveEditor handles are still literals.** The `--wzl-handle-size`
  family covers the 45°-rotated squares; the round ranks did not fold into it,
  because a radius is not a diamond edge. The plain anchor circle (`r={4}` in
  `createFunctionLayer`) and the bezier control handle (`HANDLE_RADIUS = 3.5` in
  `createKeyframeLayer`) are the two left. Either add `--wzl-handle-dot-size`
  for the round ranks or restate the family in terms of diameter — it is a
  visual call that wants a browser.


- **(P3) ToggleBar's selected segment is the Aqua glass ramp, not a color of its own.** Asked for:
  move the default treatment off "the aqua" and save it for a theme that wants it. There is no
  ToggleBar color to move — every surface in the ramp is `var(--wzl-accent)`, which seventeen
  components read, and `Button.variant_primary` is the same drawing. The panel's bars already sit
  outside it via the `flat` variant. Ruled 2026-10-11: the default theme draws selected and primary
  controls flat everywhere, `Button`'s primary included, and the glass becomes something a theme
  opts into. That leaves the flat default for everything drawn with the ramp, and a seat in the
  theme that turns the glass on.

- **(P2) Disable a pref by the values of others.** A leaf has no way to say "off while
  `snap.enabled` is false": nothing on `PrefLeaf` reads another leaf's value, and the forms have no
  disabled row. The condition has to be data, since a schema exports as a literal and survives a
  draft, so it is an expression over other leaves' paths and not a function. CEL is a candidate
  for that expression; nothing in the repo uses it yet. Covers `PrefsForm`, `SelectionPanel`,
  `Bar`, and labkit's `ControlPanel`, and an attribute for it in `PrefSchemaEditor`.

- **(P3) What a bar does not do yet.** `ActionBar` is not built on `Bar`: its `icons` prop
  overrides an entry's icon with a `ReactNode`, which a leaf, being data, cannot carry, so it needs
  that prop to become icon names or `Bar` to take icon overrides by path. A bar too long for its
  room scrolls, with no overflow menu. A group a standalone `Bar` opens from a button draws as
  labeled rows whatever its `as`, where a bar in a `PrefsForm` opens it in its own form.

- **(P3) `PrefSchemaEditor` clears required custom attributes.** Emptying an attribute removes
  it, which is right for optional built-in attributes but deletes a custom kind's required one —
  `registry-enum`'s `source` on WeaselDraw's `#/dev/prefs`. `CustomKinds` has no way to mark an
  attribute required; it needs one, and `blankLeaf` should seed those attributes for a custom kind.
  The same gap leaves a leaf switched to a custom kind with `default: undefined` and no Default row
  unless the kind's entry declares one. A type made with `prefType` has no such gap, carrying its
  own default.

- **(P2) `PrefSchemaEditor`: an unset Auto value reads as "not set" and as a value at once.** The
  row is drawn through `PrefsForm`'s own auto state (`AttributesPane.tsx` passes
  `auto={UNSET_AUTO_VALUE}` and substitutes the leaf's default as the value), so its label is a pin
  button, the words "not set" sit beside it, and the control under them shows the default at full
  strength: `Auto value not set [8]`, or a ticked checkbox. Nothing says the 8 is the default and
  not something stored, and the way to set or clear it is the label, which does not look like a
  control. Ruled 2026-10-11: a switch sits before the control on the same row, and the control is
  disabled until the switch is on. That leaves drawing the row that way in `AttributesPane.tsx`, for
  every kind, in place of the auto state.

- **(P3) `PrefSchemaEditor` layout rough edges.** The always-mounted notice row adds one grid gap
  above the attributes pane, and the Key/Kind rows are wider than the attribute form under them.
  Seen on `#/dev/prefs` at 1440×900.

- **(P3) `PrefsForm` two across: a spanning leaf's rows line up with neither column.** Seen
  2026-10-11 in headless Chromium, rail layout, `rowsAcross={2}`, pane 443px wide. An object or
  list leaf spans both columns, and its inner rows start at about 60% of the pane, under neither
  column's labels nor its controls.

- **(P2) `PrefSchemaEditor` layout by dragging, what is left.** A `label` and a `separator` are kinds only
  `PrefsForm` and a bar draw: `SelectionPanel` and labkit's `ControlPanel` show each as an unknown
  kind, `prefFieldChoices` offers each as a field, and `@weasel-js/prefs` does not know either kind.
  The editor's attributes pane still offers a separator a description, which nothing draws, and a
  name, which only the editor's own structure tree shows as the row's label.
  `PrefsForm.drop.browser.test.tsx` checks the form's drop target and reflow in a real browser; no
  test in the repo drives a pointer through the editor itself. Palette, row, rail, and tree drags
  were driven through a headless browser on astv's page and on the editor's story on 2026-10-10.

- **(P3) `subPages` and `foldable` overlap a group's `as`.** `PrefsForm`'s form-wide `subPages`
  and `foldable` props decide what `as: 'page'` on a nested group and a folding panel should;
  fold both into `as`. `as: 'page'` means nothing where there is no rail (`ControlPanel`, the
  columns and list layouts, any `PrefSection`) and draws as the default there.

- **(P3) `PrefSchemaEditor`: a drag begun in the structure tree shows the tree's rows as its ghost over the live preview.** A
  palette drag and a drag begun in the preview show the node as the form draws it (`NodeGhost`). `Tree` draws its
  own ghost and has no way to be handed one, so it needs a prop for what to draw, and for when the drag has left it.
  Over the preview that ghost now also sits on top of the node the form draws where it would land; the palette's and
  the preview's own ghosts step aside for it (`drawsNode`).
- **(P3) `PrefSchemaEditor`: several nodes at once, what is left.** The Unplaced tree selects one row, and a
  click there replaces a selection of several; a drag out of it or out of the palette carries one node
  (`onPaletteDrop` takes one). Add alias and an alias drag act on one pref and are off with several selected.
  Shift does nothing in the live preview, where a range across pages has no clear meaning. A range taken upward in the tree leaves the newest path, which leads, at the range's far end.

- **(P3) `PrefSchemaEditor`'s properties-panel preview ignores the selection.** For a group
  schema the tree and the live preview select and scroll to each other, through `PrefsForm`'s
  `selected`/`onSelect`. A section schema previews through `SelectionPanel`, which has neither.

- **(P1.5) Two of a labkit schema's common attributes can only be code.** `.showIf` takes a
  function and a number's `unit` is an object of `toDisplay`/`fromDisplay` functions, so neither
  can be written to JSON, set in `PrefSchemaEditor`, or kept in a draft (a draft holds code as a
  pointer into the source schema, which a new leaf has none of). In astv's settings nearly every
  `showIf` is one comparison against another setting (`c.mode === 'commits'`,
  `PLATED.has(c.layout)`), and every unit is an identity conversion carrying a suffix. Proposed,
  not agreed: `showIf` also takes a condition as data, and a unit may be `{ suffix, accepts }`
  with the conversion implied; the function forms stay for what data cannot say.

- **(P3) A rail does not see through a fragment.** A page nested in an `as: 'fragment'` group gets no rail entry
  and is drawn as a section where the fragment sits, the same as a group nested in a tab or a panel. If a fragment
  is to be a pure macro, `prefRailItems` and `RailLayout`'s `ownOf` would treat its children as its parent's.
  Its element has no box (`display: contents`), so a drag in `PrefSchemaEditor`'s preview cannot land beside or
  into the group itself, only beside the rows inside it; the structure tree takes both.

- **(P3) `PrefSchemaEditor` sees only a `ResolvedConfig`'s `group`.** A schema built with
  `f.section` keeps its sections, `showIf` rules, `.render` overrides and `.dialog` rows beside the
  `PrefGroup` tree, not in it, so the editor shows a sectioned schema as one flat list and its
  export drops all four. Seen on astv's `/prefs-schema.html`, whose settings are sectioned rather
  than nested because `f.group` would move their config paths.

- **(P3) `sectionTree` doesn't lift heading controls.** `ControlPanel` draws a `.heading()` leaf,
  or a first row repeating its heading ("Pump" under "Pumping"), in the heading's title row and
  warns about the repeat. The prefs rail `sectionTree` feeds to `PrefsForm` still draws that leaf
  as a row under a heading of the same name, and doesn't warn, because `PrefsForm` has no slot for
  a control in a rail item or subsection heading.

- **(P3) labkit's lab store treats an unread record cache as final.** It opts out of the cache's
  retries (`retryMs: false` in `openLabStore.ts`): `readLab` answers an unwritable cache with an
  empty lab, so records landing later would skip its migrations and its fold of the old storage
  keys. `whenRead()` on the cache now says when a late read lands, which is where that work would
  rerun. Ruled 2026-10-11: a stored lab that arrives late is migrated whole, then merged trial by
  trial into the lab built while storage was away. That leaves running `readLab`'s migrations and
  fold on the late read, then applying the result by trial id, the way `bindLabStore` already
  applies another writer's records. The opt-out also turns off the timer that resends a write
  storage rejected, which then waits for the next flush.

- **(P3) An older build's pref that lands after its `$version` is taken unmigrated.**
  `watchPrefsVersion` migrates another writer's records when the version it wrote arrives, so a
  record of that writer's delivered afterward is held in the older shape for the session. Read
  from the code, not reproduced; an adapter that delivers a writer's batch out of order is what
  it would take.

- **(P3) A Windows 9x theme.** Gray 3D bevels, a navy-to-blue gradient title strip and the
  system's pixel faces, as a full theme beside Interstellar rather than a one-component skin. Its
  titled groups want a titlebar frame motif (a solid title strip across the top), which was left
  out of the first set of frame motifs for this theme to bring.

- **(P3) A classic Mac OS theme.** Which era it follows, System 7's one-bit look or Mac OS 8–9's
  Platinum, is the first decision.

- **(P1.5) `@weasel-js/ui` names colors as raw CSS strings, not `ColorSource`.** `@weasel-js/paint`'s
  `ColorSource` (a literal, a `ColorRef` like `{ ref: 'accent' }`, or a function, resolved by
  `resolvePaletteColor`) is the kit's color type, but only core's renderer uses it. In the ui package
  every color prop is a string passed through as CSS: `StanceProps.tone` (`number | string`, the
  number indexing the theme's tone list), `Plot2D`'s series colors, `CurveField`'s band and line
  colors, `createFunctionLayer`'s `color`, `Badge`'s effect colors. So a palette name has no way into
  any of them, and the UI and the renderer name colors two ways. Adopting it means giving the theme
  context a `Palette` (or an `ExternalColors` resolver onto its ramps; `ThemeProvider` hands out tones
  only as a `ColorList` today) and resolving every one of those props through it.

- **(P2) labkit stored lab: one trial whose state fails to hydrate takes the whole lab down.**
  `deserializeTrials` (`packages/labkit/src/state/helpers.ts`) calls each instrument's `deserialize`
  with no guard, and `hydrateTrials` runs `migrateConfig` the same way, so one stored trial that
  either throws on rejects the whole `openLabStore`; the lab now shows that error through its error
  boundary on every load, and the trials that were fine are unreachable. The document-level path
  beside it quarantines and stops writing; the per-trial path does neither. Wanted: hydrate each
  trial in its own try/catch, keep the raw record so it is not overwritten, and decide what the tile
  shows (a failed tile with a way to discard it, or the lab minus that trial plus a warning).

- **(P2) labkit trial: the settings panel and the instrument write config through two `setConfig`s
  that disagree.** The chrome's (`packages/labkit/src/trial/TrialChrome.tsx`, used by the settings
  panel and by chrome contributions) calls the instrument's `onConfigChange` but takes no undo
  snapshot; the instrument's own `ctx.setConfig` (`renderCtx` in
  `packages/labkit/src/trial/Trial.tsx`) snapshots on `config.change` and `config.change:<path>` but
  never calls `onConfigChange`. So an instrument declaring `undo: { snapshotOn: ['config.change'] }`
  gets no undo entry for anything changed in the settings panel, and one declaring `onConfigChange`
  gets no derived state for its own writes. Wanted: one `setConfig` owned by the trial runtime that
  snapshots, writes, and runs `onConfigChange` against the stored record, handed to both contexts.
  The open calls: whether a panel edit should snapshot per write or once per gesture (a slider drag
  writes on every move), and whether an instrument's own write should run `onConfigChange`.

- **(P3) labkit lab: every trial re-renders whenever any trial's record changes.** `LabContext`'s
  value carries `trials` (`packages/labkit/src/lab/Lab.tsx`), and both `Trial` and `TrialChrome`
  read that context, so a pan frame, a job item, a clock write, or a mark save in one trial
  re-renders all of them. `CanvasStack` no longer repaints on it, but the React work remains, and
  `as2DView` (`packages/labkit/src/state/view.ts`) still allocates a view per render for every other
  reader. `LabContextValue.trials` is public, so splitting it out (a separate context, or a selector
  hook over the store, with the commands in a value that does not change) is an API decision.

- **(P3) labkit transport: on a looping clock, End and a scrub to the far right land at the start of
  the next pass.** `transportControl.seek` (`packages/labkit/src/clock/transportControl.ts`) clamps
  to `[0, duration]` and seeks `passStart + duration`, which a looping clock reads as phase 0 of the
  next pass, so the playhead shows at the left edge; with a counted loop (`loop: 3`), repeated End
  presses walk through the passes and end the run. The last pass is right as it is. The call to make
  is where "the end of a pass that another follows" sits: a fixed step short of `duration` (and how
  short, given `seek` takes ms and the pass can be any length), or a clock-level notion of "end of
  pass n" that reports phase 1 without rolling over.

- **(P3) labkit canvases: a device-pixel-ratio change with no resize is not noticed.**
  `useTiledSurface` (`packages/labkit/src/surface/useTiledSurface.ts`) compares `devicePixelRatio`
  only inside a frame something else scheduled, and `CanvasStack`
  (`packages/labkit/src/canvas/CanvasStack.tsx`) reads it only from its `ResizeObserver`; a
  content-box observer does not fire when a window moves to a display with a different ratio and its
  CSS size stays the same. Read from the code, not reproduced: the shared buffer and the layer
  canvases would keep the old backing size (blurry or oversampled) until something resizes. Wanted:
  one `matchMedia('(resolution: <n>dppx)')` listener, re-armed on each change, that calls
  `invalidateRects()` and the stack's size update, with a browser test that emulates the ratio
  change.

- **(P2) labkit trial: marks drawn in another tab never appear, and the next local mark erases
  them.** A trial builds its annotation store once from `record.annotations`
  (`packages/labkit/src/trial/Trial.tsx`, "One store for the trial's lifetime") and never reads the
  record again. When another tab's write replaces the record (`bindLabStore` in
  `packages/labkit/src/state/openLabStore.ts`), this tab's state and config update on screen and its
  marks do not; its next mark then saves `annotations.toJSON()` over the other tab's. Options:
  rebuild the store when the record is replaced by a remote write (losing this tab's mark undo
  history, as the remote path already does for state history), remount the trial on a remote
  replacement, or merge mark by mark, which needs an answer for a mark both tabs edited.

- **(P3) `SelectionPanel`: which node properties read an absent value as their default.** A leaf
  with `absentIsDefault` draws its default where a node holds nothing, and is not Mixed beside a
  node that holds that default. Only `pose.rotation` in `defaultNodeProperties` carries the flag.
  Left: going through the other leaves of `defaultNodeProperties` and `inferredNodeProperties` for
  fields the engine reads with `??`, and flagging those; a leaf whose absence means the node has no
  such property (`data.stroke` on a text node) must stay unflagged.

- **(P3) An object leaf is drawn by two implementations that disagree.**
  `packages/ui/src/components/Prefs/ObjectLeaf.tsx` and `ObjectLeaf` in
  `packages/ui/src/components/SelectionPanel/renderLeaf.tsx` each walk rows, sections, and tabs and
  each own a write-back rule. They differ on the base for a field write when no object is held
  (`fromScalar ?? {}` against `fromScalar`, then a copy of `pref.default`, then `{}`; the panel's
  comment says `{}` once crashed the painter), on `as: 'bar'`, on `pair` rows, and on heading
  levels. Home: one object-leaf walker in `Prefs/` taking the per-surface parts
  as arguments (how a field's value and mixed state are read, how a row is framed), with the
  write-back rule as a pure function in `@weasel-js/prefs`.

- **(P3) A list leaf is drawn in three places, and the plain-text shortcut is written twice.**
  `Prefs/ListLeaf.tsx` keeps `ListEditor`'s own text fields when the item is a string with no
  `string` renderer and is not a `textarea`; labkit's `ControlPanel.tsx` (`LeafRow`, the `COMPOUND`
  branch) repeats the test; `SelectionPanel/ListLeaf.tsx` has no shortcut, so Enter-to-add and
  Backspace-to-remove are absent. The form substitutes `item.default` for an `undefined` entry and
  the panel marks it unset. Item renderers are looked up by kind only in all three, though
  `SelectionPanel` looks up by path first everywhere else. Home: `Prefs/ListLeaf`, with the shortcut
  test exported as one predicate.

- **(P3) Which control a leaf gets is decided again in each params surface.** `prefFieldProps` is
  the shared half; each caller then overrides it: `Prefs/PrefsRow.tsx`,
  `SelectionPanel/renderLeaf.tsx` (`renderBuiltin`), labkit's `controls/fields.tsx` (`labField`) and
  `controls/ControlMatrix.tsx`, and `packages/labkit/examples/schema-lab/prefsToFields.ts`. The
  answers differ: a boolean with no `control` is a checkbox in the form and labkit and a switch in
  the panel; `control: 'toggle'` on a boolean is a checkbox in labkit; a `slider` number with no
  bounds is a 0..100 slider in ui and a typed input in labkit (`isSliderLeaf` wants both bounds); an
  enum's `radio` is segments in labkit and `menu` is a select; `font-family` and `font-weight` get
  "no control for" in labkit because `labField` gates on `isBuiltinPref` before `prefFieldProps` can
  answer; a stored value that is absent is the default in the form, unset in the panel, and `??
  default` in labkit, where `null` also reads as absent. The icon lookup against `ICON_PATHS` is
  written four times (`Prefs/prefField.tsx`, `Bar/renderBarLeaf.tsx`, `useLeafAction.tsx`,
  `SelectionPanel/renderLeaf.tsx`). Home: a `surface` argument on `prefFieldProps` (`'form' |
  'panel' | 'lab'`) carrying these defaults in one table. labkit's "radio means segments" and "a
  slider needs bounds" are the two to decide on purpose.

- **(P3) When an edit is written differs by params surface, with no one place saying so.** A typed
  number writes on blur, Enter, or step in `PrefsForm` and `SelectionPanel`, and on every keystroke
  in labkit's `ControlPanel`; a slider writes on release in the form and on every move in the other
  two; text writes per keystroke in the form, on blur or Enter in the panel, and debounced 150 ms in
  labkit; a color writes once per gesture in the form and panel and on every move in labkit. Each is
  a no-op `onInput` passed or withheld, and `settledOnly` is declared twice (`Prefs/PrefsRow.tsx`,
  `SelectionPanel/renderLeaf.tsx`). The panel's comment gives undo steps as the reason text and
  color settle, yet a slider there writes per move; whether `scene.batch` coalesces those into one
  undo step is unverified. Home: the same `surface` argument on `prefFieldProps`, returning props
  with the commit policy applied.

- **(P3) Collecting a run of `tab` groups, and what each other `as` draws, is written five times.**
  `Prefs/PrefsPane.tsx`, `Prefs/ObjectLeaf.tsx`, `SelectionPanel/SelectionPanel.tsx` (`drawn`),
  `SelectionPanel/renderLeaf.tsx` (`rowsOf`), and labkit's `ControlPanel.tsx` (`rowsFor`).
  `GroupTabs` is shared; the run logic is not, and it differs: `panel` is a bordered box in ui and a
  plain `PropertyGroup` in labkit; `section` is a `Subpanel` in labkit and a heading elsewhere; a
  group's `description` shows under a tab in `PrefsPane` and is dropped for tabs and sections in
  labkit; `SelectionPanel`'s top level flattens nested sections (`flatten` in `model.ts`), so a
  nested `tab` or `panel` loses its `as` while the object leaf beside it honors nesting; an empty
  tab section neither joins nor ends the run in `renderLeaf`, a hidden one does not end it in
  labkit, and `PrefsPane` has no emptiness check. Home: a pure "children as runs" helper in
  `@weasel-js/prefs` (leaf, tab run, or group with its resolved `as`) that all five walk.

- **(P3) Merging `pair`ed leaves into one row is written three times.** `pairRows` in
  `SelectionPanel/model.ts`, `rowsOf` in `SelectionPanel/renderLeaf.tsx`, and `rowsFor` in labkit's
  `ControlPanel.tsx`. `pairRows` drops `pair` from a row left with one leaf; the other two keep it,
  so a lone paired leaf is labeled by the pair and loses its own name. `effectiveSections` filters
  leaves after pairing and does not re-run that drop, so a multi-kind selection whose intersection
  keeps half of a pair draws a row labeled for the pair holding one field, and a lone `toggle`
  boolean there becomes a one-segment flag bar. Home: `pairRowsOf` in `@weasel-js/prefs` returning
  the rows, not only the lookup map.

- **(P3) The compound leaf kinds are named in plain string sets a new kind compiles past.**
  `SEVERAL` and `ROWS` in `Prefs/compound.ts`, `OPENS` in `Bar/renderBarLeaf.tsx`, `COMPOUND` in
  labkit's `ControlPanel.tsx`, and a literal test in `Prefs/schema.ts` each list kinds as
  `Set<string>`. A kind added to `PrefKind` compiles, then draws inline in a `<label>`, does not
  open in a bar popover, and gets no dialog row in labkit. Home: one `Record<PrefKind, { compound:
  boolean; several: boolean }>` in `@weasel-js/prefs`, which is a compile error to leave a kind out
  of. Separately, `font-family` and `font-weight` are drawn as built-ins by ui and are absent from
  `PREF_KINDS`, so the table's promise in `packages/prefs/src/schema.ts` does not cover them and
  labkit declines them.

- **(P3) The schema lab's `prefsToFields` re-derives what `@weasel-js/prefs` owns, and gets a unit's
  step wrong.** `packages/labkit/examples/schema-lab/prefsToFields.ts` converts `min` and `max` with
  the unit's `toDisplay` and passes `step` through unconverted, so a leaf stored in radians and
  shown in degrees with `step: 0.01` steps by 0.01 degrees; a decreasing conversion yields `min >
  max`. `prefDisplayBounds` converts the step as a distance and swaps flipped ends.
  `decodePrefValue` there applies an enum `encoding` and not a boolean one, and a `field` leaf
  becomes free text. Not hit today, since the lab's schema is the rect's. The example exists to show
  the API, and `ControlPanel`'s `fields` prop is marked deprecated in favor of `schema`: pass the
  schema, which goes through `prefFieldProps`, and delete the file. Not a drop-in today: an
  instrument's `config` takes labkit's own `ConfigSchema` (`packages/labkit/src/config/types.ts`),
  and nothing turns a `PrefSection` with dotted keys into one or into a `ResolvedConfig`, so the
  example first needs a way for an instrument to declare its config as a pref schema.

- **(P3) Three params files hold several owners each.**
  `packages/labkit/src/controls/ControlPanel.tsx` (about 810 lines: panel, auto state, reset, row
  dispatch, paired rows, debounced text row),
  `packages/ui/src/components/Properties/PropertyField.tsx` (about 740: the row component and every
  kind's control), `packages/ui/src/components/SelectionPanel/renderLeaf.tsx` (about 690: cells,
  flag bar, built-in dispatch, object leaf), and `Properties.module.css` (about 1,575). Split:
  `ControlRow`, `LeafRow`, and `PairedRow` into their own file, which `ControlMatrix` already
  imports from the panel; one file per control kind under `Properties/`, each with its CSS;
  `ObjectLeaf` out of `renderLeaf`.

- **(P3) `watchPrefsVersion`: a same-version peer's record is migrated again when a lower `$version`
  arrives later.** `packages/prefs/src/migrate.ts` adds every remotely changed record to `theirs`
  and clears the set only after a migration runs. A peer tab on this build changes `view.density`;
  later any writer sets a lower `$version` (an older tab's late write, a restore), and the
  migrations run over `view.density` although it was already in this build's shape, so a doubling
  migration doubles it. Clearing `theirs` when a batch arrives at the current version is not a fix:
  an older build that writes its record first and its `$version` second produces the same two
  events, and that case must migrate (`migrate.test.ts`, "migrates the records an older writer
  leaves"). The two can only be told apart by knowing which version each record was written at.
  Ruled 2026-10-11: each stored record is stamped with the version it was written at. That leaves
  the change to the stored shape, a reading for a record that an already released build wrote with
  no stamp, and migrating by the stamp in place of `theirs`. Shares its cause with "An older build's
  pref that lands after its `$version` is taken unmigrated", the opposite ordering.

- **(P3) A clearable enum whose `default` is not `undefined` cannot be cleared.** `store.set(path,
  undefined)` now unsets the leaf, which for a default of `undefined` is the cleared state. For a
  clearable enum with any other default, clearing in a `PrefsForm`
  (`packages/ui/src/components/Prefs/prefField.tsx`, `onClear`) puts the leaf back on its default,
  so the lit segment moves to the default option instead of going dark. Ruled 2026-10-11: a
  clearable enum cannot have a default other than `undefined`, so a missing value stays the only
  stored form of cleared. That leaves rejecting the pair in the schema type
  (`packages/prefs/src/schema.ts`) and fixing any schema that declares it.

- **(P3) `PrefSchemaEditor`: under a node property schema, two prefs can be given one value path.**
  A key is checked only against its siblings (`keyProblem`, `uniqueKey` in
  `packages/ui/src/components/PrefSchemaEditor/schemaEdit.ts`), but under a section root a leaf's
  key is the path its value lives at, whichever section holds it. Alt-drag `pose.x` from Layout into
  Appearance and both sections hold a full leaf keyed `pose.x`; Add pref with Id `pose.x` in another
  section is accepted the same way; a copy into the same section is numbered `pose.x2`, a path no
  node has. No row says so, and `setDefaults`' `leafHolding` takes the first match, so a preview
  edit of the second writes the first's default. To decide: refuse a key any leaf under the root
  already holds (an `alias` is the way to show one value twice), or allow it and mark both rows.
  Refusing also has to say what a copy does under a section root: a copied leaf, and every leaf
  inside a copied section, has no other key to take (`copyNodes`), so the copy is refused outright
  or becomes an alias.

- **(P2) `PrefSchemaEditor`: Add alias and an alias drag make an alias of a field inside an `object`
  pref.** Extends the `alias` entry above, which covers the `Of` picker offering the same fields.
  `canLand` in `StructurePane.tsx` allows any leaf that holds a value, and `aliasOf` names it by
  `valuePathOf`, so under a group root the alias gets `obj.field`, which no reader resolves, and
  under a section root it gets the bare field key (`cap` for `data.stroke.cap`), which is the wrong
  path as well. Ruled 2026-10-11: a field inside an `object` pref cannot be aliased. That leaves
  refusing the alias for a leaf whose parent is an `object` leaf, in the button, the tree drag, and
  the preview drag (`usePreviewDrag`'s `aliasable`). `valuePathOf` is also wrong for anything under
  a section inside an `object` leaf of a group root, where it counts the section's key as a step.

- **(P2) `PrefsForm`: a mixed object, list, map, or union leaf draws as unset, and one edit
  overwrites every node's whole value.** `mixed={new Set(['appearance.stroke'])}` on an object leaf
  draws each field at its default, not mixed, because `ObjectLeaf`'s `fieldCtx`
  (`packages/ui/src/components/Prefs/ObjectLeaf.tsx`) passes no `mixed` down; changing `width` then
  calls `onChange('appearance.stroke', { width: 3 })`, which an owner writing to every node uses to
  drop each node's other fields. `renderBuiltin` in `PrefsRow.tsx` likewise never passes `mixed` to
  `UnionPicker`, and a mixed list or map reads as `None`, where `Add` writes a one-entry list over
  all of them, and a mixed union shows "Choose option…". Passing `mixed` down to the fields is the
  small half. The other half is the write: `PrefsForm` knows only that a path is mixed, not the
  values behind it, so a field edit cannot build a whole object. Ruled 2026-10-11: `mixed` names
  field paths (`appearance.stroke.width`), and a field edit calls `onChange` at the field's own
  path, which leaves each node's other fields in the owner's hands. That leaves both halves, and a
  drawn state for a mixed list or map; `SelectionPanel` draws the word `Mixed` in place of the
  editor.

- **(P3) `PrefsForm` rail layout: a page that opens without a rail click keeps the last page's row
  state.** `RailLayout` renders `PrefsPane` unkeyed and `paneChildren` keys rows by child key, not
  path, so a row with the same key on two pages (`general.name`, `export.name`) keeps its component
  state across the change: a tab strip's picked tab, a `MapEditor`'s half-typed entry. Keying the
  pane's contents by the open page fixes it; check that a drag which changes the open page
  (`useDropMotion`, `useDropFrame`) survives the remount.

- **(P3) `PrefsForm` rail layout: the pane draws a group's leaves before its groups, where columns
  and list keep schema order.** `PrefsPane` (`packages/ui/src/components/Prefs/PrefsPane.tsx`)
  filters leaves and fragments out ahead of the groups, so children `{ light: tab, note: leaf, dark:
  tab }` draw as the row and then one `Light | Dark` strip in the rail, and as a `Light` strip, the
  row, and a `Dark` strip elsewhere; a drop placeholder between two sections is drawn up among the
  leaves. `paneChildren`'s doc says "in schema order", which the pane's own call does not honor. One
  walk in schema order for every layout, wrapping each run of rows in `.rows`, makes them agree; it
  changes what existing rail forms look like, which is why it is a decision.

- **(P2) diagram: a self-edge with no named ports draws nothing.** An edge whose `dependsOn` is `[a,
  a]` and whose ends name no `port` (what `fromData` produces for a self-loop) resolves both ends in
  `resolveEnd` (`packages/diagram/src/edge.ts`) toward the node's own center, so every port scores
  the same facing and both ends pick the same one; the router gets two coincident points and the
  path has no length. With two different named ports the `straight` router draws a chord through the
  node's interior instead. The layouts already handle self-loops, so the edge is meant to show.
  Ruled 2026-10-11: one shared rule beside `resolveEnd` has a portless self-edge leave and return by
  two adjacent sides and pass a point outside the node, and the routers (`straight`, `orthogonal`,
  `bezier`) route through that point and draw no loop of their own. That leaves the rule, how far
  the loop stands off the outline, and `edgeDerivePath` handing the routers the waypoint.

- **(P2) guides: alignment snapping does not say which world its candidates are in on a parallax
  layer.** `alignMoveBehavior`, `alignInsertBehavior`, and `alignResizeBehavior`
  (`packages/guides/src/guides/alignment/behaviors.ts`) compare the gesture's pose with
  `getCandidates()` directly and never read `ctx.plane`. The guide and grid behaviors now carry the
  camera's lines into the plane (`packages/guides/src/strategies/onPlane.ts`), but alignment
  candidates come from the consumer, usually `deriveAlignmentGuides` over sibling poses, which are
  plane coordinates when the siblings share the dragged node's layer and camera coordinates when
  they do not (a page box, or nodes on another layer). The matched lines are also published through
  `setActiveGuides` to a layer the camera draws, so a plane-space match is drawn in the wrong place.
  Ruled 2026-10-11: alignment candidates are always camera coordinates, and the caller carries
  sibling boxes out of their planes. That leaves the three behaviors converting through
  `guideOffsetOn` and publishing camera-space lines, the conversion for callers of
  `deriveAlignmentGuides`, and the docs naming the space.

- **(P3) hud loupe: pixel mode keeps a stale picture when the scene changes under a parked aim.**
  `createLoupe` (`packages/hud/src/loupe/createLoupe.ts`) re-reads the framebuffer only when the
  aim, mode, factor, or window size changes (`scheduleRefresh` from `surface.changed` and
  `onResize`). Park a pixel-mode loupe, then undo or nudge a node under it: vector mode follows,
  pixel mode and `loupe.color` do not. `LoupeModel.resample()` exists for this and nothing in the
  hud calls it. Refreshing on every landed frame would loop, since the new bitmap's own redraw lands
  a frame, so it needs a scene-changed signal that the loupe's redraw does not raise (the painted
  version from `CanvasExtensionApi.getPaintedVersion`, compared before and after the loupe's own
  request, is one candidate), or a public `refresh()` on the handle that the consumer calls.

- **(P3) theme: `applyTheme` publishes into the global `document` and never retires a rule.**
  `packages/theme/src/applyTheme.ts` keeps one module-level sheet on the bare `document`, keyed by
  theme name and selection. An element in another document (a `window.open` popout fed by a portal)
  or in a shadow root gets its `data-wzl-*` attributes but no rule, so a theme that is not built
  into `tokens.css` has no effect there, with no error. `emitted` only grows: every name ever
  applied keeps a full token block for the life of the page, which is unbounded for a consumer that
  mints a theme name per instance. Two different `Theme` objects sharing a name on two subtrees
  overwrite each other's rule while each `<ThemeProvider>`'s `resolved` still reports its own
  values. Fixing it means keying the sheet by `el.getRootNode()` and counting references from
  `ThemeProvider`'s effect cleanup, which changes `applyTheme` from fire-and-forget to something
  that returns a release, a public API change.

- **(P3) theme-editor: discarding a draft that does not derive throws away every other unsaved
  edit.** When a stored draft fails to derive, `ThemeWorkbench`
  (`apps/theme-editor/src/ThemeWorkbench.tsx`) offers "Discard the draft and reload from disk" for a
  saved theme, and "Discard this unsaved theme" for one with no file. The editor no longer stores a
  draft that does not derive, so this screen is now reached only through a draft stored by an older
  build or one that stopped deriving because the theme it extends changed. In that second case one
  inherited reference is the whole problem and the user loses everything; the screen could open the
  Pins layer on the last stored draft with the failing reference named, instead of offering only a
  discard.

- **(P2) CurveEditor: a right-click delete skips the built-in undo, and undo never reaches
  `onChange`.** Drag an anchor, right-click another to delete it, press Cmd+Z: one press reverts
  both, because the delete in `packages/ui/src/components/CurveEditor/CurveEditor.tsx`
  (`onContextMenu`) writes the points directly and never pushes onto `LayeredCurveEditor`'s history;
  a delete that was the first edit cannot be undone at all. Separately, undo and redo in
  `LayeredCurveEditor.tsx` (`restore`) call `onLayerChange` only, so `CurveEditor` emits `onInput`
  and never `onChange`, and a consumer that saves on `onChange` is not told the curve changed. The
  delete's guards (locked, pinned endpoint, `minPoints`) are also a second copy of the ones in
  `createFunctionLayer.tsx`, and the wrapper `div` with an inline `display: contents` exists only to
  host the handler. For the delete: a `contextmenu` hook on `CurveLayer`, dispatched with hit
  testing and history like `onPointerDown` (new public surface on the layer type), which also
  retires the duplicate guards and the wrapper. Ruled 2026-10-11: undo and redo report a finished
  change the same way the end of a drag does, so `CurveEditor` emits `onChange` for them. That
  leaves `restore` calling `onLayerCommit` too, and the documented contract ("undo fires
  `onLayerChange`") reworded to say so and to tell a consumer that keeps its own undo, or builds ops
  from `onLayerCommit`, to turn `history` off.

- **(P2) LayerList: rows under a card are `role="row"` with no `treegrid` ancestor.** When a level
  holds any item with a body, `Level` in `packages/ui/src/components/LayerList/LayerList.tsx`
  renders it as a `PropertyList` with no role, and a nested level's container is `role="none"`, so
  the body-less rows in a mixed level and the child rows under a card carry `role="row"` and
  `aria-level` with no grid above them. Flat lists are fine (each row now owns a `gridcell`). Ruled
  2026-10-11: each level of plain rows under a card or among cards becomes its own `treegrid`, named
  for its card, with `aria-level` restarting there. That leaves that markup in `Level`, and what a
  lone row among cards belongs to, since it has no card to be named for.

- **(P2) ActionBar: a button's `enabled` / `active` state is re-read only when something else
  re-renders the bar.** A "Delete" action enabled only while something is selected stays disabled
  when the selection changes in a store the bar's parent does not render from:
  `packages/ui/src/components/ActionBar/ActionBar.tsx` subscribes to `registry.subscribe`, which
  fires on register and unregister only, and its layout effect compares render-time values with
  commit-time values, which helps only on a render that already happened. The dep registry
  (`depRegistry.tsx` in `packages/routing`) has no change subscription to listen to. The fix is a
  subscribe/notify on the dep registry that the bar (and any other reader of
  `buildDepsFromRequires`) listens to; that is new surface in `@weasel-js/routing`.

- **(P3) SceneGradientHandles: unmounting mid-drag commits the half-finished drag.** Deselect the
  node (or anything else that unmounts the overlay) while a handle is held: the parent's
  `useOngoingAction` cleanup runs first and commits the value under the pointer, then `DragPoint`'s
  own unmount cancel opens a second `setFill` at the starting value and cancels it, which changes
  nothing (seen in jsdom: ends `commit`, `cancel`, in
  `packages/ui/src/components/GradientEditor/SceneGradientHandles.tsx`). `useOngoingAction`
  documents the commit on unmount as "what the user was looking at", which fits a slider left
  mid-edit; whether a pointer drag cut short by an unmount should commit or cancel is the call. To
  cancel, the overlay has to learn a drag is live before the parent's cleanup runs.

- **(P2) DataGrid: rows can be reordered by pointer only, and the handler sits on the `<td>`.** With
  `onReorder`, the handle in `packages/ui/src/components/DataGrid/DataGrid.tsx` is a `<td>` holding
  an `aria-hidden` glyph with `onPointerDown` on the cell: not focusable, and no key moves a row.
  `useReorderDragList` already returns `nudge`, which `LayerList` and `ItemList` bind to
  Alt+ArrowUp/Down. The fix is a `<button>` filling the cell that takes the pointer handler and an
  Alt+Arrow `onKeyDown` calling `drag.nudge`; it needs a name for each row (rows carry no label, so
  a column or a `rowLabel` prop has to supply one) and a button style that fits the 14px handle
  column, checked in a browser.

- **(P3) Callout: re-anchoring dispatches a fake `resize` on `window`.** A callout tracking a scene
  node through a pan dispatches `new Event('resize')` on every `anchorRect` change
  (`packages/ui/src/components/Callout/Callout.tsx`), so every resize listener on the page runs once
  per pan frame for as long as the callout is mounted with a rect, open or not. The comment says it
  is deliberate for want of a public `updatePosition` on React Aria's Popover. Options: dispatch
  only while open; or change the anchor span's size by a sub-pixel, which trips React Aria's own
  `ResizeObserver` without touching `window`.

- **(P3) ItemList: removing the focused row leaves focus on `<body>`.** A consumer's remove control
  in a row's `trailing` cell unmounts the row with focus inside it, and
  `packages/ui/src/components/ItemList/ItemList.tsx` computes a fallback tab stop for the vanished
  `focusId` but never focuses it, so the next arrow key goes nowhere. `LayerList` now handles this
  because it owns its remove button; `ItemList` does not own the control, so it has to infer "the
  row that held focus is gone". That needs focus-within tracking that survives the removal, and
  browsers differ on whether removing the focused element fires `blur`, so settle it in a
  `*.browser.test.tsx`.

- **(P3) BandEditor: splitting a band has no keyboard path.** A band is split only by clicking the
  ruler (`onTrackPointerDown` in `packages/ui/src/components/BandEditor/BandEditor.tsx`); every
  other edit has a key. It needs a key and a rule for where the split lands (the selected band's
  midpoint on the scale is the obvious one).

- **(P3) ui/routing: "is this key press aimed at a text field" is answered twice.** `isTextEntry`
  (`packages/ui/src/components/BandEditor/track.ts`) says yes for input, textarea, select, and
  `isContentEditable`; `isEditableTarget` (`packages/routing/src/interactions/keyHelpers.ts`,
  re-exported by core) says yes for input, textarea, and contenteditable but not select, and also
  reads the `contenteditable` attribute. `BandEditor` and `Timeline` use the first, the gesture
  dispatcher and `keyState` the second. Make one definition (deciding whether a `<select>` counts)
  and have ui import it; `isTextEntry` also sits in a `BandEditor` module that `Timeline` now
  reaches into. What turns on `<select>`: counting it stops a tool hotkey from firing under its
  type-ahead, and also stops Delete and Cmd+Z in the dispatcher for as long as focus rests on a
  select after a choice is made, which is every bound key, modifier chords included
  (`useGestureDispatcher.tsx`).

- **(P3) UnitField: a field that began at NaN cannot give back what it sent while typing.** Typing
  that ends in Escape or in unreadable text sends the value it began from through `onInput`
  (`packages/ui/src/components/NumberField/UnitField.tsx`). A field showing a mixed selection began
  at NaN, which is not a value to send, so a caller holding the live value keeps the last readable
  keystroke. It needs a way to say "typing was abandoned" that carries no value, such as an
  `onCancel` callback.

- **(P2) AnimatedTimeline: a resume made off the component does not start its playhead.** Call
  `handle.resume()` (or `seek` on a finished timeline) from the app's own button while
  `<AnimatedTimeline>` shows the same handle: the animation runs, but the playhead and the
  transport's Play button stay put until something else re-renders the component, because
  `TimelineHandle.subscribe` (`packages/core/src/animation/timeline/createTimeline.ts`) fires on
  `edit` only and the component's frame loop is started from its own Play button or a render. The
  handle needs to report play-state changes (pause, resume, seek, finish) to subscribers, or expose
  a second subscription for them; `AnimatedTimeline` then requests a frame from it.

- **(P2) TokenPanel scale: dragging a step's thumb back to where it started reads one unit off.** On
  a `px` scale with a step at 16, drag its thumb to 20 and back in one drag: near the start the
  readout shows 17 (or 15 from below), and exactly at the start it stops updating. `Slider` keeps
  calling the `onInput` it was given at pointerdown, so `commit` in
  `packages/ui/src/components/TokenPanel/Scale.tsx` compares every move against the starting amount,
  and its "an arrow key still moves a step by one unit" nudge fires for drags too. The nudge is only
  right for a key press, and `Slider` gives its caller no way to tell one from a drag (both arrive
  through `onInput`; a key press also calls `onChange`, but so does a drag's end). Options: `Slider`
  passes the source of a change to `onInput`/`onChange`; or `Scale` owns the arrow keys for its
  thumbs and `commit` never nudges.

- **(P3) Slider: `ThumbShape.render` and `renderTrack` are told constants.** A custom thumb is
  always handed `{ width: 14, height: 24, isActive: false }`
  (`packages/ui/src/components/Slider/Slider.tsx`), so one that highlights while dragged never does
  and one drawn under `density="slim"` or a custom `trackHeight` is given the wrong box;
  `.thumbActive` in `Slider.module.css` is a rule nothing references. `renderTrack`'s `trackWidth`
  is read from a ref during render, so it is 0 on the first render and stale after a resize. Needs
  the dragged index held in state and the thumb and track measured with a `ResizeObserver`, as
  `Ruler` does.

- **(P3) Slider.tsx holds four jobs in one 740-line file.** The value and stop math (`attract`,
  `stepStops`, `clampOrdered`, `useSpan`), the endless wrapper, the two drag gestures, and the
  render share `packages/ui/src/components/Slider/Slider.tsx`. Move the pure math beside
  `crossEnd.ts` and the drags into a hook; the render-context fix above then has somewhere to go.

- **(P3) PaintInput: its per-kind memory follows the mount, not the selection.** A `PaintInput` left
  mounted while the selection changes offers the new selection the last one's paints: select shape A
  with a linear gradient, then shape B with a solid, click "linear" on B, and B receives A's stops
  (`remembered` in `packages/ui/src/components/PaintInput/PaintInput.tsx`). `apps/draw` avoids it
  with `key={ctx.selectionKey}`; `PaintField` mounts it inside a popover, so its memory lasts only
  while the popover is open. Ruled 2026-10-11: a new prop names what the control is pointed at, and
  the memory clears when that changes. That leaves the prop, the reset of `remembered`, and
  `apps/draw` passing the prop in place of the `key`.

- **(P3) Tree: focus drops to the page when the focused node is removed.** A consumer's own Delete
  handler removes the focused row: the tab stop recomputes to the first selected or first row, but
  DOM focus falls to `<body>` and the next arrow key goes nowhere (`stopId` in
  `packages/ui/src/components/Tree/Tree.tsx`; only `pendingFocus`, set by keyboard moves, ever calls
  `.focus()` after a render). When `focusId` leaves the tree while focus was inside it, focus should
  move to a row; which one (the next sibling, the previous row, the parent) is the decision.

- **(P3) Timeline: an omitted `transport` draws play controls that do nothing.** With no `transport`
  prop the bar draws Play, Loop, and Rate wired to no-ops
  (`packages/ui/src/components/Timeline/Timeline.tsx`); `false` hides the whole row. The row also
  holds the time readout and the Graph switch, which both work without a transport, so the open
  call is what an omitted `transport` draws: the readout and the switch alone, or nothing.

### WeaselDraw app follow-ups (defer)

- **(P3) Multi-page documents.**

---

### weasel-den deferrals

From `docs/specs/2026-05-03-weasel-den-design.md`. **Read `packages/den/README.md` first** — the spec's `{ registry, alwaysOn, keybindings }` pack shape was superseded by core's `Contribution` + `mergeContributions`, and its convenience layer shipped inside core as the `features` presets plus `defaultTools` / `toolOptions` on `SceneCanvas`. The items below are what survives that.

- **(P3) Additional domain bundles.** `useWhiteboardPack` (sticky notes, freeform pen, text), `usePresentationPack` (frame tools, slide nav). Each is its own arc, and each is a `Contribution` bundle rather than a den pack. The diagram bundle shipped as `@weasel-js/diagram`; don't propose another.
- **(P3) Move `useSelectTool` / `useTextTool` / `usePenTool` /
  `usePencilTool` out of core's builtin tools.** The den's one motivation nothing
  has absorbed: separating finished, stable tools' test surface from core's. It
  needs no new package — `packages/den` is a README, not a package — and core's
  own workspace layout can hold them. Defer until each is stable. (`useInsertTool` was removed as a duplicate of `useRectTool`, and
  `useUserPenTool` never existed — this entry named both for months.)

### d3 integration plugin

`@weasel-js/d3` shipped; one item is parked:

- **(P3) `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
  (the `viewport.zoom` / `viewport.pan` actions, `useHandTool`, `useViewAnimation`;
  `useDragGesture`).
  Worth building only for d3 semantics the kit genuinely lacks, not for parity —
  none identified yet.

---

## forge

`@weasel-js/forge` is the component workshop built on labkit: each story renders
in the workshop page as a lab trial with controls. A story that sets `isolate`
renders in an iframe ("frame") instead; that path is frozen, kept for as long
as any story needs it, and `check:forge-isolate` holds the count. It is the
only story runner in the repo.

- **(P3) The served page is titled "weaselforge" until the shell config loads.**
  `ShellConfig.title` sets `document.title` at runtime, but the HTML the plugin
  serves and builds (`packages/forge/src/vite/html.ts`) hard-codes
  `<title>weaselforge</title>`, so a tab, a crawler or a link preview reads the
  old name. The plugin cannot import the shell config module; either it learns
  to read the title out of it at build time, or the title moves to
  `ForgeOptions` — and then the shell config's copy should go, not stay as a
  second source.

- **(P3) Marks are off in the workshop until annotations are a feature.** forge's
  instruments no longer declare labkit's `annotations` capability, so trials show
  no Marks section and the tool rail holds only Info. The removed wiring — the
  story as the one annotation target, sized and captured through the trial's
  frame registry — is in `git log --grep 'take marks out of forge'`.

- **(P3) The CSS Vars panel saves scale edits only.** A single token edited by
  hand — a color, a step changed after its scale — stays a per-trial override,
  because a token's value comes from a semantic rule, a ramp or a pin and the
  panel has no mapping back to which. Scale edits save through
  `applyScaleEdits` (`packages/forge/src/shell/cssVars/saveScales.ts`). A save
  also refuses a param that differs by `mode` while the trial's mode is Auto,
  since the panel does not know which scheme the frame resolved.

- **(P3) A captured forge story loses what `:root`, `html` and `body` style.**
  The frame serializes its story into a `<foreignObject>` whose root is a
  `<div>` (`packages/forge/src/frame/capture.ts`), so a rule hanging off those
  three selectors does not reach the clone. Custom properties are restated on
  the capture root, which covers theme tokens; a page background or a body
  font is still lost, and so is any font or image the document did not inline.


- **(P3, isolated stories only) A forge story whose `viewport` the index cannot
  read reloads its frame once when first opened.** The index reads a native
  story's `viewport` when both sides are number literals, and the first
  instrument takes its stage from that. Otherwise — a computed size, or a CSF
  story, whose viewport comes from `parameters.viewport` and `globals.viewport` —
  the stage arrives with the frame's `ready`, and labkit's `Trial`
  (`packages/labkit/src/trial/Trial.tsx`) renders stage content inside `<Stage>`
  and other content bare, so `FrameView` remounts and the iframe reloads. A
  general fix keeps the frame through that remount (it is already placed by hand,
  and `moveBefore` moves an iframe without reloading it), or has `Trial` keep
  the body at one tree position whether or not there is a stage.

- **(P3) A trial tile narrower than 300px cuts off its content pane.** A trial's `Split`
  (`packages/labkit/src/primitives/Split.tsx`) holds the sidebar at its 140px floor and the content
  at its 160px floor however narrow the tile gets, so below 300px the content pane runs out past the
  tile. Measured in forge on 2026-09-28 with two trials beside the story sidebar and CSS Vars aside:
  at a 1000px viewport each tile is 176px and the content pane reaches 124px past it, at 1100px
  74px; at 1718px with default sidebar widths the tiles are 535px and nothing overflows. The
  2026-09-13 fit-check warning (`.lk-shell-body` scrolls, a pane 68px past `lk-trial__panes`) was
  this, but every split zone between the pane and the shell body now has `overflow: hidden`, so the
  lab no longer scrolls and the fit check stays silent: the story is clipped with no way to reach
  its right side. Ruled 2026-10-11: the split gives way: when the zone cannot hold both panes it
  shrinks its sidebar below its floor first, then its content. That leaves relaxing the two floors
  in `Split`. At the same 140px the forge Globals group's label/value columns overlap ("MODE" over
  "Lab").

- **(P3) windease lays out a node that was registered and never shown.** A
  strip gives a `mounted` node its room and a seam, while `Container` renders
  only `visible` ones, so the pane is an empty gap with a live separator
  (`layout-node-adapter.js` skips `hidden` and `destroyed` only; windease
  2.0.0). `Split` works around it by showing its sidebar node and hiding it
  again (`createSplitStore`). The fix belongs in windease; the workaround goes
  when it lands.

- **(P2) forge: a story's `play` never runs in the workshop, and the frame protocol still carries
  the plumbing for it and three other things nothing reads.** `play` runs only under `forgeTest`: no
  shell code sends `{ type: 'play' }`, and `FrameView` has no case for the frame's `played` answer
  (`packages/forge/src/protocol/messages.ts`, `frame/FrameController.tsx`). The comment in
  `packages/forge/src/test/play.ts` says a play is driven "by `forgeTest` under vitest or by the
  workshop", which is false. Beside it, written and never read: `capture.run` / `TrialFrame.capture`
  (`frame/capture.ts`, `shell/FrameView.tsx`, `shell/TrialHost.tsx`), the `size` report and the
  `ResizeObserver` each open story keeps alive to send it, `TrialFrames.hostRef` (whose map in
  `shell/trialFrames.ts` is never pruned), and a `vars` array `TrialHost` builds and drops. These
  are what taking marks out of forge left behind. Ruled 2026-10-11: the workshop does not run a
  story's play. That leaves deleting all of it, with the protocol messages and the `:root`-capture
  entry below, and correcting the `play.ts` comment.

- **(P2) forge: the static index and the runtime loaders disagree about what a story is and what it
  is titled.** Three cases, all in `packages/forge/src/vite/indexFile.ts` against `story/native.ts`
  and `csf/loadCsfModule.tsx`. A native story file with `export const rows = makeRows()` beside its
  stories lists a story "Rows" in the tree, because the index takes every exported call, and
  opening it faults with `has no story export "rows"`, because the loader skips exports that are not
  stories (an export written out as a value, such as an array or a function, is already left out). A
  CSF meta whose `title` is an identifier or a template literal with an expression
  indexes under the auto title while `loadCsfModule` uses the real one, so the loaded story's id
  differs from its entry's and the index page's Open button does nothing. And `forgeTest`
  (`vite/forgeTest.ts`) and `packages/forge/scripts/check-isolate.ts` call `indexFile` without the
  resolved wrappers, so a file whose `meta`/`story` come through a project helper is indexed
  differently there, and `check:forge-isolate` does not count an `isolate` inside it. The fix is one
  "index this file" function every caller shares, a native index that takes only exports whose
  callee is a `story` wrapper, and a CSF loader that is handed the index's title the way the native
  loader already is.

- **(P3) forge: the index page mounts a cell only once it is on screen, not a viewport ahead.**
  `packages/forge/src/frame/index/IndexPage.tsx` keeps a private `useNearViewport` that reads
  `isIntersecting` against the implicit root with `rootMargin: '100%'`. In the workshop document an
  index page sits in a scrolling pane, and a root margin does not widen an intermediate scroller's
  clip, so the margin does nothing there (from the IntersectionObserver spec, not measured).
  `frame/useNearViewport.ts` already solves this by position against `root: document`. Folding the
  copy into it needs the shared hook to take its starting value: it starts `true`, and the index
  page's starts `false` so a page of canvas stories never mounts every cell at once. Check the
  result with a browser test like `useNearViewport.browser.test.tsx`, with the cell inside an
  `overflow: auto` box.

- **(P3) forge: `@weasel-js/forge` names a story's library from this repo's directory layout.**
  `libraryOf` (`packages/forge/src/story/library.ts`) maps `/packages/ui/`, `/packages/labkit/`,
  `/apps/draw/`, and so on to badge labels, so another project with a `packages/ui/` gets weasel's
  `ui` label and everything else falls back to the title's first segment. The tree's package filter
  and the index page header both read it. The table is data about this repo and belongs in
  `ShellConfig`, supplied by `apps/forge`, with the title-segment rule as the default.

- **(P2) wake (`~/src/wake`, not this repo): every hot update is followed by a full reload about
  three seconds later.** `hotUpdate` in `~/src/wake/src/index.ts` sets `stamp = Date.now()` for any
  non-CSS file even when `fullReload` is off. The page's own stamp in `~/src/wake/src/client.ts` is
  a `const` read once from `<meta name="wake-build">`, so after a successful hot update the next
  poll sees a newer server stamp, and after `GRACE_MS` the page reloads itself. Scenario: edit a
  story in forge with wake loaded; forge reloads the story in place, then the tab reloads and
  unpersisted trial state is lost. This hides forge's own hot-update path on this machine, which is
  why `WAKE_PATH=/nonexistent` is needed to see it. The same client is injected into `/frame.html`,
  so every isolated frame and both warm pool frames poll `/__wake`, draw their own `.wake-badge`,
  and reload on their own. Fix in wake: adopt the server's stamp on `vite:afterUpdate` when
  `fullReload` is off, and skip the client when `window.parent !== window`.

- **(P3) wake (`~/src/wake`, not this repo): a server's exit-time release can drop another app's
  registry entry.** `releaseSync` and `releaseExtraSync` in `~/src/wake/src/claim.ts` read the
  registry and write it back without the lock `updateRegistry` (`~/src/wake/src/state.ts`) takes.
  Scenario: server A exits while server B, another app, is inside `updateRegistry`; A reads, B
  writes its entry, A writes back its earlier read with only its own holder cleared, and B's entry
  is gone, so B's next start picks a port as though it had never run. Nothing synchronous can take
  the port lock; either re-read and compare just before the write, or have the next `claim` treat a
  dead holder as released and make the exit-time release a no-op.

- **(P3) forge: a URL naming a story that does not exist keeps the last page in the stage.** Opening
  `#/<an id no story has>` shows `No story <id>` over the story list, and the stage goes on showing
  the component index or story that was open before, under that page's breadcrumb. Seen in headless
  Chromium with `#/labkit-controls-controlpanel:nested`. The stage should say the story is missing.

---

## Demos & visual regression

- **(P3) labkit's clock browser test failed once on the fleet.** `clock.browser.test.tsx`, "a timed
  layer repaints as the clock plays, and holds once it pauses", line 92: the canvas read back red
  0 where the paused frame's shade was 3, in a full run on teitou on 2026-10-10 that passed the
  other 16,953 tests. Seen once and not rerun, so whether it is a race between the last paint and
  the readback or a real missed repaint is not known.

- **(P2) A docs minisite per package: overview, guides, and demos.** The API reference half is
  built: `npm run build:api` documents every published package in one TypeDoc site at `/api/`,
  each package a module with its README as the landing page. Still to design: an overview and
  hand-written guides per package (only labkit has any, in its own VitePress site), and the
  demos that exercise a package shown from its pages. Rendering TypeDoc's JSON output inside the
  site's own shell is the route that puts all four in one place.
- **(P2) The API reference build reports warnings in the packages it newly covers.**
  `docs/conventions.md` says `npx typedoc` reports none; that held while it read only core.
  Most are a documented export referencing a type its barrel does not export, each one a call
  between exporting the type and listing it under `intentionallyNotExported` in that package's
  `typedoc.config.mjs`. 91 warnings remain as of 2026-10-11: 87 of that kind, `{@link Field}`
  in ui's `Input` and `ComboBox` props (unresolved only where labkit re-exports them), and
  `{@link KEEP}` in `PrefSchemaEditor/schemaExport.ts`.
- **(P3) A symbol core re-exports from a sibling is documented twice.** `ClaimableGesture` has a
  page under `@weasel-js/core` and another under `@weasel-js/gestures`, with the same text.
  TypeDoc's `packages` strategy converts each package on its own, so core's copy is a full
  declaration, not a pointer. Type references do cross: core's pages link into the sibling's.
- **(P3) SVG export writes wrapped text as one line.** `data-weasel-wrap` round-trips `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws a wrapped node as its unbroken lines. Exporting the laid-out lines needs fonts at serialize time, which `@weasel-js/svg` does not have. A justified node is written at its start edge with `data-weasel-align="justify"` for the same reason: once lines are exported, its wrapped lines need per-word `x` placement too, since `text-anchor` has no justify.

- **(P2) draw: the swatches' active fill and stroke never reach a newly drawn shape.** With nothing
  selected, pick red in the fill swatch and drag out a rectangle: it takes the kit's next palette
  color, and `INITIAL_FILL_COLOR` in `apps/draw/src/App.tsx` reaches no shape either. The seam is
  there: `<SceneCanvas insertPaint>` takes `(kind, seq) => { fill?, stroke? }` and the kit keeps the
  geometry. Draw has to feed it from `useColorContext()`, mapping `{ kind: 'none' }` to `null`, and
  that needs two answers the color context does not hold: the width of a new stroke (the kit's
  line and pencil use 2), and whether a line or a pencil trail takes the active fill.

- **(P2) draw: Open adds the file to the current document instead of replacing it, and keeps the old
  filename.** Open an SVG into a non-empty document and both sets of shapes are on the page; the
  undo entry is labeled "Import SVG" while the button says "Open". The filename stays the previous
  document's (`parsedToDoc` returns `title`, `pickSvgFile` drops `file.name`, and `onOpenSvg` in
  `apps/draw/src/App.tsx` reads neither), so the next Save downloads under the wrong name. Paper
  size and background are already taken from the file, which only makes sense for a replace.
  Options: Open replaces (clear the scene in the same batch, take the filename from the picked file,
  reset the background to white when the file names none) and a separate Import appends; or the
  button is renamed Import and stops adopting the file's paper size and background.

- **(P2) draw: three shortcuts shown on command-bar buttons are bound to nothing.** Hover Show grid
  (Shift+3), Release compound path (Shift+|), or Preferences (Cmd+,) in
  `apps/draw/src/CommandBar.tsx`, press the key, and nothing happens: each `shortcut=` is a
  `formatShortcut` label with no binding behind it. Each should be a registered action with a
  `defaultBinding` (an ambient `Contribution`, the way `colorContribution` carries the color keys)
  and the button should render from the registry as the `KitActionBar` groups do, so a label cannot
  name a key nothing listens for.

- **(P3) draw: turning the wheel during an opacity scrub can rewind an edit made while O was held.**
  `applyLive` in `apps/draw/src/opacityScrub/useOpacityScrub.ts` calls
  `jumpToHistoryIndex(session.startHistoryIndex)` on every tick, assuming nothing else pushed
  history since the session opened; hold O, wheel, tap an arrow key to nudge, wheel again, and the
  nudge is undone and cut off the redo stack. The scrub should be an ongoing action with a coalesce
  key, as `setFill` is through `useOngoingAction`, so it owns one entry without rewinding the stack
  by index.

- **(P2) site: the source-file tabs and the Select demo's list cannot be operated from the
  keyboard.** `apps/site/WeaselDemos.tsx` renders `role="tablist"` / `role="tab"` buttons with no
  `tabpanel`, no `aria-controls`, no roving tabindex, and no arrow keys.
  `apps/site/demos/SelectDemo.tsx` puts `role="option"` and `onClick` on bare `<li>`s inside a
  `role="listbox"` with nothing focusable, so the demo of selection conventions takes no key at all.
  The first should be the kit's `Tabs`; the second should be `ItemList` (or a focusable child
  filling each `<li>`, with Space/Enter and arrows feeding the same `select()` reducer the click
  does).

- **(P3) AnimationDemo: the demo builds and mutates its own adapter because the animation wrappers
  have no canvas seat.** `apps/site/demos/AnimationDemo.tsx` spreads `sceneToAdapter(scene, {
  selection })`, overrides `insertNode` / `removeNode` / `snapshotSelection` by hand, wraps the
  result in `animateOnSetPose` and `animateLifecycle` through two `as never` casts, hands that to
  `useSelectTool` / `useTools`, and then calls `adapter.setPose` / `adapter.insertNode` from button
  handlers, so those writes skip the op pipeline and undo. It also re-renders React once per
  animator tick (`bumpTick`) to repaint per-card scale and alpha. `<SceneCanvas>` should take the
  wrappers itself (an `animate={{ setPose, lifecycle }}` option, or a `SurfaceContribution` that
  wraps the adapter the canvas already builds), so the demo keeps `features={['pick', 'move']}`, its
  buttons call `scene.setPose` / `scene.add`, and per-node effects repaint through `redrawOn` /
  `requestRedraw`.

- **(P2) draw: the input recorder is reachable from nothing.** `recorder.ts`, `recordingIO.ts`, and
  `replay.ts` are complete and tested, and no control starts a recording or plays one. Wiring them
  needs a `Recorder` on the canvas's pointer and keyboard surface, which wants a
  `SurfaceContribution` with `attach` rather than a capture-phase listener in the app. The command
  bar's Record button, profile select, and Play button went with the no-op handlers behind them;
  `git log -S'Record input' -- apps/draw/src/CommandBar.tsx` has them.

- **(P3) draw: no command palette, no toast host, and no first-run notice.** The actions registry
  lists every action by stable id, so a palette is a port of `apps/site/CommandPalette`; save
  failures and SVG import warnings currently go to `console.warn` (`onWarn` in
  `apps/draw/src/App.tsx`) where a toast should carry them. (Moved from the deleted
  `apps/draw/TODO.md`.)

- **(P3) draw: two owners for "which mode is the editor in".** The kit holds `textEdit.editingId`
  and `editAnchors.editingId`; the app holds a second mode machine
  (`apps/draw/src/modality/machine.ts`) whose `text-edit` and `path-edit` modes say the same thing.
  Two effects with `prev` refs in `apps/draw/src/App.tsx` reconcile text editing in each direction,
  and their comments record two shipped bugs from the split; path editing has no reconciling effect
  at all, and the kit papers over it by reading the mode
  (`packages/core/src/canvas/SceneCanvas.tsx`, the `effectivePathEditingId` block). A double-click
  is acted on by both the kit's `enterPathEdit` binding and the app's `onDoubleClick` observer. One
  owner: either the machine's `enterMode` / `exitMode` are the only callers of `startEdit` /
  `setEditingId`, or the kit's edit state drives the mode registry and the machine keeps only
  journals.

- **(P3) draw: `apps/draw/src/App.tsx` is about 1,450 lines holding seven jobs.** The document model
  types, scene and history loading, the right sidebar (layers, properties, colors, history panels),
  the toolbar with SVG open/save, two dep publishers, the editor shell, and the status bar. Each
  wants its own module; `docPersistence.ts`, `sessionStore.ts`, `svgImport.ts`, and
  `releaseCompound.ts` are the first pieces out. `apps/site/demos/RotatedResizeMathDemo.tsx` (713
  lines) has the same shape: the four-panel ledger chrome and the resize math variants are
  separable.

- **(P3) draw: dead surface left in the tree.** `modality/backgroundClickPolicy.ts` has no caller
  outside its test, and a TODO in `App.tsx` says it waits on a hook into the dispatcher for
  background clicks outside normal mode. `PreferencesModal`'s `registryEnumSources` prop is never
  passed, so the one `registry-enum` pref (`LAST_TOOL` in `prefs.ts`, source `tools`) renders as
  free text through `RegistrySelect`'s fallback; a `tools` resolver needs the tool list, which the
  canvas holds and `App.tsx` does not.

- **(P3) draw: paper sizes and "no paint" are each defined more than once.** Paper sizes:
  `PaperSizeKey` (`CommandBar.tsx`), `WeaselDrawPaperSize` (`svgInterop.ts`), `PAPER_PRESETS`
  (`docPersistence.ts`), and two label lists that disagree: the New menu says "US Letter"
  (`PAPER_ITEMS`), the document properties say "Letter" (`PAPER_SIZE_OPTIONS`). One table of `{ key,
  label, width, height }` should feed all four; which label wins is a wording call. No paint: `{
  kind: 'none' }` in the color context's `ActivePaint`, `null` in node data, with `toFillStyle` in
  `ActiveSwatches.tsx` translating; `ActivePaint` could be `FillStyle | null` and the translation
  would go.

- **(P3) CustomShaderDemo: every frame re-renders React to move one uniform.**
  `apps/site/demos/CustomShaderDemo.tsx` calls `setTime` from its `useVisibleRaf` loop, rebuilding
  three uniform objects and re-rendering three `<SceneCanvas>` trees for a number only the shader
  reads (a test pins this at one commit per frame, down from more). The demo should keep `time` in a
  ref and ask for a repaint, which needs `<SceneCanvas>` to expose `requestRedraw` (or accept a
  `redrawOn` source) to a custom layer's owner without the demo reaching for the canvas ref in three
  places; a `useFrameUniforms(ref)` helper on the shader layer would absorb it.

- **(P3) GesturesDemo: the demo hand-writes the pointer-to-controller glue the gesture hooks need.**
  `apps/site/demos/GesturesDemo.tsx` feeds `useDragGesture` / `useDragRect` / `useDragRadial` from
  raw `onPointerDown/Move/Up` with manual `setPointerCapture`, and its `ptOf` turns a `PointerEvent`
  into the `{ clientX, clientY, worldX, worldY }` the controllers take. The blurb says the bypass is
  the point, so the raw events stay, but the kit should ship that conversion (a `pointOf(event,
  element, view?)` beside the hooks) and the demo's modifier footer should read `useKeyState`
  instead of its own `window` key listener.

---

## Backends (WebGL future)

From the WebGL transition spec — all deferred:

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win, significant API complexity. Defer until measured pain on the single-thread pipeline. (Note: `OffscreenCanvas` is already used on the main thread for pattern-tile rasterization in `packages/core/src/features/patterns/` — that's not worker offload; the worker move is the open item.)
- **(P3) Exotic composite operations** (xor, custom Porter-Duff) via framebuffer pingpong — deferred from v1 GL.
- **(P3) Headless server-side rendering in Node.** The browser/worker headless path landed 2026-07-19 as `renderSceneToPixels` (`packages/core/src/canvas/renderSceneToPixels.ts`, public) — it accepts a caller-supplied `gl`, so it already works with an `OffscreenCanvas` in a worker. Remaining P3 scope is specifically Node: verify against a caller-supplied `gl` from `headless-gl` (untested there), or wire up a worker + `OffscreenCanvas` path for a Node-hosted consumer.
- **(P3) Screen adoption of mipmap image minification** — `imageMinification: 'mipmap'` exists on `WeaselRenderer` but the screen path stays `'linear'`; evaluate upload-time `generateMipmap` cost before flipping the default (print already gets it).
- **(P3) Gradient ramp resolution at print scale** — 1×256 LINEAR ramps verified adequate for 8-bit output (interpolation error < 1/255 per channel); revisit only if >8-bit output lands.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Lint

A correctness baseline runs over `packages` and `apps` as of 2026-08-22, on
top of the scoped `no-restricted-imports` blocks that were previously the whole
config. Eleven rules, enumerated in `eslint.config.js` rather than spread from
a plugin `recommended` so a dependency upgrade can't change what's enforced.
`npm run lint` gates it in CI.

Turning it on cost ~100 fixes and found real bugs: six Badge effects called
`useId` after a `variant` early return, so a variant round-trip remounted them
and changed the `<clipPath id>` their gradients point at; `Canvas.tsx`'s paint
effect closed over a stale `helpersForLayers`; `useDeviceProfile` ignored a
provider-supplied `targetScale`; and a bare `Function` cast in `slice.test.ts`
was hiding an assertion that read `.space` without narrowing.

Deferred, with the rationale in `eslint.config.js` next to each:

- **(P3) eslint-plugin-react-hooks v7 compiler rules still off.**
  `static-components`, `use-memo`, `globals` (outside tests) and
  `set-state-in-effect` are on; each effect that sets state legitimately says
  why in its disable comment. The rest:
  - `refs` — 387 reports; reading a ref during render is how a canvas library
    reaches frame state, and there is no writes-only mode
    (`weasel/no-render-ref-write` covers writes).
  - `immutability` — 52 reports, none a defect: `useVisibleRaf` loops
    re-requesting themselves, and writes to forwarded refs, DOM nodes and
    mutable engine objects.
  - `preserve-manual-memoization` — reports where React Compiler would bail,
    and nothing here is compiled.

`eqeqeq`, `@typescript-eslint/no-unused-vars` and
`reportUnusedDisableDirectives` are all on as of 2026-09-05. The counts that
had them recorded as large sweeps were measured with the rules' strict
defaults: every one of the 317 `eqeqeq` reports was a `== null`, and 135 of the
136 unused-vars reports were the `_`-prefixed discards this repo already writes
deliberately. Configured to match those two conventions, the whole sweep was
one dead `const` and four stale disable directives.

---

## Release-gate & build hygiene

- **(P3) core: two modules register at load and are not listed as side effects, and listing them
  costs every one-symbol import 83 KB.** `renderer/effects/composite.ts` registers the program group
  effects composite with, and `canvas/NodeShape.ts` registers the built-in shape painters, each as a
  statement in the module body. Neither is in `packages/core/package.json`'s `sideEffects`, so a
  consumer's bundler that inlines the one constant imported from `composite.ts` (the hazard
  `packages/core/vite.config.ts` documents and turns off for core's own build) is left with a bare
  import it may drop, registration and all. Adding both to `sideEffects` was tried on 2026-10-11:
  `check:treeshake` then measured esbuild shipping 83,480 B for `import { asNodeId }` against a 512
  B budget, because the barrel reaches both. The registrations want to move behind an explicit call
  the renderer and the canvas make, as mesh paint's does through `features/meshPaint/register.ts`.

- **(P2) HUD vs DOM text: what the idle rerun left open.**
  `tests/perf/hud-vs-dom.spec.ts` now prices the HUD against plain DOM, a
  React overlay, and a DOM layer moved as one element, on an idle node
  (`tests/perf/README.md`, "HUD text against a DOM overlay"). Two things are
  still open:
  - **The HUD's 5,000-glyph readout gets the fewest frames** — about 70 ms
    apart under every camera, against 43–61 for the DOM — while its traced
    busy time is the lowest, about 9 ms per frame. Either the headless frame
    scheduler or a thread the trace analysis does not count (renderer worker
    threads, for one) accounts for the rest; nothing has checked which. Until
    it is, none of the frame intervals can be read as a display's frame rate.
  - **A static label on a fixed camera still favors the DOM**, 1.38 ms of main
    thread against 0.33 at 5,000 glyphs, because the renderer walks every
    unchanged text command each frame. A layer-level skip for a HUD whose
    widgets are all unchanged would need `content` painters kept out of it.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op factories, shape kinds and the `features` presets; public exports remain uncovered.

- **(P2) What still breaks the batch, now that a rect clip does not.** A group
  clipped by an axis-aligned rect no longer flushes: `batchClip.ts` cuts staged
  quads to the rect on the CPU. Measured on teitou (Apple M5 Max, ANGLE Metal),
  2026-10-06, one frame a task, each sample ending in a one-pixel `readPixels`
  so the GPU's own time counts; the result files are in
  `tests/perf/recorded/render-cost-2026-10-06/`.

  | at 60 Hz, `frame-budget.spec.ts` | before | now |
  |---|---:|---:|
  | clipped groups, depth 1 | 3,424 | 83,968 |
  | clipped groups, depth 4 | 2,080 | 42,496 |

  The before column is the renderer ahead of the rect-clip change, measured
  2026-10-04 through `gl.finish()`, which does not wait for the GPU
  (`tests/perf/README.md`, "Timing a frame"); its files are in
  `tests/perf/recorded/render-cost-2026-10-04/before/`. Re-measuring it means
  that renderer under today's timing, so the size of the gain is not settled.
  What is left:

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`),
    16 of it bind and draw; no other call in `flushBatch` moves it by more than
    its noise, about 1.2 us. So what remains is the draw count: a color matrix,
    synthetic bold, and an eighth texture all still break the run.
  - **A clip only the stencil can express still flushes on entry and exit**:
    a polygon, a rect turned off the axes, and a rect clip with a slanted item
    crossing it (`DrawBatch.clipQuad` says why a slanted edge cannot be cut).
    The stencil itself costs about 4.9 us a push and pop, 7.9 at 8 leaves
    (`clip-cost.spec.ts`).
  - **Caching `u_synthBold`, `u_samplers` and `u_fieldScale` was tried and
    reverted**, measured through `finish`: it saved about 0.1 us a flush on
    color-matrix breaks and made a frame of 20,000 stroked rects 30% slower,
    with both renderers interleaved in one page. The cause was not found.
  - **Changing kind costs 1.35–4.9 us a boundary** (`transition-matrix.spec.ts`):
    text and gradient the least, shader (4.9) and vcolor (4.4) the most. Pairs
    whose kinds share a batch cost nothing extra; the rest add 8–16 us, with a
    run-to-run spread up to 9.7 us, so the spec ranks pairs but does not price
    one.

- **(P2) A ring of buffers measures slower than rewriting one.**
  `SOLID_RING_SIZE` (64) exists so a flush never writes a buffer a draw is
  still reading. On teitou (Apple M5 Max, ANGLE Metal), 2026-10-06, four passes
  back to back in ABBA order, a quad that ends its run (`image-quad`,
  `renderer/unmerged`, 20,000 a frame) cost 22.50 and 21.99 us through a ring
  of 64 against 17.75 and 18.09 through a ring of 1, with no overlap between
  the sides' samples; `flush-anatomy` did not separate them. Result files:
  `tests/perf/recorded/ring-size-2026-10-06/`. Only one GPU and backend has
  been measured, and the ring's own case was made on an M2 Max by the retired
  block method; D3D and Vulkan backends are where an in-flight buffer write
  would stall, if anywhere.

- **(P3) The mesh batching caps are measured on one GPU.** A mesh joins a run
  up to `MAX_BATCHED_MESH_VERTICES_IN_RUN` (1,024) vertices when one is open,
  and up to `MAX_BATCHED_MESH_VERTICES` (96) when none is
  (`packages/core/src/renderer/draw.ts`). `tests/perf/mesh-batch.spec.ts` times
  256 convex meshes a frame, batched against drawn alone:

  | Frame | Break-even, two passes (vertices) | At 256: alone less batched (us/mesh) |
  |---|---:|---:|
  | meshes back to back | 136 and 92 | -2.36 and -1.00 |
  | a rect before every mesh | 1,488 and 1,724 | 26.31 and 21.02 |

  Drawn alone among rects, a mesh costs 26–37 us whatever its size, because it
  closes the rect's run and switches program twice; back to back it costs
  1.4–6.7 us. Both caps sit below their break-even because being wrong on the
  open-run side costs about ten times more a mesh. A chain of mid-sized meshes
  that a small one opened stays batched, which is the cheap side of being wrong.
  Measured on teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, at the spec in
  `2108ceb69`, two passes 20 minutes apart; load average 2–5 on 18 cores, with
  small fleet jobs overlapping. Result files:
  `tests/perf/recorded/mesh-batch-2026-10-07/`. Left: the same run on a D3D or
  Vulkan backend, where the break-evens may sit elsewhere.

- **(P3) What inside Chromium or ANGLE slows frames drawn back to back in one
  task** — 4–10x after about eight (`tests/perf/README.md`, "Timing a frame")
  — is unknown.

- **(P3) A consumer's `sampling: 'nearest'` costing up to 8x does not
  reproduce here.** They drew a 5652px atlas (~122MB) and saw nearest cost
  8.11x linear at 2:1 minification, 5.98x at 1.33:1, 1.08x at 1:1 and 1.14x
  magnified, in single runs on a contended box. `atlas-wall.spec.ts` with
  `WEASEL_PERF_SHEET=5652` builds sheets that size, cells sampling tiles across
  all of it. On teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, at
  `48f473a66`, in ABBA passes against our 0.1–3MB sheets, 5 runs a pass,
  nearest over linear was:

  | Sheet | Pass | 1:1 (56px) | 1.33:1 (42px) | 2:1 (28px) |
  |---|---:|---:|---:|---:|
  | 5652px | 1 | 1.30 | 1.20 | 0.66 |
  | 3MB    | 2 | 1.11 | 0.97 | 0.77 |
  | 3MB    | 3 | 1.17 | 1.68 | 1.11 |
  | 5652px | 4 | 0.63 | 1.08 | 1.25 |

  Every ratio, magnified rungs included, falls between 0.6 and 1.7 either way
  with no trend in sheet size or minification. The frames are 0.2–0.6 ms,
  where 0.1 ms is noise; an 8x would be 3 ms and could not hide. That matches
  the code: `GLImageCache` uploads with MIN_FILTER LINEAR and no mipmaps, and
  `sampling` reaches GL only as `setMagFilter`, which skips a value the texture
  already holds. Result files: `tests/perf/recorded/atlas-wall-sheet-2026-10-07/`.
  What is left is their side: whether their build predates `fee0c98db`
  (which stopped re-asserting MAG_FILTER per flush), their GPU and backend, and
  their dpr. Only their harness can answer it.

- **(P3) Whether the batched path costs a co-tenant on the same page.**
  Unverified here, and reported rather than measured. A consumer benchmarking
  its wall against a canvas2d control found that at one rung the *canvas2d*
  side went from ~8.8 ms to 102-160 ms, and only when the page also held a
  build with the merged batch. Reproducible in both directions.

  Its seven rungs narrow it to an interaction rather than to either cause
  alone. Five rungs share one byte-identical 12MB atlas, and only the densest
  of them is anomalous — canvas2d costs 160.4 ms at 16px / 2,700 commands
  against 5.2 at 24px / 1,419, on the same sheet. So it is not residency. The
  two rungs with *more* commands, 8px at 7,500 and 12px at 4,275, are fine on a
  smaller sheet, so it is not command count. What is unique is the pair: the
  most commands anyone draws against the large texture.

  Two axes move together across that ladder and want separating. Holding the
  cell at 16px and drawing fewer of them varies command count at a fixed 2:1
  minification; drawing 24px cells until the count reaches 2,700 varies the
  sampling ratio at a fixed count. Density of access to a large texture is a
  texture-cache story, not a memory-pressure one, and 16px is where a 32px tile
  is minified hardest by anything drawing that many of them — `GLImageCache`
  sets MIN_FILTER to LINEAR and generates no mipmaps on the screen path, so a
  minified draw scatters its taps.

  **Run the control first.** Every number in it is canvas2d on a page that also
  holds a WebGL2 context. Nobody has measured that rung with no GL context at
  all, so "the batch costs its co-tenant" and "this rung is expensive whenever
  GL is resident, and the batch only changes the timing" are not yet separated.
  That is one run and it could retire the entry.

  Worth chasing because a real app is a co-tenant too: weasel beside a chart
  library, or two surfaces on one page.

- **(P3) Per-layer GPU dispatch skipping.** `RenderLayer.deps`
  (`packages/core/src/core/layers/render.ts`) skips rebuilding a layer's
  command tree, not submitting it: every layer still goes through
  `WeaselRenderer.render` every frame. Skipping that means drawing each cached
  layer into its own texture once and compositing one quad per layer, which
  the renderer has no concept of today.

  Measured: **compositing a cached layer is cheaper than resubmitting it once
  the layer holds more than about 130–250 commands**, at every layer count
  from 4 to 64. Below that, resubmitting wins, by up to 7 ms at 64 layers of
  10 commands. At 64 layers of 1,000 commands, submission costs 58 ms a frame
  and the composite 5.4. With a single layer the composite costs nothing
  measurable, so it never loses there.

  `tests/perf/layer-dispatch.spec.ts` times `N` unchanged layers of `M`
  commands (half solid rects, a quarter text labels, 15% images, 10% linear
  gradients) through `drawLayers` with a warm command cache, against a frame
  holding only one live rect. The composite stands in for cached layers with
  one canvas-sized image per layer, which batches 7 to a draw. Canvas
  1280x800 at dpr 2. ms a frame over that control, two passes (`pass 1 / pass 2`),
  each the median of 3 runs:

  | Layers | Cmds a layer | Submit | Composite | Draws, submit / composite |
  |---:|---:|---:|---:|---:|
  |  1 |    10 |  0.07 /  0.03 |  0.02 /  0.03 |     1 /  1 |
  |  1 |    30 |  0.18 /  0.11 |  0.08 /  0.02 |     1 /  1 |
  |  1 |   100 |  0.28 /  0.23 |  0.12 /  0.10 |     3 /  1 |
  |  1 |   300 |  0.60 /  0.30 |  0.05 /  0.00 |     7 /  1 |
  |  1 | 1,000 |  1.19 /  0.85 | -0.02 /  0.04 |    21 /  1 |
  |  4 |    10 |  0.05 /  0.02 |  0.79 /  0.71 |     1 /  1 |
  |  4 |    30 |  0.09 /  0.09 |  0.94 /  0.80 |     1 /  1 |
  |  4 |   100 |  0.39 /  0.25 |  0.53 /  0.70 |     8 /  1 |
  |  4 |   300 |  1.15 /  0.90 |  0.63 /  0.53 |    24 /  1 |
  |  4 | 1,000 |  4.17 /  3.96 |  0.57 /  0.77 |    80 /  1 |
  | 16 |    10 |  0.14 /  0.19 |  3.63 /  3.58 |     1 /  3 |
  | 16 |    30 |  0.32 /  0.40 |  3.85 /  3.61 |     1 /  3 |
  | 16 |   100 |  1.48 /  1.51 |  3.66 /  3.71 |    31 /  3 |
  | 16 |   300 |  4.44 /  4.56 |  3.62 /  3.00 |    96 /  3 |
  | 16 | 1,000 | 14.42 / 15.00 |  1.74 /  1.69 |   319 /  3 |
  | 64 |    10 |  0.41 /  0.47 |  7.54 /  6.81 |     2 / 10 |
  | 64 |    30 |  1.04 /  1.10 |  7.24 /  7.85 |     3 / 10 |
  | 64 |   100 |  4.70 /  5.69 |  6.77 /  7.63 |   122 / 10 |
  | 64 |   300 | 17.14 / 17.54 |  5.67 /  5.78 |   383 / 10 |
  | 64 | 1,000 | 57.57 / 58.67 |  5.35 /  5.39 | 1,274 / 10 |

  Interpolating linearly between the 100 and 300 rungs, the crossing falls
  at 143 / 210 commands for 4 layers, 245 / 217 for 16, and 131 / 128 for 64.
  Submission runs about 0.75–1.2 us a command from 300 commands a layer up;
  the renderer's own `render()` time is about a third of that, and the rest is
  the GPU process and the GPU. A composited layer costs 0.08–0.25 ms, almost
  none of it in `render()` (0.04–0.09 ms for the whole composite frame).

  **With one layer changing every frame, the crossing moves to about 300
  commands a layer, and past 1,000 for a single layer.** The changed layer
  draws into an offscreen buffer as a group with one copy effect, then
  composites with the rest (`compositeDirty`), against submitting every layer
  with that one's `deps` changing (`submitDirty`). The copy is a full-buffer
  pass a real layer texture would not need, so the composite side is an upper
  bound. ms a frame over the control, `pass 1 / pass 2`:

  | Layers | Cmds a layer | Submit, one dirty | Composite, one dirty |
  |---:|---:|---:|---:|
  |  1 |   100 |  0.17 /  0.20 |  0.63 /  0.63 |
  |  1 |   300 |  0.43 /  0.45 |  0.88 /  0.87 |
  |  1 | 1,000 |  1.42 /  1.17 |  1.79 /  1.54 |
  |  4 |   300 |  1.64 /  1.50 |  2.31 /  2.33 |
  |  4 | 1,000 |  5.13 /  6.91 |  3.06 /  3.27 |
  | 16 |   100 |  2.69 /  2.58 |  6.64 /  7.14 |
  | 16 |   300 |  6.32 /  6.12 |  5.74 /  5.85 |
  | 16 | 1,000 | 14.53 / 14.74 |  2.63 /  2.70 |
  | 64 |   100 |  5.86 /  5.17 |  8.64 /  7.89 |
  | 64 |   300 | 16.94 / 17.06 |  6.75 /  6.72 |
  | 64 | 1,000 | 58.96 / 57.77 |  7.09 /  7.02 |

  A dirty layer adds 0.4–3.5 ms to the composite frame, most at 16 layers;
  submitting barely notices it, since rebuilding one layer's command tree is
  cheap next to submitting it. Full rows are in the result files.

  Still left out, both counting against building it: the texture memory, 16 MB
  a layer at this canvas size (1 GB at 64 layers); and quads bounded to a
  layer's content rather than the whole canvas, which would cost less fill and
  memory than measured here.

  Unexplained: the composite frame is identical down a layer count, yet it
  falls from 3.6 to 1.7 ms at 16 layers and 7.5 to 5.4 at 64 as the submit
  frames interleaved beside it get heavier. One reading, not checked: heavy
  neighbors hold the GPU at a higher clock. And one composited layer measures
  near zero while four measure 0.5–0.9 ms.

  Measured on teitou (Apple M5 Max, ANGLE Metal, headless Chromium 153),
  2026-10-07, at the spec in `7e16a79d7`, and the dirty rows at `a91417aea`,
  whose clean rows reproduce the first run; load average 2.4–4.3 on 18 cores,
  no other fleet job running. Result files:
  `tests/perf/recorded/layer-dispatch-2026-10-07/` and
  `tests/perf/recorded/layer-dispatch-dirty-2026-10-07/`. One GPU and backend
  only.
- **(P3) No pull request runs the benchmarks.** Every benchmark lives in `tests/perf/` and writes a
  result file per run; nothing gates anything. The vitest microbenchmarks keep a committed baseline
  in `tests/perf/bench/`. `tests/perf/README.md` argues a hard threshold on shared runners would
  have to be loose enough to miss real regressions. Ruled 2026-10-11: a pull request job runs the
  benchmarks on both revisions and posts the `npm run perf:compare` table as a comment, and it never
  fails the build. That leaves writing the job.

- **(P2) A scene's `generateId` is honored by `scene.add` only.** `createScene({ generateId })`
  mints ids for `scene.add` (`core/scene/scene.ts`), and five other minters ignore it, each with its
  own module-level counter and a comment saying it mirrors the scene's private scheme:
  `interactions/actions/defaults/freshNodeId.ts`, `defaults/group.ts`, `canvas/sceneAdapter.ts` (two
  sites; one says "The scene's own `generateId` isn't reachable from the adapter"),
  `packages/svg/src/unpack.ts`, and `core/adapters/arrayAdapter.ts` (which uses
  `crypto.randomUUID()`, a third format). A consumer whose ids are server-assigned or sortable gets
  a second scheme in the same document from Cmd+G, Cmd+D, paste, an SVG drop, or a tool whose
  factory omits `id`. Expose the minter on the scene and have all five call it.

- **(P2) `mod` is drawn as ⌘ on every platform by `formatShortcut`.**
  `packages/ui/src/components/ToolPalette/formatShortcut.ts` pushes `⌘` for `mod` with no platform
  read, so on Windows and Linux `ActionBar`, the prefs leaf actions, `PrefSchemaEditor`, and
  labkit's `LabZoom` show `⌘,` for a binding the dispatcher matches on Ctrl; `Keycaps` in the same
  package does detect the platform, so one app shows `Ctrl` in a keycap and `⌘` in a tooltip. Behind
  it, what `mod` means and what it looks like are decided separately: routing's dispatcher tests
  `/mac/i` on `navigator.platform || navigator.userAgent` (`useGestureDispatcher.tsx`),
  `Keycaps/keySpecsFromMods.ts`'s `detectPlatform` reads `userAgentData.platform ?? userAgent`,
  treats iPhone and iPad as macOS, and answers `'macos'` for anything unrecognized, and two demos
  carry their own regexes that differ from each other (`GestureGrammarDemo.tsx`, `RoutingDemo.tsx`).
  One `isApplePlatform()` in `@weasel-js/gestures`, beside `matchModifiers(e, mods, isMac)`, read by
  all of them.

- **(P3) The root `prepublishOnly` never fires, and CLAUDE.md says `check:bumps` runs there.** The
  root package is private and the release workflow does not call the script, so its chain
  (`check:bumps`, `check:test-projects`, `typecheck`, `lint`, `test`, the builds, and the smoke
  checks) runs only when someone types it. CI and `release.yml` each run `check:bumps` themselves;
  CLAUDE.md's "Releases" section lists `prepublishOnly` as a third place. `audit:jsdoc` and
  `lint:ref-writes` also run nowhere, and neither can fail: both print a report and exit 0.

- **(P3) Overlays sit on two unrelated z-index scales.** The theme defines `--wzl-z-toolbar`,
  `--wzl-z-overlay`, and `--wzl-z-modal` as 10, 20, and 30. `Dialog` (1000), `Toast` (1100),
  `Tooltip` and `Callout` (1200), core's debug HUDs (900), labkit's `DragGhost` (9999), and
  `pointerDrag`'s cloned ghost (10000, set in script) are literals; ui's `DragGhost`, labkit's
  `Lightbox`, `ViewportRegion`, `LabSwitcher`, and `LabShell`, and draw's HUDs read the tokens. So
  the token named "modal" is below every real modal, a consumer retuning `--wzl-z-modal` moves the
  lightbox and none of the dialogs, and ui's `DragGhost` (20) dragged out of a list inside a
  `Dialog` (1000) can draw behind it. Extend the ladder to the layers that exist (hud, modal, toast,
  popover, drag) and have every site read a token.

- **(P3) labkit inlines siblings that own module state.** `packages/labkit/tsup.config.ts` bundles
  every `@weasel-js/*` sibling except core and theme, and its own comment gives the reason those two
  are external: a module-global registry inlined twice is two registries. The same holds for
  `@weasel-js/quantity` (`registerDisplayKind` writes a module-level map, so a kind an app registers
  is unknown to the copy inside labkit's `dist`, and `displayKindOf` falls back to decimal without a
  warning), `@weasel-js/storage` (`memorySubscribers`), and `@weasel-js/ui` (`RecentColorsProvider`,
  the overlay portal host). labkit also lists those siblings as `dependencies`, so a consumer
  installs one copy and runs another. In the repo, aliases resolve both to one source, so no test
  can see it.

- **(P3) Dev aliases, tsconfig `paths`, and `exports` are three hand-kept maps that disagree.**
  `scripts/vite-aliases.ts` sends `@weasel-js/<pkg>/<tail>` to `packages/<pkg>/src/<tail>` for any
  tail. `@weasel-js/diagram/layout` is published from `src/layout.entry.ts` and the alias resolves
  it to `src/layout.ts`, a different module with different exports; `@weasel-js/labkit/weasel-ui`
  works only where a config overrides the alias by hand; and a subpath no `exports` map publishes
  resolves in every dev server and test (`@weasel-js/labkit/styles.less` in seven app and demo
  files, `@weasel-js/labkit/theme/interstellar` in `apps/forge/themes.ts`).
  `packages/core/tsconfig.json` maps nine siblings to source and leaves `paint`, `text`, `font`,
  `cursor`, `quantity`, and `prefs` to resolve to their built `dist`. Generate the aliases and the
  `paths` from each package's `exports` and build entries, and reject a subpath that is not
  exported.

- **(P3) There is no shared subscribe/notify primitive, and the hand-rolled ones notify two ways.**
  About 46 stores across 18 packages each keep their own listener `Set`. Some notify over a snapshot
  (prefs, storage, modes, `keyState`, `PointerContext`), and others iterate the live set (the scene,
  history and its journal, `select/store.ts`, the dispatcher, `poseFeed`, `poseOverrides`,
  `imageCache`, `reflectable`, `createTimeline`), so a listener that subscribes during a notify is
  called in the same pass on the second kind and not on the first. None isolates a throwing
  listener. One `createEmitter()` with stated semantics in a leaf package every tier can reach
  (`@weasel-js/registry`).

- **(P3) Hex and CSS color parsing is implemented in six places that accept different inputs.**
  core's `renderer/math/color.ts` `parseHex` takes 3, 4, 6, and 8 digits and throws otherwise.
  `paint/src/colorSpaces.ts` `hexToOklchDeg` and `theme/src/engine/color/oklch.ts` `hexToRgb` run
  `parseInt` on whatever follows the `#` with no length check, so `#abc` reads as `#000abc` and an
  8-digit hex shifts its alpha byte into blue; `ui/src/color/ramp.ts` and
  `theme/src/engine/semantics.ts` call those. `paint/src/palette.ts`, `theme/src/dtcg/color.ts`, and
  `ui`'s `TokenPanel/color.ts` each have another. The complete parser lives in core, which paint and
  theme sit below; move it to `@weasel-js/paint` and have the rest import it.

- **(P3) `isPlainObject`, `shallowEqual`, and `clamp` have no home below core.** core's
  `isPlainObject` is realm-safe; `prefs/src/repair.ts`, three files in `theme/src`,
  `labkit/src/state/labRecords.ts`, and `forge/src/shell/globals.ts` use
  `typeof v === 'object' && v !== null && !Array.isArray(v)`, which accepts a `Date` or a `Map`.
  Scalar `clamp` is defined locally in ten places and `@weasel-js/geom` exports none. Put
  `isPlainObject` in a leaf, re-export it from core, and add `clamp` to geom's scalars.

- **(P3) `@weasel-js/loupe` peers on all of core for one function and one type.** Its model is
  framework-free and `sideEffects: false`, and it imports `normalizeZoom` and the `View` type from
  `@weasel-js/core`, which makes core, and React through it, a requirement of anything using the
  model. The view math has no React in it and belongs in geom. Related: the kit's 2D point type
  `Point2` is declared in `@weasel-js/routing`, and core's `Vec2` aliases it.

- **(P3) Three drag-ghost implementations.** core's `pointerDrag` `defaultGhost` clones the source,
  ui's `DragGhost` portals to the themed host, and labkit's `dragdrop/DragGhost` is a third. They
  sit at three stacking levels, and only ui's corrects for a transformed containing block, so
  labkit's and core's `position: fixed` ghosts are offset inside a transformed ancestor (read from
  the CSS and the clone code, not rendered). labkit's should render ui's.

- **(P3) Manifest and check-script loose ends.** `@weasel-js/labkit` lists `@weasel-js/kernel3d` in
  `dependencies` and only `packages/labkit/examples/3d-lab/`, which is not published, imports it.
  `@weasel-js/d3` declares a `react` peer and no source file imports React.
  `check:frame-loops` reads only `requestAnimationFrame`: a `setInterval` loop passes, and its
  allowlist is per file, so a new loop in an allowlisted file passes too. `check:spacing` and `check:controls` walk `packages/ui/src` `*.css`
  only, not labkit's `.less` or the apps.

- **(P3) Four more files past a thousand lines, each with a split along its owners.**
  `canvas/SceneCanvas.tsx` (2,973 lines): the props type, `SceneCanvasInner`, and five sibling
  mounters and registrars, each of which is a file in the existing `SceneCanvas/` directory.
  `apps/draw/src/dev/RegistryDetail.tsx` (1,482): one file per named component. `canvas/NodeShape.ts`
  (991): the painter registry, and one file per built-in painter, keeping the registration at load.
  `core/src/index.ts` (1,502): per-area barrels re-exported by name. `draw.ts`, `scene.ts`,
  `Canvas.tsx`, the two dispatcher files, and draw's `App.tsx` have their own entries.