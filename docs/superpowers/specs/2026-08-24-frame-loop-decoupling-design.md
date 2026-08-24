# Decoupling the frame loop from React

**What this is:** the design for two seams the scene graph is missing under
continuous motion — a paint loop that does not require a React render, and a
write path for per-frame state that does not go into the undo stack.

**Who it's for:** whoever implements it. Assumes the kit's rendering path
(`SceneCanvas` → `Canvas` → `RenderLayer[]` → renderer) and that `Scene` is the
retained tree with history over it.

**What it answers:** why a moving camera currently forces a React render per
frame, what decoupling costs, and where per-frame poses should live if not in
the document.

---

## The constraint

Two independent couplings make continuous motion expensive.

**Every repaint is a React render.** `requestRedraw` is
`setRedrawNonce(n => n + 1)` (`Canvas.tsx:780`), the paint is a `useEffect`
keyed on `[layersWithDebug, width, height, effectiveView, redrawNonce, …]`
(`Canvas.tsx:1284`), and `view` is either a prop or `SceneCanvas`'s own
`useState` (`SceneCanvas.tsx:961`). There is no imperative path: the ref handle
carries `requestRedraw`, `registerLayer`, `hitTestExtras` and `ingest`
(`canvasExtension.ts:24-69`), and none of them paints without going through
React.

**Every write is an undo entry.** `scene.setPose` runs `executeAndLog`
(`scene.ts:566`) → `history.applyOps` + `notify()`. `scene.batch` reduces a
frame to one entry and one notify, which at 120 Hz is still 120 entries per
second. The only escape today is `getActiveJournal` with periodic `cancel()`,
and that journal's inner history is itself unbounded.

The consequence is visible in the repo. `SideScrollerDemo` pins `view` to
identity and hand-projects every layer specifically to keep its loop out of
React state — and once the view is identity, scene nodes cannot be used at all,
because they project through it. That is how a demo in a scene-graph library
ended up with the scene graph switched off.

`SceneScrollerDemo` is the same platformer built the other way, and it prices
the couplings (120 Hz display, DevTools tracing on, so read the ratios not the
absolute milliseconds):

| | immediate | scene graph |
|---|---|---|
| main-thread busy / s | 1.00× | 1.27× |
| busy per committed frame | 6.31 ms | 11.57 ms |
| major GC over 10 s | 57 ms | 549 ms |

Unloaded, both hold 120 fps. Part 2 is where the GC delta comes from.

---

## Part 1 — paint without a render

### The change

`Canvas` owns a frame loop. `requestRedraw` sets `dirtyRef.current = true`; a
`requestAnimationFrame` loop paints when dirty and clears the flag. React
renders write their inputs — layer set, dims, debug config, all of which change
rarely — into refs and mark dirty on the way past. The paint body does not move;
only its trigger does.

`view` becomes a ref with a setter that marks dirty, exposed on the canvas
handle:

```ts
interface CanvasExtensionApi {
  // …existing members
  /** Set the view without a React render. The next frame paints with it. */
  setView(next: View | ((current: View) => View)): void;
  /** Current view, readable mid-frame. */
  getView(): View;
  /** Notified after each committed paint, for chrome that mirrors the view. */
  subscribeView(fn: (view: View) => void): () => void;
}
```

The `view` / `defaultView` / `onViewChange` props stay exactly as they are. A
consumer that supplies `view` still gets controlled behavior; `setView` is
refused in that mode rather than fighting the prop. `subscribeView` is how a
zoom readout or a minimap keeps up without the canvas re-rendering to tell it.

`useScene`'s `useSyncExternalStore` (`useScene.ts:76`) re-renders the host on
every mutation, which a frame loop never needs. Add a non-subscribing form —
`useSceneRef`, or an option on `useScene` — that returns the same `Scene`
without the subscription. Consumers rendering DOM from scene data keep the
subscribing form.

### What it costs

**Not concurrency.** `useSyncExternalStore` already de-opts external-store
updates from concurrent rendering to prevent tearing, so today every scene
mutation forces a blocking render — 120 per second under a game loop,
competing with everything else scheduled. Decoupling stops spending concurrency
rather than starting to.

**Single-commit consistency between React-rendered DOM and canvas pixels.**
Today both come out of one commit. After, the canvas can be one frame ahead of
DOM derived from the same scene. Three cases, worth separating:

- Readouts, counts, layer panels: one frame stale during motion, invisible.
- DOM anchored to world coordinates — the text-edit overlay
  (`useSceneTextEdit.getScreenPose`), tooltips pinned to a node, DOM handles:
  shears during fast pans. These must move to `subscribeView` and be positioned
  from the same frame, not from React state.
- **Scene-derived DOM inside `startTransition`: unbounded divergence.** React
  defers it deliberately; nothing forces it to catch up. Today `uSES` prevents
  this by force. This is the one case that needs a stated rule rather than a
  mitigation — *do not render scene-derived DOM inside a transition* — and a
  dev-mode warning if that is detectable.

Version-stamping keeps the guarantee available where it is wanted: the paint
records the `scene.getVersion()` it drew, `getPaintedVersion()` exposes it, and
chrome that must be in lockstep can compare and defer one frame. A `syncPaint`
prop restores today's behavior wholesale — paint in a layout effect after commit
— for consumers with heavy DOM chrome pinned to canvas content.

**Test and lifecycle work**, all one-time: `act()` no longer implies painted, so
component tests and the visual baselines need a frame tick; the rAF loop needs
explicit ownership under StrictMode double-mount and must stop for hidden trees;
per-frame work disappears from the React profiler.

---

## Part 2 — where per-frame poses belong

### The real problem

A 60 Hz pose is not a document edit. Nothing about it should be undoable,
serialized, or coalesced — it is presentation state, and it goes into the
document tree today only because there is nowhere else to put it. Animation
tweens, drag previews, simulation ticks and this game loop all want the same
thing, and each currently improvises: `animateOnSetPose` wraps the adapter,
drag previews write and roll back, `useSimulation` refuses to touch the adapter
at all and hands the caller mutated nodes instead
(`features/simulation/README.md`).

A "skip history" flag would paper over this. The missing concept is an
**ephemeral pose override**: a per-node pose the renderer composes over the
document pose, never recorded, never serialized, cleared wholesale.

```ts
interface Scene<TData, TLayer, TPose> {
  // …existing members
  /** Ephemeral per-node pose overrides. Not recorded, not serialized.
   *  The renderer reads the override when present, the document pose when not. */
  readonly overrides: PoseOverrides<TPose>;
}

interface PoseOverrides<TPose> {
  set(id: NodeId, pose: TPose): void;
  clear(id: NodeId): void;
  clearAll(): void;
  /** One bump per frame invalidates painter memos for overridden nodes only. */
  commit(): void;
}
```

`buildSceneTree` reads through the override when resolving each node's pose;
everything downstream is unchanged, because it already receives a pose rather
than reading `node.pose` itself. Undo, `toJSON` and the history journal never
see overrides. A consumer that wants a frame's state to *become* document state
— dropping a dragged node, baking an animation — writes it once through
`setPose` and clears the override.

### Why this also fixes the GC

`nodeMemo` keys painter output on pose *reference* (`nodeMemo.ts:1-28`) and
`kit:setPose` replaces it (`scene.ts:395`), so correct code must allocate a
fresh pose object per moving node per frame. In `SceneScrollerDemo` that is ~27
objects at 120 Hz — about 3,200 per second — and major GC rises from 57 ms to
549 ms over ten seconds.

An override buffer can be mutated in place, because invalidation stops being
reference identity and becomes the generation `commit()` bumps. That removes the
allocation without weakening the memo for document poses, which keep their
current semantics.

### Scope

An override that carries only `pose` covers animation, dragging, simulation and
this demo. Alpha, tint and per-frame scale currently live in consumer refs read
inside `drawOne` (`TimelineDemo.tsx:88`, `AnimationDemo.tsx:63`), which is the
same pattern wanting the same home — worth designing the override map as
`Partial<TPose> & { alpha?, … }` from the start rather than discovering it later.

---

## Sequencing

Part 1 and part 2 are independent and either can land first. Part 1 is the
larger change and the one with a behavioral rule attached; part 2 is contained
to the scene and the tree builder.

Out of scope: the scene tree composes clips, not transforms
(`buildSceneTree.ts:42`, `composePose.ts:45`). Rotation-aware pose composition
is its own arc — it changes move, resize and hit-testing semantics repo-wide.
