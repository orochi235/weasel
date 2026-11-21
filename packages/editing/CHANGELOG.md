# @weasel-js/editing

## 2.0.0

### Major Changes

- 398b575: `escapeAction` is `deselectAction`, with id `deselect` and binding `deselect.key`, after what it does; it is still bound to Escape.
  
  ```tsx
  // before
  <SceneCanvas actions={{ escape: null }} bindingOverrides={{ 'escape.key': unbound() }} />
  // after
  <SceneCanvas actions={{ deselect: null }} bindingOverrides={{ 'deselect.key': unbound() }} />
  ```
  
  <!-- entry: breaking api -->
- 040af35: `useBooleansAdapterSource` is `useBooleansAdapterDepSource`, named like the other hooks that publish a dep.
  
  ```ts
  // before
  useBooleansAdapterSource(scene, operands, adapter);
  // after
  useBooleansAdapterDepSource(scene, operands, adapter);
  ```
  
  <!-- entry: breaking api -->
- 51376ec: `clipboardPasteEventAction` is `clipboardPasteCopiedAction`, named for what it pastes: nodes a kit canvas copied.
  
  Its id is still `clipboard.pasteEvent`.
  
  ```ts
  // before
  useAction(clipboardPasteEventAction);
  // after
  useAction(clipboardPasteCopiedAction);
  ```
  
  <!-- entry: breaking api -->
- e7c03a3: Editing's contribution factories are spelled `create…Contribution`.
  
  `selectionMoveContribution`, `selectionTransformContribution`, `selectionResizeContribution`, `selectionRotateContribution` and `areaSelectContribution` are renamed; their arguments are unchanged.
  
  ```ts
  // before
  const ambient = [selectionMoveContribution(), areaSelectContribution()];
  // after
  const ambient = [createSelectionMoveContribution(), createAreaSelectContribution()];
  ```
  
  <!-- entry: breaking api -->
- 75f0443: Editing's tool sets of every kit tool are `KIT_TOOLS`, `KIT_TOOL_GROUPS` and `KIT_TOOL_IDS`; "builtin" is left to core's own tools.
  
  `BUILTIN_TOOLS`, `BUILTIN_TOOL_GROUPS` and `BUILTIN_TOOL_IDS` are renamed, and `KIT_TOOLS`'s set id is `'kit'`. Core's `BUILTIN_TOOL_IDS` (the hand) keeps its name.
  
  ```ts
  // before
  import { BUILTIN_TOOLS, BUILTIN_TOOL_GROUPS, BUILTIN_TOOL_IDS } from '@weasel-js/editing';
  // after
  import { KIT_TOOLS, KIT_TOOL_GROUPS, KIT_TOOL_IDS } from '@weasel-js/editing';
  ```
  
  <!-- entry: breaking api -->
- f1a886d: Editing's hit predicates `onEmptyCanvas` and `onBody` are `isEmptyOffChrome` and `isBodyOffChrome`.
  
  ```ts
  // before
  { kind: 'drag', target: { kindOf: onEmptyCanvas } }
  // after
  { kind: 'drag', target: { kindOf: isEmptyOffChrome } }
  ```
  
  <!-- entry: breaking api -->
- c70da31: `useSelectToolWith` and `createSelectToolWith`, the select tool over a host's picker, are `usePickerSelectTool` and `createPickerSelectTool`.
  
  Both are also renamed in `@weasel-js/editing/engine`; their arguments are unchanged.
  
  ```ts
  // before
  const select = useSelectToolWith(selectAdapter, { pickEvery, pickBest });
  // after
  const select = usePickerSelectTool(selectAdapter, { pickEvery, pickBest });
  ```
  
  <!-- entry: breaking api -->
- 17e237b: Editing's presets are on `@weasel-js/editing/presets` only; the main entry no longer exports `drawPreset`, `pickPreset` or any other `…Preset`.
  
  Import the entry as a namespace and use each preset's short name: `drawPreset` is `presets.draw`, `selectToolsPreset` is `presets.selectTools`, and so on for all of them. `FEATURE_PRESETS`, `namedFeatures` and the rest stay on the main entry.
  
  ```tsx
  // before
  import { drawPreset, useSelection } from '@weasel-js/editing';
  <SceneCanvas features={[drawPreset]} />;
  
  // after
  import { useSelection } from '@weasel-js/editing';
  import * as presets from '@weasel-js/editing/presets';
  <SceneCanvas features={[presets.draw]} />;
  ```
  
  <!-- entry: rank=20 breaking api -->
- 2b283ed: `useResizePolicy` is `useResizePolicyDepSource`, like the other hooks that publish a dep, and takes `UseResizePolicyDepSourceOptions`.
  
  ```ts
  // before
  useResizePolicy({ constraints });
  // after
  useResizePolicyDepSource({ constraints });
  ```
  
  <!-- entry: breaking api -->
- f37a70e: `selectToolKitPreset` and `shapeToolKitPreset`, which offer tools unmounted, are `presets.selectToolsOffered` and `presets.shapeToolsOffered`.
  
  ```tsx
  // before
  <SceneCanvas features={[shapeToolKitPreset]} defaultTools={['rect']} … />
  // after
  <SceneCanvas features={[presets.shapeToolsOffered]} defaultTools={['rect']} … />
  ```
  
  <!-- entry: breaking api -->
- 0618a25: `useImageTool` no longer accepts `share`, which it ignored: the image tool has no options for a share to lay over.
  
  Code passing it stops compiling; drop the option, since it never did anything.
  
  ```ts
  // before
  useImageTool({ src, share: { fill: null } });
  // after
  useImageTool({ src });
  ```
  
  <!-- entry: rank=-5 breaking fix -->
- ea0eef2: The insert gesture's wheel-rotate action has the id `insert.rotate`, matching `insertRotateAction` and its sibling `insert.reposition`.
  
  ```ts
  // before
  { spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } }, actionId: 'insert.adjustRotation' }
  // after
  { spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } }, actionId: 'insert.rotate' }
  ```
  
  <!-- entry: breaking api -->
- 36dc93a: Which layout container takes a drop is `move`'s `layoutDropTarget` param, set through `tune`, not `<SceneCanvas layoutDropTarget>`.
  
  This is breaking. The `<SceneCanvas>` prop and `LayoutDep.dropTarget` are gone, and `useLayoutDepSource` takes `(scene, reflow?)`. The modes and the `'innermost'` default are unchanged, and the param decides both the drag-time reflow preview and the commit.
  
  ```tsx
  // before
  <SceneCanvas layoutDropTarget="topmost" />
  // after
  <SceneCanvas tune={{ move: { params: { layoutDropTarget: 'topmost' } } }} />
  ```
  
  <!-- entry: breaking api -->
- b835405: The move, resize and rotate options' `onGestureStart` and `onGestureEnd` are `onRunStart` and `onRunEnd`.
  
  `GestureLifecycleOptions` is `RunLifecycleOptions`: the lifecycle is the action run's, not a gesture's.
  
  The helpers follow: `readGestureLifecycle`, `gestureLifecycleParams`, `commitGestureOps` and `closeGesture` are `readRunLifecycle`, `runLifecycleParams`, `commitRunOps` and `closeRun`.
  
  ```ts
  // before
  <SceneCanvas selectTool={{ move: { onGestureStart: save, onGestureEnd: done } }} />
  // after
  <SceneCanvas selectTool={{ move: { onRunStart: save, onRunEnd: done } }} />
  ```
  
  <!-- entry: breaking api -->
- 97cce9d: The many-at-once selection mode is `'multiple'` everywhere, as React Aria spells it, and a mode prop is `selectionMode`.
  
  `SelectionMode` is `'single' | 'multiple'`, so `useSelection`'s `mode`, `selectionOptions` and `<SceneCanvas selectionMode>` take `'multiple'` in place of `'multi'`. `<ItemList>`'s `selection` prop, `ListModeInput.selection` and the HUD list's `selection` option are `selectionMode`.
  
  ```tsx
  // before
  useSelection({ scene, mode: 'multi' });
  <ItemList rows={rows} selection="multi" />
  // after
  useSelection({ scene, mode: 'multiple' });
  <ItemList rows={rows} selectionMode="multiple" />
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- 74e52e2: `@weasel-js/core/groups` and `@weasel-js/editing/groups` name the kit's action groups, for `<ActionBar group>`
  
  ```tsx
  import * as groups from '@weasel-js/editing/groups';
  <ActionBar group={groups.history} />
  <ActionBar group={groups.align} />
  ```
  
  Core's entry has `history`, `viewport`, `presentation`, `anchors`, `path` and `tool`. Editing's re-exports those beside its own `clipboard`, `edit`, `structure`, `nudge`, `insert`, `align`, `distribute`, `flip`, `reorder` and `pathfinder`; a package that does not use editing imports `@weasel-js/core/groups`. Each is the string its actions already carried, so `<ActionBar group="history" />` still works.
  
  <!-- entry: api -->
- 643c699: A move behavior can set the cursor a drag shows, by returning `cursor` from `onMove`.
  
  The latest behavior to name one wins, and the drag falls back to the move action's own cursor when none does. The cursor follows a change a behavior makes with the pointer held still, such as a dwell timer arming, as soon as the gesture's handle says it changed.
  
  <!-- entry: api new -->
- 3f23bc8: The Boolean path ops and the `booleansAdapter` dep move from `@weasel-js/core` to `@weasel-js/editing`, and `presets.booleans` publishes the dep.
  
  This is breaking. These are editing's now, under the same names: `useBooleans`, `useBooleansAdapter`, `applyBooleanOp`, `previewBooleanOp`, `resolveBooleanOperands`, `commitBooleanPieces`, `useBooleansAdapterDepSource`, and the types `BooleanOp`, `BooleansAdapter`, `BooleanOpPreview`, `BooleanOpResult`, `BooleanPreviewPiece`, `BooleanOpOptions`, `BooleanStrokes`, `BooleanSource`, `BooleanOperands`, `BooleanCommitPiece`, `UseBooleansOptions` and `UseBooleansReturn`. `usePathLeafDepSources` is gone; `useSliceDepSource` stays in core.
  
  `<SceneCanvas>` no longer publishes a `booleansAdapter` over its path leaves. `presets.booleans` does, and `presets.pathfinder` (so `presets.draw`) and path-tools' `pathTools.pathTools` include it. A canvas that runs the shape builder or reads the dep without either names it:
  
  ```tsx
  // before
  import { useBooleansAdapter } from '@weasel-js/core';
  <SceneCanvas features={[presets.pick]} tools={{ shapeBuilder }} />
  // after
  import { useBooleansAdapter } from '@weasel-js/editing';
  import * as presets from '@weasel-js/editing/presets';
  <SceneCanvas features={[presets.pick, presets.booleans]} tools={{ shapeBuilder }} />
  ```
  
  <!-- entry: rank=10 breaking api -->
- f5058e3: The clipboard ops and wire format move from `@weasel-js/core` to `@weasel-js/editing`, retiring `@weasel-js/core/clipboard`.
  
  This is breaking. These are editing's now, under the same names: `useClipboard`, `useClipboardOps`, `WEASEL_CLIPBOARD_MIME`, `WEASEL_CLIPBOARD_MIME_WEB`, `buildWeaselClipboardText`, `sniffWeaselClipboardText`, `parseWeaselClipboardText`, `embedWeaselMetadataInSvg`, `extractWeaselClipboardFromSvg`, and the types `ClipboardFlavors`, `PastedItems`, `UseClipboardOptions`, `UseClipboardOpsOptions` and `UseClipboardOpsReturn`. `materializePaste` is no longer exported. The clipboard contract types (`ClipboardSnapshot`, `PasteCtx`, `PasteOmission`, `ClipboardDep`) stay in core. `@weasel-js/editor` now depends on `@weasel-js/editing`, whose `useClipboard` its `useDocClipboard` runs on.
  
  ```ts
  // before
  import { useClipboardOps } from '@weasel-js/core';
  import { buildWeaselClipboardText } from '@weasel-js/core/clipboard';
  // after
  import { buildWeaselClipboardText, useClipboardOps } from '@weasel-js/editing';
  ```
  
  <!-- entry: rank=10 breaking api -->
- 8764186: `deleteAction`, `createDeleteAction` and their helpers move from `@weasel-js/core` to `@weasel-js/editing`.
  
  This is breaking: import `deleteAction`, `createDeleteAction`, `DeleteActionOptions`, `commitDeleteToScene` and `hiddenSourceDeleteOps` from `@weasel-js/editing`. `presets.delete` and the standard edit presets carry the action as before.
  
  <!-- entry: rank=20 breaking api -->
- 8c58288: The edit, clipboard, Transform Again and Pathfinder actions move from `@weasel-js/core` to `@weasel-js/editing`.
  
  This is breaking. These exports are editing's now, under the same names: `deselectAction`, `selectAllAction`, `duplicateAction` (with `duplicateSelection`), `groupAction`, `ungroupAction`, the `nudge*Action`s, `setFillAction`, `setFillOpacityAction`, `setStrokeAction`, `setStrokeOpacityAction`, `setStrokeWidthAction`, `setVertexColorAction`, `ingestAction`, `transformAgainAction`, `transformSelection` and `SelectionTransform`, the `clipboard*Action`s, the `pathfinder*Action`s and `PATHFINDER_STROKES`, `makeBooleanGroupAction`, `booleanGroupOps` and `makeBooleanGroup`, `PATHFINDER_KEYMAP`, `PATHFINDER_KEYMAP_ID` and `PATHFINDER_LEADER`, and `ENGINE_STANDARD_ACTIONS`, which leaves `@weasel-js/core/engine`.
  
  ```ts
  // before
  import { ENGINE_STANDARD_ACTIONS, useActionSet } from '@weasel-js/core/engine';
  // after
  import { useActionSet } from '@weasel-js/core/engine';
  import { ENGINE_STANDARD_ACTIONS } from '@weasel-js/editing';
  ```
  
  Core keeps `deleteAction` and `DUPLICATE_OFFSET`, the offset a paste shares with a duplicate. Measure's Move by and Rotate by read `transformSelection` from editing.
  
  <!-- entry: rank=10 breaking api -->
- 64fed84: Editing's tools and commands draw their glyphs from editing's own `editing` icon namespace, so `core:rect` and the others are `editing:rect`.
  
  This is breaking for code that names one of these glyphs: write `icon('editing:rect')` where it wrote `icon('core:rect')`. They move: `alignBottom`, `alignCenterX`, `alignCenterY`, `alignLeft`, `alignRight`, `alignTop`, `booleanGroup`, `bringForward`, `bringToFront`, `crop`, `divide`, `duplicate`, `ellipse`, `eyedropper`, `flipX`, `flipY`, `group`, `lasso`, `line`, `merge`, `polygon`, `rect`, `select`, `sendBackward`, `sendToBack`, `star`, `transformAgain`, `trim`, `ungroup`. Core keeps the hand, history, cut, copy and paste, the booleans its own nodes name (union, intersect, subtract, exclude), and the path, text and paint glyphs. `@weasel-js/editing/icons` exports editing's table, and its `weaselIcons` field points the build plugin at it.
  
  <!-- entry: rank=5 breaking -->
- bbbe801: `icon('editing:…')` type-checks in a package that builds against editing's published types, which now carry its glyph names (`EditingIconName`).
  
  <!-- entry: fix api -->
- 33ddb2e: `@weasel-js/editing/presets` names every kit preset by its short name
  
  ```tsx
  import * as presets from '@weasel-js/editing/presets';
  <SceneCanvas features={[presets.view, presets.pick, presets.move, presets.delete]} />
  ```
  
  Core's `view` and `viewTools` are among them, the same objects `@weasel-js/core/presets` exports.
  
  <!-- entry: api -->
- 964a242: The editing presets, preset names, `useStandardActions`, and align, distribute, flip and reorder move to the new `@weasel-js/editing`.
  
  This is breaking. Core keeps its view presets, `view` and `viewTools` on `@weasel-js/core/presets`, so a canvas given only those draws, pans and zooms. Everything else a canvas got from core's presets now comes from editing's `@weasel-js/editing/presets` entry: `presets.draw`, `presets.pick`, `presets.transform`, `presets.select`, `presets.outline`, `presets.move`, `presets.resize`, `presets.rotate`, `presets.edit` and its parts (`presets.escape`, `presets.contextMenu`, `presets.selectAll`, `presets.duplicate`, `presets.delete`, `presets.group`, `presets.nudge`, `presets.style`, `presets.clipboard`), `presets.arrange` and its parts (`presets.flip`, `presets.reorder`, `presets.align`, `presets.distribute`), `presets.pathfinder`, `presets.ingest`, `presets.selectTools` and `presets.shapeTools`.
  
  ```tsx
  // before
  import { drawPreset, SceneCanvas } from '@weasel-js/core';
  import { namedFeatures } from '@weasel-js/core/named-features';
  
  // after
  import { SceneCanvas } from '@weasel-js/core';
  import { namedFeatures } from '@weasel-js/editing';
  import * as presets from '@weasel-js/editing/presets';
  ```
  
  The `@weasel-js/core/named-features` entry is gone: `namedFeatures`, `FEATURE_NAMES`, `FEATURE_PRESETS`, `FEATURE_ACTION_IDS` and `FeatureName` are editing's, and name core's view presets as well as editing's. `useStandardActions`, `UseStandardActionsOptions` and `KIT_STANDARD_ACTION_IDS` move with them; core keeps `useActionSet` and `useStandardDeps`. `flipAction`, `useAlign`, `alignDeltaFor`, `alignTargetBounds`, `useDistribute`, their option and adapter types, `FlipAxis`, `FlipPivot`, and the `AlignParams`, `DistributeParams`, `FlipParams` and `ReorderParams` param types are editing's, which also exports the align, distribute and reorder actions by name.
  
  <!-- entry: rank=20 breaking api pick -->
- d074d01: `selectionTransformAnswer` says whether a move, turn or resize of the selection would change anything, and why not.
  
  It returns `true`, `NotApplicable` when the finished batch changes nothing, or `Locked` when it would rewrite a locked node: the answer Transform Again gives, for a command's `enabled`.
  
  <!-- entry: api -->
- 8764186: The group enter and leave actions, `createEnterGroupAction` and `createLeaveGroupAction`, move to `@weasel-js/editing`.
  
  This is breaking: import them and their `EnterGroupOptions` and `LeaveGroupOptions` from `@weasel-js/editing`, beside the group-entry contribution that binds them. Core now exports `isEnterable`, which says whether a node is a group a press can enter, and the `AdapterPickGates` and `PickSource` types its pick helpers already took.
  
  <!-- entry: rank=20 breaking api -->
- 9566a40: `presets.insert` turns on drag-to-insert and click-to-place: the `insert` dep, and the actions a tool that makes a node binds.
  
  Its `insert`, `place`, `insert.rotate` and `insert.reposition` actions register once a tool or binding on the canvas names them, and its dep builds the kit's kinds (`KIT_INSERT_KINDS`) without a factory. The shape tool kit, `presets.clipboard` and `presets.ingest` include it. `useInsertDepSource` publishes the same dep on a host that builds its own.
  
  <!-- entry: new api -->
- 8e6f5d2: The kit's paste and drop handlers for images, SVG and copied nodes move to `@weasel-js/editing`, and `presets.ingest` brings them.
  
  This is breaking. A canvas without `presets.ingest` (or `presets.draw`, which includes it) routes a paste or drop through only its own `ingestion.handlers` and its presets'. `ingestion.kitHandlers` now turns off the kit handlers a preset brings, by their `kit:` ids, as before. Core keeps the mechanism: `registerContentHandler`, `runIngest`, `handlersFor`, the `ingestion` prop and dep, and `SceneCanvasApi.ingest`. `KIT_CONTENT_HANDLERS` comes from editing, and `@weasel-js/editing/test-seams` holds the image and SVG measuring stubs a jsdom test needs.
  
  <!-- entry: rank=5 breaking api -->
- d73bd9f: `setFill`, `setStroke`, and the other paint actions take an `ids` param naming the nodes to paint in place of the selection.
  
  ```ts
  registry.begin('setFill', { paint, ids: ['node-1'] });
  ```
  
  <!-- entry: new api -->
- 52e0851: `resolveBooleanOperands` takes the ids to resolve as an optional third argument, defaulting to the selection.
  
  <!-- entry: api -->
- a23923e: The select tool, group entry and the selection's move, resize and rotate contributions move to `@weasel-js/editing`, with an `./engine` entry.
  
  This is breaking. `<SceneCanvas>` no longer builds a select tool: editing's `presets.selectToolsOffered` offers one by id, built over the canvas's pickers and its `selectTool` options, and `presets.select` (in `presets.pick` and `presets.draw`) mounts it and installs the group entry (double-click to enter, Escape to leave). Under `actions={null}` that group entry stays, as the rest of the preset does. Core's `BuiltinToolId` is now `'hand'`.
  
  From editing: `useSelectTool`, `usePickerSelectTool` and their plain factories `createSelectTool` and `createPickerSelectTool`, `SelectAdapter`, `UseSelectToolOptions`, `createSelectionMoveContribution`, `createSelectionResizeContribution`, `createSelectionRotateContribution`, `createSelectionTransformContribution` and their `*Bindings`, `createAreaSelectContribution`, `isBodyOffChrome`, `isEmptyOffChrome`, the `SELECTION_*_ID`s and `AREA_SELECT_ID`, `createGroupEntryContribution`, `useGroupEntryContribution`, `GROUP_ENTRY_ID` and `GROUP_LEAVE_PRESS_BINDING`. A host of another dimension imports `usePickerSelectTool`, `createSelectionMoveContribution`, `useGroupEntryContribution` and `ENGINE_STANDARD_ACTIONS` from `@weasel-js/editing/engine`, which loads none of editing's presets.
  
  ```ts
  // before
  import { createSelectionMoveContribution, usePickerSelectTool } from '@weasel-js/core/engine';
  // after
  import { createSelectionMoveContribution, usePickerSelectTool } from '@weasel-js/editing/engine';
  ```
  
  <!-- entry: rank=10 breaking api -->
- 9246f97: The selection chrome moves to `@weasel-js/editing`: the outline, resize handles and rotate badge it paints, and the handles a press grabs.
  
  This is breaking. A canvas with no editing preset paints nothing in the `selectionOverlay` slot and grabs no resize or rotate handle; a layer of the consumer's own in that slot still paints. `presets.outline`, `presets.resize` and `presets.rotate` include the new `presets.selectionChrome`, which hands the canvas `SELECTION_CHROME` through the new `FeaturePreset.selectionChrome` role, so a canvas using them changes nothing.
  
  From editing, under the same names: `createSelectionOverlayLayer`, `createSelectionOutlineLayer`, `createSelectionHandlesLayer`, `composeSelectionPose`, `ComposeSelectionPoseOptions`, `createCornerResizeAffordance`, `CornerResizeAffordanceOptions`, `CornerResizeScratch`, `createRotationAffordance`, `RotationAffordanceOptions`, `RotationScratch`, `rotationHandle`, `hitRotationHandle`, `DEFAULT_ROTATION_HANDLE_DISTANCE` and `RotationHandle`. Core keeps the slot's option types (`SelectionOverlayLayerOptions` and the rest), the affordance mechanism, the path-anchor affordances and chrome-caps, and adds `SelectionChrome` and `SelectionChromeSizes` for a preset drawing chrome of its own.
  
  <!-- entry: rank=10 breaking api -->
- 843859b: `useSelection` moves to `@weasel-js/editing`, and a canvas with no editing preset keeps a selection nothing it runs writes.
  
  This is breaking. Editing's presets include `presets.selection`, whose `createSelection` factory builds the selection a canvas writes through, answering clicks by `selectionOptions`. Without one, the canvas's selection is core's `viewerSelection`: it reads the scene's selection and ignores every write the canvas's tools, actions and adapter make, while the app, undo and redo still move it. `selectionOptions.initial` seeds an empty scene either way, and `<SceneCanvas selection>` still takes any `SelectionApi`.
  
  ```ts
  // before
  import { useSelection } from '@weasel-js/core';
  // after
  import { useSelection } from '@weasel-js/editing';
  ```
  
  `useSelection`, `createSelection` and `UseSelectionOptions` are editing's, on its main entry and `./engine`. Core keeps the contract: `SelectionApi` (from `@weasel-js/routing`), `SelectionOptions`, `SelectionFactory`, `SelectionStore`, and `viewerSelection`.
  
  <!-- entry: rank=10 breaking api behavior -->
- 670aeb3: The shape, lasso, image and eyedropper tools and the kit's tool sets move to `@weasel-js/editing`, which offers them by id.
  
  This is breaking. `<SceneCanvas>` no longer builds rect, ellipse, line, polygon, star or lasso in: a preset offers them, and `defaultTools`, a preset's `tools` or a `tools` patch mounts one by id only when an enabled preset offers it. `presets.draw` offers every one; a canvas without it adds `presets.shapeToolsOffered` (or `presets.shapeTools`, which also mounts them) for the shapes and `presets.selectToolsOffered` for the lasso.
  
  ```tsx
  // before
  <SceneCanvas scene={scene} features={[presets.pick]} defaultTools={['rect']} />
  
  // after
  import * as presets from '@weasel-js/editing/presets';
  <SceneCanvas scene={scene} features={[presets.pick, presets.shapeToolsOffered]} defaultTools={['rect']} />
  ```
  
  From editing, under the same names: `useRectTool`, `useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `useLassoTool`, `useImageTool`, `useEyedropperTool`, their `*_TOOL_OPTIONS` and option types, `shapeToolOptions`, `styleOptionLeaves`, `toolOptionPaint`, `DEFAULT_SHAPE_PAINT`, `insertBindingBehaviors`, `InsertToolOptions`, `createPointerFollower`, `SELECT_TOOLS`, `SHAPE_TOOLS`, `KIT_TOOLS`, `KIT_TOOL_GROUPS`, `KIT_TOOL_IDS` and `TOOL_GROUP_ORDER`. Each hook has a plain factory beside it (`createRectTool`, …). Core keeps `VIEW_TOOLS`, the hand, and `BuiltinToolId`, now `'select' | 'hand'`; editing's `KitToolId` names every kit tool. `BuiltinToolOptions` is gone: `toolOptions` is `SceneCanvasToolOptions`, whose `lasso` and `insert` keys editing adds.
  
  <!-- entry: rank=10 breaking api -->
- 78dd590: Two same-size nodes can trade places: hold one still over the other while dragging it, or select both and run the `swap` command.
  
  Turn the drop on with the move's `swapOnDrop: 'dwell'` param (`<SceneCanvas tune={{ move: { params: { swapOnDrop: 'dwell' } } }}>`). Resting a single dragged node over another for a second arms the swap: the other slides into the dragged one's starting place, is outlined, and the cursor shows the swap glyph. Released there, the two trade places, parents and stacking order as one undo step, "Swap". A binding that wants another wait or its own target passes `swapOnDrop({ dwellMs, targetAt })` from `@weasel-js/editing` in its `behaviors`.
  
  The `swap` action (in the `arrange` preset, and `presets.swap`) does the same for exactly two selected nodes. Which nodes may swap is the new `canSwap` dep's to say; without one, two nodes of one `kind` and one size do. `swappable` asks that rule, and `swapOps` builds the commit both use.
  
  <!-- entry: rank=10 new api -->
- 9566a40: The move, resize, rotate, clone, insert, marquee, lasso and clear-selection actions move to `@weasel-js/editing`, with the deps they read.
  
  This is breaking. A bare `<SceneCanvas>` no longer publishes the `insert`, `insertLive`, `areaSelect`, `lassoSelect` or `resizePolicy` deps, and a tool binding `insert` or `areaSelect` no longer brings the action with it: an editing preset does. `presets.draw` has them all; a canvas mounting a tool that inserts (a shape tool, `@weasel-js/path-tools`' pen or pencil, a `@weasel-js/diagram` stencil) without it adds `presets.insert`. `textTools.textTools` includes it.
  
  ```tsx
  // before
  <SceneCanvas scene={scene} tools={useDiagramTools({ connector })} />
  
  // after
  import * as presets from '@weasel-js/editing/presets';
  <SceneCanvas scene={scene} features={[presets.insert]} tools={useDiagramTools({ connector })} />
  ```
  
  From editing, under the same names: `moveAction`, `cloneAction`, `resizeAction`, `createResizeAction`, `ResizeActionOptions`, `rotateAction`, `areaSelectAction`, `clearSelectionAction`, `lassoSelectAction`, `UseLassoSelectOptions`, `selectFromLasso`, `SelectFromLassoOptions`, `insertAction`, `INSERT_DRAG_MODS`, `insertParams`, `POLYGON_INSERT_PARAMS`, `STAR_INSERT_PARAMS`, `placeAction`, `insertRepositionAction`, `INSERT_REPOSITION_BINDING`, `insertRotateAction`, `insertStyleOf`, `DEFAULT_STROKE_WIDTH`, `STYLE_OPTION_KEYS`, `InsertStyle`, `StyleOptionKey`, `useResizePolicyDepSource` and `UseResizePolicyDepSourceOptions`; `moveAction`, `insertAction` and `areaSelectAction` also from `@weasel-js/editing/engine`. The `@weasel-js/core/move`, `/resize` and `/clone` entries are gone: `snapToContainer`, `snapBackOrDelete`, `clampMove`, `ClampMoveOptions` and `clampMinSize` come from `@weasel-js/editing`, and the pose descriptors, handle geometry, `MoveOptions` and `CloneBehavior` from `@weasel-js/core`. `toolDrivenActions` and `TOOL_DRIVEN_ACTION_IDS` are gone; a preset's `toolActions` say the same. Core keeps the option types (`MoveOptions`, `ResizeOptions`, `RotateOptions`), the dep types and `DepSchema` entries, `InsertNodeFactories`, and the action params.
  
  <!-- entry: rank=10 breaking api -->

### Patch Changes

- e468edc: Make Boolean Group is disabled wherever running it would make nothing, such as a selection spanning layers.
  
  <!-- entry: fix -->
- 6355d18: A Pathfinder op over many shapes in a large drawing no longer stalls sorting its operands by paint order.
  
  <!-- entry: perf -->
- 691b592: A Pathfinder operation counting strokes outlines a skewed or unevenly stretched path's stroke as it is drawn.
  
  <!-- entry: fix -->
- e8df1fc: The clipboard logs a `console.error` when your `produceFlavors` or paste `reviver` throws, instead of failing quietly.
  
  The copy stays in memory and the paste is declined, as before; a browser without clipboard access, or another app's malformed text, is still only noted in the debug log.
  
  <!-- entry: fix -->
- cf2a57b: An Alt-drag that clones the selection waits for `move.dragThresholdPx`, as a plain drag that moves it does.
  
  <!-- entry: fix -->
- 7a5e072: An Alt-drag clone of a boolean group dropped into a container lands where it was dropped, its children stored in the container's frame.
  
  <!-- entry: fix -->
- bb5880a: An Alt-drag clone of a node inside a group scaled flat previews no copy for it, rather than throwing out of a scene's quantize rule.
  
  <!-- entry: fix -->
- a63b723: Pressing Cmd+V again on a canvas steps each paste on from the last one, as the Paste button does, instead of stacking them on one spot.
  
  <!-- entry: fix -->
- 929a2d2: Clicking a member of a multi-selection collapses the selection to it even when Shift or Cmd goes down between the press and the release.
  
  <!-- entry: fix -->
- e000f0a: Dragging a child out of a layout container previews its siblings where the drop will leave them.
  
  The preview runs the container's `depart` when its strategy has one, as the commit does.
  
  <!-- entry: fix -->
- 62aede0: An install that nests `@weasel-js/geom` under editing now resolves `polygon-clipping`, which editing depends on.
  
  geom's `./booleans` loads it, and geom lists it only as an optional peer.
  
  <!-- entry: fix -->
- 43fb985: An insert of a kind named `constructor` or `toString` finds no factory and inserts nothing, rather than calling a built-in as the node factory.
  
  <!-- entry: fix -->
- 8c17e91: Flip measures and mirrors each node through the pose descriptor its `forNode` resolves for it, as rotate and clone do.
  
  <!-- entry: fix -->
- 4bb7f17: Group keeps a container where its members are drawn when they have no drawn bounds and sit inside a moved or turned container.
  
  <!-- entry: fix -->
- 9606e24: Group sizes its container to each member's bounds as the member's own `forNode` descriptor reads them.
  
  <!-- entry: fix -->
- 8a24c29: SVG and raster files dropped together cascade from the drop point instead of landing one on top of another.
  
  <!-- entry: fix -->
- e4f2133: Several items dropped or pasted at once step 24 screen px down and right of each other at every zoom, the drop ghost too.
  
  <!-- entry: fix -->
- 7cace1d: A start an insert behavior shaped is the one a Shift-held line turns about, and it keeps that shaping when Space moves the shape.
  
  <!-- entry: fix -->
- 60b38f5: A line drawn from its center lands in the container under the press, and its `ends.start` is that center, as a centered box's is.
  
  <!-- entry: fix -->
- 74261df: A polygon or star drawn from its center by a level or plumb drag commits the shape its preview showed.
  
  <!-- entry: fix -->
- d059b75: An insert's preview under a quantize rule shows where the node lands when it is drawn into a turned or scaled container.
  
  <!-- entry: fix visual -->
- a86bd34: An insert lands in the container its snap and preview copies were for: the one under the press, or the one Space carried the shape into.
  
  <!-- entry: fix -->
- 37daa58: A lasso too thin to enclose anything clears the selection like a click (or keeps it, with Shift), with or without `selectFromLasso`.
  
  <!-- entry: fix -->
- 1526249: A group whose pose is its members, dragged out of a layout container, lands its members where the drag showed them.
  
  <!-- entry: fix -->
- 3e89500: Dragging a child out of a scrolled layout container leaves the children behind where they are shown.
  
  <!-- entry: fix -->
- 7f35ade: Transforms that would rewrite a locked node inside a selected boolean group are disabled as locked, rather than throwing.
  
  That covers Flip, Align, Distribute, Nudge, Swap (and a swap drop), and Transform Again; a rotate drag over such a group does not start.
  
  <!-- entry: fix -->
- 597f68d: While `extendClickLocked` holds, a Shift-click on a member of a multi-selection leaves the node selection alone on release too.
  
  <!-- entry: fix -->
- 921e20e: A move starts on a layer whose view answers an identity plane map, rather than throwing at press.
  
  <!-- entry: fix -->
- 2202a32: A move held still while the snap's landing changes, as when snapping is turned off, commits the new landing.
  
  <!-- entry: fix -->
- 36b25c8: A move measures each node by its own pose descriptor, so a node kind with one of its own lands with its members.
  
  This holds where a move carries a placed node's members along, reflows a layout's leftovers, picks the drop container, and catches a gliding node.
  
  <!-- entry: fix -->
- 87f3d38: A group dropped into a layout container, or snapped into one, keeps its selected child inside it.
  
  This covers `snapToContainer` as well as a layout drop and a release out of a layout container.
  
  <!-- entry: fix -->
- df97f39: `setFillOpacity` and `setStrokeOpacity` ignore an `alpha01` that is not a finite number, rather than writing a `NaN` opacity.
  
  <!-- entry: fix -->
- 6661cbf: A copy on a page with no async clipboard API no longer reports an unhandled rejection when a promised flavor fails.
  
  <!-- entry: fix -->
- a37a658: The fill and stroke actions on a node whose paint is `'inherit'` start from the paint it inherits, and write that paint with the change.
  
  <!-- entry: fix -->
- 9d4db71: The fill, stroke and vertex color actions leave a selected page unpainted, and are disabled when only page structure is selected.
  
  Nudge reports `SelectionRequired` rather than `NotApplicable` with only page structure selected.
  
  <!-- entry: fix -->
- 3d5d715: `useSelectTool`'s `pickTolerance` docs say the default `'aabb'` picker reads it around a derived route's box.
  
  A straight route's box has no area, so it is hit only with `pickTolerance` set.
  
  <!-- entry: rank=-5 fix -->
- 1fbfa96: Click-to-place hands the dep the extras a drag out from the click would: a line's two ends, a polygon's or star's center and rotation.
  
  Style params reach the dep only as `extras.style`, and a custom kind's extras carry `originMode: 'center'`, as a centered drag's do.
  
  <!-- entry: fix -->
- 9aa8036: A click-to-place whose node factory or snap throws puts back the selection it cleared and closes its snap session, as a drawn insert does.
  
  <!-- entry: fix -->
- 76c5562: Click-to-place suspends snapping on whichever key `snap.suspend` is bound to, as a drawn insert does.
  
  <!-- entry: fix -->
- 32356ff: A resize whose constraint commits its own ops at release leaves Transform Again nothing to repeat.
  
  <!-- entry: fix behavior -->
- 34b8a3f: Resizing a path effect measures from its own box, where its handles sit, so the corner opposite the dragged handle stays put.
  
  <!-- entry: fix -->
- df73bc8: A frame whose data takes a resize dragged past its far edge leaves its contents where they drew once the resize commits.
  
  <!-- entry: fix -->
- 261488b: A resize flips a node through its anchor on an axis its `data.minSize` leaves at 0, rather than collapsing it to nothing.
  
  <!-- entry: fix -->
- 55ab2c6: A Shift resize held to a node's `data.minSize` keeps the aspect it locks, growing both axes until each meets the minimum.
  
  <!-- entry: fix -->
- 7e1ab6c: A node stored flipped keeps its flip when a resize holds it to its `data.minSize`, alone or resized with others.
  
  <!-- entry: fix -->
- 34b8a3f: A resize no longer snaps to the nodes it is resizing on the selection's behalf, such as a path effect's sources.
  
  <!-- entry: fix -->
- b0bc4cd: The selection overlay paints no rotate badge on a node that cannot rotate, or on a multi-selection holding one.
  
  <!-- entry: fix visual -->
- c23c975: Rotating a lone path-effect node turns its source about the effect's own box, where its rotate chrome is, not about the source's center.
  
  <!-- entry: fix -->
- 34b8a3f: Rotating a path effect turns its sources about the center of the effect's own box, not the center of its sources.
  
  <!-- entry: fix -->
- 814994a: Flip, Nudge, and Transform Again report themselves not applicable where operands are supplied without a scene; Flip used to throw there.
  
  <!-- entry: fix -->
- 9217b8a: Selection boxes and resize handles fit a node drawn by a painter registered on the scene's own shapes.
  
  <!-- entry: fix visual -->
- deda510: The selection outline draws with every field of its `outline` stroke, so `dashOffset`, `miterLimit`, `trim` and markers take effect.
  
  <!-- entry: fix visual -->
- 091bd67: A shape-following selection outline on an open path that inherits its stroke redraws when the container's cap or markers change.
  
  <!-- entry: fix visual -->
- c6b831f: Two `snapToContainer` behaviors on one binding each keep their own dwell, so one finishing over its container no longer depends on the other.
  
  <!-- entry: fix -->
- a8ae2f7: `setStrokeWidth` ignores a `width` that is negative or not a finite number, rather than writing it to the stroke.
  
  <!-- entry: fix -->
- 555bd8d: An SVG file that arrives with its markup as plain text beside it is inserted once, not twice.
  
  <!-- entry: fix -->
- ae6b2a5: Nodes whose text holds `</metadata>` paste back as nodes from a copy's SVG flavor, rather than as one SVG image.
  
  <!-- entry: fix -->
- 5b0df8a: A swap drop trades the node the drag moves, so selecting a node whose pose derives from another swaps that other node.
  
  A drag that moves several nodes never swaps.
  
  <!-- entry: fix -->
- d7a156b: While a swap drop is armed, a layout container under the drag stops making room for it, so the preview shows the swap the release will make.
  
  <!-- entry: fix visual -->
- d3f717d: A swap between two parents is refused when either parent would refuse the other node as a drop.
  
  <!-- entry: fix -->
- f57aa89: Transform Again repeating a resize leaves a resized frame's contents where they draw, as the drag does.
  
  <!-- entry: fix -->
- a453821: Transform Again repeating a resize puts the result on the document's output grid holding the anchored side, as the drag does.
  
  <!-- entry: fix -->
- bdc9108: `useSelection` seeds `initial` into a new `scene` store it is handed when that store has no selection yet, not only into the first.
  
  <!-- entry: fix -->
- de9d942: `setVertexColor` ignores an `rgba` that is not four finite numbers, so the anchors after the one it names keep their colors.
  
  <!-- entry: fix -->
- cdede50: `setVertexColor` is disabled with `NotApplicable` while no selected node has vertex colors.
  
  <!-- entry: fix -->
- fca9c3c: Nodes copied from a weasel canvas and dropped on another land where they were dropped, under the drop's ghost.
  
  <!-- entry: fix -->
- Updated dependencies [5099ca3]
- Updated dependencies [e5f53c6]
- Updated dependencies [74e52e2]
- Updated dependencies [617fd6c]
- Updated dependencies [03c5f2f]
- Updated dependencies [fe3c2df]
- Updated dependencies [cd84e27]
- Updated dependencies [8d7296a]
- Updated dependencies [33d9b95]
- Updated dependencies [2a3a075]
- Updated dependencies [5ad99b6]
- Updated dependencies [4204bdb]
- Updated dependencies [e4b8859]
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [9c88969]
- Updated dependencies [d764d06]
- Updated dependencies [f1bc116]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [a98ad34]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [e6b28fe]
- Updated dependencies [e72e26a]
- Updated dependencies [0090147]
- Updated dependencies [643c699]
- Updated dependencies [ca5bcb0]
- Updated dependencies [f4d8b83]
- Updated dependencies [6da5a3b]
- Updated dependencies [4fb8cbf]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [3f23bc8]
- Updated dependencies [4a642f5]
- Updated dependencies [3b803d7]
- Updated dependencies [9249b26]
- Updated dependencies [f20931c]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [3bf5d6c]
- Updated dependencies [315f5ee]
- Updated dependencies [97f1f86]
- Updated dependencies [1566d81]
- Updated dependencies [6bbc0e5]
- Updated dependencies [33c1e37]
- Updated dependencies [62f5560]
- Updated dependencies [7199e23]
- Updated dependencies [88f90f5]
- Updated dependencies [df7ba95]
- Updated dependencies [da5f6da]
- Updated dependencies [ec44e4c]
- Updated dependencies [063b00c]
- Updated dependencies [174d6ef]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [defc1cd]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [7b0562e]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [29d293c]
- Updated dependencies [0c07b8d]
- Updated dependencies [6cef61c]
- Updated dependencies [76a1854]
- Updated dependencies [fcc5602]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
- Updated dependencies [269320b]
- Updated dependencies [d07c5f1]
- Updated dependencies [26b779a]
- Updated dependencies [c3935f7]
- Updated dependencies [fcc31eb]
- Updated dependencies [8bc6d64]
- Updated dependencies [c3da788]
- Updated dependencies [9621063]
- Updated dependencies [869d865]
- Updated dependencies [42aab0c]
- Updated dependencies [d3d65f1]
- Updated dependencies [3a00602]
- Updated dependencies [ab7f613]
- Updated dependencies [95ddf7a]
- Updated dependencies [daa7a4d]
- Updated dependencies [9f5155f]
- Updated dependencies [86e1580]
- Updated dependencies [06303a3]
- Updated dependencies [8278212]
- Updated dependencies [1b27b2f]
- Updated dependencies [2a0b5f3]
- Updated dependencies [a529c26]
- Updated dependencies [f44131a]
- Updated dependencies [394cc06]
- Updated dependencies [a4e0df7]
- Updated dependencies [bfef616]
- Updated dependencies [d0ec6bd]
- Updated dependencies [3742696]
- Updated dependencies [fd63c16]
- Updated dependencies [8c58288]
- Updated dependencies [964a242]
- Updated dependencies [7cfda30]
- Updated dependencies [93b6009]
- Updated dependencies [37baa8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [5a8ac8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [963f8fd]
- Updated dependencies [5c345b8]
- Updated dependencies [b0905a2]
- Updated dependencies [1c9986a]
- Updated dependencies [1c9986a]
- Updated dependencies [83ad38f]
- Updated dependencies [0200213]
- Updated dependencies [e8e7f2f]
- Updated dependencies [b05583a]
- Updated dependencies [77bfacf]
- Updated dependencies [f585154]
- Updated dependencies [15a05d9]
- Updated dependencies [74202d3]
- Updated dependencies [c30911d]
- Updated dependencies [c569caf]
- Updated dependencies [280f9fc]
- Updated dependencies [4844d4d]
- Updated dependencies [43fb985]
- Updated dependencies [59944c1]
- Updated dependencies [6d2bb1e]
- Updated dependencies [106749f]
- Updated dependencies [e9897c7]
- Updated dependencies [075971c]
- Updated dependencies [04cd5f3]
- Updated dependencies [2940a77]
- Updated dependencies [2ab2678]
- Updated dependencies [93a7c62]
- Updated dependencies [b05583a]
- Updated dependencies [6f94fe3]
- Updated dependencies [0a2be4b]
- Updated dependencies [5477214]
- Updated dependencies [5f6ebf3]
- Updated dependencies [b76c25e]
- Updated dependencies [5614b4e]
- Updated dependencies [e21ec2d]
- Updated dependencies [386bbfc]
- Updated dependencies [ac792e8]
- Updated dependencies [3fdbc32]
- Updated dependencies [9430cf9]
- Updated dependencies [5f6ebf3]
- Updated dependencies [95d06c3]
- Updated dependencies [3e32141]
- Updated dependencies [9231556]
- Updated dependencies [63c1844]
- Updated dependencies [fd2cbc8]
- Updated dependencies [fd2cbc8]
- Updated dependencies [b0905a2]
- Updated dependencies [a8d34ac]
- Updated dependencies [66e447b]
- Updated dependencies [e9f7adf]
- Updated dependencies [bfb8442]
- Updated dependencies [4a2b3cc]
- Updated dependencies [1bd148d]
- Updated dependencies [7064286]
- Updated dependencies [e67d322]
- Updated dependencies [6316070]
- Updated dependencies [0d810a1]
- Updated dependencies [ece64a6]
- Updated dependencies [9249b26]
- Updated dependencies [d8007e8]
- Updated dependencies [d917fd4]
- Updated dependencies [b4acc4d]
- Updated dependencies [37c0385]
- Updated dependencies [fcc5602]
- Updated dependencies [794862e]
- Updated dependencies [5cf9f61]
- Updated dependencies [5db5049]
- Updated dependencies [656a653]
- Updated dependencies [42d49af]
- Updated dependencies [94c8e4c]
- Updated dependencies [4a93e4b]
- Updated dependencies [eca2b03]
- Updated dependencies [fcfefd4]
- Updated dependencies [7252e96]
- Updated dependencies [f4ac9bc]
- Updated dependencies [81b7535]
- Updated dependencies [bfc26b4]
- Updated dependencies [2503372]
- Updated dependencies [bde7b24]
- Updated dependencies [53ba27c]
- Updated dependencies [de462a6]
- Updated dependencies [03c5f2f]
- Updated dependencies [8764186]
- Updated dependencies [f3c2f12]
- Updated dependencies [81f2080]
- Updated dependencies [84a4212]
- Updated dependencies [47fa777]
- Updated dependencies [7542fc9]
- Updated dependencies [319879e]
- Updated dependencies [8d7296a]
- Updated dependencies [e6ec996]
- Updated dependencies [9a3bf41]
- Updated dependencies [d3d3973]
- Updated dependencies [22c6086]
- Updated dependencies [df9dba4]
- Updated dependencies [3833307]
- Updated dependencies [2729716]
- Updated dependencies [966b087]
- Updated dependencies [2f56e64]
- Updated dependencies [85fd57d]
- Updated dependencies [2f7e04a]
- Updated dependencies [a5bed98]
- Updated dependencies [9b8f83b]
- Updated dependencies [143e763]
- Updated dependencies [746912f]
- Updated dependencies [3a0b3b7]
- Updated dependencies [b667930]
- Updated dependencies [dc92ea4]
- Updated dependencies [15328d8]
- Updated dependencies [ebd0424]
- Updated dependencies [0046729]
- Updated dependencies [6babdc5]
- Updated dependencies [2ee9af5]
- Updated dependencies [cfc0732]
- Updated dependencies [711be7d]
- Updated dependencies [3a8b706]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [fcc5602]
- Updated dependencies [8c58288]
- Updated dependencies [084198c]
- Updated dependencies [b0d7740]
- Updated dependencies [df9a774]
- Updated dependencies [a639e4d]
- Updated dependencies [64fed84]
- Updated dependencies [964a242]
- Updated dependencies [1566d81]
- Updated dependencies [2755b11]
- Updated dependencies [49aa4d8]
- Updated dependencies [dc881e4]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [b6863aa]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [36dac61]
- Updated dependencies [b85869b]
- Updated dependencies [9787bca]
- Updated dependencies [16a2eed]
- Updated dependencies [3eb3209]
- Updated dependencies [2ac34a7]
- Updated dependencies [7e60049]
- Updated dependencies [c7db707]
- Updated dependencies [d26152c]
- Updated dependencies [a3136aa]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [7f49a0e]
- Updated dependencies [cde17d1]
- Updated dependencies [3b37bd1]
- Updated dependencies [cbd9a26]
- Updated dependencies [c3da9af]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [ac8e807]
- Updated dependencies [fb47e9b]
- Updated dependencies [50900c3]
- Updated dependencies [cc5b0c3]
- Updated dependencies [b1cfa76]
- Updated dependencies [4be1a3f]
- Updated dependencies [896cfc6]
- Updated dependencies [8c2d558]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [79d4797]
- Updated dependencies [a947127]
- Updated dependencies [7e5b389]
- Updated dependencies [cf24657]
- Updated dependencies [1d5a968]
- Updated dependencies [95bd84c]
- Updated dependencies [b7e560b]
- Updated dependencies [174d6ef]
- Updated dependencies [cfbecdb]
- Updated dependencies [9c2b3d6]
- Updated dependencies [03f84f2]
- Updated dependencies [8457029]
- Updated dependencies [22eec46]
- Updated dependencies [8fd3d6d]
- Updated dependencies [5b84825]
- Updated dependencies [516bc59]
- Updated dependencies [2338cee]
- Updated dependencies [034f292]
- Updated dependencies [1d207f7]
- Updated dependencies [eeef48a]
- Updated dependencies [736df4e]
- Updated dependencies [6aedb33]
- Updated dependencies [3dc96c8]
- Updated dependencies [972a96c]
- Updated dependencies [94ea28e]
- Updated dependencies [4f7976e]
- Updated dependencies [ed0fff4]
- Updated dependencies [8764186]
- Updated dependencies [a7dab9f]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [57a59be]
- Updated dependencies [6416860]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [0aa5132]
- Updated dependencies [7ba3e69]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [67968c3]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [158f868]
- Updated dependencies [ffcde61]
- Updated dependencies [19f8e39]
- Updated dependencies [c57e67c]
- Updated dependencies [201d32f]
- Updated dependencies [8e43f3f]
- Updated dependencies [5ffc43b]
- Updated dependencies [813a306]
- Updated dependencies [e0f4c91]
- Updated dependencies [df2ae04]
- Updated dependencies [d22292c]
- Updated dependencies [7d89cf6]
- Updated dependencies [8882b53]
- Updated dependencies [c7db707]
- Updated dependencies [452e669]
- Updated dependencies [e7561c7]
- Updated dependencies [76c5562]
- Updated dependencies [477eb15]
- Updated dependencies [8649268]
- Updated dependencies [e4f2133]
- Updated dependencies [e4f2133]
- Updated dependencies [4e9c237]
- Updated dependencies [a86bd34]
- Updated dependencies [fd2cbc8]
- Updated dependencies [7165e31]
- Updated dependencies [e5e7aef]
- Updated dependencies [3fe1323]
- Updated dependencies [22a1496]
- Updated dependencies [c3bcbf9]
- Updated dependencies [ea0eef2]
- Updated dependencies [d061e79]
- Updated dependencies [b44408d]
- Updated dependencies [51dc6ab]
- Updated dependencies [f9ab55b]
- Updated dependencies [e70f4da]
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
- Updated dependencies [38e795b]
- Updated dependencies [aa1dfd3]
- Updated dependencies [e6871f1]
- Updated dependencies [daf6f2e]
- Updated dependencies [595b596]
- Updated dependencies [10e17bb]
- Updated dependencies [8e6f5d2]
- Updated dependencies [9236a1e]
- Updated dependencies [7e5b389]
- Updated dependencies [7e5b389]
- Updated dependencies [fd2cbc8]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [01b8a73]
- Updated dependencies [6eefcb6]
- Updated dependencies [7863d23]
- Updated dependencies [6b7317b]
- Updated dependencies [181fbb3]
- Updated dependencies [24fe665]
- Updated dependencies [082dd1d]
- Updated dependencies [79bd6cc]
- Updated dependencies [5886c61]
- Updated dependencies [a34b3fc]
- Updated dependencies [e7d5f5a]
- Updated dependencies [0b82615]
- Updated dependencies [a0070e8]
- Updated dependencies [b584cc5]
- Updated dependencies [4d469aa]
- Updated dependencies [5886c61]
- Updated dependencies [0b29cea]
- Updated dependencies [c22c9a6]
- Updated dependencies [2dd5e34]
- Updated dependencies [0ac8104]
- Updated dependencies [b1e9d32]
- Updated dependencies [de8f61d]
- Updated dependencies [a5166b0]
- Updated dependencies [8b65c38]
- Updated dependencies [56784d5]
- Updated dependencies [033c46f]
- Updated dependencies [4cc61de]
- Updated dependencies [f219a71]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [3c8e227]
- Updated dependencies [8c7d44b]
- Updated dependencies [b2b79f1]
- Updated dependencies [ec23b4e]
- Updated dependencies [d2002e0]
- Updated dependencies [34090f0]
- Updated dependencies [0ecff6a]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [de8f61d]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [44148c3]
- Updated dependencies [e72e26a]
- Updated dependencies [b9f3a12]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [1aa0af1]
- Updated dependencies [f88fa83]
- Updated dependencies [9eb084a]
- Updated dependencies [066e590]
- Updated dependencies [7c01199]
- Updated dependencies [5792fce]
- Updated dependencies [b3b9f5e]
- Updated dependencies [1ba9061]
- Updated dependencies [dc710e2]
- Updated dependencies [0c1b6a6]
- Updated dependencies [b6ae714]
- Updated dependencies [a64cc29]
- Updated dependencies [e737c0f]
- Updated dependencies [69399bc]
- Updated dependencies [d9c51c0]
- Updated dependencies [d19f8cc]
- Updated dependencies [717a531]
- Updated dependencies [3a50e80]
- Updated dependencies [f522122]
- Updated dependencies [36dc93a]
- Updated dependencies [11b0336]
- Updated dependencies [fa288ff]
- Updated dependencies [02087eb]
- Updated dependencies [75ef9fb]
- Updated dependencies [85f85ba]
- Updated dependencies [e549ad3]
- Updated dependencies [fd2cbc8]
- Updated dependencies [dc881e4]
- Updated dependencies [fb4710c]
- Updated dependencies [46440b6]
- Updated dependencies [db54baf]
- Updated dependencies [bbf58f0]
- Updated dependencies [65703dc]
- Updated dependencies [42aab0c]
- Updated dependencies [ac18636]
- Updated dependencies [5d3b9b7]
- Updated dependencies [adb1290]
- Updated dependencies [3f575e2]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [9a3e262]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [dc881e4]
- Updated dependencies [9c4c2ff]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [fa5c2d9]
- Updated dependencies [4810ef4]
- Updated dependencies [4bda721]
- Updated dependencies [b29a94e]
- Updated dependencies [5531792]
- Updated dependencies [c129ce1]
- Updated dependencies [43bf365]
- Updated dependencies [c8f84f3]
- Updated dependencies [c0d43ee]
- Updated dependencies [d73bd9f]
- Updated dependencies [4ee45ab]
- Updated dependencies [b98bad7]
- Updated dependencies [0d377ec]
- Updated dependencies [435c248]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [c491f93]
- Updated dependencies [aadb086]
- Updated dependencies [b1bbd39]
- Updated dependencies [8934e48]
- Updated dependencies [e4a8c4f]
- Updated dependencies [aeda396]
- Updated dependencies [c1da54a]
- Updated dependencies [aeda396]
- Updated dependencies [e30b99b]
- Updated dependencies [d8dc6bf]
- Updated dependencies [e4a8c4f]
- Updated dependencies [a791e92]
- Updated dependencies [09f0c86]
- Updated dependencies [d11dc30]
- Updated dependencies [5ad7bc0]
- Updated dependencies [481218b]
- Updated dependencies [f8172cf]
- Updated dependencies [e5395a6]
- Updated dependencies [cd7ffdb]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [f95e342]
- Updated dependencies [d6ba47e]
- Updated dependencies [fcc5602]
- Updated dependencies [fcc5602]
- Updated dependencies [880cbbf]
- Updated dependencies [2932eb2]
- Updated dependencies [c1a3072]
- Updated dependencies [968362b]
- Updated dependencies [fd2cbc8]
- Updated dependencies [f4bfab5]
- Updated dependencies [e6c888e]
- Updated dependencies [fcc5602]
- Updated dependencies [3cf6a17]
- Updated dependencies [c5e5476]
- Updated dependencies [56089ae]
- Updated dependencies [d7de41f]
- Updated dependencies [f544aeb]
- Updated dependencies [c8b8348]
- Updated dependencies [1e1d4c6]
- Updated dependencies [33b9074]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [ccd6f25]
- Updated dependencies [527f214]
- Updated dependencies [42169f9]
- Updated dependencies [6d2bb1e]
- Updated dependencies [c4304d4]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [edfe71a]
- Updated dependencies [1a03017]
- Updated dependencies [6a9cd12]
- Updated dependencies [be3711c]
- Updated dependencies [4f03b5d]
- Updated dependencies [c0555fb]
- Updated dependencies [094ba4d]
- Updated dependencies [7d598c5]
- Updated dependencies [6d2bb1e]
- Updated dependencies [cff801a]
- Updated dependencies [ff4504e]
- Updated dependencies [cbb78ec]
- Updated dependencies [0ae8b0c]
- Updated dependencies [d897c83]
- Updated dependencies [8078d25]
- Updated dependencies [c428e9e]
- Updated dependencies [bf94421]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [7645aaa]
- Updated dependencies [7dd8e23]
- Updated dependencies [e265bdc]
- Updated dependencies [24bca7a]
- Updated dependencies [0f60e3d]
- Updated dependencies [768acf7]
- Updated dependencies [4bf376e]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [45e100f]
- Updated dependencies [6ab962a]
- Updated dependencies [6ab962a]
- Updated dependencies [0e01d7f]
- Updated dependencies [70076bc]
- Updated dependencies [f8f4954]
- Updated dependencies [b1c09d3]
- Updated dependencies [fa9657c]
- Updated dependencies [f5b75cb]
- Updated dependencies [f41f7ed]
- Updated dependencies [4b3a525]
- Updated dependencies [15e923d]
- Updated dependencies [4c8749c]
- Updated dependencies [9057ecb]
- Updated dependencies [2823dca]
- Updated dependencies [1c43dbf]
- Updated dependencies [a3b1735]
- Updated dependencies [d01d5a2]
- Updated dependencies [bcc5c05]
- Updated dependencies [e11a52e]
- Updated dependencies [3744131]
- Updated dependencies [5477214]
- Updated dependencies [594d4ce]
- Updated dependencies [7e5b389]
- Updated dependencies [2e7bd80]
- Updated dependencies [6c3e486]
- Updated dependencies [e7bee92]
- Updated dependencies [7affd45]
- Updated dependencies [bef9c67]
- Updated dependencies [470d4be]
- Updated dependencies [2668893]
- Updated dependencies [7e5b389]
- Updated dependencies [1e9c740]
- Updated dependencies [586b6c1]
- Updated dependencies [53fb0eb]
- Updated dependencies [47fa777]
- Updated dependencies [47fa777]
- Updated dependencies [fd2cbc8]
- Updated dependencies [9566a40]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [7d67497]
- Updated dependencies [5fa6d0a]
- Updated dependencies [fc665a9]
- Updated dependencies [bb8b8cb]
- Updated dependencies [5fa6d0a]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [914ba92]
- Updated dependencies [6a9a3dc]
- Updated dependencies [4d469aa]
- Updated dependencies [419b1f1]
- Updated dependencies [a3136aa]
- Updated dependencies [5b156c6]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [f976095]
- Updated dependencies [4d31cf0]
- Updated dependencies [af132bc]
- Updated dependencies [2d57c94]
- Updated dependencies [f004638]
- Updated dependencies [3c27e36]
- Updated dependencies [3c27e36]
- Updated dependencies [ce5d609]
- Updated dependencies [9333b1a]
- Updated dependencies [fc62432]
- Updated dependencies [dd5a540]
- Updated dependencies [85d3d17]
- Updated dependencies [921d4f8]
- Updated dependencies [4a4d7c9]
- Updated dependencies [305f0ce]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [8602bbc]
- Updated dependencies [a3958dc]
- Updated dependencies [6fcc7aa]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
- Updated dependencies [31cd706]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [d58694b]
- Updated dependencies [74e37d7]
- Updated dependencies [8f61f88]
- Updated dependencies [231eec5]
- Updated dependencies [6355d18]
- Updated dependencies [fcfefd4]
- Updated dependencies [eeb7c5a]
- Updated dependencies [44848fe]
- Updated dependencies [c4d5642]
- Updated dependencies [aba9531]
- Updated dependencies [c25237f]
- Updated dependencies [b934739]
- Updated dependencies [f1e9773]
- Updated dependencies [b822d40]
- Updated dependencies [88a19c0]
- Updated dependencies [44848fe]
- Updated dependencies [48e0ecd]
- Updated dependencies [c8ed2ce]
- Updated dependencies [f5e0446]
- Updated dependencies [62aede0]
- Updated dependencies [dc3eb53]
- Updated dependencies [f6c305d]
- Updated dependencies [2a7e9e0]
- Updated dependencies [139f3f0]
- Updated dependencies [e0f4c91]
- Updated dependencies [00a1f20]
- Updated dependencies [9c46d22]
- Updated dependencies [6451f0c]
- Updated dependencies [3dab4ca]
- Updated dependencies [c8ed2ce]
- Updated dependencies [f3a1232]
- Updated dependencies [d55c488]
- Updated dependencies [56fda8d]
- Updated dependencies [e04e543]
- Updated dependencies [5c778a0]
- Updated dependencies [162f816]
- Updated dependencies [f88d616]
- Updated dependencies [3cb3a67]
- Updated dependencies [a97fe65]
- Updated dependencies [c60fc3d]
- Updated dependencies [1c2c1ac]
- Updated dependencies [834d2ca]
- Updated dependencies [457fbc3]
- Updated dependencies [1e80440]
- Updated dependencies [d3b20b9]
- Updated dependencies [86b5903]
- Updated dependencies [647b21c]
- Updated dependencies
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [2076b1b]
- Updated dependencies [429e80c]
- Updated dependencies [49b3b13]
- Updated dependencies [bd25e62]
- Updated dependencies [b425d50]
- Updated dependencies [d962a91]
- Updated dependencies [46ec294]
- Updated dependencies [17d184b]
- Updated dependencies [19387a6]
- Updated dependencies [cabffe5]
- Updated dependencies [f92300d]
- Updated dependencies [07f5db2]
- Updated dependencies [16eca51]
- Updated dependencies [08512ea]
- Updated dependencies [e0bea5a]
- Updated dependencies [82f3868]
- Updated dependencies [6c1ea88]
- Updated dependencies [83ad38f]
- Updated dependencies [82e481d]
- Updated dependencies [87a8b06]
- Updated dependencies [bfc26b4]
- Updated dependencies [d569abf]
- Updated dependencies [36a20d4]
- Updated dependencies [410ba5e]
- Updated dependencies [4e4ddb5]
- Updated dependencies [9d459cd]
- Updated dependencies [76ca845]
- Updated dependencies [b835405]
- Updated dependencies [bf1cf7b]
- Updated dependencies [c3e773c]
- Updated dependencies [8558f40]
- Updated dependencies [fa8902c]
- Updated dependencies [96de590]
- Updated dependencies [0ac8104]
- Updated dependencies [9bbe3e4]
- Updated dependencies [0c77c8d]
- Updated dependencies [fd2cbc8]
- Updated dependencies [56f8264]
- Updated dependencies [1c6f913]
- Updated dependencies [f20931c]
- Updated dependencies [2241860]
- Updated dependencies [5d7b7b8]
- Updated dependencies [447f742]
- Updated dependencies [0fe19aa]
- Updated dependencies [5339aec]
- Updated dependencies [3a71a1a]
- Updated dependencies [a979682]
- Updated dependencies [d8c22e6]
- Updated dependencies [f11549d]
- Updated dependencies [ab56471]
- Updated dependencies [86b43d1]
- Updated dependencies [eaefc65]
- Updated dependencies [8cce06e]
- Updated dependencies [16d4fab]
- Updated dependencies [edcc040]
- Updated dependencies [1ceadbf]
- Updated dependencies [a47e5ed]
- Updated dependencies [6829ab9]
- Updated dependencies [865ccae]
- Updated dependencies [a47e5ed]
- Updated dependencies [eb82ac9]
- Updated dependencies [795f517]
- Updated dependencies [a26f70d]
- Updated dependencies [aedb49f]
- Updated dependencies [95da921]
- Updated dependencies [6ac9c99]
- Updated dependencies [f39b469]
- Updated dependencies [e752074]
- Updated dependencies [8b73d9a]
- Updated dependencies [002ff57]
- Updated dependencies [31dd479]
- Updated dependencies [2557ab3]
- Updated dependencies [7a7ea82]
- Updated dependencies [df1d23c]
- Updated dependencies [ca663c7]
- Updated dependencies [e01f958]
- Updated dependencies [a23923e]
- Updated dependencies [9246f97]
- Updated dependencies [843859b]
- Updated dependencies [4816dc3]
- Updated dependencies [97cce9d]
- Updated dependencies [6bfce5e]
- Updated dependencies [9f9a61a]
- Updated dependencies [b646c27]
- Updated dependencies [850db0a]
- Updated dependencies [ef3ebdd]
- Updated dependencies [0828a03]
- Updated dependencies [b92bf56]
- Updated dependencies [0828a03]
- Updated dependencies [f23829c]
- Updated dependencies [7dadcf2]
- Updated dependencies [87e8475]
- Updated dependencies [9521334]
- Updated dependencies [0177219]
- Updated dependencies [670aeb3]
- Updated dependencies [6a9b37e]
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
- Updated dependencies [415e5b8]
- Updated dependencies [033c46f]
- Updated dependencies [e68cb62]
- Updated dependencies [29135cb]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [16e4b0b]
- Updated dependencies [7bc2c18]
- Updated dependencies [fb69a95]
- Updated dependencies [a45338c]
- Updated dependencies [fb69a95]
- Updated dependencies [3f575e2]
- Updated dependencies [4f9848f]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [c11f37e]
- Updated dependencies [cb6e47b]
- Updated dependencies [e39dbc5]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [e0f4c91]
- Updated dependencies [d455bd2]
- Updated dependencies [12df18a]
- Updated dependencies [62aede0]
- Updated dependencies [bda75b2]
- Updated dependencies [5bf7f01]
- Updated dependencies [7293e22]
- Updated dependencies [6bdf14d]
- Updated dependencies [bfc26b4]
- Updated dependencies [2f2e3ca]
- Updated dependencies [a9a0abc]
- Updated dependencies [880ed50]
- Updated dependencies [6975d7b]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [7e90922]
- Updated dependencies [78dd590]
- Updated dependencies [d3f717d]
- Updated dependencies [1a9548b]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [4c592ae]
- Updated dependencies [6153ae7]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [dc881e4]
- Updated dependencies [4aaefe7]
- Updated dependencies [f3130d5]
- Updated dependencies [95b6eb4]
- Updated dependencies [5a94e2b]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [685bc3d]
- Updated dependencies [4b0b9df]
- Updated dependencies [a23ebea]
- Updated dependencies [fd2cbc8]
- Updated dependencies [c62a3d3]
- Updated dependencies [67cb364]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [8fda190]
- Updated dependencies [368fb5f]
- Updated dependencies [dd7e196]
- Updated dependencies [8ec6662]
- Updated dependencies [963f8fd]
- Updated dependencies [ba59515]
- Updated dependencies [7a75fd1]
- Updated dependencies [e063817]
- Updated dependencies [de71f7d]
- Updated dependencies [b2d7ddb]
- Updated dependencies [87d7436]
- Updated dependencies [ae7d97c]
- Updated dependencies [95ca540]
- Updated dependencies [8d7296a]
- Updated dependencies [d6f8aac]
- Updated dependencies [1f05956]
- Updated dependencies [c4f5447]
- Updated dependencies [c4f5447]
- Updated dependencies [9566a40]
- Updated dependencies [129da4b]
- Updated dependencies [cd410a7]
- Updated dependencies [29f3da2]
- Updated dependencies [b70bc7f]
- Updated dependencies [a8efdf5]
- Updated dependencies [6a423ea]
- Updated dependencies [774e9cc]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [a0d7dfc]
- Updated dependencies [7d77794]
- Updated dependencies [a5c1865]
- Updated dependencies [0d977b8]
- Updated dependencies [01d3e39]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [371b695]
- Updated dependencies [0c18df0]
- Updated dependencies [d268d21]
- Updated dependencies [95cd658]
- Updated dependencies [c4783b4]
- Updated dependencies [ce8655e]
- Updated dependencies [edcb456]
- Updated dependencies [f2b94bc]
- Updated dependencies [4198fea]
- Updated dependencies [0ac8104]
- Updated dependencies [475c725]
- Updated dependencies [adca5ed]
- Updated dependencies [5dd240d]
- Updated dependencies [8b01b26]
- Updated dependencies [2c0f2fe]
- Updated dependencies [c7db707]
- Updated dependencies [ca65c7b]
- Updated dependencies [987dd51]
- Updated dependencies [d2002e0]
- Updated dependencies [904ff6b]
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [12816b7]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [5b8e066]
- Updated dependencies [f62be4d]
- Updated dependencies [f776161]
- Updated dependencies [087e02c]
- Updated dependencies [f873d0e]
- Updated dependencies [5046776]
- Updated dependencies [232d77f]
- Updated dependencies [0f2cc79]
- Updated dependencies [542e4e2]
- Updated dependencies [abdc064]
- Updated dependencies [5b08bd0]
- Updated dependencies [2eb84fc]
- Updated dependencies [413e38c]
- Updated dependencies [55fd480]
- Updated dependencies [aec0cec]
- Updated dependencies [3e39fea]
- Updated dependencies [eb070dc]
- Updated dependencies [42ec713]
- Updated dependencies [a9b8fbb]
- Updated dependencies [73f1cf1]
- Updated dependencies [cbc7e4b]
- Updated dependencies [0d0c238]
- Updated dependencies [5354da3]
- Updated dependencies [787ca7b]
- Updated dependencies [721585e]
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/routing@2.0.0
  - @weasel-js/core@2.0.0
  - @weasel-js/stroke@2.0.0
  - @weasel-js/geom@2.0.0
  - @weasel-js/gestures@2.0.0
  - @weasel-js/renderer@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/cursor@2.0.0
  - @weasel-js/react@2.0.0
  - @weasel-js/icons@2.0.0
  - @weasel-js/prefs-schema@2.0.0
  - @weasel-js/select@2.0.0
