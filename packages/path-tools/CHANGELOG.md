# @weasel-js/path-tools

## 2.0.0

### Major Changes

- 03c5f2f: Bindings, `trigger`, `begin`, `preview` and `useOngoingAction` check params against the id's `ActionParamSchema` entry, as tunings do.
  
  This is breaking. An id the schema names takes its whole entry, required keys included, as a record or a thunk; passing no params at all is still allowed, as a palette runs an action. An id the schema does not name takes no params, so a binding or a trigger that hands params to one either adds a schema entry for it or passes the id as `dynamicActionId(id)`, the deliberate path for an id held only at runtime. A plain `string` id is one of those.
  
  ```ts
  declare module '@weasel-js/routing' {
    interface ActionParamSchema { 'review.stamp': { size: number } }
  }
  
  registry.trigger('review.stamp', { size: 2 });          // checked
  registry.trigger('review.stamp', { size: 'wrong' });    // now an error
  registry.trigger(dynamicActionId(item.action.id), item.params); // an id read at runtime
  ```
  
  The kit's own actions that read params have entries: `insert`, `place`, `move`, `rotate`, `viewport.dragPan`, `lassoSelect`, `slice`, `measure`, `ingest`, `setFill`, `setStroke`, `setStrokeWidth`, `setVertexColor`, `simplifyPath`, `offsetPath`, `present.step`, `present.go`, `spiro.finish`, `girth.drag` and others. `AlignParams`, `FlipParams` and `SetFilletsParams` make each field optional, since each action defaults it. `holdPreviewId` returns a `DynamicActionId`, and the `actionParams` dep is typed as `ActionsRegistry['paramsOf']`.
  
  <!-- entry: rank=10 breaking api -->
- 29d293c: The Envelope mesh tool is now Cloth warp, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `useEnvelopeTool`, `UseEnvelopeToolOptions` | `useClothWarpTool`, `UseClothWarpToolOptions` |
  | `DEFAULT_ENVELOPE_SIZE` | `DEFAULT_CLOTH_SIZE` |
  | tool id and `WarpKind` `'envelope'` | `'cloth'` |
  | actions `envelope.drag`, `envelope.grab` | `cloth.drag`, `cloth.grab` |
  | icon `path-tools:envelope` | `path-tools:clothWarp` |
  | `EnvelopeWarp`, `EnvelopeMapping` (`@weasel-js/geom/warp`) | `ClothWarp`, `ClothMapping` |
  | `envelopeOver`, `resizeEnvelope` | `clothOver`, `resizeCloth` |
  | a held warp's `kind: 'envelope'` | `kind: 'cloth'` |
  
  The tool keeps its Shift+F key. A document saved with an envelope warp held on a path needs that warp's `data.warp.warp.kind` rewritten to `'cloth'`.
  
  ```ts
  // before
  const envelope = useEnvelopeTool({ rows: 4 });
  <SceneCanvas tools={{ envelope }} tune={{ 'envelope.drag': { params: { cols: 4 } } }} />
  // after
  const cloth = useClothWarpTool({ rows: 4 });
  <SceneCanvas tools={{ cloth }} tune={{ 'cloth.drag': { params: { cols: 4 } } }} />
  ```
  
  <!-- entry: rank=5 breaking api data -->
- 0046729: Soft selection is now Drape, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `createSoftSelectionPreset`, preset id `'softSelection'` | `createDrapePreset`, `'drape'` |
  | `createSoftSelectionExtension`, extension id `'softSelection'`, `SoftSelectionOptions` | `createDrapeExtension`, `'drape'`, `DrapeOptions` |
  | `softSelectionWeights`, `softSelectionBand`, `softFalloff`, `SoftFalloff` (`@weasel-js/geom`) | `drapeWeights`, `drapeBand`, `drapeFalloff`, `DrapeFalloff` |
  
  ```ts
  // before
  <SceneCanvas features={['paths', createSoftSelectionPreset(() => ({ radiusPx: 80 }))]} />
  // after
  <SceneCanvas features={['paths', createDrapePreset(() => ({ radiusPx: 80 }))]} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- 644baad: Harmonize curvature is now Fairing, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `harmonizePreset`, preset id `'harmonize'` | `pathTools.fairing`, `'fairing'` |
  | action `harmonizeAnchors`, `harmonizeAnchorsAction` | `fairAnchors`, `fairAnchorsAction` |
  | `harmonizeAnchors` (`@weasel-js/geom`) | `fairAnchors` |
  | icon `core:harmonize` | `core:fairing` |
  
  ```ts
  // before
  <SceneCanvas features={['paths', harmonizePreset]} tune={{ harmonizeAnchors: { bindings: [{ kind: 'key', key: 'h' }] } }} />
  // after
  <SceneCanvas features={['paths', pathTools.fairing]} tune={{ fairAnchors: { bindings: [{ kind: 'key', key: 'h' }] } }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- c3da9af: The Corner shape tool is now Fillet, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `cornerShapePreset`, `createCornerShapePreset`, preset id `'cornerShape'` | `pathTools.fillet`, `createFilletPreset`, `'fillet'` |
  | action `editCorner`, its binding `editCorner.drag`, `editCornerAction`, `EDIT_CORNER_PARAMS`, `EditCornerParams` | `editFillet`, `editFillet.drag`, `editFilletAction`, `EDIT_FILLET_PARAMS`, `EditFilletParams` |
  | action `setCorners`, `setCornersAction` | `setFillets`, `setFilletsAction` |
  | action `cycleCornerShape`, `cycleCornerShapeAction`, `CYCLE_CORNER_SHAPE_PARAMS`, `CycleCornerShapeParams` | `cycleFillet`, `cycleFilletAction`, `CYCLE_FILLET_PARAMS`, `CycleFilletParams` |
  | `CORNER_SHAPE_OPTIONS`, `DEFAULT_CORNER_SHAPE`, `DEFAULT_CORNER_TRIM_SHARE` | `FILLET_SHAPE_OPTIONS`, `DEFAULT_FILLET_SHAPE`, `DEFAULT_FILLET_TRIM_SHARE` |
  | `CORNER_CONTROLS`, `CORNER_CONTROLS_PROMPT`, `CORNER_K_SLIDER_RANGE`, `cornerControlsParams`, `cornerControlsState`, `CornerControlsState` | `FILLET_CONTROLS`, `FILLET_CONTROLS_PROMPT`, `FILLET_K_SLIDER_RANGE`, `filletControlsParams`, `filletControlsState`, `FilletControlsState` |
  | `useCornerControls`, `CornerControlsScene`, `CornerControlsSelection`, `UseCornerControlsReturn` | `useFilletControls`, `FilletControlsScene`, `FilletControlsSelection`, `UseFilletControlsReturn` |
  | `createCornerWidgetsExtension`, `cornerWidgetCommands`, `cornerWidgetFrames`, `CORNER_WIDGET_STANDOFF_PX`, `CornerWidgetStyle` | `createFilletWidgetsExtension`, `filletWidgetCommands`, `filletWidgetFrames`, `FILLET_WIDGET_STANDOFF_PX`, `FilletWidgetStyle` |
  | chrome id `path-edit.corners`, `PATH_CORNERS_CHROME_ID` | `path-edit.fillets`, `PATH_FILLETS_CHROME_ID` |
  | toggle `pathEdit.show.corners`, `showCornersAction` | `pathEdit.show.fillets`, `showFilletsAction` |
  | widget hit kind `corner:N`, routing's `isCornerWidget` | `fillet:N`, `isFilletWidget` |
  | icon `path-tools:cornerShape` | `path-tools:fillet` |
  
  Core's CSS `corner-shape` model keeps its names: `CornerSpec`, a polygon's `corners`, `resolveCorners`, `CornerShape`, and the keywords, so saved documents load as before.
  
  ```ts
  // before
  <SceneCanvas features={['paths', cornerShapePreset]} tune={{ cycleCornerShape: { bindings: [{ kind: 'key', key: 'k' }] } }} />
  // after
  <SceneCanvas features={['paths', pathTools.fillet]} tune={{ cycleFillet: { bindings: [{ kind: 'key', key: 'k' }] } }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- 1022f0f: The Girth drag's grab reach is `reachPx`, in its params and in `useGirthTool`'s options, as every other screen-px param is named.
  
  ```ts
  // before
  useGirthTool({ reach: 10 });
  registry.trigger('girth.drag', { reach: 10 });
  // after
  useGirthTool({ reachPx: 10 });
  registry.trigger('girth.drag', { reachPx: 10 });
  ```
  
  <!-- entry: breaking -->
- fe8d797: Handle snapping takes its angles in radians, as `angleStep` and `reachRad`, the names core's measure tool and snap sessions use.
  
  `HandleSnapOptions`' `stepDeg` and `reachDeg` (degrees) are now `angleStep` and `reachRad` (radians); the defaults are unchanged at 45° and 6°.
  
  ```ts
  import { DEG_TO_RAD } from '@weasel-js/geom';
  // before
  createHandleSnapPreset({ stepDeg: 15, reachDeg: 4 });
  // after
  createHandleSnapPreset({ angleStep: 15 * DEG_TO_RAD, reachRad: 4 * DEG_TO_RAD });
  ```
  
  <!-- entry: breaking api -->
- 7e5b389: The kit settings area types are read from their packages' schemas, so they are type aliases and can no longer be augmented.
  
  That covers `GestureKitSettings`, `CoreKitTargetSettings`, `ViewKitSettings`, `LoupeKitSettings`, `Orbit3dKitSettings`,
  `RigKitTargetSettings` and `PathToolsKitTargetSettings`. Add a setting by augmenting `@weasel-js/react`'s `KitSettings` or `KitTargetSettings`, as before:
  
  ```ts
  declare module '@weasel-js/react' {
    interface KitTargetSettings { myHandlePx: number }
  }
  ```
  
  <!-- entry: breaking -->
- 1ad4f25: The Smudge brush is now Knead, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `useSmudgeBrushTool`, `UseSmudgeBrushToolOptions`, `SMUDGE_BRUSH_OPTIONS` | `useKneadTool`, `UseKneadToolOptions`, `KNEAD_TOOL_OPTIONS` |
  | `smudgePreset`, preset id `'smudge'` | `pathTools.knead`, `'knead'` |
  | tool id, action id, and `PathToolId` `'smudgeBrush'` | `'knead'` |
  | `smudgeBrushAction`, `SMUDGE_BRUSH_PARAMS`, `SmudgeBrushParams` | `kneadAction`, `KNEAD_PARAMS`, `KneadParams` |
  | `DEFAULT_SMUDGE_RADIUS_PX`, `DEFAULT_SMUDGE_STRENGTH` | `DEFAULT_KNEAD_RADIUS_PX`, `DEFAULT_KNEAD_STRENGTH` |
  | `smudgePath`, `SmudgePathOptions` (`@weasel-js/geom`, re-exported by core) | `kneadPath`, `KneadPathOptions` |
  | icon `path-tools:smudgeBrush` | `path-tools:knead` |
  
  The tool keeps its U key. Tool options saved under the `smudgeBrush` id start from their defaults under `knead`.
  
  ```ts
  // before
  const smudgeBrush = useSmudgeBrushTool();
  <SceneCanvas features={['draw', smudgePreset]} tools={{ smudgeBrush }} />
  // after
  const knead = useKneadTool();
  <SceneCanvas features={['draw', pathTools.knead]} tools={{ knead }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- e549ad3: Functions that place a node in world take the whole scene, as a node under a container needs.
  
  They are `nodeFrameOf`, `shownNodeOf`, `storesEdits`, `ownGeometryAt`, and path-tools' `brokenConstraintLink`, `brokenConstraintLinks` and `constraintLinkConflictsOf`.
  
  This is breaking for a caller that passed an object with only a few of the scene's methods: one with a node under a container threw. Pass the scene itself.
  
  ```ts
  // before
  shownNodeOf({ get: (id) => scene.get(id) }, id);
  // after
  shownNodeOf(scene, id);
  ```
  
  <!-- entry: breaking fix -->
- 744fbce: The path, text, rig, diagram and measure actions act on the `operands` dep, the selection by default.
  
  This is breaking for code that runs these actions with deps it builds by hand: each now declares `operands` in `requires` and reads it where it read `selection`, as core's editing actions do. On a `<SceneCanvas>` nothing changes, since `operands` answers with the selection unless a host sources its own. Selecting actions (diagram's edge pick and sequence-part pick, following an off-page tag) still read `selection`.
  
  ```ts
  // before
  snipAtCrossingsAction.invoker.run({ scene, selection, applyOps });
  // after
  snipAtCrossingsAction.invoker.run({ scene, operands: selection, applyOps });
  ```
  
  <!-- entry: rank=0 breaking api -->
- 8fac6ca: Bindings and triggers of path-tools' actions check their params against `ActionParamSchema`, including the click, hover, and drag actions.
  
  New schema entries: `snipPath`, `snip.preview`, `linkAnchor`, `editFillet`, `cycleFillet`, `textAlong`, `girth.clear`, `girth.hover`, `shapeBuilder.showFace`, `shapeBuilder.takeFace`, and `equalizeHandles`; `girth.drag`, `pin.addPin`, `spiro.placePoint`, `convertSegmentAt`, `configureWarp`, and `editPathEffect` now name every param they read, the event's `press`, `world`, or `mods` included. Two types are new exports: `StrokePressParams`, what a click command reads to find its stroke, and `ConfigureWarpParams`.
  
  This is breaking in two places. `planSnip` takes `StrokePressParams` rather than `unknown`. `WarpSettings`, `GirthDragParams`, `KneadParams`, `TugPathParams`, `LinkAnchorParams`, `EditFilletParams`, and `CycleFilletParams` are type aliases now, so declaration merging no longer extends them.
  
  ```ts
  planSnip(deps, { press, radiusPx: 4 });        // checked
  planSnip(deps, event as unknown);              // now an error
  ```
  
  <!-- entry: api breaking -->
- 72c4da1: Path edit's drag that selects anchors in a box has the action id `areaSelectAnchors`, matching core's `areaSelect`.
  
  Its default binding's id is `areaSelectAnchors.drag`.
  
  ```ts
  // before
  { spec: { kind: 'drag', target: 'empty' }, actionId: 'marqueeAnchors' }
  // after
  { spec: { kind: 'drag', target: 'empty' }, actionId: 'areaSelectAnchors' }
  ```
  
  <!-- entry: breaking api -->
- 4ba13d5: `createHandleCommand` is `createHandleEditAction`: it builds an action that edits handles.
  
  ```ts
  // before
  const smooth = createHandleCommand('smoothHandles', 'Smooth', icon, edit);
  // after
  const smooth = createHandleEditAction('smoothHandles', 'Smooth', icon, edit);
  ```
  
  <!-- entry: breaking api -->
- 3e75a05: `joinPathsCommand` is `createJoinPathsAction`: it builds an action, and "command" in path-tools means a draw command.
  
  ```ts
  // before
  const join = joinPathsCommand({ id: 'join', label: 'Join' }, () => ({}));
  // after
  const join = createJoinPathsAction({ id: 'join', label: 'Join' }, () => ({}));
  ```
  
  <!-- entry: breaking api -->
- 9cff861: `livePathEdit` is `createLivePathEditAction`, spelled like the other action factories.
  
  ```ts
  // before
  const inset = livePathEdit({ id: 'inset', label: 'Inset', param: 'distance', params, edit, commit });
  // after
  const inset = createLivePathEditAction({ id: 'inset', label: 'Inset', param: 'distance', params, edit, commit });
  ```
  
  <!-- entry: breaking api -->
- c75b38f: `showOverlayAction` is `createOverlayToggleAction`: it builds the toggle that shows or hides a path-edit overlay.
  
  ```ts
  // before
  const comb = showOverlayAction('comb', 'pathEdit.comb', 'Curvature comb', glyph);
  // after
  const comb = createOverlayToggleAction('comb', 'pathEdit.comb', 'Curvature comb', glyph);
  ```
  
  <!-- entry: breaking api -->
- 76664c0: `pathEditPreview`, which core exported, is path-tools' `createPathEditPreview`, spelled like the other factories.
  
  This is a breaking rename, with no alias. Its arguments are unchanged.
  
  ```ts
  // before
  import { pathEditPreview } from '@weasel-js/core';
  const preview = pathEditPreview(dep, id, current);
  // after
  import { createPathEditPreview } from '@weasel-js/path-tools';
  const preview = createPathEditPreview(dep, id, current);
  ```
  
  <!-- entry: breaking api -->
- d8c2af0: `DRAW_TOOLS` includes the spiro pen beside the pen and the pencil, as its `draw` palette group already did.
  
  A host that mounts `DRAW_TOOLS` now mounts `spiro` too, so it passes the spiro tool in `tools` (`usePathToolsTools` builds it) or drops it:
  
  ```ts
  // to keep the pen and pencil alone
  const draw = withoutTools(DRAW_TOOLS, 'spiro');
  ```
  
  <!-- entry: breaking api -->
- 58a8915: The girth tool's types are `GirthTarget`, `GirthEdgeHit` and `GirthGrip`, named for the tool.
  
  ```ts
  // before
  import type { WidthTarget, WidthEdgeHit, WidthGrip } from '@weasel-js/path-tools';
  // after
  import type { GirthTarget, GirthEdgeHit, GirthGrip } from '@weasel-js/path-tools';
  ```
  
  <!-- entry: breaking api -->
- b67db58: path-tools' action groups move from its main entry's `…_GROUP` constants to `@weasel-js/path-tools/groups`
  
  ```tsx
  // before
  import { ANCHOR_SELECTION_GROUP } from '@weasel-js/path-tools';
  <ActionBar group={ANCHOR_SELECTION_GROUP} />
  
  // after
  import * as pathToolsGroups from '@weasel-js/path-tools/groups';
  <ActionBar group={pathToolsGroups.anchorSelection} />
  ```
  
  `ANCHOR_SELECTION_GROUP`, `PATH_EFFECTS_GROUP` and `PATH_OVERLAYS_GROUP` are gone from the main entry; the new one names `anchorSelection`, `pathEffects` and `pathOverlays`. Each is the same string as before.
  
  <!-- entry: breaking api -->
- 1d280b0: The action that leaves path edit is `leavePathEdit`, the verb `group.leave` uses for leaving a group.
  
  Its label is "Leave path edit" and its Escape binding's id is `leavePathEdit.key`.
  
  ```ts
  // before
  actions.trigger('exitPathEdit');
  // after
  actions.trigger('leavePathEdit');
  ```
  
  <!-- entry: breaking api -->
- 1e51ab5: `depOf` is `openPathEditOf`: the `editAnchors` dep while a path is open for editing, or null.
  
  ```ts
  // before
  const dep = depOf(deps);
  // after
  const dep = openPathEditOf(deps);
  ```
  
  <!-- entry: breaking api -->
- 81de83f: Path-tools' all-families preset `pathTools` moves to `@weasel-js/path-tools/presets`, beside every other path-tools preset.
  
  Its preset id is still `'pathTools'`.
  
  ```tsx
  // before
  import { pathTools } from '@weasel-js/path-tools';
  <SceneCanvas features={[presets.draw, pathTools]} tools={tools} />
  // after
  import * as pathTools from '@weasel-js/path-tools/presets';
  <SceneCanvas features={[presets.draw, pathTools.pathTools]} tools={tools} />
  ```
  
  <!-- entry: breaking api -->
- 659a2f6: Path-tools' presets move off the main entry to `@weasel-js/path-tools/presets`, each under its short name.
  
  The main entry no longer exports any `…Preset`: `pathToolsPreset` is `pathTools.pathTools`, `pathsPreset` is `pathTools.paths`, `spiroPreset` is `pathTools.spiro`, and so on for each. The factories, `createFilletPreset`, `createDrapePreset` and the rest, stay on the main entry.
  
  ```tsx
  // before
  import { pathToolsPreset, usePathToolsTools } from '@weasel-js/path-tools';
  <SceneCanvas features={[drawPreset, pathToolsPreset]} tools={usePathToolsTools()} />;
  
  // after
  import { usePathToolsTools } from '@weasel-js/path-tools';
  import * as pathTools from '@weasel-js/path-tools/presets';
  <SceneCanvas features={[presets.draw, pathTools.pathTools]} tools={usePathToolsTools()} />;
  ```
  
  <!-- entry: rank=10 breaking api -->
- 4104e09: The Shape Builder's action ids are `'shapeBuilder.showFace'` and `'shapeBuilder.takeFace'`, naming what they do.
  
  They were `'shapeBuilder.hover'` and `'shapeBuilder.click'`. The tool's binding ids are unchanged.
  
  ```ts
  // before
  { spec: { kind: 'click' }, actionId: 'shapeBuilder.click' }
  // after
  { spec: { kind: 'click' }, actionId: 'shapeBuilder.takeFace' }
  ```
  
  <!-- entry: breaking api -->
- 5cfe2fd: The knife's tool set, `SLICE_TOOLS`, has the id `'slice'`, and the slice tool sits in the `slice` palette group.
  
  Both were `'page'`; a palette `groupOrder` or a check that names the old group names the new one.
  
  ```tsx
  // before
  groupOrder={['select', 'view', 'shape', 'page']}
  // after
  groupOrder={['select', 'view', 'shape', 'slice']}
  ```
  
  <!-- entry: breaking api -->
- 0f60e3d: Puppet warp is now Pin warp, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `usePuppetTool`, `UsePuppetToolOptions` | `usePinWarpTool`, `UsePinWarpToolOptions` |
  | tool id, `PathToolId`, and `WarpKind` `'puppet'` | `'pin'` |
  | actions `puppet.drag`, `puppet.addPin`, `puppet.removePin` | `pin.drag`, `pin.addPin`, `pin.removePin` |
  | icon `path-tools:puppetWarp` | `path-tools:pinWarp` |
  | `PuppetWarp`, `PuppetPin` (`@weasel-js/geom/warp`) | `PinWarp`, `WarpPin` |
  | `puppetMap`, `puppetSolve`, `puppetMesh`, `PuppetMesh`, `PuppetMeshOptions` | `pinWarpMap`, `pinWarpSolve`, `pinWarpMesh`, `PinWarpMesh`, `PinWarpMeshOptions` |
  | a held warp's `kind: 'puppet'` | `kind: 'pin'` |
  
  The tool keeps its B key. A document saved with a puppet warp held on a path needs that warp's `data.warp.warp.kind` rewritten to `'pin'`.
  
  ```ts
  // before
  const puppet = usePuppetTool({ tolerance: 1 });
  <SceneCanvas tools={{ puppet }} tune={{ 'puppet.addPin': { params: { tolerance: 1 } } }} />
  // after
  const pin = usePinWarpTool({ tolerance: 1 });
  <SceneCanvas tools={{ pin }} tune={{ 'pin.addPin': { params: { tolerance: 1 } } }} />
  ```
  
  <!-- entry: rank=5 breaking api data -->
- 0f60e3d: Perspective and free distort is now Plane warp, and every name it carried changes with it; this is breaking, with no aliases. Its two modes are still `free` and `perspective`.
  
  | Before | After |
  |---|---|
  | `useDistortTool`, `UseDistortToolOptions` | `usePlaneWarpTool`, `UsePlaneWarpToolOptions` |
  | tool id, `PathToolId`, and `WarpKind` `'distort'` | `'plane'` |
  | action `distort.drag`, its layer's hit kind `layer:warp-distort` | `plane.drag`, `layer:warp-plane` |
  | warp settings fields `distorts` and `distort.mode` | `planes` and `plane.mode` |
  | icon `path-tools:distort` | `path-tools:planeWarp` |
  | `DistortWarp`, `DistortMode`, `distortOver` (`@weasel-js/geom/warp`) | `PlaneWarp`, `PlaneMode`, `planeOver` |
  | a held warp's `kind: 'distort'` | `kind: 'plane'` |
  
  The tool keeps its F key. A document saved with a distort held on a path needs that warp's `data.warp.warp.kind` rewritten to `'plane'`.
  
  ```ts
  // before
  const distort = useDistortTool({ mode: 'perspective' });
  <SceneCanvas tools={{ distort }} tune={{ 'distort.drag': { params: { mode: 'perspective' } } }} />
  // after
  const plane = usePlaneWarpTool({ mode: 'perspective' });
  <SceneCanvas tools={{ plane }} tune={{ 'plane.drag': { params: { mode: 'perspective' } } }} />
  ```
  
  <!-- entry: rank=5 breaking api data -->
- e49aa18: Balance handles is now Poise, and every name it carried changes with it; this is breaking, with no aliases. Equalize handles keeps its name.
  
  | Before | After |
  |---|---|
  | `balancePreset`, `createBalancePreset`, preset id `'balance'` | `pathTools.poise`, `createPoisePreset`, `'poise'` |
  | action `balanceHandles`, its binding `balanceHandles.drag`, `balanceHandlesAction` | `poiseHandles`, `poiseHandles.drag`, `poiseHandlesAction` |
  | chrome id `path-edit.balance`, `PATH_BALANCE_CHROME_ID` | `path-edit.poise`, `PATH_POISE_CHROME_ID` |
  | toggle `pathEdit.show.balance`, `showBalanceAction` | `pathEdit.show.poise`, `showPoiseAction` |
  | `createBalanceExtension`, `balanceCommands`, `PathEditBalanceStyle` | `createPoiseExtension`, `poiseCommands`, `PathEditPoiseStyle` |
  | grip hit kind `balance:N`, routing's `isBalanceGrip` | `poise:N`, `isPoiseGrip` |
  | `handleBalances`, `HandleBalance`, `balanceFactorToward` (`@weasel-js/geom`) | `poiseLines`, `PoiseLine`, `poiseFactorToward` |
  | icon `path-tools:balanceHandles` | `path-tools:poise` |
  
  ```ts
  // before
  const balance = createBalancePreset({ color: '#a0f' });
  <SceneCanvas features={['paths', balance]} tune={{ balanceHandles: { bindings: [{ kind: 'key', key: 'b' }] } }} />
  // after
  const poise = createPoisePreset({ color: '#a0f' });
  <SceneCanvas features={['paths', poise]} tune={{ poiseHandles: { bindings: [{ kind: 'key', key: 'b' }] } }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- 3f553ff: The Extend to next path tool is now Reach, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `useExtendTool`, `UseExtendToolOptions` | `useReachTool`, `UseReachToolOptions` |
  | `extendPreset`, preset id `'extend'` | `pathTools.reach`, `'reach'` |
  | tool id and `PathToolId` `'extend'` | `'reach'` |
  | action `extendToMeet`, `extendToMeetAction`, `EXTEND_TO_MEET_PARAMS`, `ExtendToMeetParams` | `reachToMeet`, `reachToMeetAction`, `REACH_TO_MEET_PARAMS`, `ReachToMeetParams` |
  | `extendToMeet`, `ExtendToMeetOptions` (`@weasel-js/geom`, re-exported by core) | `reachToMeet`, `ReachToMeetOptions` |
  | icon `path-tools:extend` | `path-tools:reach` |
  
  The tool keeps its Shift+U key.
  
  ```ts
  // before
  const extend = useExtendTool();
  <SceneCanvas features={['draw', extendPreset]} tools={{ extend }} tune={{ extendToMeet: { params: { shape: 'straight' } } }} />
  // after
  const reach = useReachTool();
  <SceneCanvas features={['draw', pathTools.reach]} tools={{ reach }} tune={{ reachToMeet: { params: { shape: 'straight' } } }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- bf1cf7b: The Simplify brush is now Sand, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `useSimplifyBrushTool`, `UseSimplifyBrushToolOptions`, `SIMPLIFY_BRUSH_OPTIONS` | `useSandTool`, `UseSandToolOptions`, `SAND_TOOL_OPTIONS` |
  | `simplifyBrushPreset`, preset id `'simplifyBrush'` | `pathTools.sand`, `'sand'` |
  | tool id, action id, and `PathEditToolId` `'simplifyBrush'`, binding `simplifyBrush.drag` | `'sand'`, `sand.drag` |
  | `simplifyBrushAction`, `SIMPLIFY_BRUSH_PARAMS`, `SIMPLIFY_BRUSH_RADIUS_PX`, `SimplifyBrushParams` | `sandAction`, `SAND_PARAMS`, `SAND_RADIUS_PX`, `SandParams` |
  | icon `core:simplifyBrush` | `core:sand` |
  
  Core's Simplify command is unchanged. Tool options saved under the `simplifyBrush` id start from their defaults under `sand`.
  
  ```ts
  // before
  const simplifyBrush = useSimplifyBrushTool();
  <SceneCanvas features={['paths', simplifyBrushPreset]} tools={{ simplifyBrush }} />
  // after
  const sand = useSandTool();
  <SceneCanvas features={['paths', pathTools.sand]} tools={{ sand }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- 16e4b0b: A slice's commit is set on the tool or action, `useSliceTool({ commit })` or `createSliceAction({ commit })`, not through a `slice` dep.
  
  This is breaking. The `slice` dep, `SliceDep` and `useSliceDepSource` are gone, and `<SceneCanvas>` no longer publishes one. The default commit is path-tools' `slicePaths(cut, deps)`, which cuts every path the cut crosses as before; it reads the deps in `SLICE_PATHS_REQUIRES`. A custom commit names the deps it reads in `requires`, and gets them as its second argument. `OpsApplier` is still exported from core.
  
  ```tsx
  // before
  useDepSource('slice', () => ({ commit: (cut) => cutMine(cut) }));
  const slice = useSliceTool();
  // after
  const slice = useSliceTool({ commit: (cut, deps) => cutMine(cut, deps.scene), requires: ['scene'] });
  // or, for the action alone
  <SceneCanvas actions={{ slice: createSliceAction({ commit, requires: ['scene'] }) }} />
  ```
  
  <!-- entry: breaking api -->
- fb702eb: The Trim segment tool is now Snip, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `useTrimTool`, `UseTrimToolOptions` | `useSnipTool`, `UseSnipToolOptions` |
  | `trimPreset`, preset id `'trim'` | `pathTools.snip`, `'snip'` |
  | tool id and `PathToolId` `'trim'`, bindings `trim.hover`, `trim.leave`, actions `trim.preview`, `trim.unpreview` | `'snip'`, `snip.hover`, `snip.leave`, `snip.preview`, `snip.unpreview` |
  | action `trimPath`, `trimPathAction`, `TRIM_PATH_PARAMS`, `planTrim` | `snipPath`, `snipPathAction`, `SNIP_PATH_PARAMS`, `planSnip` |
  | `trimPathAt`, `TrimPathOptions`, `TrimResult` (`@weasel-js/geom`, re-exported by core) | `snipPathAt`, `SnipPathOptions`, `SnipResult` |
  | icon `path-tools:trim` | `path-tools:snip` |
  
  The tool keeps its Y key. A stroke's `trim`, core's boolean Trim, and `pathTrim` are unrelated and keep their names.
  
  ```ts
  // before
  const trim = useTrimTool();
  <SceneCanvas features={['draw', trimPreset]} tools={{ trim }} />
  // after
  const snip = useSnipTool();
  <SceneCanvas features={['draw', pathTools.snip]} tools={{ snip }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- cbcc46b: The Spiro tool's finishing bindings are named `spiro.finish.click`, `spiro.finish.doubleClick`, and `spiro.finish.key`.
  
  They now follow the `<owner>.<role>` pattern every kit binding does.
  
  A stored binding override names them by the new ids:
  
  ```ts
  // Before
  registry.overrideBindings({ 'spiro.finishKey': key('Mod+Enter') });
  // After
  registry.overrideBindings({ 'spiro.finish.key': key('Mod+Enter') });
  ```
  
  <!-- entry: breaking -->
- e841e68: The Lengthen tool is now Tug, and every name it carried changes with it; this is breaking, with no aliases.
  
  | Before | After |
  |---|---|
  | `useLengthenTool` | `useTugTool` |
  | `lengthenPreset`, preset id `'lengthen'` | `pathTools.tug`, `'tug'` |
  | tool id and `PathEditToolId` `'lengthen'`, binding `lengthenPath.drag` | `'tug'`, `tug.drag` |
  | action `lengthenPath`, `lengthenPathAction`, `LENGTHEN_PATH_PARAMS`, `LengthenPathParams` | `tugPath`, `tugPathAction`, `TUG_PATH_PARAMS`, `TugPathParams` |
  | `lengthenPathEnd`, `lengthenOpenEnd`, `LengthenMode` (`@weasel-js/geom`; core re-exports `lengthenOpenEnd`) | `tugPathEnd`, `tugOpenEnd`, `TugMode` |
  | icon `path-tools:lengthen` | `path-tools:tug` |
  
  A saved binding override keyed `lengthenPath.drag` moves to `tug.drag`. The tool still has no key of its own, and the undo label of a drag that shortens the path is still Shorten path.
  
  ```ts
  // before
  <SceneCanvas features={['paths', lengthenPreset]} tools={{ lengthen: useLengthenTool() }} tune={{ lengthenPath: { params: { mode: 'curvature' } } }} />
  // after
  <SceneCanvas features={['paths', pathTools.tug]} tools={{ tug: useTugTool() }} tune={{ tugPath: { params: { mode: 'curvature' } } }} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- a5caeed: The Blend path effect is now Tween, and every name it carried changes with it; this is breaking, with no aliases. Color blending, `blendMode`, and the renderer's blend state are unrelated and keep their names.
  
  | Before | After |
  |---|---|
  | path effect `kind: 'blend'`, `BlendEffect` (core) | `kind: 'tween'`, `TweenEffect` |
  | action `blend`, `blendAction` | `tween`, `tweenAction` |
  | actions `setBlendSpine`, `releaseBlendSpine`, `setBlendSpineAction`, `releaseBlendSpineAction` | `setTweenSpine`, `releaseTweenSpine`, `setTweenSpineAction`, `releaseTweenSpineAction` |
  | the path-effect settings form's `blends` count | `tweens` |
  | `blendPaths`, `prepareBlend`, `BlendPathsOptions`, `PathBlend` (`@weasel-js/geom`, re-exported by core) | `tweenPaths`, `prepareTween`, `TweenPathsOptions`, `PathTween` |
  | icons `path-tools:blend`, `path-tools:setBlendSpine`, `path-tools:releaseBlendSpine` | `path-tools:tween`, `path-tools:setTweenSpine`, `path-tools:releaseTweenSpine` |
  
  The action keeps its key. A document saved with a live blend needs that node's `data.pathEffect.kind` rewritten to `'tween'`.
  
  ```ts
  // before
  pathEffectNode({ kind: 'blend', steps: 3 }, [a, b], 'main', PATH_EFFECT_DERIVATIONS);
  // after
  pathEffectNode({ kind: 'tween', steps: 3 }, [a, b], 'main', PATH_EFFECT_DERIVATIONS);
  ```
  
  <!-- entry: rank=5 breaking api data -->

### Minor Changes

- 96839c7: Select every Nth anchor declares its count as a params form, `SELECT_EVERY_NTH_ANCHOR_PARAMS`, with a range of 1 to 100.
  
  <!-- entry: api -->
- 7e5b389: A settings page built from the kit settings schemas shows help text on the gesture, target, view, loupe and orbit rows.
  
  <!-- entry: new -->
- 5da2046: A node deleted while Create Outlines waits for a face no longer stays selected after the conversion.
  
  `runCreateOutlines` takes the ids to convert as an optional third argument, and `applyOutlineStroke` as an optional third argument after its options; both default to the selection.
  
  <!-- entry: fix api -->
- 845819b: New `pathEditAidsSchema`: path edit's aids as a prefs group, with `pathEditAidsVisibility` and `PATH_EDIT_AID_CHROME_IDS` to show them.
  
  <!-- entry: api -->
- 527f214: `createPathEditHost` can take the open path from a mode machine, and can leave out nodes with no anchors to edit.
  
  `target: { get, open, close }` reads the open path from the machine's path-edit mode and enters and leaves that mode through it, instead of the host holding an id of its own. `editable: (id) => boolean` names no path while the open one fails it; the default allows every id.
  
  <!-- entry: api -->
- 6d2bb1e: Path edit, the pen, the pencil, the knife, the path commands, and Create Outlines move from `@weasel-js/core` to `@weasel-js/path-tools`.
  
  This is breaking. `presets.draw` no longer opens a path for editing, and `<SceneCanvas>` no longer builds in the `pen`, `pencil`, `slice` or `anchors` tools. A canvas gets them back from path-tools: `pathTools.paths` (path edit, its anchor keys, the path commands, and outlines), which `pathTools.pathTools` includes, and `usePathToolsTools`, which now builds the pen, the pencil, the knife and the anchors tool beside the rest.
  
  ```tsx
  // before
  import { drawPreset, SceneCanvas } from '@weasel-js/core';
  <SceneCanvas features={[drawPreset]} defaultTools={['select', 'pen', 'pencil', 'slice']} />;
  
  // after
  import { SceneCanvas } from '@weasel-js/core';
  import * as presets from '@weasel-js/editing/presets';
  import { usePathToolsTools } from '@weasel-js/path-tools';
  import * as pathTools from '@weasel-js/path-tools/presets';
  const tools = usePathToolsTools();
  <SceneCanvas features={[presets.draw, pathTools.pathTools]} defaultTools={['select']} tools={tools} />;
  ```
  
  These exports leave core and are path-tools' now: the presets `pathTools.paths`, `pathTools.pathEdit`, `pathTools.anchorKeys`, `pathTools.outlines` and `pathTools.pathCommands`, on `@weasel-js/path-tools/presets`; `usePenTool`, `PEN_TOOL_OPTIONS`, `createPenPreviewLayer`, `PEN_CLOSE_HIT_PX`, `usePencilTool`, `PENCIL_TOOL_OPTIONS`, `useSliceTool`, `sliceAction`, `anchorsTool`, `ANCHORS_TOOL_ID`; `editAnchorsAction`, `selectAnchorAction`, `deleteAnchorsAction`, the `nudgeAnchors*Action`s, `hitAnchor`, `commitAnchorEdit`, `anchorEditWouldChange`, `openPathEditOf`, `requiresAnchorSelection`, `createHandleEditAction`, `joinSelectedAnchors`, `editTargetOf`, `markUnder`, `deleteSelectedMark`, `finishPathEditFrame`, `editedPathSymmetries`, `locksInForce`, `HANDLE_LOCK_ROLES`; `createLivePathEditAction`, `createJoinPathsAction`, `planJoin`, `SIMPLIFY_PATH_PARAMS`, `OFFSET_PATH_PARAMS`, `DEFAULT_SIMPLIFY_TOLERANCE`, `OffsetPathParams`; `applyCreateOutlines`, `applyOutlineStroke`, `useCreateOutlinesAdapter`, and their types.
  
  Core's tool sets lose `ANCHOR_TOOLS`, `DRAW_TOOLS` and `PAGE_TOOLS`, and its presets `drawToolsPreset` and `pageToolsPreset` with their `tools:draw` and `tools:page` names: path-tools' `PATH_EDIT_TOOLS` now leads with the anchors tool, and `DRAW_TOOLS` and `SLICE_TOOLS` hold the pen and pencil and the knife. `TOOL_GROUP_ORDER` names core's groups only, so a palette showing path-tools' tools passes its own `groupOrder`. The `pen` and `pencil` shape kinds stay core's, with `tool: false`.
  
  <!-- entry: rank=20 breaking api -->
- 4202a36: A path effect just made shows its settings in the last-operation panel, where a change remakes it in place.
  
  Each effect's settings are one form, `PATH_EFFECT_PARAMS[kind]`, which the making action declares as its `params` and `editPathEffect`'s settings form shows as a section, so a new effect's defaults and the ones the form shows are the same values. Every number in them now has a range.
  
  <!-- entry: new api -->
- 6d2bb1e: The pen's and the knife's kit settings move to `pathToolsKitSettingsSchema` in `@weasel-js/path-tools`.
  
  `targets.penAnchorRadiusPx`, `targets.penHandleDotRadiusPx`, `targets.penCloseHintRadiusPx`, `targets.penCloseHitPx`, `targets.sliceVertexRadiusPx` and `targets.sliceCloseHitPx` keep their paths and defaults; `coreKitSettingsSchema` and `CoreKitTargetSettings` no longer list them, and path-tools' `PathToolsKitTargetSettings` does. A settings page merges the new schema beside core's:
  
  ```ts
  import { coreKitSettingsSchema } from '@weasel-js/core';
  import { pathToolsKitSettingsSchema } from '@weasel-js/path-tools';
  const kit = mergePrefGroups('Kit settings', coreKitSettingsSchema, pathToolsKitSettingsSchema);
  ```
  
  <!-- entry: breaking api -->
- `@weasel-js/path-tools` exports `createOutlinesAction`, `runCreateOutlines`, and `outlineStrokeAction`.
  
  <!-- entry: api -->
- bfc26b4: The params types of the path-effect and `setFillets` actions are exported.
  
  `PathEffectParams`, `TweenParams`, `SetFilletsParams` and `EditPathEffectParams`, as `ActionParamSchema` names them.
  
  <!-- entry: api -->
- fada84a: `createPathEditHost()` holds which path is open and which anchors are selected, for `<SceneCanvas pathEdit>`, `redrawOn`, and a panel to read.
  
  ```ts
  const host = createPathEditHost({ id: 'outline', anchors: [2] });
  <SceneCanvas pathEdit={host} redrawOn={[host]} … />
  ```
  
  Given `{ modes }`, path edit is a mode: opening a path enters `'path-edit'`, closing it returns to `'normal'` (`mode` and `exitMode` rename them), and a path counts as open only while the registry is in that mode.
  
  <!-- entry: api -->
- 52e0851: Shape Builder cuts the nodes a host's `operands` names, and hands what it made back to it, rather than cutting the selection.
  
  `planShapeBuilder` takes the ids to cut as an optional third argument, defaulting to the selection.
  
  <!-- entry: fix api -->
- 8d7296a: A tool set can carry a `label`, and every set the kit ships has one: `toolSet('make', ids, { label: 'Make' })`.
  
  A shortcut sheet heads a set's tools with it, and `withoutTools` keeps it.
  
  <!-- entry: api -->
- 527f214: `usePathEditMode` builds a mode registry and a path-edit host that drives it, for `<SceneCanvas modes pathEdit>`.
  
  ```tsx
  const { modes, pathEdit } = usePathEditMode({ id: 'curve' });
  return <SceneCanvas modes={modes} pathEdit={pathEdit} … />;
  ```
  
  It starts in the path-edit mode on `id` when given one, and takes the host's other options, plus `definitions` for the modes (default `DEFAULT_MODES`).
  
  <!-- entry: api new -->

### Patch Changes

- 5cd31ff: Add extremes is disabled where the axis its params name would add no anchor, as it already was for both axes.
  
  <!-- entry: fix -->
- 9a03912: An anchor or handle drag on a constrained path commits the shape its preview showed.
  
  <!-- entry: fix -->
- 2d649c0: An anchor or handle drag released where it started, or snapped back onto its own press point, records no undo step.
  
  <!-- entry: fix -->
- 666ff95: A Shift-press that takes an anchor out of the selection no longer shows snap feedback while the pointer moves, since it drags nothing.
  
  <!-- entry: fix -->
- d302e54: Canceling a marquee in path edit gives back the extension mark that was selected when it began.
  
  <!-- entry: fix -->
- 099cdcb: A marquee in path edit that sweeps no anchor deselects a selected extension mark, as a click on empty canvas does.
  
  <!-- entry: fix -->
- 373becd: Bending a segment past where a path's constraints can follow keeps the last shape they could, and releases to it, as an anchor drag does.
  
  <!-- entry: fix -->
- c80f586: The Sand, Knead and weight brushes' Size shows its unit, px, in the tool options and the last-operation panel.
  
  <!-- entry: fix -->
- 4f264d0: Values held between two bounds go through geom's `clamp` and `clamp01` rather than local copies.
  
  A loupe whose `minFactor` is above its `maxFactor` now settles on the low bound, as `clamp` does, where it settled on the high one.
  
  <!-- entry: rank=-5 behavior -->
- 7bd4b01: A length constraint given a negative or non-finite `length` holds the pair's measured length instead.
  
  <!-- entry: fix -->
- b2facdc: "Make segments straight" and "Make segments curved" are disabled when the selected segments are already that type.
  
  <!-- entry: fix -->
- 2a0b5f3: `AnyNode`, a scene node of any payload, layer, and pose, is exported beside `AnyScene`.
  
  ui's `AnyNode` from the SelectionPanel is now the same type, re-exported from core.
  
  <!-- entry: api -->
- 08d04fb: `cutPathAtAnchor` is disabled off every anchor and on an open subpath, so the click falls through to other bindings.
  
  <!-- entry: fix -->
- bfc26b4: Every type a public signature names can now be written down by a consumer.
  
  Types the declarations named through private aliases are written out, or are geom's `Point` and `Rect`.
  
  <!-- entry: internal -->
- 9e68f8b: `editPathEffect` runs on the effects its `ids` name while the selection holds none of them, as its params say it does.
  
  <!-- entry: fix -->
- 32a624a: A fillet drag or `setFillets` on two selected corners sharing an edge splits it, so each corner stores the radius it draws.
  
  <!-- entry: fix -->
- cb6aa03: Changing a Girth drag's options in the last-operation panel replays it at the zoom it was made at.
  
  <!-- entry: fix -->
- 26d113c: A held warp of a kind this build does not know, such as one a later build adds, is ignored instead of throwing.
  
  <!-- entry: fix data -->
- 9c0aeb4: A Link anchor drop where no link can be made stays where it was dropped, as a plain move, instead of snapping back.
  
  <!-- entry: fix -->
- 6623aa9: Create Outlines and Outline Stroke convert the nodes a host's `operands` names, not the selection.
  
  What replaced them is handed back to `operands`.
  
  <!-- entry: fix -->
- d88f17e: Create Outlines and Outline Stroke warn the user when a text face fails to load, rather than failing silently.
  
  <!-- entry: fix -->
- 5da2046: Create Outlines no longer throws when its face finishes loading and the adapter is a class with private fields.
  
  <!-- entry: fix -->
- 4bda721: Own-key lookups go through registry's `getOwn` and `hasOwnKey` rather than hand-written `Object.hasOwn` checks.
  
  <!-- entry: internal -->
- 4c95425: A `createPathEditHost` run as a mode tells its subscribers once when opening or closing a path switches the mode, not twice.
  
  <!-- entry: fix -->
- 6366c9f: A path-edit host given a mode `target` tells its subscribers when the open path moves from one node to another.
  
  <!-- entry: fix -->
- 70fdef4: Edits under a `pathSymmetry` dep keep moving each anchor's images on a path far from the origin.
  
  <!-- entry: fix -->
- 62aede0: An install that nests `@weasel-js/geom` under path-tools now resolves `earcut` and `polygon-clipping`, which path-tools depends on.
  
  geom's `./warp` and `./booleans` load them, and geom lists them only as optional peers.
  
  <!-- entry: fix -->
- e3a1721: Installing @weasel-js/path-tools no longer brings in the prefs store: it depends on @weasel-js/prefs-schema.
  
  <!-- entry: perf -->
- 963f8fd: Path-tools' command keys wait for a drag in flight to end, as core's editing keys do.
  
  That covers Bridge, Add Extremes, the path effects, Convert Segments, and the anchor-selection keys.
  
  <!-- entry: fix -->
- 8fac6ca: The Warp Settings and path-effect settings forms make no params from a field value of the wrong type.
  
  <!-- entry: behavior -->
- d82703e: Path-effect and path-command settings named like `constructor` or `__proto__` are kept as data instead of reaching built-ins.
  
  <!-- entry: fix -->
- 0bee7f4: Finishing a path the pen continued drops a lone anchor clicked after a close, as finishing a new path does.
  
  <!-- entry: fix -->
- e89b2a4: Double-clicking with the pen on another open path's end joins the two and leaves the pen idle, rather than starting a new path at the joint.
  
  <!-- entry: fix -->
- 2429e15: Dragging with the pen from a path's first anchor closes the path and pulls that anchor's handles, as a click there closes it.
  
  <!-- entry: fix -->
- cbf665c: The pen joins onto an open path inside a group or frame where that path draws, rather than where its pose is stored.
  
  <!-- entry: fix -->
- 5b827ec: Reach on a selected path keeps its per-anchor stroke widths and colors when an end grows new segments, as it already did in path edit.
  
  <!-- entry: fix -->
- 79e22dc: Inserting, deleting, joining, or bridging anchors on a path whose constraints refuse the edit leaves the anchor selection as it was.
  
  <!-- entry: fix -->
- 790e88a: Sand's preview follows a tolerance changed mid-stroke, so the path previewed is the one committed on release.
  
  <!-- entry: fix -->
- 1ca4e09: `setAnchorField` is disabled for an entry that would change nothing.
  
  That covers the value the anchors already hold, a handle field the anchor has no handle for, a non-finite number, and a selection naming no anchor of the path.
  
  <!-- entry: fix -->
- 7a46f5c: Shape Builder takes a face from the shape now on top when the selection was restacked after the face was shown.
  
  <!-- entry: fix -->
- 415e5b8: Sand and `simplifyAnchorsAt` leave a closed subpath starting on the anchor it started on.
  
  <!-- entry: fix -->
- b88f9f5: The Knead tool's default key is U and the Reach tool's is Shift+U, so Knead no longer shares S with the sticky tool.
  
  Pass `keybinding` to either hook to keep the old key.
  
  <!-- entry: behavior -->
- d22725a: The Snip tool's hover preview reaches as far as a tuned `snipPath` click does, so the dashed piece is the one a click removes.
  
  <!-- entry: fix -->
- 34e0794: Switching away from the spiro tool mid-curve ends its cursor's snap session and its pointer subscription.
  
  <!-- entry: fix -->
- cb6e47b: The Spiro tool closes a curve within the pen's close reach, the `targets.penCloseHitPx` kit setting, when no `closeHitRadius` is given.
  
  Core exports that setting's default as `PEN_CLOSE_HIT_PX`.
  
  <!-- entry: fix api -->
- 0d977b8: Add Pin places the pin on a pin-warped shape turned past 60°, since `unwarpPoint` now inverts such a warp.
  
  It now steps through the map's local Jacobian and returns the point with the smallest miss it found.
  
  <!-- entry: fix -->
- 2075087: A path saved holding a distort, envelope, or puppet warp opens with it editable as the plane, cloth, or pin warp it was renamed to.
  
  `heldPathWarpOf` reads the old kinds as their new ones, and the next edit writes the warp back under the new kind.
  
  <!-- entry: fix data -->
- 9c6db6a: Warp Settings keeps a warp's rows, columns, and tolerance when handed a non-finite number, such as a cleared field.
  
  <!-- entry: fix -->
- 15c0856: `configureWarp`'s settings form reads each field's choices from the warp's own field definitions.
  
  <!-- entry: internal -->
- ce89f4c: Warp Settings is disabled for a selection whose warps an edit has left stale; Expand Warp still drops them.
  
  <!-- entry: fix -->
- 361fce4: A warp drag begun over text whose font is still loading converts and warps the text once the font loads.
  
  <!-- entry: fix -->
- 9fa2d45: A warp tool passed to two canvases shows and redraws its controls on each, and one canvas unmounting leaves the other's controls in place.
  
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
- Updated dependencies [e72e26a]
- Updated dependencies [0090147]
- Updated dependencies [643c699]
- Updated dependencies [0dc7968]
- Updated dependencies [ca5bcb0]
- Updated dependencies [f4d8b83]
- Updated dependencies [6da5a3b]
- Updated dependencies [4fb8cbf]
- Updated dependencies [e468edc]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [6355d18]
- Updated dependencies [3f23bc8]
- Updated dependencies [691b592]
- Updated dependencies [4a642f5]
- Updated dependencies [3b803d7]
- Updated dependencies [9249b26]
- Updated dependencies [f20931c]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [edcd3a6]
- Updated dependencies [3bf5d6c]
- Updated dependencies [b5d4882]
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
- Updated dependencies [6fb8869]
- Updated dependencies [ec44e4c]
- Updated dependencies [063b00c]
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
- Updated dependencies [e8df1fc]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [cf2a57b]
- Updated dependencies [7a5e072]
- Updated dependencies [bb5880a]
- Updated dependencies [29d293c]
- Updated dependencies [a63b723]
- Updated dependencies [0c07b8d]
- Updated dependencies [6cef61c]
- Updated dependencies [76a1854]
- Updated dependencies [fcc5602]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
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
- Updated dependencies [a2df698]
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
- Updated dependencies [929a2d2]
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
- Updated dependencies [398b575]
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
- Updated dependencies [e000f0a]
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
- Updated dependencies [040af35]
- Updated dependencies [51376ec]
- Updated dependencies [e7c03a3]
- Updated dependencies [62aede0]
- Updated dependencies [64fed84]
- Updated dependencies [bbbe801]
- Updated dependencies [43fb985]
- Updated dependencies [75f0443]
- Updated dependencies [f1a886d]
- Updated dependencies [c70da31]
- Updated dependencies [33ddb2e]
- Updated dependencies [964a242]
- Updated dependencies [17e237b]
- Updated dependencies [2b283ed]
- Updated dependencies [d074d01]
- Updated dependencies [1566d81]
- Updated dependencies [f37a70e]
- Updated dependencies [2755b11]
- Updated dependencies [49aa4d8]
- Updated dependencies [dc881e4]
- Updated dependencies [583bd6d]
- Updated dependencies [d353c85]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [b6863aa]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [36dac61]
- Updated dependencies [b85869b]
- Updated dependencies [4674f07]
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
- Updated dependencies [824eca6]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [8c17e91]
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
- Updated dependencies [4bb7f17]
- Updated dependencies [8764186]
- Updated dependencies [9606e24]
- Updated dependencies [a7dab9f]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [6416860]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [0aa5132]
- Updated dependencies [7ba3e69]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
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
- Updated dependencies [0618a25]
- Updated dependencies [e7561c7]
- Updated dependencies [76c5562]
- Updated dependencies [477eb15]
- Updated dependencies [8649268]
- Updated dependencies [8a24c29]
- Updated dependencies [e4f2133]
- Updated dependencies [e4f2133]
- Updated dependencies [4e9c237]
- Updated dependencies [7cace1d]
- Updated dependencies [60b38f5]
- Updated dependencies [74261df]
- Updated dependencies [a86bd34]
- Updated dependencies [fd2cbc8]
- Updated dependencies [d059b75]
- Updated dependencies [a86bd34]
- Updated dependencies [7165e31]
- Updated dependencies [e5e7aef]
- Updated dependencies [9566a40]
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
- Updated dependencies [8c63002]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
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
- Updated dependencies [37daa58]
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
- Updated dependencies [1526249]
- Updated dependencies [0b29cea]
- Updated dependencies [3e89500]
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
- Updated dependencies [7f35ade]
- Updated dependencies [597f68d]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [3c8e227]
- Updated dependencies [8c7d44b]
- Updated dependencies [b2b79f1]
- Updated dependencies [ea36901]
- Updated dependencies [65ac904]
- Updated dependencies [ec23b4e]
- Updated dependencies [d2002e0]
- Updated dependencies [34090f0]
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
- Updated dependencies [10ba95e]
- Updated dependencies [7618831]
- Updated dependencies [dc710e2]
- Updated dependencies [0c1b6a6]
- Updated dependencies [c3a9456]
- Updated dependencies [cd290f3]
- Updated dependencies [2907e97]
- Updated dependencies [9b7a29c]
- Updated dependencies [3cdeca9]
- Updated dependencies [d9af6f2]
- Updated dependencies [26aa3d2]
- Updated dependencies [b6ae714]
- Updated dependencies [a64cc29]
- Updated dependencies [e737c0f]
- Updated dependencies [69399bc]
- Updated dependencies [d9c51c0]
- Updated dependencies [d19f8cc]
- Updated dependencies [717a531]
- Updated dependencies [3a50e80]
- Updated dependencies [921e20e]
- Updated dependencies [2202a32]
- Updated dependencies [f522122]
- Updated dependencies [36dc93a]
- Updated dependencies [36b25c8]
- Updated dependencies [87f3d38]
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
- Updated dependencies [9204311]
- Updated dependencies [3f575e2]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [df97f39]
- Updated dependencies [9a3e262]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [6661cbf]
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
- Updated dependencies [a37a658]
- Updated dependencies [9d4db71]
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
- Updated dependencies [dd3fdb0]
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
- Updated dependencies [3d5d715]
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
- Updated dependencies [1fbfa96]
- Updated dependencies [9aa8036]
- Updated dependencies [76c5562]
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
- Updated dependencies [32356ff]
- Updated dependencies [34b8a3f]
- Updated dependencies [df73bc8]
- Updated dependencies [5c778a0]
- Updated dependencies [261488b]
- Updated dependencies [55ab2c6]
- Updated dependencies [7e1ab6c]
- Updated dependencies [162f816]
- Updated dependencies [34b8a3f]
- Updated dependencies [52e0851]
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
- Updated dependencies [b0bc4cd]
- Updated dependencies [c23c975]
- Updated dependencies [34b8a3f]
- Updated dependencies [e08d172]
- Updated dependencies [2076b1b]
- Updated dependencies [429e80c]
- Updated dependencies [49b3b13]
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
- Updated dependencies [431aa8e]
- Updated dependencies [1ac16c5]
- Updated dependencies [a82e65b]
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
- Updated dependencies [814994a]
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
- Updated dependencies [a23923e]
- Updated dependencies [9217b8a]
- Updated dependencies [9246f97]
- Updated dependencies [843859b]
- Updated dependencies [4816dc3]
- Updated dependencies [97cce9d]
- Updated dependencies [deda510]
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
- Updated dependencies [091bd67]
- Updated dependencies [670aeb3]
- Updated dependencies [6a9b37e]
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
- Updated dependencies [6222db5]
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
- Updated dependencies [c6b831f]
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
- Updated dependencies [a8ae2f7]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [555bd8d]
- Updated dependencies [ae6b2a5]
- Updated dependencies [7e90922]
- Updated dependencies [5b0df8a]
- Updated dependencies [78dd590]
- Updated dependencies [d7a156b]
- Updated dependencies [d3f717d]
- Updated dependencies [1a9548b]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [de2d442]
- Updated dependencies [4c592ae]
- Updated dependencies [3a28bbb]
- Updated dependencies [a0d5f84]
- Updated dependencies [6153ae7]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [dc881e4]
- Updated dependencies [30e2485]
- Updated dependencies [95083bc]
- Updated dependencies [cbaa22a]
- Updated dependencies [bb03b55]
- Updated dependencies [1377fab]
- Updated dependencies [9199cb5]
- Updated dependencies [8ac8a64]
- Updated dependencies [de1e1c0]
- Updated dependencies [4aaefe7]
- Updated dependencies [c356829]
- Updated dependencies [fcc5602]
- Updated dependencies [f3130d5]
- Updated dependencies [95b6eb4]
- Updated dependencies [cbf500e]
- Updated dependencies [c5a7102]
- Updated dependencies [3871e2f]
- Updated dependencies [c3f3d9a]
- Updated dependencies [5548d73]
- Updated dependencies [e824816]
- Updated dependencies [5a94e2b]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [45559fc]
- Updated dependencies [685bc3d]
- Updated dependencies [6111c56]
- Updated dependencies [accc590]
- Updated dependencies [4b0b9df]
- Updated dependencies [f9ed89f]
- Updated dependencies [a23ebea]
- Updated dependencies [8d3c536]
- Updated dependencies [fd2cbc8]
- Updated dependencies [9d1f28d]
- Updated dependencies [f4115e7]
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
- Updated dependencies [f57aa89]
- Updated dependencies [a453821]
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
- Updated dependencies [bdc9108]
- Updated dependencies [0c18df0]
- Updated dependencies [d268d21]
- Updated dependencies [95cd658]
- Updated dependencies [c4783b4]
- Updated dependencies [de9d942]
- Updated dependencies [cdede50]
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
- Updated dependencies [793ac72]
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
- Updated dependencies [fca9c3c]
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
  - @weasel-js/editing@2.0.0
  - @weasel-js/stroke@2.0.0
  - @weasel-js/geom@2.0.0
  - @weasel-js/text@2.0.0
  - @weasel-js/renderer@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/cursor@2.0.0
  - @weasel-js/react@2.0.0
  - @weasel-js/icons@2.0.0
  - @weasel-js/modes@2.0.0
  - @weasel-js/prefs-schema@2.0.0

## 1.19.1

### Minor Changes

- e6c0756: The Girth tool's hover mark and Alt-click clear reach as far as a press does once the last-operation panel changes its grab reach.
  
  A custom `GirthEnv` can take the reach each drag resolved through its new optional `noteReach`, and answer `reachPx` with it.
  
  <!-- entry: fix api -->

### Patch Changes

- dd8810c: Two canvases running `constraintsPreset` each mark their own scene's broken constraint links, and closing one leaves the other's marks.
  
  <!-- entry: fix -->
- 566f538: Editing a path whose stored constraints were written with their keys in another order no longer rewrites them as changed on every edit.
  
  <!-- entry: fix -->
- 1f8115f: A distort, envelope or puppet control drag previews the shape as the scene's output grid stores it, so it lands where it showed.
  
  <!-- entry: fix visual -->
- Updated dependencies [c91c39c]
- Updated dependencies [69b696d]
- Updated dependencies [d65a34b]
- Updated dependencies [c93b396]
- Updated dependencies [687501a]
- Updated dependencies [3e8a149]
- Updated dependencies [b1fdbf3]
- Updated dependencies [687501a]
- Updated dependencies [de8f829]
- Updated dependencies [e8de9c3]
- Updated dependencies [e17dbd6]
- Updated dependencies [2bb5cde]
- Updated dependencies [1f42c0c]
- Updated dependencies [34e40b2]
- Updated dependencies [d9a7171]
- Updated dependencies [f0ef9ba]
- Updated dependencies [9b03a7b]
- Updated dependencies [e17dbd6]
- Updated dependencies [a2627b8]
- Updated dependencies [2a32658]
- Updated dependencies [dbbca9f]
- Updated dependencies [3cd42d9]
- Updated dependencies [913a468]
- Updated dependencies [eb6276d]
- Updated dependencies [34dfc04]
- Updated dependencies [ef4ff01]
- Updated dependencies [5e0f965]
- Updated dependencies [c3c9f05]
- Updated dependencies [7f2951f]
- Updated dependencies [a760b7b]
- Updated dependencies [d11f1df]
- Updated dependencies [baa3137]
- Updated dependencies [c12b7a7]
- Updated dependencies [1ba8505]
- Updated dependencies [500c153]
- Updated dependencies [661582d]
- Updated dependencies [5b509a7]
- Updated dependencies [c3c9f05]
- Updated dependencies [73bdfc7]
- Updated dependencies [b39b992]
- Updated dependencies [b39b992]
- Updated dependencies [8ea61a3]
- Updated dependencies [59a1c5f]
- Updated dependencies [5c1d019]
- Updated dependencies [f0946c4]
- Updated dependencies [1f55652]
- Updated dependencies [d3a8b36]
- Updated dependencies [635431c]
- Updated dependencies [60d4ba5]
- Updated dependencies [f6a2555]
- Updated dependencies [9a0d9d1]
- Updated dependencies [e45b7e4]
- Updated dependencies [9bd6635]
- Updated dependencies [2a03672]
- Updated dependencies [7036750]
- Updated dependencies [3fdf6ae]
- Updated dependencies [58298fa]
- Updated dependencies [71c3f85]
- Updated dependencies [16900c1]
- Updated dependencies [7e954c5]
- Updated dependencies [770768b]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [216d193]
- Updated dependencies [1691dec]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [8ada2a6]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [0cbbb94]
- Updated dependencies [8562ebe]
- Updated dependencies [4fb0c17]
- Updated dependencies [20878ef]
- Updated dependencies [04ac694]
- Updated dependencies [92e4fa8]
- Updated dependencies [f3618cb]
- Updated dependencies [6d1a52e]
- Updated dependencies [25e3464]
- Updated dependencies [687501a]
- Updated dependencies [ca3a89a]
- Updated dependencies [4ff8a4b]
- Updated dependencies [2de6b88]
- Updated dependencies [687501a]
- Updated dependencies [9db6c05]
- Updated dependencies [42f5a79]
- Updated dependencies [5461e84]
- Updated dependencies [5c64825]
- Updated dependencies [8941d77]
- Updated dependencies [f611d11]
- Updated dependencies [e6959cc]
- Updated dependencies [59485d4]
- Updated dependencies [141697f]
- Updated dependencies [28404b3]
- Updated dependencies [b4e8f97]
- Updated dependencies [3fd5c6f]
- Updated dependencies [72e6d28]
- Updated dependencies [16900c1]
- Updated dependencies [2c3416d]
- Updated dependencies [6289e51]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/core@1.19.1
  - @weasel-js/renderer@1.19.1
  - @weasel-js/routing@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/prefs@1.19.1
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/cursor@1.19.1
  - @weasel-js/stroke@1.19.1
  - @weasel-js/icons@1.19.1

## 1.19.0

### Patch Changes

- c0845c1: `@weasel-js/cursor` adds `brushRing(radius, unit)`, the `brush` ring cursor at a radius in screen px. With `unit` set to `'world'`, the radius is in world units and the ring follows the zoom.
  
  `brushRingCursor` is gone from `@weasel-js/path-tools`; call `brushRing` instead.
  
  <!-- entry: breaking api -->
- 0a82772: `useSmudgeBrushTool` and `useSimplifyBrushTool` take a `share` option, so `shareBrushSize` can give them one brush size. It is laid over their options' shares.
  
  <!-- entry: api -->
- 2143ffe: Extend to next path, handed params, is enabled exactly when the run those params make would carry an end on. Handed no params, it still enables when either a straight or an eased run meets a stroke, since the last-operation panel can switch shapes.
  
  <!-- entry: fix -->
- f8a6830: Extend to next path is not enabled for an end that already touches a stroke, so it no longer records an undo step that changes nothing. `extendToMeet` reports no meet from such an end.
  
  <!-- entry: fix -->
- b1309b2: Clearing a Girth width point is disabled with `NotApplicable` when its params hold no click and no set width point under the press.
  
  <!-- entry: rank=-5 fix -->
- ae99285: Dragging a Girth width point at an open end with a retracted handle moves it across the curve, not sideways along the path.
  
  <!-- entry: fix -->
- 2ba2d22: Releasing an Alt-dragged anchor with `linkAnchor` under a real dispatcher links or moves it instead of throwing.
  
  <!-- entry: fix -->
- e913291: An edit action that would change nothing reports itself disabled (`NotApplicable`) instead of enabled.
  
  That covers `deleteAnchors` where the path refuses the delete, such as one anchor of a two-anchor line; `constrainAnchors` where the selection makes no constraint of its kind; `unconstrainAnchors` where there is none to remove; `setCorners` without a shape or radius, or with the ones the corners have; and the anchor nudges and `reversePath` where the selection names no anchor of the path. Selection commands stay enabled when their result is the current selection.
  
  <!-- entry: behavior fix -->
- f0c159d: Repeat Along lays its copies end to end along the path, so a saved document's repeats land in new places.
  
  Each copy is as long along the path as the shape is wide. A count with no spacing puts the first copy's start at the path's start and the last copy's end at its end, rather than centering them on the ends, and `spacing` is the gap between one copy's end and the next one's start, not between their centers. On an open path a copy that `offset` slides partly off an end is kept; one slid wholly off is dropped. `stationsAlongPath` takes the copies' length as a third argument, 0 by default.
  
  <!-- entry: rank=10 behavior data visual api -->
- f8a6830: Menus and the command palette no longer offer a Trim segment that would cut nothing.
  
  It is disabled with `NotApplicable` when it has no click and its press reaches nothing it could cut.
  
  A click still enables it, and the run decides from the click's point, as Extend to next path does.
  
  <!-- entry: fix -->
- Updated dependencies [0896b71]
- Updated dependencies [aaeec8d]
- Updated dependencies [bbfb059]
- Updated dependencies [65ee9a0]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [c0845c1]
- Updated dependencies [6646205]
- Updated dependencies [c5202b9]
- Updated dependencies [6ff27f5]
- Updated dependencies [976bdf2]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [cd3e070]
- Updated dependencies [b1309b2]
- Updated dependencies [998e8d4]
- Updated dependencies [c841997]
- Updated dependencies [253abc5]
- Updated dependencies [97e890d]
- Updated dependencies [87c8ed0]
- Updated dependencies [e3481a9]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [056d901]
- Updated dependencies [42e088a]
- Updated dependencies [214a57e]
- Updated dependencies [8a41dc2]
- Updated dependencies [433a5ad]
- Updated dependencies [b1309b2]
- Updated dependencies [01e5634]
- Updated dependencies [4ecaf12]
- Updated dependencies [3ed07dc]
- Updated dependencies [25b09cf]
- Updated dependencies [867f10c]
- Updated dependencies [d5a83f9]
- Updated dependencies [799636f]
- Updated dependencies [c09afdf]
- Updated dependencies [e36ca03]
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [33bca4e]
- Updated dependencies [d4c2b70]
- Updated dependencies [3b3289a]
- Updated dependencies [fbb67d5]
- Updated dependencies [68383ed]
- Updated dependencies [a43fd34]
- Updated dependencies [d83feb6]
- Updated dependencies [14398f2]
- Updated dependencies [82e3877]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [337b676]
- Updated dependencies [020f69a]
- Updated dependencies [c2465cd]
- Updated dependencies [458e1c2]
- Updated dependencies [dd13518]
- Updated dependencies [b62813d]
- Updated dependencies [f68d93b]
- Updated dependencies [6321d2a]
- Updated dependencies [b1309b2]
- Updated dependencies [55f85bb]
- Updated dependencies [faaeb54]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [7a7c2ef]
- Updated dependencies [60b297c]
- Updated dependencies [3065fad]
- Updated dependencies [8c7c11a]
- Updated dependencies [8e09cb6]
- Updated dependencies [c6d9ee5]
- Updated dependencies [56a58c9]
- Updated dependencies [b1309b2]
- Updated dependencies [45373d0]
- Updated dependencies [3e4a895]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
- Updated dependencies [f718790]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [f137f48]
- Updated dependencies [f0c159d]
- Updated dependencies [caffe33]
- Updated dependencies [562c8a2]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [043db55]
- Updated dependencies [886642a]
- Updated dependencies [a1911f5]
- Updated dependencies [c0b44f0]
- Updated dependencies [7736185]
- Updated dependencies [f63f932]
- Updated dependencies [a933054]
- Updated dependencies [ae820c2]
- Updated dependencies [8710c48]
- Updated dependencies [7d5ab0e]
- Updated dependencies [ef5634e]
- Updated dependencies [7c02aa8]
- Updated dependencies [08c143e]
- Updated dependencies [11ffe9f]
- Updated dependencies [81e2cf4]
- Updated dependencies [744af77]
- Updated dependencies [b1309b2]
- Updated dependencies [7b9e651]
- Updated dependencies [efac12a]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [47a4976]
- Updated dependencies [eaff448]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [6bd1b2b]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [77cc6e1]
- Updated dependencies [afa1429]
- Updated dependencies [582dfcb]
- Updated dependencies [204596e]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [45c01e4]
- Updated dependencies [a7578e7]
- Updated dependencies [0a82772]
- Updated dependencies [3643214]
- Updated dependencies [b8ea958]
- Updated dependencies [b1309b2]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [30c0e8e]
- Updated dependencies [5bc9b94]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/geom@1.19.0
  - @weasel-js/renderer@1.19.0
  - @weasel-js/prefs@1.19.0
  - @weasel-js/cursor@1.19.0
  - @weasel-js/routing@1.19.0
  - @weasel-js/icons@1.19.0
  - @weasel-js/stroke@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/registry@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- 7b4a182: Path tools read grouped nodes where they draw, and click tools leave locked and hidden strokes alone.
  
  - A constraint link tying a node inside a group is checked against that node where it draws, so a link that holds no longer reports as broken (`brokenConstraintLink`, `constraintLinkConflictsOf`) or draws its broken mark in the wrong place.
  - The Smudge brush converts text inside a group to outlines when it passes over the text where it draws, not where the text would sit outside the group; a fresh warp over selected text in a group lays its controls around the text where it draws.
  - Trim segment and Extend to next path, given a click, pass over a locked or hidden stroke for the one under it. Before, a click on a locked stroke tried to change it and a click over a hidden one trimmed or extended it unseen. A hidden stroke no longer cuts a trim or stops an extension.
  - Link anchor never ties a dropped anchor to a hidden or locked path. `linkTargetAt` reads `isHidden` and `isLocked` from the scene it is given when the scene has them.
- 389a7f9: Fixes to how the hand, pencil and slice tools, the 3D camera actions and the trim tool take their gestures.
  
  - The hand tool pans on a drag with Shift, Alt, Ctrl or Cmd held. Before, a held modifier kept its drag from matching, so the drag went to whatever sat under it: a Shift-drag on a selected node moved the node, and an Alt-drag cloned it.
  - The pencil draws a stroke that starts over a shape, as the other insert tools do. Before, its drag matched only on empty canvas, and a drag starting on a shape moved the shape.
  - With a slice cut pending, an Alt-drag places one more point where it is released, as a plain drag does, rather than cutting freehand on its own.
  - `camera.orbit`, `camera.pan` and `camera.pinchDolly` hand a drag or pinch on to the next binding when the view has no `camera3d` dep. `camera.dolly` passes on a wheel or pinch it does nothing with (no camera, or a wheel that only moves sideways), and `camera.home` passes on a double click when there is no camera or no `home`. Before, each took the input and did nothing, so no other binding, and for a wheel not the page either, saw it.
  - The trim tool clears its dashed preview of the piece under the pointer when the pointer leaves the canvas. The warp tools' option docs give Envelope's default key as Shift+F, which it is.
- b4f2043: Audit round thirteen's path-tools fix.
  
  - A warp or smudge over a selected group leaves the locked and hidden paths inside it as they are.
- d16f1ca: Paths inside a frame-defining group are read and written where they draw.
  
  - Path commands (Cut at Crossings, Join, Simplify, Offset, Resample, Trim, Extend to Meet, Smudge, Warp, Girth) read a path stored inside a group in world, and store their result back in the group's frame. Before, they read it without the group's offset or turn, so Cut at Crossings found no crossing between a root path and one inside a group.
  - Path edit draws a grouped path's anchors where the path is, and commits edits into its own frame.
  - Path snapping and the outlines Trim and Extend stop at take a grouped node where it draws.
  - A connector or other derived node inside a turned group is picked on the ink it paints, not turned a second time by the group's angle.
  
  `PathNode` gains `shown` (the node at its world pose) and `local` (a world pose as the node stores it). `withPath`, `reshapeOps` and `pathCopy` now take the `PathNode` instead of its `node`, which breaks callers that passed the node. `withShownPath`, `nodeFrameOf`, `shownIn` and `shownNodeOf` are new. The `editAnchors` dep's `getNodeShape` answers the world pose, and a new optional `storedPose` turns a world pose back into the stored one.
- 07205dd: A stroke whose width is 0 draws nothing, whatever its per-vertex widths and marker sizes, on every path.
  
  - The renderer draws no marker head for a stroke with no width. Before, a head given its own `size` was drawn on a line that drew nothing, where SVG and PDF export drew neither.
  - A node's stroke with no width is no longer hit by a click or hover within its per-vertex widths or its heads (`inkReach`), where nothing is drawn.
  - `strokeEdgeNear` answers `null` for a stroke with no width, so the Girth tool no longer finds or drags edges of a stroke that draws nothing.
  - `inkWidth`, the tessellator's test of whether a width puts down ink, is exported from `@weasel-js/stroke`.
  - `resolveStroke`'s docs no longer say a stroke with no width can draw through its per-vertex widths.
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [3528360]
- Updated dependencies [115c920]
- Updated dependencies [348fb68]
- Updated dependencies [d416d0c]
- Updated dependencies [0c77d00]
- Updated dependencies [fc38c90]
- Updated dependencies [19c6682]
- Updated dependencies [389a7f9]
- Updated dependencies [493a3d2]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [3b10455]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/core@1.18.2
  - @weasel-js/routing@1.18.2
  - @weasel-js/prefs@1.18.2
  - @weasel-js/renderer@1.18.2
  - @weasel-js/cursor@1.18.2
  - @weasel-js/react@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/stroke@1.18.2
  - @weasel-js/icons@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- 7537af5: Set a mark in a cursor's corner instead of drawing one glyph per pair
  
  - A cursor glyph with a mark slot carries a mark naming what the tool does: `cursorFor('crosshair', { mark: 'rect' })`, or `{ glyph: 'pen', mark: 'add' }` as a `CursorSpec`. The mark is drawn after the glyph with a halo of its own, in both the baked and the painted tier.
  - `crosshair` and `pen` have slots. The marks are `add`, `remove`, `rect`, `ellipse`, `polygon`, `star` and `line`, in `MARKS`.
  - Breaking for `@weasel-js/cursor`: `crosshairRect`, `crosshairEllipse`, `crosshairLine`, `crosshairStar`, `crosshairPolygon` and `penPlus` are gone from `GLYPHS`. Write `cursorFor('crosshair', { mark: 'rect' })` and the like, and `{ glyph: 'pen', mark: 'add' }` for `penPlus`. Each pair bakes to the same pixels and hotspot the glyph it replaces did.
  - New exports: `cursorGlyph(name, mark?)`, `markedGlyph`, `placeCursorPath`, `cursorVariants()`, `MARKS`, and the types `CursorMark`, `CursorMarkSlot`, `CursorMarkName`, `CursorVariant` and `CursorForOptions`.
- 112f6bb: Name an icon with a mark in data
  
  - Every field that names an icon takes an `IconSpec`: a ref, or `{ name, mark }` for a subject with a mark set in its corner. That covers an action's and a variant's `icon`, a tool's `presentation.icon`, `useCommand`'s, a pref's and a group's, labkit's chrome, tool and builder items, path-tools' stroke-click tools, diagram stencils and types, forge globals, paint kinds, `SelectionPanel` sections, and `Bar`'s and `ActionBar`'s icons. A bare ref still works everywhere one did.
  - `@weasel-js/icons` exports `IconSpec`, `iconParts`, `iconSpecRefs` and `toIconSpec`, which reads a spec from JSON. It also exports `markLayers`, `ICON_SLOTS`, `ICON_FRAME` and `ICON_STROKE`, the slot geometry `<Icon mark>` used to keep in ui, so every renderer sets a mark the same way.
  - `<Icon name>` takes a spec, and its `mark` prop replaces the spec's. `resolveIcon` and `actionIcon` draw a spec's mark.
  - hud's canvas menus draw a row's mark, cutting the subject around it. `iconCommands(icons, spec, at)` is exported beside `glyphCommands`.
  - The schema editor's icon field picks a mark from the `Marks` group and writes `{ name, mark }`.
  - Code reading a field that was `IconRef` and is now `IconSpec` should read its refs with `iconSpecRefs` rather than assume a string. The devtools snapshot writes a spec's icon as `name + mark`.
  - The boolean crop glyph no longer uses a `clipPath`, which hud's canvas renderer skipped, drawing the whole disc filled.
- 860ab3b: Describe tools and stack tool sets in data, and give forge's global options icons, descriptions and disabled states
  
  - `ToolPresentation.description` says what a tool does. `ToolPalette` reads it in a tool's tooltip in place of the label, the shortcut after it, for a lone button and for a stack's face; `ToolButton` takes `description` for the same. `StrokeClickToolSpec`, `DiagramStencil` and `ContainerStencil` carry one into the tools they build.
  - A tool set can be a stack: `toolSet(id, members, { stack: true })`. `ToolPalette` gives each stacked set inside its `include` one button, and its `stacks` takes sets beside id lists; given, `stacks` replaces the stacks `include` would give. `toolStacksOf(entries)` lists them. `withoutTools` keeps a set's `stack`. `WARP_TOOLS` is now a stack, so a palette including it shows the three warps on one button.
  - `Select` options and `SelectItem` take `description`, a line under the label in the list, and `disabledReason`, read in its place while the option is disabled. Both become the row's accessible description.
  - forge's `GlobalDeclaration` options are `GlobalOption`s, which add `icon`, `disabled`, `disabledReason` and `description`; the globals toolbar draws all four. A lab value naming a disabled option falls back to the nearest enabled one, as one `shows` hides does.
- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [4dd9285]
- Updated dependencies [860ab3b]
  - @weasel-js/routing@1.18.1
  - @weasel-js/core@1.18.1
  - @weasel-js/cursor@1.18.1
  - @weasel-js/icons@1.18.1
  - @weasel-js/prefs@1.18.1
  - @weasel-js/renderer@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1
  - @weasel-js/stroke@1.18.1

## 1.18.0

### Patch Changes

- 4161bcd: Fixes from an audit of core's canvas, tools and input:
  
  - A paste that lands in a container or on a page puts the members of a pasted envelope group where they were drawn; they were stored in world coordinates under the container's frame and landed offset by it.
  - An Alt-drag clone snaps to its own source, which stays where it was. `SnapBegin` takes `exclude`, the nodes that offer no targets, which defaults to `ids`.
  - A Shift-drag on empty canvas marquees and adds what it takes to the selection; the select tool's marquee forbade Shift, so it did nothing.
  - A drag started with a modifier already held now starts: every shape tool (rect, ellipse, line, polygon, star, text, sticky, image, pencil, diagram stencils) with Shift, Alt or Ctrl; move, resize, rotate, clone and measure with Shift or Ctrl; anchor and handle drags, the anchor marquee, balance grips and diagram waypoints with the keys their roles read. Their bindings left those keys out, which the matcher reads as forbidden. `roleMods(roles)` builds a binding's `mods` from an action's modifier roles, and `INSERT_DRAG_MODS` is the insert drag's.
- 5707cd5: Fix path tools found in an audit:
  
  - A warp drag or pin that makes no warp no longer leaves an undo entry holding only the text it converted to outlines.
  - A balance grip dragged back to where it was pressed now commits nothing, instead of the shape from the move before.
  - Extend to next path in path edit now commits through path edit, so what path-edit extensions keep per anchor follows the anchors, and a selected end stays selected on the new end.
  - Canceling an Add spiro point drag puts the anchor selection back as it was, instead of clearing it.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [26f3d8f]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [26e836e]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [b4163e6]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [5c6d898]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [d83476e]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [d025e1b]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [bdb314c]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/routing@1.18.0
  - @weasel-js/stroke@1.18.0
  - @weasel-js/paint@1.18.0
  - @weasel-js/renderer@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/prefs@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/icons@1.18.0
  - @weasel-js/registry@1.18.0
  - @weasel-js/cursor@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [5bda052]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/routing@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/renderer@1.17.3
  - @weasel-js/stroke@1.17.3
  - @weasel-js/cursor@1.17.3
  - @weasel-js/icons@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/prefs@1.17.3
  - @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- cda0a20: Undoing an insert restores the selection from before it. The insert and place actions clear the selection at the press, and the pen and spiro tools select the path they finish or continue; each of those changes now commits in the same undo entry as the node, so under an `applyOps` history that knows nothing about the selection, undo no longer leaves it empty or still on the node it removed. A pen join commits its selection the same way.
  
  This changes two dep contracts, which breaks a consumer's own `insert` or `editAnchors` dep. Both take a `CommitSelection` (`from`, the selection before the change, and `selectNode`): `InsertDep.commit` as a fourth argument and `EditAnchorsDep.applyEdit` as a fifth, both named `select`. A dep that applies ops appends `commitSelectionOps(select, id, label)` to its batch. An insert that applies none must set the selection itself, to the new node with `selectNode` and to nothing otherwise; an edit that commits nothing changes no selection. A dep that ignores `select` leaves the selection empty after an insert, and the pen and spiro tools no longer select what they draw or continue through it. These batches now carry a `setSelection` op, so a consumer history's adapter needs `setSelection`. kernel3d's `createInsert` passes `select` to `mint` as a third argument.
- 85c08f8: The path-effect commands (applying an effect, Expand, Set and Release Spine, Set and Release Effect Path) and Trim put their selection change in their own undo entry, through `commitOps`'s `select`. Undo now restores the selection they started from under a consumer's `applyOps` history, where it used to leave their result selected. An `applyOps` adapter sees a `setSelection` op at the end of these batches.
- 90024bc: Trim segment and Extend to next path now reach a stroke as far on screen as every other picker does under non-uniform zoom; they used to take the smaller of the two axes' world extents and could miss a stroke a few pixels from the click. geom adds `pxReach(px, scale)`, the one conversion of a screen-pixel radius to a world distance that core's anchor clicks, rig, Girth and Smudge now share.
- Updated dependencies [d15e917]
- Updated dependencies [32e0dd5]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [25bbbd5]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [9298f90]
- Updated dependencies [d12d868]
- Updated dependencies [5f8b357]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [f6e234a]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/core@1.17.2
  - @weasel-js/paint@1.17.2
  - @weasel-js/stroke@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/routing@1.17.2
  - @weasel-js/prefs@1.17.2
  - @weasel-js/renderer@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/cursor@1.17.2
  - @weasel-js/icons@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/cursor@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/icons@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/prefs@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/renderer@1.17.1
  - @weasel-js/routing@1.17.1
  - @weasel-js/stroke@1.17.1

## 1.17.0

### Patch Changes

- 6539d70: Double-clicking a balance grip to equalize a segment's handles now moves every image of both handles under a `pathSymmetry` dep, as dragging the grip already did; it used to change only the clicked segment and leave a symmetric path lopsided. `equalizeSegmentHandles` takes the symmetries as an optional fourth argument.
- Updated dependencies [f7dc7c8]
- Updated dependencies [d28ff77]
- Updated dependencies [13ca1ea]
- Updated dependencies [d3820c9]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [b9f95c2]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [e3a95da]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [52fd33e]
- Updated dependencies [e989ef7]
- Updated dependencies [c59a02a]
- Updated dependencies [e6cf896]
- Updated dependencies [3a4cc62]
- Updated dependencies [3517855]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [ee7d8ce]
- Updated dependencies [cb58393]
- Updated dependencies [5b39acd]
- Updated dependencies [c29b1f7]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [e95d9fc]
- Updated dependencies [8fd23c2]
- Updated dependencies [9f29268]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
- Updated dependencies [305c461]
- Updated dependencies [a3ff22a]
- Updated dependencies [15a5e1d]
  - @weasel-js/react@1.17.0
  - @weasel-js/core@1.17.0
  - @weasel-js/renderer@1.17.0
  - @weasel-js/routing@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/prefs@1.17.0
  - @weasel-js/stroke@1.17.0
  - @weasel-js/cursor@1.17.0
  - @weasel-js/icons@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [0233f80]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/renderer@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/routing@1.16.2
  - @weasel-js/stroke@1.16.2
  - @weasel-js/cursor@1.16.2
  - @weasel-js/icons@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/prefs@1.16.2
  - @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [5a2e82a]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [b45f2cc]
- Updated dependencies [017246d]
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/routing@1.16.1
  - @weasel-js/renderer@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/stroke@1.16.1
  - @weasel-js/prefs@1.16.1
  - @weasel-js/cursor@1.16.1
  - @weasel-js/icons@1.16.1
  - @weasel-js/react@1.16.1
  - @weasel-js/paint@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/prefs@1.16.0
  - @weasel-js/routing@1.16.0
  - @weasel-js/paint@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/stroke@1.16.0
  - @weasel-js/renderer@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/cursor@1.16.0
  - @weasel-js/icons@1.16.0
  - @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- a4138b6: `@weasel-js/geom` states the nearest point of a segment, point distance and lerp once, in any
  dimension, and every tier answers through that one rule.
  
  - `@weasel-js/geom/nd` adds `segmentT`, `closestPointOnSegment`, `pointSegmentDist`,
    `pointSegmentDist2`, `distance`, `distance2` and `lerp` over plain number arrays.
  - The root barrel adds `segmentT` and `pointSegmentDist` over loose scalars, which allocate nothing,
    beside the existing `pointSegmentDist2`; `distance`, `distance2` and `lerpPoint` over `Point`; and a
    scalar `lerp`.
  - `@weasel-js/geom/3d`'s `closestPointOnSegment` and `lerp` now go through the same rule, so a planar
    problem gets the same numbers in 2D, 3D and `nd`.
  
  A segment's parameter is clamped to [0, 1] and is 0 on a zero-length segment; at `t = 1` the nearest
  point is the far end exactly. `nearestOnLine` and the private copies in core's measurement hit test,
  animator's auto-skinning, diagram's route and label code, stroke's edge test, path-tools'
  extend-to-meet and guides' layout snaps now call these, so their distances can move by a rounding
  step (`Math.hypot` became a square root of the summed squares).
  
  Corner shapes (`cornerShapePieces`) now fit the true superellipse within `CORNER_FIT_TOLERANCE` for
  every finite `k`. Past `|k| ≈ 9` they strayed up to nine times the tolerance off the curve's straight
  legs, because the fit stepped in an angle that crowds those legs into less than a double resolves;
  it now steps evenly along each leg. The same corners draw with about a third fewer cubics.
- f1906a8: The rest of the kit's stores notify through registry's `createEmitter`: the entered group, the snap
  outcome, devtools roots and transports, kit settings, the menu host and menu controller, tool
  options, `RunSlots`, the seam preview, the HUD list, the effect runners, the symmetry controller,
  the devtools client, and forge's loupe and CSS-variable stores. A listener that throws is logged
  and no longer stops the others, and a listener unsubscribed mid-notify is no longer called; the
  menu host, `RunSlots` and the HUD list used to walk their live set. diagram, diagram-formats, menu,
  symmetry and devtools now depend on `@weasel-js/registry`.
  
  Structural comparisons that went through `JSON.stringify` use `deepEqual` instead, so key order no
  longer makes two equal values differ (theme baking, diagram export's style diffs, trial marks, path
  constraints, unit rows, toolbar dock drops). PrefSchemaEditor's three-way merge keeps
  `JSON.stringify`, because there a reordered key is an edit.
  
  New: `sameList(a, b, same?)` in `@weasel-js/registry`, whether two lists hold equal elements in
  order. `@weasel-js/react`'s `sameList` is now this function, and ui's `samePath` is an alias of it.
- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [6544399]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/paint@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/stroke@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/routing@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/prefs@1.15.2
  - @weasel-js/renderer@1.15.2
  - @weasel-js/cursor@1.15.2
  - @weasel-js/icons@1.15.2

## 1.15.1

### Patch Changes

- 424ba52: The Smudge brush, the Simplify brush, a warp's control drag, and Warp Settings can be the last operation, their
  settings changed after the fact in the last-operation panel. A brush stroke replays every dab from its start with the
  new Size, Strength or Tolerance; text the Smudge brush converted is put back and converted again wherever the brush
  at its new size meets it. A warp drag replays with the warp remade under the new Mode, Rows, Columns, Mapping or
  Tolerance, the control moved as it was first, so an envelope's new grid is resampled from the mesh the drag bent.
  Warp Settings shows only the settings a run changed. Each stays one undo entry.
  
  A tool's options and its action's panel are one setting: `ActionTuning.keep` is handed the params a panel change set,
  and the tuning `<SceneCanvas>` makes from `toolOptionValues` writes them back there, so an options row shows the
  values the next stroke uses. `OngoingHandle.params` reports params a gesture took from what it edited rather than
  from its binding, such as a held warp's own grid, which the panel shows and replay receives. A gesture that opens a
  journal as it starts is now kept as the last operation. `SMUDGE_BRUSH_PARAMS` and `SIMPLIFY_BRUSH_PARAMS` are the
  forms the brushes' options use, and `warpDragParams`, `configureWarpParams`, and `WARP_SETTING_FIELDS` the warps'.
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [027c59a]
- Updated dependencies [8ad43af]
- Updated dependencies [120420a]
- Updated dependencies [9c051bd]
- Updated dependencies [b6a97f4]
- Updated dependencies [e982d8a]
- Updated dependencies [fa1c9a7]
  - @weasel-js/routing@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/prefs@1.15.1
  - @weasel-js/renderer@1.15.1
  - @weasel-js/stroke@1.15.1
  - @weasel-js/cursor@1.15.1
  - @weasel-js/icons@1.15.1
  - @weasel-js/paint@1.15.1
  - @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- 70a64a3: Tools can declare options: `ToolDef.options` names the action they are params of, a prefs group of number leaves
  (their bounds and defaults), and which one is the tool's size and which its strength. `<SceneCanvas>` tunes the
  action from the values the host keeps in the new `toolOptionValues` dep (`ToolOptionValues`, published with
  `useToolOptionValues`; `createToolOptionValues` keeps them in memory). `defineTool` adds step actions for the size
  and strength, bound to `[` `]` and `Shift+[` `Shift+]` while the tool is the active one, so they win over the same keys'
  anchor-selection commands only then.
  
  The Smudge brush (`SMUDGE_BRUSH_OPTIONS`: size, strength) and the Simplify brush (`SIMPLIFY_BRUSH_OPTIONS`: size,
  tolerance) declare theirs. Size steps by ×1.25; the Smudge brush's strength by 0.1, the Simplify brush's tolerance by
  ×1.25.
- c81abf6: `constrainAnchors` and `unconstrainAnchors` have glyphs of their own, `path-tools:constrainAnchors` and
  `path-tools:unconstrainAnchors`, and `constrainAnchors` lists one variant per constraint kind, so a bar, menu or
  palette offers each kind by name. The constraint actions, `deleteConstraint` included, are now in the `constraints`
  action group rather than `anchors`: a surface drawing the `anchors` group no longer shows them. The kinds' names are
  exported as `CONSTRAINT_KIND_LABELS`.
- a95d3a4: Extend to next path now eases a curved end out of its bend instead of running it straight on: the
  extension starts with the end's curvature, lets it fall linearly to zero (an Euler spiral) over the stretch
  that turns it a further `easeTurn` (30° by default), then runs straight, so tangent and curvature both stay
  continuous where it joins. `extendToMeet` searches along that curve for the first stroke it meets.
  
  geom: a new `'eased'` `LengthenMode` for `lengthenPathEnd` and `lengthToward`, `extensionPieces` and
  `easeLength` for the curve an end grows along, and `mode` and `easeTurn` options on `extendToMeet`
  (default `'eased'`) and `lengthenOpenEnd` (default `'tangent'`). `extendToMeet`'s `distance` is now arc
  length along the curve.
  
  path-tools: the `extendToMeet` action declares `params` (`shape`: Eased or Straight, `easeTurn`), so its
  settings appear in the last-operation panel after a click or the command; `lengthenPath` accepts
  `mode: 'eased'`.
- 48b6c4c: An action can declare its params as a form, `Action.params` (a `@weasel-js/prefs` group of labels, ranges, steps,
  and defaults). An immediate run of such an action that commits one history entry becomes the actions tree's last
  operation, read with `useLastOperation()` / `useLastOperationStore()` (or `lastOperationOf(registry)`). Its
  `adjust(patch)` undoes that entry, puts back the selection the run started from, reruns the action with the patch
  over the values it used, and keeps the new entry in place of the old one, so the history still holds one entry. Any
  other history step, an undo or redo, or `dismiss()` clears it. The values last used become the action's params for
  the rest of the session, under any tuning. Core publishes a `selectionSnapshot` dep that captures the node selection
  and the anchor selection together, which the rerun restores.
  
  `@weasel-js/ui` adds `<LastOperationPanel>`, which draws the last operation as a form titled with the command's label,
  adjusting it on each change and dismissing it from its close button; it renders nothing while there is none.
  
  `bridgePaths` and `bridgeAnchors` declare their Tension (`BRIDGE_PARAMS`), `resamplePath` its count, spacing, corners,
  and tolerance (`RESAMPLE_PARAMS`), and `addExtremeAnchors` a new Turns param (`ADD_EXTREMES_PARAMS`). `resamplePath`
  is now an immediate command committing one entry, where it was an ongoing action previewed through `begin`: code
  driving it with `useOngoingAction` must trigger it instead. `addExtremeAnchors` takes `params.axes` — `'xy'` (the
  default), `'x'`, or `'y'` — and geom's `segmentExtremaTs` and `addExtremaAnchors` take the same choice as a last
  argument (`ExtremaAxes`).
  
  <!-- bump-approved: minor: maintainer — 1.15.0 release requested 2026-10-31 -->
- c41c917: Path edit's tools are ordinary tools, and a mode can name the tool it starts on.
  
  **Breaking:** the `pathEditTool.*` toggle actions (`pathEditToolAction`, `exitPathEditToolAction`,
  `pathEditToolActive`, `simplifyBrushToolAction`, `lengthenToolAction`, `SIMPLIFY_BRUSH_TOOL`, `LENGTHEN_TOOL`) are
  removed, as are the `editAnchors` dep's `tool` and `setTool`, `PathEditHost`'s `tool` and `setTool`, and
  `AnchorState.tool`. The `simplifyBrush` and `lengthenPath` actions no longer bind a drag themselves: mount
  `useSimplifyBrushTool` and `useLengthenTool` (or `usePathEditTools`, named by `PATH_EDIT_TOOLS`; `usePathToolsTools`
  includes them), each carrying `edits-anchors`. Their bindings sit at the active tier, so they outrank anchor
  editing's ambient drags; a Lengthen drag on an anchor that is no open end falls through to moving it.
  
  `ModeDefinition.defaultTool` names the tool a mode starts on: entering the mode activates it, leaving restores the
  tool active at entry, and Escape with another tool on returns to it before a second Escape leaves: a mode shortcut's
  `exit` and `cancel` and core's `exitPathEdit` each call `returnToModeDefault` first, reading the new `modeDefaultTool`
  dep `<SceneCanvas>` sources. `PATH_EDIT` names core's new `anchors` tool (key A, glyph `core:anchors`), which the
  `pathEdit` preset mounts and `ANCHOR_TOOLS` names; it binds nothing and holds path edit's active slot. The pointer
  cursor over an anchor or handle is now `editAnchors`' own `cursor`, so a path-edit tool's cursor shows there.
  
  A `chromeRules` dep, which `<SceneCanvas>` sources, reads and sets chrome-visibility rules at run time. The toggles
  `pathEdit.show.direction`, `.comb`, `.balance`, and `.corners` (group `pathOverlays`) use it to flip each overlay
  between `always` and `never`, and come with the preset that draws it.
  
  `ToolPalette` takes `ineligible: 'dim' | 'hide'`, default `dim`; `hide` leaves out every tool the current mode does
  not allow. The Girth tool's palette group is now `path`, beside Trim, Extend, and the Smudge brush.
  
  In the dev server and under vitest, `weaselIcons` in app mode stops looking for tables at the nearest workspace root
  above the app, and reads that workspace's packages' source tables. It used to walk on into an enclosing checkout's
  `node_modules` (a git worktree sits inside its main checkout), so a worktree served that checkout's glyphs: a glyph
  added on the branch drew as "?", and one redrawn there drew as before.
- eda4635: More path tools leave the last-operation panel up after they run, holding the values they read:
  
  - Lengthen (`lengthenPath`, a drag): Shape, straight, arc, or eased (`LENGTHEN_PATH_PARAMS`).
  - Girth (`girth.drag`, a drag): Grab reach and One edge only (`GIRTH_DRAG_PARAMS`, `GirthDragParams`). The drag
    action's label is now "Stroke width", its undo entry's. `useGirthTool`'s `reach` option, when given, wins over
    the reach the panel last set.
  - Corner radius (`editCorner`, a drag): Shape for sharp corners (`EDIT_CORNER_PARAMS`). The corner controls' Shape
    options are now labeled ("Round" rather than "round"), from the shared `CORNER_SHAPE_OPTIONS`.
  - Next corner shape (`cycleCornerShape`): Size for sharp corners, the share of a corner's room its new shape cuts
    (`CYCLE_CORNER_SHAPE_PARAMS`).
  - Link anchor (`linkAnchor`, a drag): Reach (`LINK_ANCHOR_PARAMS`). A replay that misses every target leaves a
    plain move.
  - Trim segment (`trimPath`): Reach (`TRIM_PATH_PARAMS`). Extend to next path's form gains Reach too.
  
  Each drag replays the gesture as it ended with the new values, as one undo entry.
- 1de1aab: The Smudge brush now smudges text: a text node it may push (selected, or any unlocked, shown one while nothing is
  selected) is converted to outlines, as Create Outlines does, the moment the brush touches it, and its paths are
  smudged from then on. Conversion and smudge are one undo entry labeled "Smudge brush", and Escape mid-stroke puts the
  text back. Text whose face has no outlines is left alone, and the user is told once per stroke. In a host with no
  `createOutlinesAdapter` dep, text is skipped. A selected group is now smudged as its path leaves.
  
  `applyCreateOutlines(adapter, ids?)` converts the given text nodes rather than only the selection.
  
  A journal can now open inside another (`Journal.beginJournal`), and `scene.history.beginJournal` opens inside the
  journal edits are going to when there is one, so a gesture journaled during a mode lands in the mode's journal as one
  entry. A journal opened on `scene.history` now takes the scene's `applyBatch` edits without an active-journal accessor.
  
  New `notices` dep (`NoticesDep`, published with `useNotices`): where an action tells the user something went wrong.
  Create Outlines, Outline Stroke, Pathfinder, and the Smudge brush report text they cannot outline through it, and fall
  back to the console without it.
- c5b61d8: The Smudge brush now pushes every path under it while nothing is selected, skipping locked and hidden ones; with a
  selection it still pushes only the selected paths. It used to do nothing without a selection.
- 746fab0: The warp tools (Distort, Envelope, Puppet Warp) now work on a selected group: one set of controls is laid around all
  of its paths, and they warp together. Selected text converts to outlines when a warp begins on it (a drag on the fresh
  controls, or a pin placed), conversion and warp landing as one undo step; canceling the drag puts the text back, and
  text whose face has no outlines is left alone with a notice. While a warp tool is active, the selection's resize and
  rotation handles no longer draw over its controls or take its presses.
  
  New `ToolDef.hides`: chrome ids hidden, in paint and hit-test alike, while that tool is the active one (carried to
  rules as `RuleCtx.hiddenChrome`).
- Updated dependencies [2bdba7b]
- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [719d457]
- Updated dependencies [81a1b94]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [e05ddd3]
- Updated dependencies [30bf607]
- Updated dependencies [0e60598]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [2e2f76c]
- Updated dependencies [c41c917]
- Updated dependencies [fbc7ebf]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [51ca29e]
- Updated dependencies [746fab0]
  - @weasel-js/renderer@1.15.0
  - @weasel-js/core@1.15.0
  - @weasel-js/routing@1.15.0
  - @weasel-js/geom@1.15.0
  - @weasel-js/stroke@1.15.0
  - @weasel-js/cursor@1.15.0
  - @weasel-js/icons@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/prefs@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [012cae5]
- Updated dependencies [56f9771]
- Updated dependencies [dedcb92]
- Updated dependencies [ae38d2e]
- Updated dependencies [dc5a786]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
- Updated dependencies [c5cba19]
- Updated dependencies [64b59af]
  - @weasel-js/renderer@1.14.2
  - @weasel-js/core@1.14.2
  - @weasel-js/prefs@1.14.2
  - @weasel-js/registry@1.14.2
  - @weasel-js/routing@1.14.2
  - @weasel-js/cursor@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/stroke@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/core@1.14.1
  - @weasel-js/cursor@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/renderer@1.14.1
  - @weasel-js/routing@1.14.1
  - @weasel-js/stroke@1.14.1

## 1.14.0

### Patch Changes

- 607cb0e: The anchor selection commands (`growAnchorSelection`, `shrinkAnchorSelection`, `selectEveryNthAnchor`, `selectCornerAnchors`, `selectSmoothAnchors`, `invertAnchorSelection`) and each of `setSpiroKind`'s variants have icons, so an action bar shows them as glyphs rather than as text. They are `path-tools:` glyphs under the new "Anchor selection" and "Spiro points" groups.
- 436f034: `central-topic` draws its outline as an oval of four circular arcs instead of an ellipse, flatter across the top, so it holds solid rows and columns at 16px 1x where the ellipse stepped through gray on every side. `blend` is redrawn on the pixel grid at a stroke one pixel wide, with a larger circle, so it no longer renders gray at 1x.
- c13f843: The `path-tools:roughen` and `path-tools:puckerBloat` glyphs are redrawn so each reads at 16px. Roughen is a square whose edge is finely toothed, where it was a square with its corners knocked out of place. Pucker & Bloat shows both sides of the effect, pinched to spikes on its left half and bloated round on its right, where it was a four-point star.
- c898ec6: Every path effect's create action reads `hideSources` from its params, so Blend, Bend Along, and Repeat Along can
  hide their sources when made, and Text Along Path can be told to leave them shown. The edit action still ignores it.
- 5b7d0ac: Breaking: an immediate action's params carry the event's point as `world`, a `WorldPoint`, in place of `worldX`/`worldY`, and a click's press point as `press` in place of `pressX`/`pressY`. Read `params.world.x` where you read `params.worldX`, and pass `{ world: { x, y } }` where you passed `{ worldX: x, worldY: y }`: to `trigger`, as a menu's params, and to an invoker called directly. The new exported `ImmediateParams` type names every field the dispatcher puts in the bag; cast `params` to it to read them. `trigger` asks `enabled` at `params.world`. A parallax plane now carries `press` into the plane as it already did the release point. The align and flip actions' `'pointer'` reference reads `world` too. The input events themselves are unchanged: a `ClickEvent` still has `x`/`y` and `pressX`/`pressY`, and `useClipboardOps`' `paste(at)` keeps its `{ worldX, worldY }` shape.
- aeb8e3d: Resample, Convert to path (`releaseSpiro`), Set Spine and Release Spine have glyphs of their own (`path-tools:resamplePath`, `releaseSpiro`, `setBlendSpine`, `releaseBlendSpine`), so a command bar draws them as icons instead of their labels.
- 39cb8ed: `core:symmetricHandles`, `core:simplifyBrush`, `core:harmonize`, `path-tools:spiro`, `path-tools:spiroSmooth`, `path-tools:spiroG4`, and the warp tools' `path-tools:distort`, `path-tools:envelope` and `path-tools:puppetWarp` are redrawn on the 16px pixel grid at a one-pixel stroke. The spiro S-curves now run level and along the pixel diagonal, so at 1x they no longer render as a gray diagonal. `simplifyBrush` is now a zigzag path that runs straight from inside the brush's ring, and `harmonize` is a circular arc under two equal curvature-comb teeth.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
- b06e2b9: Breaking: `PointerWorldPos`, the pointer store's value, is `{ world: WorldPoint; viewId }` in place of `{ worldX, worldY, viewId }`. Read `p.world.x` where you read `p.worldX`, and publish with `store.set({ world: { x, y }, viewId })`. `useClipboardOps`' own `getDropPoint` option keeps its `{ worldX, worldY }` shape. When that option is left out, the paste point read from the pointer store no longer carries the store's `viewId` along with it.
- 01b103e: `core:retractHandles` and `path-tools:resamplePath` are redrawn on the 16px pixel grid. `retractHandles`'s corner runs on the pixel diagonal and its arrows carry 45-degree heads; `resamplePath`'s anchors are two pixels square on pixel corners, so they no longer blur at 1x.
- 8e2c8c8: Three live path effects of one shape: Roughen, Zigzag, and Pucker & Bloat. geom adds the math as `roughenPath`, `zigzagPath`, and `puckerBloatPath`, each with its options type. Core adds `RoughenEffect`, `ZigzagEffect`, and `PuckerBloatEffect` to `PathEffect`: a path-effect node of one of these kinds has one source, `[shape]`, and paints it changed in its own fill and stroke. path-tools adds `roughenAction` (Alt+Shift+G), `zigzagAction` (Alt+Shift+Z), and `puckerBloatAction` (Alt+Shift+K) to `pathEffectsPreset`, each with a `path-tools:` glyph. Each makes one effect of every selected shape, just over it, and hides the shape while the effect shows it; Edit Path Effect, Expand to Paths, and Release work on them as on the others. This adds API.
  
  <!-- bump-approved: minor: maintainer — 1.14.0 release requested 2026-10-29 -->
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [d6221a7]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [e1bbdcd]
- Updated dependencies [a1b06d8]
- Updated dependencies [9725598]
- Updated dependencies [592b6e5]
- Updated dependencies [41a013b]
- Updated dependencies [965e698]
- Updated dependencies [fda48f1]
- Updated dependencies [070f3d0]
- Updated dependencies [f2188ba]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [8b14236]
- Updated dependencies [a40d519]
- Updated dependencies [2993216]
- Updated dependencies [61e07e5]
- Updated dependencies [a64647a]
- Updated dependencies [7b048f4]
- Updated dependencies [aba8563]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [8ef803d]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [7cc9da9]
- Updated dependencies [2692828]
- Updated dependencies [767713e]
- Updated dependencies [2232189]
- Updated dependencies [6a69c27]
- Updated dependencies [8763fc3]
- Updated dependencies [b0a55a6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [f7c49b7]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [4aa138a]
- Updated dependencies [81d08f7]
- Updated dependencies [e7d70f5]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [9a3626f]
- Updated dependencies [28f476b]
- Updated dependencies [ffdbbcf]
- Updated dependencies [ee97c81]
- Updated dependencies [941f382]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [561472d]
- Updated dependencies [c66c536]
- Updated dependencies [cbb344e]
- Updated dependencies [4c0141f]
- Updated dependencies [d3fdba8]
- Updated dependencies [f9282f7]
- Updated dependencies [0509c29]
- Updated dependencies [3803ba2]
- Updated dependencies [01b103e]
- Updated dependencies [9819d7a]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8ddaf05]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [ebe1f55]
- Updated dependencies [78213f7]
- Updated dependencies [0fc0e50]
- Updated dependencies [3401898]
- Updated dependencies [058fcdf]
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [871a56b]
- Updated dependencies [f645651]
- Updated dependencies [95eb9d3]
- Updated dependencies [7507e13]
- Updated dependencies [1e54d33]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [ca31c35]
- Updated dependencies [69d6ede]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/renderer@1.14.0
  - @weasel-js/stroke@1.14.0
  - @weasel-js/paint@1.14.0
  - @weasel-js/routing@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/cursor@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- 5f28e9c: A path effect that hides its sources no longer treats a source that was already hidden when the effect was made as one it hid. Release leaves that source hidden, and Expand to Paths, Delete and Cut leave it in the scene; Set Path moving off it leaves it hidden too. The effect records those sources by position in a new `foundHidden` field beside `hideSources`, and a saved effect without one reads as before: it hid them all. `sourcesHiddenBy(scene, id)` in core answers which sources an effect holds hidden, and `sourcesOf(node)` the ids a node names in its `dependsOn`.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- d9f7bb7: Set Spine and Release Spine move the `hidden` flag as Set Path does where a blend hides its sources. Set Spine hides the path it lays the blend along, or records it in `foundHidden` where it was hidden already, and shows the spine it replaces unless another effect still hides it or the blend found it hidden. Release Spine shows the spine on the same terms, counting every selected blend let go of that spine.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [7c1134c]
- Updated dependencies [f1c1528]
- Updated dependencies [9a76fb5]
- Updated dependencies [7e5f9e3]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/routing@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/renderer@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/stroke@1.13.0
  - @weasel-js/cursor@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 5f28e9c: A path effect that hides its sources no longer treats a source that was already hidden when the effect was made as one it hid. Release leaves that source hidden, and Expand to Paths, Delete and Cut leave it in the scene; Set Path moving off it leaves it hidden too. The effect records those sources by position in a new `foundHidden` field beside `hideSources`, and a saved effect without one reads as before: it hid them all. `sourcesHiddenBy(scene, id)` in core answers which sources an effect holds hidden, and `sourcesOf(node)` the ids a node names in its `dependsOn`.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- d9f7bb7: Set Spine and Release Spine move the `hidden` flag as Set Path does where a blend hides its sources. Set Spine hides the path it lays the blend along, or records it in `foundHidden` where it was hidden already, and shows the spine it replaces unless another effect still hides it or the blend found it hidden. Release Spine shows the spine on the same terms, counting every selected blend let go of that spine.
- Updated dependencies [7e5f9e3]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/routing@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/renderer@1.13.0-rc.0
  - @weasel-js/stroke@1.13.0-rc.0
  - @weasel-js/cursor@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 13e597d: Text can follow a path. `@weasel-js/geom` adds a `'path'` track shape (`pathShape`), a `side` override on `trackRun`,
  and `placeAlongRun`, which turns item lengths into places along a run, in `RunOrder` `'reading'` or `'track'`.
  `TrackShape` gains a required `closed` member, so a shape implemented outside geom has to add it.
  `runPlaces` and `runLength` moved there from `@weasel-js/ui`, which re-exports `runPlaces` by name, so its curved rows
  come from geom's placement. `measurePath` takes `keepCorners`. `@weasel-js/text` adds `textClusters`, a line's
  grapheme clusters as outlines with their advances. `@weasel-js/core` adds the `textAlong` path effect; every effect
  takes `hideSources`, effect sources can carry a list of items, curved text is derived again when a font loads, a
  hidden source is edited through its effect, and Delete, Cut and Expand now remove an effect's hidden sources with
  it. A committed in-place text edit is labeled "Edit text" in history.
  `@weasel-js/path-tools` adds Text Along Path (Alt+Shift+X), Release and Set Path. `useTextEdit` in
  `@weasel-js/text-dom` gains `onDraft`.
  
  <!-- bump-approved: minor: maintainer — 1.12.0 release requested 2026-10-22 -->
- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- 24f2495: An absent fill or stroke now means none everywhere, read through `resolveFill` and `resolveStroke`. This breaks three things that used to fill in a default:
  
  - **A text node built without a `fill` now draws no glyphs.** Write `fill: { paint: solid('#000') }`, or `DEFAULT_TEXT_FILL`, now exported from `@weasel-js/text` and `@weasel-js/core`. `DEFAULT_TEXT_STYLE.fill` is `null`. The text insert, the sticky note and SVG import write black themselves.
  - **A derived part with no `fill` or `stroke` no longer takes its node's.** Write `INHERIT` (`'inherit'`) for that; `DerivedPart` allows it, and `resolvePartPaint` is the one reading of a part's paint.
  - **`diagramShape` drops its `defaultFill` and `defaultStroke` options.** An outline paints what its data names; `diagramScene` already writes the default style onto every node. SVG import writes SVG's initial black onto text that names no fill, and SVG export writes `fill="none"` for text that has none.
  
  `setFill` and `setStroke` write None as a record with no `paint` rather than `null`, so a stroke keeps its width and dash; a `paint: null` passed when the gesture starts used to be read as no paint given and painted the default color. The selection panel shows a fill or stroke paint as a paint, None or Mixed, never unset; `nestedPaintValue` is that reading. Booleans, Outline Stroke and the character bar read a fill with no paint as unfilled. Core re-exports `resolveFill`, `resolveStroke`, `INHERIT` and their types.
- Updated dependencies [dbd6711]
- Updated dependencies [f6db995]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [2cf7da4]
- Updated dependencies [92a0f2d]
- Updated dependencies [448065a]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [929736f]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/routing@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/stroke@1.12.0
  - @weasel-js/renderer@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/cursor@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 70b12d1: An action can carry a settings form: `Action.settings` holds a prefs schema, a `read` that gives
  the selection's current values (and which fields it disagrees on), and an optional `params` that
  turns one field's change into the params the action is triggered with. Every surface that lists
  actions draws such an action as its form instead of a button that triggers it bare: a bar or a
  panel opens it in a popover under the action's button, a menu shows it as a submenu of its fields,
  and the command palette opens it in a dialog. Each change is one trigger, so one undo step. The
  form is disabled while the action's `enabled` says no. `readActionSettings` and
  `actionSettingsParams` are what the surfaces read it through; `useActionSettings`,
  `ActionSettingsPopover` and `ActionSettingsDialog` are in `@weasel-js/ui/components/ActionSettings`.
  `BarActionButton` takes `expanded` for a button that opens a dialog.
  
  Warp Settings (`configureWarp`) and Edit Path Effect (`editPathEffect`) carry one each, so Warp
  Settings on a bar now opens Mode, Rows, Columns, Mapping and Tolerance for the selected warps
  rather than doing nothing, and both are disabled with nothing they apply to selected.
  `editPathEffect` takes an optional `kind`, limiting an edit to effects of that kind, and now reads
  `selection`. The forms are exported as `warpSettingsForm` and `pathEffectSettingsForm`.
- 3b5750f: Set, swap, or release the spine of a blend that already exists. `setBlendSpineAction`
  (`setBlendSpine`) lays the selected blend along the other selected path, in either selection order,
  replacing any spine it had; `releaseBlendSpineAction` (`releaseBlendSpine`) puts each selected
  blend back on a straight run between its two shapes and selects the spines, ordinary paths where
  they were. Both are in `pathEffectsPreset` and the `pathEffects` group, and each is one undo step.
  
  Core adds `createSetDependsOnOp`, an undoable retarget of a derived node's `dependsOn`, and the
  `setDependsOn` write it goes through on `SceneMutators` and the scene-backed adapter.
- 25a112b: Constraint links follow whole-node drags live, and broken ones are drawn.
  
  - core: move, resize and rotate preview the nodes a constraint link ties as they will commit, every frame, through the same finishing the commit runs, and `transformPreviewFields` gives a drag its preview fields with them added.
  - path-tools: `createConstraintLinkMarks(style)` is a screen-space layer, carried by `constraintsPreset`, that draws every broken link: its constraint's mark by the anchor it holds and a dashed line to where it wants that anchor, in the conflict color. `brokenConstraintLink(scene, id)` and `brokenConstraintLinks(scene)` read the links that do not hold, `constraintLinkMarks` draws a list of them, and `DEFAULT_CONSTRAINT_STYLE` is exported.
- 4d99526: Constraint links now hold through whole-node transforms, preview through every path-edit drag, and have a gesture that makes them.
  
  - core: `PathEditExtension.finishTransform(ctx: PathTransformFinishCtx)` answers the other nodes a move, resize, rotate, flip, nudge or transform-again changes along with the ones it transforms — align and distribute too — committed in the same history entry; the `editAnchors` dep runs it as `transformOps(ops, label)`, and those actions now declare `editAnchors`. An extension may refuse a transform by answering null.
  - core: `pathEditPreview` finishes each frame itself through the new `finishPathEditFrame`, so bend segment and the path-tools drags preview the node's constraints and linked nodes as they will commit. Breaking: its `current` thunk now answers a `PathEditFrame` (`{ path, origins? }`) instead of a bare path.
  - geom: `PathsEditItem.yields` lets a path the edit left alone give way freely.
  - path-tools: the constraints extension carries linked nodes through whole-node transforms; `constraintLinkConflictsOf(scene, id)` reports the links tying a node that do not hold; `linkAnchorAction` (in `constraintsPreset`) links an anchor Alt-dragged onto another node's anchor (`coincident`) or segment (`onPath`), with `linkTargetAt` and `linkConstraint` beside it.
- 6875e54: `cornerControlsState` reports a corner with no keyword (a parameter between them, or a sharp corner) as `shape: 'none'` rather than `null`. A prefs form now reads a `null` value as absent and shows the leaf's default, which would have pressed `round`; `'none'` is a held value the shape leaf's encoding reads as no option.
- 5cdc3d0: `BROWSER_RESERVED_CHORDS` adds Mod+Shift+I, J, C and K: Chrome's devtools, console and inspector on Windows and Linux, and Firefox's Browser and Web Console. Bridge and Bridge anchors move off Mod+Shift+J to Alt+J, which is a breaking change for anyone relying on the old default.
- 1bb4752: Tool sets: a `ToolSet` names a group of tool ids and other sets as one unit (`toolSet`, `toolIdsOf`, `withoutTools`, `toolSetHas`). `<SceneCanvas defaultTools>`, a preset's `tools`, and `ToolPalette`'s `include` each take sets. Core exports one per family, `SELECT_TOOLS`, `VIEW_TOOLS`, `SHAPE_TOOLS`, `DRAW_TOOLS`, `TYPE_TOOLS`, `PAGE_TOOLS` and `RIG_TOOLS`, with `BUILTIN_TOOLS` over them all; `BUILTIN_TOOL_IDS` is derived from it, and a shape kind's new `family` field says which set names it. `@weasel-js/path-tools` exports `WARP_TOOLS`, `RESHAPE_TOOLS`, `PATH_TOOLS_TOOLS`, and `usePathToolsTools()`, which builds every one of its tools keyed by id.
- Updated dependencies [70b12d1]
- Updated dependencies [3b5750f]
- Updated dependencies [768be71]
- Updated dependencies [9390be4]
- Updated dependencies [1dd65f5]
- Updated dependencies [411b629]
- Updated dependencies [267d5e4]
- Updated dependencies [922cddf]
- Updated dependencies [d5a4102]
- Updated dependencies [9cd12f7]
- Updated dependencies [e5ba382]
- Updated dependencies [8e317f5]
- Updated dependencies [abf41a7]
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [853ce69]
- Updated dependencies [5cdc3d0]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [50da815]
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [8cd81e7]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [f148f50]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/routing@1.11.1
  - @weasel-js/core@1.11.1
  - @weasel-js/renderer@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/stroke@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/cursor@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 60d8e39: `@weasel-js/path-tools` adds three presets, each also in `pathTools`:
  
  - `anchorSelectionPreset` selects anchors along the path in path edit. `growAnchorSelection` (`]`) adds each selected anchor's neighbors in its subpath and `shrinkAnchorSelection` (`[`) drops the anchors at the ends of each selected run, wrapping round a closed subpath. `selectEveryNthAnchor` (Alt+N) selects every `params.n`th anchor counting from the first selected one; `selectCornerAnchors` (Alt+C), `selectSmoothAnchors` (Alt+M), and `invertAnchorSelection` (Alt+I) select by anchor kind and by complement. They are in the `ANCHOR_SELECTION_GROUP` group, change only the selection, and push no undo step.
  - `resamplePreset` brings `resamplePath`, an ongoing path command: it spreads each selected path's anchors evenly along it by arc length, to `params.count` anchors or at `params.spacing`, holds corner anchors fixed unless `params.keepCorners` is false, and refits the curves through the new anchors within `params.tolerance`, halving any piece that cannot follow the original that closely. It previews on `begin` and every update, and commits one undo step.
  - `addExtremesPreset` brings `addExtremeAnchors` (Alt+X), which splits curved segments at their x and y extremes without moving the shape: the segments whose two ends are selected, or the whole path while no anchor is. It is in the `anchors` group.
  
  `ActionParamSchema` types the params of `selectEveryNthAnchor` and `resamplePath`.
  
  Core exports `livePathEdit`, the builder behind `simplifyPath` and `offsetPath`, for a path command driven live by its params. A live path command now recomputes when any param changes, not only its main number, and reads params a tuning supplies as a thunk.
  
  `@weasel-js/geom` adds `resamplePath`, `addExtremaAnchors`, `segmentExtremaTs`, `cubicAxisExtremaTs`, and the selection walks `growAnchorSelection`, `shrinkAnchorSelection`, `everyNthAnchor`, `anchorsWhere`, `cornerAnchors`, `smoothAnchors`, and `invertAnchorSelection`.
- 6f839dd: A blend can lay its steps along a spine and space them by distance. A blend node whose `dependsOn` names a third path, `[from, to, spine]`, places each step on the spine as far along it as the step is between its sources, and paints nothing while that spine is gone; `orient` also turns each step by how far the spine's heading differs from the straight run between the sources. `spaceBy: 'distance'` puts a step every `distance` from the first source, along the spine where there is one, as many as fit short of the second; `spaceBy: 'count'`, the default, keeps `steps` evenly spread. Blend made with three shapes selected takes the third as its spine, and `blend` and `editPathEffect` take `spaceBy`, `distance`, and `orient` as params.
- 6072e93: A path constraint conflict names every constraint it needs, not only the one left failing. Fixing both ends of an edge and then asking for it vertical reports all three, so the fix — drop either pin, or the new constraint — is on screen.
  
  `@weasel-js/geom` gains `conflictingConstraints(points, constraints, opts?)`: for each group of constraints sharing anchors that cannot all hold, a smallest subset that still cannot, found by dropping each member in turn and keeping it out when the rest still fail. Later constraints in the list are kept over earlier ones that conflict the same way, so the one just added stays in the set. A constraint that cannot apply at all is named on its own.
  
  In `@weasel-js/path-tools`, `constraintConflictsOf` and the overlay's conflict color cover the whole set, and `setConstraints` answers it — empty when every constraint holds, null when the dep cannot store — where it answered a boolean. This changes `setConstraints`' return type.
- 53ba41a: Path constraints can tie nodes together. A constraint link is a scene node: its `dependsOn` names the nodes it ties, and its `data.constraintLink` holds one path constraint whose anchors are numbered over theirs one after another. Being a node, it is saved and undone with the scene, and deleting a node it ties deletes it. Additive, except where noted below.
  
  `@weasel-js/geom` gains `constrainPathsEdit(items, links)`: an edit of several paths finished in one solve, each path's own constraints and each link renumbered through the edit, and the paths the edit left alone held unless nothing else can give way. `constrainPathEdit` is now its one-path case. A solve takes a frame per constraint (`axisAngles`), so paths drawn in different frames solve together. A dragged anchor held on a segment now starts from the nearest point on it and stays there while the rest give way, where before it slid by moving more freely than everything else, which let it drift off the pointer to satisfy unrelated constraints.
  
  In `@weasel-js/core`, a path-edit extension's `finishEdit` gets a fourth argument, a `PathEditFinishCtx` that reads other nodes, their paths and their dependents, and may answer `others`: nodes it changes along with the edited one, each with a new path, data, or `remove`. They are committed in the same history entry, and the anchor drag previews them. The `editAnchors` dep's `finishEdit` now answers `{ path, others }` where it answered the path. This changes its return type.
  
  In `@weasel-js/path-tools`, `constraintLinkNode` makes a link node and `constraintLinkOf` reads one. The constraints extension solves every node links reach from the edited one: an anchor held on another node's segment slides along it when dragged, and follows the segment when that node is edited. Link nodes draw nothing and take no clicks.
- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- The Envelope mesh tool's key is C, not M, which the Measure tool takes.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- fb75358: Lengthen: in path edit, turn on the Lengthen path-edit tool and drag an open path's end anchor outward to grow the path from that end, or inward to shorten it along itself. It grows straight along the end tangent, or along a circular arc with the curvature the end has, meeting the path smoothly. The `lengthenPath` action's `mode` param (`'tangent'` or `'curvature'`, typed for `<SceneCanvas tune>`) sets which a plain drag does, and Shift, read on every move, picks the other. A straight end segment grows in place; a curved one is continued with a new segment, one per quarter turn of arc. Each drag is one undo step, "Lengthen path" or "Shorten path". `lengthenPreset` in `@weasel-js/path-tools` registers the action and its toggle, `pathEditTool.lengthen` (`lengthenToolAction`, drawn with `path-tools:lengthen`); `pathTools` includes it.
  
  `lengthenPathEnd(set, end, distance, mode)` (`@weasel-js/geom`) is the edit underneath, with a negative `distance` shortening. `openEndAt` names the open end an anchor is, `pathEndFrame` gives an end's point, outward tangent, and signed curvature, `lengthToward` turns a pointer position into a distance, and `pathEndAnchorIndex` finds the end anchor again after an edit. `lengthenOpenEnd`, which Extend to next path uses, is now `lengthenPathEnd` in tangent mode, so both tools grow a curved end by the same rule.
  
  While a path-edit tool is on, path edit's anchors and handles no longer show their own hover cursor, so the tool's action shows its own.
- 86725ed: An ongoing action can name the modifiers it reads mid-gesture as roles: `Action.modifierRoles` declares each role's default keys, a tuning's `roles` or a binding's `opts.roles` moves one to other keys, and the dispatcher resolves them into `InvocationCtx.roles` on the press, every move, and the release. `roleReader` reads them, falling back to the default keys where nothing resolved them.
  
  Path edit's modifiers are roles now. `editAnchors` declares `selection.add` (Shift), `mirror.break` (Alt), `handle.holdAngle` (Shift), and `handle.holdLength` (Cmd or Ctrl); `marqueeAnchors` declares `selection.add`; the pen's handle drag declares `mirror.break`, `snap.constrain` (Shift) and `snap.suspend` (Ctrl); and `balanceHandles` declares the two handle locks. So `<SceneCanvas tune={{ editAnchors: { roles: { 'handle.holdLength': ['alt'] } } }}>` moves the length lock to Alt.
  
  Breaking: `locksInForce` takes the invocation context in place of its `ModifierState`, so it can read the roles.
- 679138c: A scene node can be hidden or locked on its own, not only through its layer. `SceneNode.hidden` keeps a node and its whole subtree from being drawn; `SceneNode.locked` keeps a node and its subtree drawn but out of reach, the way a locked layer's nodes are. Both are set through `scene.setHidden(id, hidden)` and `scene.setLocked(id, locked)`, each one undo step that neither lock blocks, or through the new `createSetHiddenOp` / `createSetLockedOp` against an adapter's `setHidden` / `setLocked`. Both go on `AddNodeSpec`, ride a snapshot, and come back with an undone removal. Additive.
  
  `scene.isHidden(id)` is new, and `scene.isLocked(id)` now folds in the node flags. Both answer from `nodeGates`, now exported with `isNodeHidden`, `isNodeLocked` and `hidesSubtree`, which every reader asks: painting, point picking, the marquee and lasso, select-all, path snapping, measurement picking and snapping, sibling spacing guides, the slice and Girth tools, and text editing all pass over a hidden node, and the pickers over a locked one. The selection now drops a hidden node as it drops a locked one, so hiding a layer or a node deselects what it hides.
  
  `@weasel-js/svg`: `svgNodesFromKit` writes a node carrying `hidden` with `display="none"`, which `parseSvg(…, { keepHidden: true })` reads back as hidden, and `unpackSvgFiles` now keeps a dropped file's hidden content, inserting it hidden rather than leaving it out.
- a4c99c1: An `onPath` path constraint holds an anchor on a segment of its own path, `{ kind: 'onPath', anchor, segment: [a, b] }`, anywhere along it. Additive.
  
  Each one gives the solve a parameter of its own, the place along the segment, started at the point nearest the anchor and kept between the segment's ends. A dragged anchor held on a segment slides along it rather than pulling the segment after it, and stops at its ends. An edit that splits or breaks the segment drops the constraint, as one that deletes a named anchor does. `segmentBetween(path, a, b)` answers the segment joining two anchors, in the order the path runs it.
  
  In `@weasel-js/path-tools`, `constrainAnchors` with kind `onPath` reads three selected anchors: the first held on the segment the other two end. The overlay marks it with a dot on a line.
- 0677769: Path edit gains soft selection and handle snapping, each a preset in `@weasel-js/path-tools` that nothing turns on by default, `pathTools` included.
  
  - **Soft selection** (`createSoftSelectionPreset(() => ({ radiusPx, falloff, onRadius }))`, its options read as each anchor drag starts; null leaves the drag hard). Dragging anchors also moves the anchors near them, each by a weight falling from 1 to 0 over the radius, which is measured along the path in screen pixels. The falloff is `'smooth'`, `'linear'` or `'sharp'`. The reach is drawn as a band while the drag lasts, and the wheel scrubs the radius mid-drag, reporting each new value to `onRadius`. Under a `pathSymmetry` dep a soft drag moves no symmetric images.
  - **Handle snapping** (`handleSnapPreset`, or `createHandleSnapPreset({ stepDeg, reachDeg, opposite })`, or a thunk of them read on every move). A dragged control handle's angle snaps to multiples of the step (45° by default) and to the line through the anchor's other handle, within the reach (6° by default), keeping its length. The line it snapped to is drawn. A held angle lock wins over the snap; a held length lock keeps the length while the angle snaps.
  
  Both reach the drag through a new member of core's `PathEditExtension`: `drag(start)`, asked as an anchor or handle drag starts, returns the extension's share of it (`PathEditDrag`) — anchors that follow an anchor drag and the share of its delta each moves by (`weights`), where a dragged handle goes after the locks (`handle`), a claim on the wheel mid-drag (`wheel`), and overlays drawn while the drag lasts (`overlays`). `PathEditDragStart` and `PathEditHandleMove` describe what it reads.
  
  `@weasel-js/geom` adds the geometry: `measureAnchorPath`, `softSelectionWeights`, `softSelectionBand` and `softFalloff` for soft selection.
- 66e3696: A derived node inside a container that composes frames paints where its dependencies are painted. Its path is drawn from their world poses, and the walk used to turn it again by the container's rotation; it now turns by the node's own rotation only. A derivation is handed each dependency's pose in the frame of the node deriving, so a path effect, or any `derivePose`, over shapes in another container boxes itself where it paints. `derivedDepOf(source, id, reader)` reads a dependency the way `reader`'s derivation does, and Expand to Paths uses it, so an effect across containers expands where it is drawn.
- 48399c0: `path-tools:bendAlong`'s side stripes stop on the band's edges instead of capping past its inner edge, each running along the band's normal. `path-tools:extremeAnchors`'s tangent reaches nearly across the glyph, 13 units where it was 7.
- 5973184: Every path operation carries `tags` naming the gesture that drives it, so the operations sharing a gesture can be gathered with `actionsTagged` / `taggedActionItems`. Each carries `path` and one of `path-drag`, `path-click`, `path-brush`, `path-box`, or `path-command`, defined once as `PATH_GESTURE_TAGS` and applied with `pathOperationTags(family)` (both new in core). `docs/path-operations.md` lists the operations under each tag. Actions built with `makeHandleCommand` and `joinPathsCommand` now carry `path-command` too. Additive.
- 3378ade: Two path-tools presets for a path's structure, both in `pathTools`:
  
  - `pathStructurePreset` brings `setPathStart` (group `anchors`), which makes the one selected anchor its subpath's start — a closed subpath turns to start there, and an open one reverses when given its last anchor — and `reversePath` (group `path`), which runs paths the other way without changing their shape. In path edit it reverses the subpaths holding the selected anchors, or every subpath, and the anchor selection follows its anchors; outside path edit it reverses every selected path in one undo step. It also draws an arrow at the middle of every segment of the open path, pointing the way it runs, and a ring round each subpath's start anchor, under the chrome id `path-edit.direction` (`PATH_DIRECTION_CHROME_ID`), off until chrome-caps shows it. `createPathStructurePreset(style)` takes their `color`, `arrowPx`, and `ringPx`.
  - `segmentTypePreset` brings `convertSegments` (group `anchors`, Shift+C), which turns the selected segments — those whose two ends are selected anchors — between straight and curved: a line becomes a curve with handles at its thirds, drawing the same line, and a curve drops the two handles that shape it. `params.to` picks `'line'` or `'curve'`; with none it flips the lot. `convertSegmentAt` flips the segment under a Shift+double-click.
  
  Core's `paths` preset gains `setAnchorField`, which writes a typed number into the selected anchors: `{ field, to }` sets every one, `{ field, by }` offsets each. `useAnchorFields()` reads the fields for chrome beside the canvas — the selected anchors' X and Y, `null` where they differ, and a lone anchor's handle X, Y, angle and length — and writes through that action. `segmentUnder` is exported for actions that act on the segment under the pointer in path edit.
  
  An anchor edit now carries a node's vertex colors, `data.vertexColors` and `data.stroke.vertexColors`, and its stroke widths, `data.stroke.vertexWidths`, along with its `data.skin`: an anchor the edit keeps keeps its color and width, one it makes blends its neighbors' (each side of a two-sided width on its own), a deleted one's entry goes, and reordering anchors reorders them. Where an edit reverses a subpath, a two-sided width trades its `left` and `right`, so each edge stays on the side it was drawn on.
- c0d59c6: The path tools gain icons. Smudge brush, Distort, Envelope and Puppet Warp show theirs on the tool and its action; Blend, Bend Along Path, Repeat Along Path, Balance handles and Equalize handles get one each; Expand to Paths and Expand Warp share `path-tools:expand`. All are in the `path-tools` icon namespace. Warp Settings and Edit Path Effect take `core:tune`, and Delete constraint takes `core:delete`.
- f426089: New package, `@weasel-js/path-tools`: the path-editing tricks moved out of core, each family a `FeaturePreset` an app turns on beside core's (`features={['draw', pathTools]}`, or one preset at a time). It holds the Simplify brush, the handle-lock toggles, Bridge and Bridge anchors, Trim segment, Extend to next path, Smudge brush, Harmonize curvature, the curvature comb, Balance handles and Equalize, path constraints, Blend / Bend along / Repeat along, and the warp actions and tools (distort, envelope, puppet, expand, configure). Their action and tool names are unchanged; they are imported from `@weasel-js/path-tools` now, and core's `paths` preset no longer registers them.
  
  Core keeps basic path editing and gains the extension point these are built on: `PathEditExtension`, carried by a preset's `pathEdit`, draws marks on the open path, adds grabbable parts (an `AffordanceRegion` may name a `chromeId` of its own), selects and deletes its marks, and finishes every edit (`finishEdit`). A preset's `chromeRules` sets default visibility for chrome of its own. Breaking for code reading the `editAnchors` dep: `constrainEdit` is `finishEdit`, `selectedConstraint` / `setSelectedConstraint` are `selectedMark` / `setSelectedMark`, and `setConstraints` is gone (`setConstraints(dep, …)` in the package); the dep adds `store` and `extensions`. The overlay slot's `comb` and `balance` options, `PATH_COMB_CHROME_ID`, `PATH_BALANCE_CHROME_ID`, and the constraint colors in `PathEditingOverlayStyle` move to the package's presets. Core now exports what a path command or path-edit feature built outside it needs — `selectedPathNodes`, `withPath`, `reshapeOps`, `commitOps`, `joinPathsCommand`, `makeHandleCommand`, `commitAnchorEdit`, `GEOMETRY_BOUND_DATA`, and the rest — plus `flipAction` and the anchor actions (`selectAnchorAction`, `deleteAnchorsAction`, `nudgeAnchors*Action`), and `makeEditAnchorsDepForTests` and `useEditAnchorsDepSourceForTests` in `@weasel-js/core/test-seams`. The path-effect scene nodes and their derivations stay in core, so a saved document renders without the package.
- ddbb431: `ToolPalette` takes `include`, a filter over the registered tools, and `ariaLabel`, the toolbar's accessible name (default `"Tools"`). Two palettes over one `tools` with complementary filters split a canvas's tools between two toolbars; WeaselDraw shows path-tools' tools in a strip of their own this way.
  
  Envelope mesh's tool key is now Shift+F, beside Distort's F. It was C, which WeaselDraw's crop mode already holds, so the key never reached it there.
- 5f12888: A puppet warp bends through the shape rather than across the plane. The shape's fill is triangulated with its outline as triangle edges (`puppetMesh`) and deformed as-rigid-as-possible (`createArapSolver`), so two limbs that nearly touch no longer move together when a pin on one is dragged. Both linear systems are factored once per pin set; a drag frame only re-solves them.
  
  Breaking: the warp API moved out of the root `@weasel-js/geom` entry into a new `@weasel-js/geom/warp` entry, because a puppet needs the optional `earcut` peer to triangulate. `pathWarpMap` now takes the source path as its second argument, and `rigidPuppetMap` is gone; `puppetMap(source, pins)` replaces it.
- cc11671: More tools and actions gain icons. In core, the Bone and Weight tools (`core:bone`, `core:weight`) and Bend segment (`core:bendSegment`). In `@weasel-js/path-tools`, Trim segment and Extend to next path get their own (`path-tools:trim`, `path-tools:extend`) in place of the Slice knife, on both tool and action; Reverse path, Set path start, Set corners and the corner radius drag, Next corner shape, Convert segments with a straight and a curved variant, and Add extreme anchors get one each; and `path-tools:girth` is drawn for the Girth tool.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- f3398d4: The `@experimental` designation is retired. Everything that carried it is now ordinary public API: the actions registry and its built-in action descriptors and icons, the ambient pointer and selection contexts, `CanvasView`, the canvas extension API, the view resolver and viewport layer, the affordance helpers, path-tools' commands and icons, and `registerEffect`. No signatures changed.
- 86a5ec7: The shape builder lives in `@weasel-js/path-tools`, in a directory of its own, rather than in core: import `useShapeBuilderTool`, `planShapeBuilder`, `facesAlong` and their types from there, and mount the tool with `<SceneCanvas tools>`. It carries its own actions, so it needs no preset. Its behavior is unchanged, and core has no code of its own for it.
  
  Core opens its Boolean pipeline to an operation of the caller's own, which is what the shape builder now runs on: `resolveBooleanOperands(adapter, opts)` answers the selection's operands back to front, resolved as the built-in operations resolve them (text outlines, a counted stroke's region and the paint it leaves), and `commitBooleanPieces(adapter, operands, pieces, label)` replaces them with the caller's pieces as one undo step, each minted from the source it names and stacked in that source's slot. `PATHFINDER_STROKES`, what a stroked operand gives the Pathfinder actions, is exported, and `@weasel-js/core/test-seams` adds `rootsTreeForTests`, the flat tree of a fake adapter.
- c2048de: `@weasel-js/path-tools` adds `useShapeBuilderTool` (Shift+M), which builds shapes from the faces two or more selected paths cut each other into. The face under the pointer is shown; a drag unites every face it passes through into one path standing in for the first face's source, so it wears that source's paint, and an Alt-drag deletes them instead, Alt being read live through the drag. A click takes a single face. Every face not taken becomes a path of its own, and each gesture is one undo step. With fewer than two paths selected, a drag marquee-selects. `mode: 'delete'` swaps the two, so a plain gesture deletes and Alt unites. It reads the `booleansAdapter` dep the Pathfinder actions use, and counts an unfilled stroke as the region it covers, as they do.
  
  Core's `<SceneCanvas>` now publishes a `booleansAdapter` of its own over its path leaves (`data.path` drawn through the pose's box), so the Pathfinder actions and the shape builder work on a canvas whose consumer publishes none. A result is minted from the source it stands in for, keeping its layer, parent, frame, and data. A consumer's `useBooleansAdapter` under the canvas still replaces it — for text operands, which this one does not read. `useBooleansAdapterSource` is the hook behind it.
  
  `planShapeBuilder(adapter, opts)` is the engine under it: the faces, `faceAt(x, y)`, and a `commit(picked, 'merge' | 'delete')` that writes the batch. `facesAlong(plan, run, step)` answers the faces a run of points passes through, in the order it enters them.
  
  Core's `createPathOverlay({ id })` holds paths that are not nodes and gives a world-space `RenderLayer` drawing them over the scene, for a tool's `overlay` or a canvas's `layers`. Each path names a role, styled by `PATH_OVERLAY_ROLES` (`'chrome'`, `'picked'`, `'remove'`) or the caller's own.
  
  `@weasel-js/geom` adds `pathFacePieces(...paths)`: `pathDividePieces` with a region that falls apart split into one piece per connected part.
- db8c16e: One snap pipeline for every gesture. Move, resize, rotate, insert (drag and click-place), pen and spiro placement, pen handles, anchor and handle drags in path edit, measure, and the symmetry center all begin a session on the `snap` dep at press and ask it each frame where their point lands. Every kind of target is a snap source, and one resolver ranks all of their candidates together: a point beats a line, a real target beats a fallback such as the grid, then the smaller move on screen wins, then source order. One readout layer draws what the result met. `docs/snapping.md` is the reference.
  
  **Breaking: removed APIs, with their replacements.**
  
  - `SnapDep.point` is gone: the `snap` dep is `begin(req)`, which returns a `SnapSession` (`at`, `angle`, `end`).
  - `<SceneCanvas toolOptions={{ snapPoint }}>` is gone: register a source in `<SceneCanvas snap={{ sources }}>`, `gridSnapSource` for a grid.
  - `selectTool.snap`, `SnapStrategy`, and core's `snap()` behavior adapter are gone: a grid is `gridSnapSource({ spacing, origin?, unitSystem? })`, ruler guides `guideSnapSource(getGuides)`. A pose that is neither a rect nor a `Path` passes its `OriginProjection` as `snap={{ originProjection }}`. Moving from `selectTool.snap: gridSnapStrategy(…)` to `gridSnapSource` also snaps resize corners, inserts and pen clicks to the grid, not only a move's origin.
  - `@weasel-js/guides`: `gridSnapStrategy`, `guideSnapStrategy`, `GuideSnapOptions`, `DEFAULT_GUIDE_TOLERANCE_PX`, and `pointSnapToGrid` are gone, and so are the `@weasel-js/guides/move`, `/resize` and `/insert` subpaths with their `snapToGrid`, `snapToGuides`, `SnapToGuidesMoveArgs`, `SnapToGuidesResizeArgs` and `SnapToGuidesInsertArgs`: use `gridSnapSource` and `guideSnapSource`. An import of `snapToGrid` from `@weasel-js/core/move` (a subpath that no longer had it) becomes `gridSnapSource` from `@weasel-js/guides`.
  - `@weasel-js/guides`: `alignMoveBehavior`, `alignInsertBehavior`, `alignResizeBehavior`, `AlignMoveArgs`, `AlignmentBehaviorBase`, `matchAlignment`, `MOVE_ANCHORS`, `AlignAnchor` and `AlignMatchResult` are gone: `alignmentSnapSource(opts)` snaps to siblings' edges and centers and `spacingSnapSource(opts)` to equal gaps, on move, resize and insert alike. `matchSpacing` and `measureGaps` stay.
  - `PointSnapBehavior`, `PointSnapContext`, `PointSnapResult`, `PointSnapFrame`, `ResizePolicy.pointSnap`, `useResizePolicy`'s `pointSnap`, and the resize option `pointSnapBehaviors` are gone: a resize snaps its dragged corner or edges through the session, so any source snaps it.
  - `lockAspectWithModifier` (with its `{ key }` option) and `DEFAULT_RESIZE_BEHAVIORS` are gone from `@weasel-js/core/resize`: Shift's aspect lock is the resize's `snap.constrain` role.
  - `snapRotationWithModifier`, `DEFAULT_ROTATION_SNAP_STEP` and `DEFAULT_ROTATE_BEHAVIORS` are gone: rotation snaps through `rotationSnapSource`, which every canvas asks, and the `snap.constrain` role (Shift) adds the 15° steps. `rotate: { behaviors: [] }` no longer turns rotation snapping off; `<SceneCanvas snap={{ omit: ['rotation'] }}>` does, and a source with the id `'rotation'` replaces the default.
  - `constrainTo45` is gone from `@weasel-js/core`: the pen's handle Shift is the session's angle step.
  - `usePenTool`'s `snapPoint` and `anchorSnapRadius` options are gone, and `useDragRect`'s and `useDragRadial`'s `snapPoint`: the pen and the drag gestures snap through the `snap` dep (`pathSnapSource` for anchors, `gridSnapSource` for a grid). A pen anchor joins an open end within `targets.penCloseHitPx` of the press before any snap.
  - kernel3d's `createSnap()` took nothing and snapped nothing; `createSnap(world, { sources?, reachPx?, store? })` takes the world and snaps.
  
  **New.**
  
  - `<SceneCanvas snap={{ sources, omit, reachPx, originProjection, readout, readoutStyle }}>` (`SceneCanvasSnap`), a feature preset's `snapSources`, and `useSnapSource(source)`.
  - One reach for every source that sets none, the kit setting `targets.snapPx` (8 screen px; `DEFAULT_SNAP_PX`).
  - The snap source contract: `SnapSource`, `SnapCollect`, `SourceCandidate`, `Locus`, `SnapProbeAt`, `SnapGesture` (with `'handle'`), `SnapEdge`, `SnapEdges`, `AngleCollect`, `AngleCandidate`, `SnapMark` and `SnapMarks`; the session types `SnapBegin` (with `reachRad` and `theta0`), `SnapConstrain`, `SnapMods`, `SnapOutcome`, `SnapResizeBox`, `SnapSession`.
  - Sources: `pathSnapSource` with `PathSnapSourceOptions` (and `only`), `measureEndSource` with `MeasureEndSourceOptions` (`reachPx`), and `rotationSnapSource` in core; `gridSnapSource`, `guideSnapSource`, `alignmentSnapSource` and `spacingSnapSource` in guides; `handleSnapSource` and `HandleSnapOptionsInput` in path-tools (`createHandleSnapPreset` and `createHandleSnapExtension` take options or a thunk of them, and the preset registers the source); `boxSnapSource`, `alignPlaneSource`, `groundGridSource` and `GroundGridSourceOptions` in kernel3d.
  - The modifier roles `snap.suspend` (Ctrl) and `snap.constrain` (Shift), declared by every snapping action: `SNAP_ROLES`, `snapMods`, `SNAP_ANGLE_STEP` (the one 15° step for a line insert, a measurement, a rotate and the symmetry axis), `SNAP_AXIS_STEP`, and `stepAngles`.
  - The readout: `createSnapReadoutLayer`, `SnapReadoutStyle`, `createSnapOutcomeStore`, the `snapReadout` dep (`SnapReadoutDep`), and the drawing helpers `tickedSegment`, `pillCommands` and `measuredSegmentCommands`. The debug overlay's `snap` feature draws every candidate the resolver weighed.
  - Building blocks for a host's own session: `resolveSnap` and its types in `@weasel-js/geom/nd`, with `stepLine` and the flat math under it (`Flat`, `Vec`, `flatDim`, `closestOnFlat`, `closestBetweenFlats`, `intersectFlats`); `gatherSnapCandidates`, `resolvedSnapMarks`, `snapSourcesFor`, `GatherSnapOptions`, `SnapCandidateMark` and `SnapGeometry` in core; `pointSnap`/`PointSnap` for a tool placing points.
  - `@weasel-js/geom/3d` gains `vec3`, `distance`, `lerp`, `pointOnRay`, `aabbOfPoints`, `closestPointOnLine`, `closestPointOnSegment` and `closestPointsRayLine`.
  - `@weasel-js/core/test-seams` gains `createSnapSession2dForTests` (with `SnapSession2dOptions`), a 2D session for tests outside core; it is not public API.
  - kernel3d: `projectSnapMarks` with `ScreenLine` and `ScreenPoint`, `projectPoint`, and `Snap3dOptions`.
  - `InsertDep.commit` and `InsertDep.build` take an optional `ends: InsertEnds` (the drag's start, end and `fromCenter`); click-place passes them too. kernel3d's `createInsert` builds its footprint from the two ends cast onto the ground, so a 3D click-place centers its footprint on the snapped ground point.
  - path edit: `PathEditDragStart.snap`, `PathEditDrag.end`, `SnapMods.hold`.
  
  **Behavior changes.**
  
  - Every `<SceneCanvas>` snaps point gestures to other nodes' anchors — rect and text corners, ellipse quadrants, path anchors — through a default source with `pathSnapSource`'s id, `'path-snap'`: pen placement and handle tips, spiro points, anchor drags, line and box insert, click-place, measure ends and the measurement end drag, and the symmetry center; not move, resize or rotate. `snap={{ omit: ['path-snap'] }}` drops it, and a consumer's own `pathSnapSource()` replaces it rather than doubling. A point target on the gesture's own `origin` is never offered, so a handle tip does not stick to its anchor.
  - A grid gives way to a target in reach on its axis, where alignment used to add its delta on top of the grid's. Guides and alignment reach 8px, not 6.
  - Ties between equally good results break by source order, then by the order a source yields its targets.
  - Ctrl suspends snapping on every snapping gesture, a pen drag and an anchor drag included; a handle drag keeps Ctrl as its length lock.
  - A rotate snaps to quarter turns and to other nodes' angles without Shift (new); near the pivot its reach is capped at 30°.
  - Shift on a move locks it to the horizontal, vertical or 45° line through the press (new), and so does Shift on an anchor drag (new).
  - Shift on a line insert, a measurement or a pen handle puts the end at the pointer's nearest point on the stepped line through the start (it used to keep the drag's length), and that line meets snap targets.
  - An anchor drag meets every point-gesture source, a grid included.
  - A multi-root move snaps each root's origin, the nearest winning, not only the first node's.
  - A move's behaviors run on the snapped delta, and a behavior's translate stands, so a container's slot preview wins over a snap target in reach.
  - A measurement end drag keeps its offset from the press (it used to jump the end to the pointer), and no longer snaps to its own measurement's ends.
  - kernel3d's `translate` puts its plane at `up · position`, the same as before for +y up.
- Spiro curves: a curve drawn by its on-curve points alone. `@weasel-js/geom` solves one with `solveSpiro(points, closed)`: an Euler-spiral segment, whose curvature changes evenly along it, runs between each pair of points, and the segments are solved together so tangent and curvature carry straight through every `smooth` point. A `corner` lets its two sides turn independently, `left` continues the straight segment arriving at it, and `right` runs the curve into the straight segment leaving it. `spiroToPath(contours)` writes the solved curve as cubics, splitting a segment wherever one cubic would stray more than a ten-thousandth of its length, and reports which anchor each point became; `spiroContoursOf`, `spiroControlPath` and `spiroContoursFromControl` read the points back out of such a path and in from an edited control path. The `spiro` curve representation in `@weasel-js/geom/curves` now uses the solver.
  
  Breaking: `SharedAnchor.spiroType` takes a `SpiroKind` (`'smooth' | 'corner' | 'left' | 'right'`) where it took `'g2-smooth' | 'g4-smooth' | 'corner'`. G4 points were never solved as such.
  
  `@weasel-js/core` lets a path be drawn from another form it keeps beside it. A node's `data.representation` holds the form, named by its `kind`, and a `PathEditExtension`'s new `representation` (a `PathRepresentation`) says how path edit reads and writes forms of that kind: `editPath` gives what path edit shows and moves in place of the drawn path, `store` turns an edit of it back into the drawn path and the form, the live drag preview included, `anchorMarkers` shapes each anchor's marker (`AnchorMarkerShape`), and `segmentPress` takes a press on the outline in place of Bend segment. A form no representation on the canvas reads is edited as its drawn path and dropped, and `representation` joins `GEOMETRY_BOUND_DATA`, so a path command that replaces the geometry, such as Join or Simplify, leaves plain geometry. `pathEditPathOf` and `storeEditablePath` take the extensions to consult; the `editAnchors` dep's new optional `getOutlinePath` gives the drawn path the segment affordance hit-tests. The insert dep's `'path'` extras take a `data` laid under the path, and `createPointerFollower` is exported for tools that trail the pointer.
  
  `@weasel-js/path-tools` draws and edits spiro curves, all from `src/spiro`. `spiroPreset`, in `pathTools`, brings the spiro representation: a spiro node, `data.path` plus a `{ kind: 'spiro', kinds, at }` form (`spiroNodeData`, `spiroOf`, `withoutSpiro`), is edited through the straight-sided control path through its points, and every edit solves the curve again. Each point draws by its kind: a circle for smooth, a square for a corner, a half-disc facing away from the line for `left` and `right`. Dragging the curve between two points adds a smooth point there and drags it. The preset also brings `setSpiroKind`, which sets the kind of the points selected in path edit, and `releaseSpiro` ("Convert to path"), which turns a spiro curve into an ordinary path. The spiro tool, `useSpiroTool` (Shift+P), mounted through `<SceneCanvas tools>`, places points by clicking, each of the kind its `spiro.placePoint` action's `params.kind` names, Alt-click for a corner, and inserts the curve through the `insert` dep as a `'path'` carrying its form. Its glyph is `path-tools:spiro`.
- 365ab72: Spiro curves have a `g4` point kind: tangent, curvature, and the curvature's first two derivatives all carry through it, so a run of `g4` points bends more evenly than `smooth` ones. A segment with a `g4` point at either end is a cubic-curvature segment rather than an Euler spiral: `fitEulerSegment` takes the two higher terms (`k2`, `k3`) as optional arguments, `EulerFit` carries them (zero on an Euler spiral), and `eulerCurvatureDerivativesAt` answers the curvature's first two derivatives. Where such a segment meets a point that is not `g4`, its curvature's second derivative is zero there. `setSpiroKind` gains the kind as a variant, and path edit marks a `g4` point with a diamond.
- 4cec295: A `tangent` path constraint keeps an anchor's two handles on one line through it, pointing apart — G1 continuity — with their lengths free. Additive.
  
  The solver now works over handles as well as anchors: each handle is an offset from its anchor, so it rides with the anchor as before, and becomes a variable only where a `tangent` reads it. `ConstraintPoint` carries `inHandle` and `outHandle`, `pathAnchorPoints` reports them, `solvePathConstraints` writes the turned handles back, and `solveConstraints` takes `heldHandles` beside `held`. `constrainPathEdit` holds the handles an edit moved, so a handle drag finished through it turns the other handle and leaves the dragged one where the pointer put it. A tangent on an anchor missing a handle cannot hold and is reported as unsatisfied; one the solve could satisfy only by shrinking a handle to nothing is a conflict. `constraintApplies` says whether a constraint can be solved over a set of points.
  
  In `@weasel-js/path-tools`, `constrainAnchors` with kind `tangent` constrains each selected anchor that has both handles, and the overlay marks a tangent anchor with a line touching a circle.
- d705830: A stroke can be drawn with a broad nib. `Stroke.nib` is `{ angle, ratio }`: the nib's edge in radians counterclockwise on screen, and its thinnest width as a fraction of its widest. The stroke is its full width moving across the nib and `ratio` of that moving along it, an elliptical pen's width in between, and it multiplies `vertexWidths` where both are set. Each side of a corner keeps its own width, so a square drawn with a level nib has thin level sides and full upright ones right up to the joins; a round join's arc runs between the two. `strokeToPath`, the renderer's ribbon cache, and SVG export follow it, and since a nib only ever narrows a stroke, bounds and culling are unchanged. `@weasel-js/stroke` adds `nibWidthScale`, the nib as a `WidthScale`, and `widestStrokeWidth`, which culling, picking, and flattening now share; picking used to ignore `vertexWidths`. Draw's stroke properties gain a Nib switch with its angle and thinnest ratio.
  
  A `vertexWidths` entry is a `VertexWidth`: a number, the full width centered on the path as before, or a `{ left, right }` pair giving each edge its own distance from the path, `right` being the side the normal `(−dy, dx)` points to, below a path running in +x on screen. Every reader resolves an entry through `vertexHalfWidths(entry, fallback)` in `@weasel-js/paint`: the tessellator, which carries the difference between the sides as the new `Polyline.offsets` through trimming, dashing, and the nib, and centers caps between the two edges; `strokeToPath`; the inner and outer ribbon; bounds, culling, and picking, through `widestHalfWidth`; and SVG, which writes a pair as `left/right` in `wzl:vertex-widths`. `vertexWidthFromSides` writes equal sides back as a number, and `scaleVertexWidth` scales either form. An entry of zero is now a zero width; it used to take the stroke's `width`.
  
  `useGirthTool` (Shift+W), in `@weasel-js/path-tools`, edits `vertexWidths` by dragging the stroke's edges. Hovering near either edge marks the grab point on it and the width point a press there moves: the anchor at that spot, or one inserted between two with `insertAnchorOnSegment`, so the path keeps its shape. The grabbed edge follows the pointer along the path's normal and the other mirrors it, writing a number; dragging inward pinches the stroke, down to zero. Alt-drag moves the grabbed edge alone and writes a pair. The drag moves the edge as drawn, so under a nib the stored width changes by more. Every drag is previewed live and committed as one undo entry. Alt-click on a width point clears it, so it takes the stroke's `width` again. The stroke last touched shows its anchors, with a line across the stroke at each that has a width. `strokeEdgeNear` in `@weasel-js/stroke` is the hit test behind it: the edge of a stroke nearest a point, measured along the path's normal, with each side's distance as drawn.
  
  A dashed stroke now keeps its per-vertex widths, which it used to drop. The anchor-parameter rule that trimming and dashing share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.
  
  SVG has no variable width. `serializeSvg` writes a stroke with `vertexWidths` or a `nib` as its outline: the path keeps its stroke attributes at `stroke-width="0"`, which draws nothing, with the real width, the per-vertex widths, the nib, and its markers in the `wzl` namespace, and the outline follows as a filled path in the stroke's paint that draws the marker heads. A node with an opacity wraps both in one group carrying it, so they composite as one layer. Other viewers draw the outline; `parseSvg` drops it and reads the stroke back off the path, and a transform it bakes in scales the per-vertex widths with the width.
- 329aa39: A polygon-pose node rotated after a warp keeps its warp. `resolvePathWarp` used to recover only a move or a resize of the stored coordinates; it now recovers any affine rewrite of them, with the new `fitAffine` in `@weasel-js/geom` (the least-squares affine map between two point sets, falling back to a similarity for points on one line).
- d944b4b: Paths warped together no longer drift apart once one is moved alone. Each keeps its own copy of the shared warp, carried with it; the warp tools now treat paths as sharing a warp only while their copies put the same controls in the same places. A path moved or edited on its own comes back under an id of its own, shows its own controls, and is no longer driven by the others' — and its next edit writes that id to it.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
- Updated dependencies [65be8d3]
- Updated dependencies [10b67bb]
- Updated dependencies [6f839dd]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [275714b]
- Updated dependencies [4da5998]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [0a30bde]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies [a988460]
- Updated dependencies
- Updated dependencies [8374354]
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [0382007]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [628c62d]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [98870f1]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [3246831]
- Updated dependencies [5eda461]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [e901a2b]
- Updated dependencies [da45b33]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [c6d61e0]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a2dcbfb]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
- Updated dependencies [8775065]
- Updated dependencies [d4d28ad]
- Updated dependencies [ad8f48a]
- Updated dependencies [5274f79]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [66e3696]
- Updated dependencies [5973184]
- Updated dependencies [7afe8cd]
- Updated dependencies [3378ade]
- Updated dependencies [71c079d]
- Updated dependencies [c0d59c6]
- Updated dependencies [f426089]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
- Updated dependencies [e021579]
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [925dde2]
- Updated dependencies [a322444]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [e562d4b]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [e287da2]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [3318cf7]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [e40a56f]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/registry@1.11.0
  - @weasel-js/routing@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/renderer@1.11.0
  - @weasel-js/stroke@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/cursor@1.11.0
