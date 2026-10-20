> **Scaffolding for work in flight on branch `scene-splits`, 2026-10-12. Not built, and not verified:**
> a read-only pass wrote this and ran nothing, so each claim is checked against the code before it is
> acted on. Section B (built-in tool registry assembly) has landed and is deleted from here, and so have
> A, C, and D except for the items still listed under them, which were checked against the code and are
> written as found. E, F, G, H, I, J, and N have landed and are deleted, F except for the item still
> listed under it. Every other lettered
> section is unbuilt, and its line numbers predate all of that work.
> Delete this file when the SceneCanvas.tsx
> work it lists has merged; `docs/TODO.md` holds what is left.

# Audit: `packages/core/src/canvas/SceneCanvas.tsx`

Read at 1,395 lines (not 1,540; the checkout is being edited), with `SceneCanvasInner` at 145-1348. Unqualified line numbers are that file. "Evidence" means I read or grepped it; "inference" means reasoning. Nothing was run.

Two facts drive most of what follows.

- **The input scope is already above `SceneCanvasInner`** (evidence). `SceneCanvasWrapper` (1354-1365) wraps it in `<InputScope>`, and `Provide` (`packages/routing/src/interactions/actions/inputScope.tsx:57-65`) supplies the dep registry, actions registry, and tool node. Only `PointerProviderIfRoot` (1259) is mounted inside. So `useActionsRegistry()` and `useDepRegistry()` resolve to this canvas's own registries inside the function body, and most of the "mounter" children and the refs feeding them exist for a boundary that moved.
- **`CanvasView` is a second implementation of "one view's input wiring"** (evidence, `CanvasView.tsx:245-405`: its own `createDispatcher`, `anchorStateFrom`, `buildAffordanceAt`, `buildClassifyTarget`, `getRuleCtx`). The canvas's own view ("view zero") is hand-wired across `SceneCanvasInner` and `GestureDispatcherMounter`.

## Things that do not belong

### A. Left over from path editing

The state landed: `features/paths/pathEditState.ts` holds the editing id, the selected anchors, and
the marquee, and its `getEditingId` is the one rule (the node exists, is selected, and the mode
permits anchor editing) the dep, the anchor overlay, the suppressed set, `editingAnchors`, and the
shift-click lock all read. `SceneCanvas.pathEditMask.test.tsx` pins it.

- **The anchor hit-test is still not preview-aware.** `liveEditablePath`
  (`features/paths/editablePath.ts`) is what the overlay draws from. The two hit-test sites,
  `GestureDispatcherMounter.tsx` and `CanvasView.tsx`, take the committed path from the dep and call
  `pathFromPlane` on it through `anchorStateFrom`'s `toCamera(id, path)` callback. Routing them
  through `liveEditablePath` means changing that callback's contract in both files at once, and
  makes a hit-test during a gesture follow the preview, which is a behavior change.
- **A masked id is kept, not cleared** (run, not inferred). Deselect a node mid-edit and its anchors
  go away; select it again and it is being edited again, with no second `enterPathEdit`. That is the
  rule the dep already had. Clearing instead needs a moment to write the id, and a host's id is not
  the canvas's to clear.
- **`useEditAnchorsDepSource` still takes its state as an optional argument.** It is not a public
  export, but `usePenTool.test.tsx` and `editAnchors.test.tsx` call it without one, and it then makes
  a state of its own.

### C. `selectTool.rotate === false` is still decided three times

The preset table landed: `FEATURE_PRESETS` in `SceneCanvas/features.ts` holds each preset's actions,
tools, ambient entry, and chrome. What is left is the rotate opt-out, which was pinned and not
collapsed, because the three sites do not agree and the difference can be observed
(`SceneCanvas.rotateOff.test.tsx`, run against the code):

- `useSceneStandardActions` mutes the `rotate` action. That also covers a tool that binds `rotate`, and it
  yields to a consumer's own `actions.rotate`, which stays registered and merged.
- `chromeRules` hides `selection.rotation-handle`, and a consumer `chromeVisibility` rule can put it back.
- `useSceneCanvasTools` turns `false` into `undefined` for the rotate binding, and the rotate preset's ambient entry stays installed.
  With the handle put back, a drag on it resolves the `rotate` binding, finds the action muted, and the
  dispatcher warns `binding resolved actionId "rotate" which has no registered action`.

Dropping `rotate` from the resolved preset set would remove that warning, register `rotate` again for
a tool that binds it, and leave a partial `actions.rotate` with no default to merge onto. Each is a
behavior change that needs a decision.

### D. Left over from the chrome-caps rule context

The assembly landed: `features/chrome-caps/useChromeCaps.ts` builds the context, derives
`multiActive`, and writes the mode gate once.

- **`buildChromeCtx`, `BuildChromeCtxArgs`, and `ChromeCtx` are public and nothing in the kit calls
  them.** Removing them is an API change.
- **One ref stays in `SceneCanvasInner`:** the selection as of the last commit. `selection.current` is
  a live getter on the kit's own selection, so reading it at rule time would run ahead of the painted
  chrome.

### F. View state mirror

The mirror landed: `SceneCanvas/useCanvasCamera.ts` makes the one camera with `useCanvasView`,
`<Canvas>` takes it as `viewState`, and every reader reads its `viewRef`.

- **`resolvedViewportZoom` and the three `enabled.has('view') ? … : false` props** belong in
  `useViewportActions`, which should take `viewport` and the preset flag. Left because they are
  props of `StandardActionsRegistrar`, which section E replaces.

### K. Dead or vestigial (grep-verified)

- **`chromeSizes` (219-222).** Its only use is `handleHitRadius: chromeSizes.handle` (456), and `useSceneSelectTool`'s `selectTool` argument has no such field (`useSceneSelectTool.ts:92-104`). The `targetSizesPx` import goes with it.
- **`insertTool` (154, 515-516).** It becomes `adapter.commitInsert`, which has no non-test caller (grep `\.commitInsert`: one test, `mintId.test.ts:53`). The insert action uses the `insert` dep.
- **`nodeResolver`'s `pose` and `data` (551).** The only readers of the hit take `id` and `kind` (`useHitObserver.ts:21`) or `id` (827). `getNodeAtPoint.ts` still documents a `<Canvas getNodeAtPoint>` prop that no longer exists.
- **Duplicate refs:**
  - `useLatest(getNodeAtPoint)` at 732 and 807.
  - `useLatest(scene)` at 970 and 1232.
  - `useLatest(selection)` at 465 and 1233.
  - `liveToolsRef` (680) and `tools` (691) are the same expression.

### L. Not production component code

- **Lines 120-123:** a module-scope write of `window.__weaselCoordLog__`. No reader in `packages`, `apps`, `tests`, `scripts`, or `docs` (grep). If kept, it belongs in `coordTrace.ts`.
- **Lines 255-258:** mount/unmount `dlog`.
- **Slops (125-130, 971, 982-989, 1093).** `chromeAffordancesRef` is written by the mounter and read only by this debug layer. The view wiring owns the affordances and could register the layer itself.
- **`onToolsCreated` (171, 726-727).** Every caller in `packages` and `apps` is a test (grep), so it is test introspection carried as a prop.

### M. Pass-through props

`shaders`, `flattenTolerance`, and `backgroundFill` are destructured (186-192) only to be re-passed (1210-1222). They are still in `CanvasProps` and would ride `restProps`.

Adjacent, in `props.ts:164-168`: the `Omit` names `moveOptions`, `resizeOptions`, `rotateOptions`, `snap`, `handleHitRadius`, `selectionOptions`, and `onBackgroundClick`, none of which `CanvasProps` declares (evidence, grep of `Canvas.tsx`).

### Belongs here

- The scene bake (224-234).
- `kindClassifier` and `kindOfNode`.
- `composedAlphaFor` and the layer gate.
- The `useSceneAdapter`, `useSceneSelectTool`, and `useTools` calls.
- Dispatcher creation.
- The scene slot's and the selection overlay's layers (`useSceneSlotLayers`,
  `useSelectionOverlayLayer`), the preview and overlay layers, and `wiredLayers`.
- The camera (`useCanvasCamera`) and the dev HUDs (`DevHuds`).
- `addView`, `mergedRef`, and `viewInputs`.
- The `<Canvas>` element and the three `CanvasView` lists.

## Shared-state map

| State or ref | Lines | Writer | Readers | Smuggles past |
|---|---|---|---|---|
| `bakedScene` | 229 | init | `scene` | — |
| `internalCanvasRef` | 247 | `mergedRef` | hover, `PointerPublisher`, registrar, mounter | Canvas → siblings (real) |
| `canvasApiRef` | 250 | `mergedRef` | redraw effects, the camera's redraw, the dev HUDs, path-edit setters, registrar, mounter, keybindings | Canvas → siblings (real) |
| `canvasReady` | 253 | `mergedRef` | 1331 | ref-attach timing |
| `selectionRef` | 465 | render | mounter | dependency array |
| `layerPaintRef` | 501 | render | `layerIsPainted` | dependency array |
| `liveToolsRef` | 680 | render | test hook | dependency array |
| `onToolsCreatedRef` | 726 | render | effect 727 | dependency array |
| `getNodeAtPointRef` | 732 | render | hit observers | dependency array |
| `getNodeAtPointRefForHover` | 807 | render | hover | duplicate of 732 |
| `dispatcherRef` | 762 | init | everything gesture-related | lazy init |
| `committedSelectionRef` | — | render | `currentRuleInputs` | dependency array, and commit timing |
| `chromeAffordancesRef` | 985 | mounter insertion effect | slops layer | child → parent, debug only |
| `addedViews` | 1137 | `addView` / `remove` | JSX | — |
| `testHookSceneRef`, `testHookSelectionRef` | 1232-1233 | render | test hook | duplicates of 970 and 465 |

## Stale comments (checked against code)

- **9-10:** "`Scene` stores absolute poses…". This describes the move action, and the scene composes local poses into world ones (`core/scene/composeFrame.ts:46`).
- **214-218:** paint, hit-test, and slops "all resolve from this one object". `chromeSizes` feeds only a dead option.
- **453-454:** "so useSceneSelectTool always receives a concrete radius". It has no such option.
- **463-464:** thunks "live in an effect closure". They are `useMemo`s, and `affordanceAt` never reads the selection.
- **754-756, 1096-1098, and `StandardActionsRegistrar.tsx:179-181`:** "OUTSIDE the actions provider". See E.
- **1223-1225 and `props.ts:168`:** both discuss `onBackgroundClick`, and say opposite things about a prop that no longer exists.

## (a) Biggest simplifications, ranked

1. Landed: path-edit state, mask, live path, and overlay to `features/paths` (A).
2. Landed: chrome-caps rule context to `features/chrome-caps`, and preset chrome and bindings to the preset table (C, D).
3. Landed: the mounters are hooks, called from one `SceneCanvasInput` component ahead of the canvas's children (E).
4. Landed: one camera, made in SceneCanvas and handed to `<Canvas>` (F).
5. Landed: ingestion hook (J).
6. Landed: selection read-only view and kind labels to `core/selection` (H). The two kind classifiers stay two.
7. Landed, the other way round: SceneCanvas builds the selection overlay and `<Canvas>` does not (I).
8. Landed: scene, overrides, and the animator through `redrawOn` (G).
9. Delete the dead items and pass-through destructures (K, M).

## (b) What would be left in `SceneCanvasInner`

- Resolve the scene, device profile, pose descriptor, and enabled presets.
- Selection (the prop, or the internal one), made read-only when `selectable` is false.
- Adapter, pickers and bounds, and node kinds.
- Tools (the resolver, or the takeover) and preset contributions.
- Dispatcher, path-edit state, and chrome caps, each one call.
- Layer map: scene slot, preview ghost, dispatcher overlay, and path-edit overlay.
- Ref handle: `ingest`, camera, and `addView`.
- JSX: providers, `<Canvas>`, the input and action hooks, views, and children.

## (c) Not determined

- **View zero as a `CanvasView`.** I read `CanvasView.tsx` only at 245-405. If view zero could be one, `SceneCanvasInput` could go, but that is a design question I could not settle by reading.
- **Unread files.** `Canvas.tsx` was read by targeted grep, not line by line. Of the `SceneCanvas/` siblings I did not read `usePreviewGhostLayer`, `useDispatcherOverlayLayer`, `contributionFrameHooks`, `defaultNodeProperties`, `poseGeometry`, or any tests.
- **Greps covered this repo only.** Readers outside it of `__weaselCoordLog__`, `NodeAtPointHit.pose` and `.data`, or `insertTool` are unknown.
## From the Canvas.tsx pass

Canvas findings 2, 3, and 8 landed here: the scene slot and the selection overlay are built in
SceneCanvas, the dev HUDs are mounted by it, and the slot types are in `layerSlots.ts`.

- Canvas findings 1 and 4 (cursor resolution into routing; the `clientToWorld` prop the dispatcher
  never sees) are not done. Neither was in this branch's scope.
- `SceneCanvas/props.ts` may restate an old z-order. Verified there: `backgroundFill` sits beneath
  everything including the grid; `decorationLayer` sits above every slot and custom layer and beneath
  a tool's `'top'` overlays.
- Canvas's `onFocus` / `onBlur` now receive the DOM `FocusEvent`, which reaches `SceneCanvasProps`
  through the `Omit`.
