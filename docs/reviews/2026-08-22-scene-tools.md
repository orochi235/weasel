# Scene / tools review — 2026-08-22

A correctness pass over `packages/core/src/{tools,canvas,interactions,affordances}`
— the scene tree, the ops that mutate it, selection, and the tool / gesture /
action dispatch layer. For anyone picking up work in those directories: this is
what was wrong, what changed, and what was deliberately left alone.

Fourteen bugs fixed, five dead paths removed. Every fix carries a test that was
mutation-checked — broken on purpose, confirmed failing, restored. `tsc`, `lint`
and `test:kit` are green (4371 tests). The visual, perf and e2e suites were not
run; they bind fixed ports and other work was in flight. **Someone should run
`npm run test:visual` before merging** — nothing here changes a draw path
deliberately, but the pen and hit-test changes are close enough to matter.

## Fixed

**A UI-driven ongoing action could commit twice.** `Dispatcher.beginUiOngoing`
returns a control whose `end()` was guarded only by its own flag, while
`cancelAll` — tool switch, Escape via `cancelGesture`, dispatcher teardown —
ends the handle behind the control's back. A color or opacity picker releasing
afterwards ran `onEnd` again, committing over an already-cancelled gesture.
`update()` had the mirror hole: it re-opened a preview nothing could then end.

**`align.*` and `distribute.*` were permanently disabled.** Both declared
`enabled: () => ActionDisabledReason.SelectionRequired`, a constant stub of
exactly the kind `requiresSelection`'s docstring warns against, so
`evaluateEnabled` greyed out all eight `<ActionBar>` entries no matter what was
selected. Each predicate now reads the selection and matches its invoker's own
guard (two nodes for align, three for distribute).

**Four descriptor families read undeclared deps.** `buildDepsFromRequires`
builds a dispatched action's bag from `requires` and, in dev, throws on any
undeclared read. `reorder.backward` read `applyOps` without declaring it (its
`forward` twin declares all three); `align.*`, `distribute.*` and
`pathfinder.*` declared no `requires` at all. They work today only because
`ActionsRegistry.trigger`'s legacy branch and `<ActionBar>` hand-build a fixed
bag — the moment a consumer wires the explicit binding their own JSDoc tells
them to, dispatch throws in dev and no-ops in production. `declaredDeps.test.ts`
now exercises these through a bag built the way the dispatcher builds it, which
is what the per-action tests miss: they all pass dep literals.

**`ActionsRegistry.begin` ignored `requires`.** It passed a fixed seven-key bag
with no `applyOps`, and its only callers are the four paint actions, all of
which declare it. A consumer registering an `applyOps` source would find color
commits silently missing from its history. It now resolves deps the way
`trigger` does.

**A registered layer's `hitTest` got `undefined` where `draw` gets live data.**
`Canvas.hitTestExtras` hardcoded it, contradicting `RenderLayer.hitTest`'s own
contract. A consumer registering `composeAffordanceLayer(...)` — the documented
way to make chrome hittable — hit a TypeError inside the pointerdown handler
the first time an affordance read `state.multiActive`.

**`<Canvas>` never disposed its GL renderer.** Every unmount stranded a
`preserveDrawingBuffer` WebGL2 context with its program registry, texture caches
and VBOs. A host that swaps canvases (the demo site's hash routing) walks into
the browser's live-context cap.

**`useTools` returned a stale registry.** The `ToolsApi` memo read `registry` /
`ambient` out of a ref while keying only on the active tool and hotkey
callbacks, so a tool added after mount never reached `<ToolPalette>` and never
got an activation key. The memo now also keys on the set of tool ids — keying on
the assembled object itself would churn identity every render, since callers
(`SceneCanvas` included) rebuild the registry literal each time.

**An `actions` prop override deleted the default it merged onto.** `register`
replaces a slot and its disposer deletes it, so re-rendering with a rebuilt
`actions` object tore the merged descriptor out and found nothing to merge onto
next pass — Cmd+D silently unbound. The teardown now re-registers the displaced
descriptor.

**Picking and marquee answered for hidden layers.** Drawing honors layer
visibility; both hit-test walks read `scene.renderOrderNodes()` raw. After
`setLayerVisible(l, false)`, a click still resolved to the invisible node — the
press classified as `unselected-body` instead of `empty`, so a drag routed to
move instead of marquee.

**A throwing `onDrop` bricked every later pointer drag.** `beginPointerDrag`
gates on module-level `activeDrag`, and `onUp` called the consumer's `onDrop`
before `cleanup()`. `useDragHandle` also had no unmount teardown for a press
whose release never arrives.

**`snapBackOrDelete`'s `'snap-back'` policy did not snap back.** Released
outside the radius it returned `undefined`, which the behavior contract reads as
"defer", so the default translate committed and the node stayed where it was
dropped. The option name, its JSDoc and the MoveSnapDemo blurb all describe the
opposite; it now returns `null`.

**A cancelled pen handle-drag left its anchor.** `pen.dragHandle`'s `start`
appends an anchor and its cancel branch only cleared the handle state, so a
`pointercancel` — the one cancel route not preceded by a full scratch reset —
left an anchor the user never placed.

**Anchor affordances claimed presses for the wrong path.** `editAnchorsAction`
resolves the path from `dep.editingId` and ignores the affordance's `targetId`,
and the overlay paints only that path's anchors — but a region was emitted for
every selected polygon. Pressing a second selected path's vertex, where nothing
is drawn, dragged the edited path's anchor of the same index.

## Removed as unreachable

`useViewportTools` (SceneCanvas derives it all inline; only the `ViewportConfig`
type survived, in its own module), `Canvas.previewBoundsExtra` (no call site
exists or can exist), `marqueeDrawCommands` and `applyHitExistingGate` (their
consumers were the deleted insert tools) along with the public
`InsertOverlayStyle` type nothing accepts any more, and the `enableKeyboard`
options on `useAlign` / `useDistribute` (documented, never read).

`InsertOverlayStyle` is the only removal visible on the public barrel; put it
back if an external consumer still names it.

## Found and deliberately not fixed

**Align, distribute and ungroup mutate the scene directly.** They use
`scene.batch(label, () => scene.setPose(...))` where every other mutating
default builds ops and routes them through `deps.applyOps` when present. It is
undoable — `scene.batch` records — but it lands in the scene's own history
rather than a consumer's, so one Cmd+G / Cmd+Shift+G pair splits across two
undo stacks, and align skips the `geometryProjection` data-mirror pass that
`nudge` and `flip` perform. `useAlign` already has the ops-based implementation
next door. This is a coherent subsystem making one wrong choice consistently,
not a typo; collapsing it is a real refactor and wants its own change.

**The pen paints closed paths with stroke identical to fill.** `nextFill()` in
`useBuiltinShapeTools` is pure despite the name — only `freshId` advances the
counter — so the two calls that clearly intend two colors return one, and a
closed pen path's 2px outline is invisible against its own fill. Every candidate
fix changes rendered output, and the visual baselines could not be run here.

**`useHandTool`'s `inertia` and `axis` options do nothing**, and neither do
`useLassoTool`'s `mode` / `behaviors`. Both compute their values and drop them;
`<SceneCanvas viewport={{ inertia }}>` threads all the way down to nothing, and
`viewportDragPan`'s docblock asserts the opposite. `Tool.onActivate` is likewise
declared, forwarded by `defineTool`, and never invoked — only `onDeactivate` is.
Each is a public option that silently no-ops, so the fix is either implement or
delete, and that is a product call rather than a correctness one.

**`PenScratch.cursor` and `closeHintActive` are unreachable.** Nothing writes
them outside tests, so the pen's rubber-band preview and close hint never draw,
and `cursor: () => closeHintActive ? …` never varies. The tool declares no
move-time binding and no `pointerMove` gesture kind exists; feeding it a pointer
position is a design decision.

**The cascade-container-move logic is implemented twice.**
`useSceneSelectTool` wraps `setPose` to re-implement what `sceneAdapter`'s
`cascadeContainerPose: 'rect'` branch already does; nothing in the repo passes
that option. Collapsing them is safe-looking but changes an undo label.

## Suspected, not established

- `useGestureDispatcher`'s big effect captures `canvasRef.current` and keys on
  `[enabled, keyboard, canvasRef]`, so listeners would not follow a recreated
  `<canvas>` element. No path in `CanvasInner` recreates it.
- `Canvas.handlePointerLeave` clears the pointer-pressed flag, and
  `handlePointerCancel` is `undefined`. Whether either fires mid-capture in a
  real browser could not be settled from source; both would need a browser probe.
- `annulusCommand` and `annulusSemiAxes` assume the annulus cutout is centered.
  `createRotationAffordance` always satisfies that, but the type permits
  otherwise, and paint and hit-test would then disagree.
- `findZone` resolves overlapping drop zones by registration order, not DOM
  nesting. No nested-zone consumer exists to say whether that is wrong.

No tool anywhere in `tools/builtin/**` runs its own gesture or commits through
`ctx.applyBatch`, and no tool hook calls `useAction`. The dead pattern the
project guidance warns about is genuinely gone.
