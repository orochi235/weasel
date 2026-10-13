> **Scaffolding for work in flight on branch `scene-splits`, 2026-10-12. Not built, and not verified:**
> a read-only pass wrote this and ran nothing, so each claim is checked against the code before it is
> acted on. Section B (built-in tool registry assembly) has landed and is deleted from here, and so have
> A, C, and D except for the items still listed under them, which were checked against the code and are
> written as found. F was checked and is written as found. Every other lettered section is unbuilt,
> and its line numbers predate all of that work.
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

- `resolvedActions` mutes the `rotate` action. That also covers a tool that binds `rotate`, and it
  yields to a consumer's own `actions.rotate`, which stays registered and merged.
- `chromeRules` hides `selection.rotation-handle`, and a consumer `chromeVisibility` rule can put it back.
- `rotateOptions` turns `false` into `undefined`, and the rotate preset's ambient entry stays installed.
  With the handle put back, a drag on it resolves the `rotate` binding, finds the action muted, and the
  dispatcher warns `binding resolved actionId "rotate" which has no registered action`.

Dropping `rotate` from the resolved preset set would remove that warning, register `rotate` again for
a tool that binds it, and leave a partial `actions.rotate` with no default to merge onto. Each is a
behavior change that needs a decision.

### D. Left over from the chrome-caps rule context

The assembly landed: `features/chrome-caps/useChromeCaps.ts` builds the context, derives
`multiActive`, and writes the mode gate once.

- **`modifiers` is not vestigial.** The `modifierHeld` condition (`conditions.ts`, exported) compiles to
  a selector that `routing/src/eligibility/rule.ts` evaluates against `ctx.modifiers`. What is true is
  that `<SceneCanvas>` always supplies all-false, so `modifierHeld` can never match on one. The fix is
  a source of held modifiers for `surfaceRuleCtx`, not removing the field.
- **`buildChromeCtx`, `BuildChromeCtxArgs`, and `ChromeCtx` are public and nothing in the kit calls
  them.** Removing them is an API change.
- **One ref stays in `SceneCanvasInner`:** the selection as of the last commit. `selection.current` is
  a live getter on the kit's own selection, so reading it at rule time would run ahead of the painted
  chrome.

### E. Mounter children and the refs that feed them

Lines 757, 762-768, 1099, 1263-1333.

- **`getActionRef` (757) and `actionsRegistryRef` (1099)** carry the actions registry up from `StandardActionsRegistrar` (its lines 188-207). The registry is in scope here, so they are vestigial. `ingestImpl`'s "registry not mounted yet" branch (1122-1127) goes with them.
- **The registrar takes 37 props (1263-1299)**, mostly values this function computed only to hand down.
- **`ToolKeybindingsMounter`** is misnamed: it also installs every contribution's actions, deps, and `attach` (`useContributionRoles`). It needs two `useKeybindings` calls because the takeover branch is decided above it.
- **Mounter props that are constant gates** (evidence): `boundsOf` is read only in `if (!selectionRef || !boundsOf || !viewRef) return undefined` (`GestureDispatcherMounter.tsx:151`), and all three are always passed.
- **Safe to convert to hooks when:** `PointerProviderIfRoot` moves into the wrapper (the registrar calls `usePointerContext()`), and the ordering the registrar relies on is kept. The registrar's own comment at 264-270 depends on child effects running before parent effects.

### F. View state mirror

Checked against the code after the `Canvas.tsx` pass merged. Not built: it cannot be done inside
SceneCanvas's own files.

- **`currentViewRef` is a third copy of the view**, beside the `viewRef` `<Canvas>` holds through
  `useCanvasView` and the prop. It has three writers: the seed from `view` / `defaultView`, an
  insertion effect that adopts a controlled `view`, and a `subscribeView` subscription that starts
  once the handle is attached.
- **Readers:** `useSceneSelectTool`'s `getView`, hover's picker view, the rule inputs, the camera
  channel's `get`, the test hook, the registrar (`currentViewRef`, for ingestion and the view deps),
  and the mounter's `viewRef`. Each wants the view in effect, synchronously, and the first three are
  read during or before the first commit, when the handle is still null.
- **`handleViewChange` re-implements the controlled/uncontrolled fork.** Uncontrolled it calls the
  handle's `setView`, which clamps to `viewBounds`. Controlled it calls `onViewChange` itself and
  skips the clamp. It is the `view.set` dep and the camera channel's `set`, so every pan, zoom, and
  animation frame goes through it.
- **Why the handle is not enough.** Its `setView` is the imperative write: controlled, it warns once
  per mount and forwards. Input needs `useCanvasView`'s `setViewFromInput`, which forwards without
  the warning, and the handle does not publish it. Its `getView` answers nothing before mount.
- **Smallest change:** `<Canvas>` publishes the input write (on the handle, or by taking a view
  state made by a `useCanvasView` call one level up, in `SceneCanvasInner`). `handleViewChange`
  becomes that call and the mirror becomes that hook's `viewRef`. Either is an edit to `Canvas.tsx`,
  and the first adds a member to the public `CanvasExtensionApi`.
- **What would change:** a controlled `<SceneCanvas view viewBounds>` would hand `onViewChange` a
  clamped view where it now hands the raw one.
- **`resolvedViewportZoom` and the three `enabled.has('view') ? … : false` props** belong in
  `useViewportActions`, which should take `viewport` and the preset flag.

### G. Redraw subscriptions

Lines 269-297. The effects for `scene.subscribe` and `scene.overrides.subscribe` do by hand what `redrawOn` does. Both match `RedrawSource` (`subscribe(listener) → unsubscribe`, `core/layers/render.ts:44`), and 240-243 already appends `modes` that way. `animator.onTick` has a different shape and would need adapting.

### H. Selection

Lines 350-408.

- **The read-only wrapper for `selectable={false}` (364-384)** belongs in `core/selection`. No such helper exists (evidence, grep).
- **`selectionKinds` (389-407) is a second node-kind classifier** beside `kindClassifier` (470-476), with different answers. The routing default calls `{ path }` data `'path'` (`SceneCanvas/defaultNodeRouting.ts:37-41`); this one calls a pose with `.kind` `'path'` and a container `'group'`. Owner: the selection-context publisher.

### I. Selection overlay prebuild

Lines 1042-1079. `<Canvas>` builds the same layer with the same `poseById` handling (evidence, `Canvas.tsx:862-871`). The only addition here is merging `getSuppressedIds`, which the slot config already accepts (1058). Passing a merged config removes the `createSelectionOverlayLayer` import and the `descriptor` dependency.

### J. Ingestion

Lines 260-267, 1096-1134. Handler registration, the clipboard context, and `ingestImpl` belong in a `features/ingestion` hook. `ingestionClipboard` is built here only "where the typed adapter is in scope" (`StandardActionsRegistrar.tsx:176-178`), and is then cast untyped at 1111.

### K. Dead or vestigial (grep-verified)

- **`chromeSizes` (219-222).** Its only use is `handleHitRadius: chromeSizes.handle` (456), and `useSceneSelectTool`'s `selectTool` argument has no such field (`useSceneSelectTool.ts:92-104`). The `targetSizesPx` import goes with it.
- **`actionDefaults` (181, 1267).** It appears in the registrar's prop type (`StandardActionsRegistrar.tsx:95`) but not its destructure (57-91), and `props.ts:532` marks it "unused after legacy-bridge removal".
- **`insertTool` (154, 515-516).** It becomes `adapter.commitInsert`, which has no non-test caller (grep `\.commitInsert`: one test, `mintId.test.ts:53`). The insert action uses the `insert` dep.
- **`nodeResolver`'s `pose` and `data` (551).** The only readers of the hit take `id` and `kind` (`useHitObserver.ts:21`) or `id` (827). `getNodeAtPoint.ts` still documents a `<Canvas getNodeAtPoint>` prop that no longer exists.
- **Duplicate refs:**
  - `useLatest(getNodeAtPoint)` at 732 and 807.
  - `useLatest(scene)` at 970 and 1232.
  - `useLatest(selection)` at 465 and 1233.
  - `liveToolsRef` (680) and `tools` (691) are the same expression.
- **The outer `<>` at 1258 and 1344** is redundant.

### L. Not production component code

- **Lines 120-123:** a module-scope write of `window.__weaselCoordLog__`. No reader in `packages`, `apps`, `tests`, `scripts`, or `docs` (grep). If kept, it belongs in `coordTrace.ts`.
- **Lines 255-258:** mount/unmount `dlog`.
- **Lines 1231-1253:** the test hook. It has real readers (`tests/e2e/fixtures.ts`, `tests/e2e/path-anchor-edit.spec.ts`, `tests/visual/text-edit-overlay.spec.ts`), but it costs two extra refs here. Owner: a `test-hook` hook or contribution reading from context.
- **Slops (125-130, 971, 982-989, 1093).** `chromeAffordancesRef` is written by the mounter and read only by this debug layer. The view wiring owns the affordances and could register the layer itself.
- **`onToolsCreated` (171, 726-727).** Every caller in `packages` and `apps` is a test (grep), so it is test introspection carried as a prop.

### M. Pass-through props

`shaders`, `flattenTolerance`, `backgroundFill`, `cursorCoordsHud`, `pickHud`, and `modalityHud` are destructured (186-192) only to be re-passed (1210-1222). They are still in `CanvasProps` and would ride `restProps`.

Adjacent, in `props.ts:164-168`: the `Omit` names `moveOptions`, `resizeOptions`, `rotateOptions`, `snap`, `handleHitRadius`, `selectionOptions`, and `onBackgroundClick`, none of which `CanvasProps` declares (evidence, grep of `Canvas.tsx`).

### N. Device profile resolved twice

`useDeviceProfile(device)` runs at 212, and `<DeviceProfileProvider value={device}>` (1256) calls it again (`core/device/useDeviceProfile.ts:126-129`). That is two sets of media-query listeners. The provider should take the resolved profile.

### Belongs here

- The scene bake (224-234), though `isSerialized` belongs in `core/scene`.
- `kindClassifier` and `kindOfNode`.
- `composedAlphaFor` and the layer gate.
- The `useSceneAdapter`, `useSceneSelectTool`, and `useTools` calls.
- Dispatcher creation.
- `sceneSlot`, the preview and overlay layers, and `wiredLayers`.
- `addView`, `mergedRef`, and `viewInputs`.
- The `<Canvas>` element and the three `CanvasView` lists.

## Shared-state map

| State or ref | Lines | Writer | Readers | Smuggles past |
|---|---|---|---|---|
| `bakedScene` | 229 | init | `scene` | — |
| `internalCanvasRef` | 247 | `mergedRef` | hover, `PointerPublisher`, registrar, mounter | Canvas → siblings (real) |
| `canvasApiRef` | 250 | `mergedRef` | redraw effects, `handleViewChange`, path-edit setters, registrar, mounter, keybindings | Canvas → siblings (real) |
| `canvasReady` | 253 | `mergedRef` | view subscription, 1331 | ref-attach timing |
| `currentViewRef` | — | seed, insertion effect, subscription | select tool, hover, rule inputs, camera channel, test hook, registrar, mounter | Canvas-owned view read above Canvas |
| `selectionRef` | 465 | render | mounter | dependency array |
| `layerPaintRef` | 501 | render | `layerIsPainted` | dependency array |
| `liveToolsRef` | 680 | render | test hook | dependency array |
| `onToolsCreatedRef` | 726 | render | effect 727 | dependency array |
| `getNodeAtPointRef` | 732 | render | hit observers | dependency array |
| `getNodeAtPointRefForHover` | 807 | render | hover | duplicate of 732 |
| `getActionRef` | 757 | registrar effect | dispatcher `getAction` | provider boundary that is gone |
| `dispatcherRef` | 762 | init | everything gesture-related | lazy init |
| `committedSelectionRef` | — | render | `currentRuleInputs` | dependency array, and commit timing |
| `chromeAffordancesRef` | 985 | mounter insertion effect | slops layer | child → parent, debug only |
| `actionsRegistryRef` | 1099 | registrar effect | `ingestImpl` | provider boundary that is gone |
| `ingestionClipboardOmitted` | 1107 | render | clipboard ctx | dependency array |
| `addedViews` | 1137 | `addView` / `remove` | JSX | — |
| `testHookSceneRef`, `testHookSelectionRef` | 1232-1233 | render | test hook | duplicates of 970 and 465 |

## Stale comments (checked against code)

- **9-10:** "`Scene` stores absolute poses…". This describes the move action, and the scene composes local poses into world ones (`core/scene/composeFrame.ts:46`).
- **209-211:** "Resolved once here and provided to the subtree". See N.
- **214-218:** paint, hit-test, and slops "all resolve from this one object". `chromeSizes` feeds only a dead option.
- **453-454:** "so useSceneSelectTool always receives a concrete radius". It has no such option.
- **463-464:** thunks "live in an effect closure". They are `useMemo`s, and `affordanceAt` never reads the selection.
- **754-756, 1096-1098, and `StandardActionsRegistrar.tsx:179-181`:** "OUTSIDE the actions provider". See E.
- **1223-1225 and `props.ts:168`:** both discuss `onBackgroundClick`, and say opposite things about a prop that no longer exists.

## (a) Biggest simplifications, ranked

1. Landed: path-edit state, mask, live path, and overlay to `features/paths` (A).
2. Landed: chrome-caps rule context to `features/chrome-caps`, and preset chrome and bindings to the preset table (C, D).
3. Mounters become hooks, removing `getActionRef`, `actionsRegistryRef`, and the 37-prop call (E).
4. One view channel shared with `<Canvas>` (F).
5. Ingestion hook (J).
6. Selection read-only wrapper and kinds to `core/selection` (H).
7. Let `<Canvas>` build the selection overlay (I).
8. Scene and overrides through `redrawOn` (G).
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

- **View zero as a `CanvasView`.** I read `CanvasView.tsx` only at 245-405. If view zero could be one, most of E disappears, but that is a design question I could not settle by reading.
- **Effect ordering.** I did not trace every dep registration to confirm that turning the registrar into a hook keeps the child-before-parent order its comment relies on.
- **Unread files.** `Canvas.tsx` was read by targeted grep, not line by line. Of the `SceneCanvas/` siblings I did not read `usePreviewGhostLayer`, `useDispatcherOverlayLayer`, `contributionFrameHooks`, `defaultNodeProperties`, `poseGeometry`, or any tests.
- **Greps covered this repo only.** Readers outside it of `__weaselCoordLog__`, `NodeAtPointHit.pose` and `.data`, `insertTool`, or `actionDefaults` are unknown.
## From the Canvas.tsx pass

Reported by the session that did `Canvas.tsx`, which has merged into this branch. The redundant
`useLateContentRedraw` call and the mounter's second layer-claim conversion were checked and removed.

- **Item I is reversed.** Canvas's selection-overlay config branch is unreachable from production, so
  SceneCanvas keeps its prebuild and Canvas's copy is deleted there. Do not do I. Not verified here.
- **Item F** needs a change in `Canvas.tsx`; see F.
- `SceneCanvas/props.ts` may restate an old z-order. Verified there: `backgroundFill` sits beneath
  everything including the grid; `decorationLayer` sits above every slot and custom layer and beneath
  a tool's `'top'` overlays.
- Canvas's `onFocus` / `onBlur` now receive the DOM `FocusEvent`, which reaches `SceneCanvasProps`
  through the `Omit`.
- Canvas findings 1, 2, 3, 4, and 8 (cursor resolution into routing; `buildSceneLayers`,
  `useSceneLayerList`, and the preview-id hide set into SceneCanvas; the three dev HUDs; slot types to
  `layerSlots.ts`) are that session's, on top of main after `scene-splits` merges.
