# @weasel-js/diagram

## 2.0.0

### Major Changes

- 72b6d07: `grabPortAction` and `grabPortBindings` are `createClaimPressAction` and `claimPressBindings`, since they claim a press on any affordance.
  
  Their arguments are unchanged; `GRAB_PORT_ACTION_ID` is still the default id.
  
  ```ts
  // before
  actions: [grabPortAction(GRAB_LABEL_ACTION_ID)], bindings: grabPortBindings(GRAB_LABEL_ACTION_ID, kind)
  // after
  actions: [createClaimPressAction(GRAB_LABEL_ACTION_ID)], bindings: claimPressBindings(GRAB_LABEL_ACTION_ID, kind)
  ```
  
  <!-- entry: breaking api -->
- ab7f613: The contribution factories that were spelled bare are `create…Contribution`, as the kit's other factories are; their arguments are unchanged.
  
  diagram: `diagramPorts`, `diagramWaypoints`, `diagramEdgeEnds`, `diagramOffPage`, `diagramContainers` and `diagramSequence` are `createDiagramPortsContribution`, `createDiagramWaypointsContribution`, `createDiagramEdgeEndsContribution`, `createDiagramOffPageContribution`, `createDiagramContainersContribution` and `createDiagramSequenceContribution`; `reorderContribution` and `itemDropContribution` are `createReorderContribution` and `createItemDropContribution`. routing's `keymapContribution` (re-exported by core) is `createKeymapContribution`, and measure's `measurementsContribution` is `createMeasurementsContribution`.
  
  ```ts
  // before
  const ambient = [diagramPorts(), measurementsContribution(scene, measurements)];
  // after
  const ambient = [createDiagramPortsContribution(), createMeasurementsContribution(scene, measurements)];
  ```
  
  <!-- entry: breaking api -->
- 01be5ca: Three action-id constants are spelled in the same order as their ids, verb first.
  
  `ROUTE_EDIT_ACTION_ID` (`'diagram.editRoute'`), `LANE_RESIZE_ACTION_ID` (`'diagram.resizeLane'`) and `ITEM_DROP_ACTION_ID` (`'diagram.dropItem'`) are renamed `EDIT_ROUTE_ACTION_ID`, `RESIZE_LANE_ACTION_ID` and `DROP_ITEM_ACTION_ID`. The ids are unchanged.
  
  ```ts
  // before
  bindings: [{ spec: { kind: 'drag' }, actionId: ROUTE_EDIT_ACTION_ID }],
  // after
  bindings: [{ spec: { kind: 'drag' }, actionId: EDIT_ROUTE_ACTION_ID }],
  ```
  
  <!-- entry: breaking api -->
- 503ed8e: `DiagramGroup`, `DataGroup` and `GraphGroup` are `DiagramCluster`, `DataCluster` and `GraphCluster`.
  
  The box holds a `members` list, which in weasel is a cluster, never a group.
  
  The rest of the family follows: `GroupInset` → `ClusterInset`, `DEFAULT_GROUP_INSET` → `DEFAULT_CLUSTER_INSET`, `expandGroupEdges` → `expandClusterEdges`, `diagramGroupOf` → `diagramClusterOf`, `DIAGRAM_GROUP` → `DIAGRAM_CLUSTER`, `GROUP_DERIVE_POSE` → `CLUSTER_DERIVE_POSE`, `groupDerivePose` → `clusterDerivePose`, `GroupPoseOptions` → `ClusterPoseOptions`, `groupLabelIdOf` → `clusterLabelIdOf` and `DEFAULT_GROUP_STYLE` → `DEFAULT_CLUSTER_STYLE`.
  
  ```ts
  // before
  const box: DataGroup = { id: 'g', members: ['a', 'b'] };
  const trait = diagramGroupOf(node);
  // after
  const box: DataCluster = { id: 'g', members: ['a', 'b'] };
  const trait = diagramClusterOf(node);
  ```
  
  <!-- entry: breaking api -->
- 761c418: `diagramScene`'s `groupPadding` and `groupStyle` options are `clusterPadding` and `clusterStyle`.
  
  ```ts
  // before
  diagramScene(data, { groupPadding: 16, groupStyle: (g) => style });
  // after
  diagramScene(data, { clusterPadding: 16, clusterStyle: (c) => style });
  ```
  
  <!-- entry: breaking api -->
- 47991e7: diagram's reorder for a cluster's members is `createClusterReorderContribution` and `clusterReorderSlots`.
  
  They were `groupReorderContribution` and `groupReorderSlots`, and take the same arguments.
  
  ```ts
  // before
  import { groupReorderContribution } from '@weasel-js/diagram';
  ambient={[groupReorderContribution(report)]}
  // after
  import { createClusterReorderContribution } from '@weasel-js/diagram';
  ambient={[createClusterReorderContribution(report)]}
  ```
  
  <!-- entry: breaking api -->
- 1fc30a9: diagram's remaining action factories are named `create…Action`, like the rest.
  
  `editEdgeLabelAction`, `editContainerTitleAction` and `routerActions` are renamed `createEditEdgeLabelAction`, `createEditContainerTitleAction` and `createRouterActions`; their arguments are unchanged.
  
  ```ts
  // before
  actions: [editEdgeLabelAction({ fill: theme.label.fill })],
  // after
  actions: [createEditEdgeLabelAction({ fill: theme.label.fill })],
  ```
  
  <!-- entry: breaking api -->
- 5cf57a3: `forceRelaxation` is `createForceRelaxation`, spelled like the other factories: it builds a simulation you tick yourself.
  
  This is a breaking rename, with no alias, in both `@weasel-js/diagram` and `@weasel-js/diagram/layout`. Its arguments are unchanged.
  
  ```ts
  // before
  const relax = forceRelaxation(graph, { charge: -400 });
  // after
  const relax = createForceRelaxation(graph, { charge: -400 });
  ```
  
  <!-- entry: breaking api -->
- 166e04a: diagram's layer factories are named `create…Layer`, like core's.
  
  `portLayer`, `waypointLayer`, `edgeEndLayer`, `labelDragLayer` and `laneLayer` are renamed `createPortLayer`, `createWaypointLayer`, `createEdgeEndLayer`, `createLabelDragLayer` and `createLaneLayer`; their arguments are unchanged.
  
  ```ts
  // before
  api.registerLayer(portLayer(participants));
  // after
  api.registerLayer(createPortLayer(participants));
  ```
  
  <!-- entry: breaking api -->
- 16bcc1f: The factory for the `diagram.moveLabel` action is `createMoveLabelAction`, named for the action it registers.
  
  `createLabelDragAction` and `LabelDragOptions` are renamed `createMoveLabelAction` and `MoveLabelOptions`; the options are unchanged.
  
  ```ts
  // before
  actions: [createLabelDragAction({ commit })],
  // after
  actions: [createMoveLabelAction({ commit })],
  ```
  
  <!-- entry: breaking api -->
- a46566f: diagram's preset factories are `createReorderPreset` and `createClusterReorderPreset`, so they no longer clash with core's `reorderPreset`.
  
  ```ts
  // Before
  import { reorderPreset, groupReorderPreset } from '@weasel-js/diagram';
  features={['move', reorderPreset(opts), groupReorderPreset(report)]}
  
  // After
  import { createReorderPreset, createClusterReorderPreset } from '@weasel-js/diagram';
  features={['move', createReorderPreset(opts), createClusterReorderPreset(report)]}
  ```
  
  <!-- entry: breaking api -->
- 761c418: `DiagramData.groups` is `DiagramData.clusters`.
  
  ```ts
  // before
  diagramScene({ nodes, edges, groups: [{ id: 'ingest', members: ['fetch', 'decode'] }] });
  // after
  diagramScene({ nodes, edges, clusters: [{ id: 'ingest', members: ['fetch', 'decode'] }] });
  ```
  
  Data still holding `groups` draws no boxes. A Diagram JSON file written under the old name still loads: `@weasel-js/diagram-formats` reads it as `clusters`.
  
  <!-- entry: rank=5 breaking api data -->
- 77329ef: `SEQUENCE_DRAG_ACTION_ID` is `DRAG_SEQUENCE_ACTION_ID`, spelled verb first like the kit's other action-id constants. Its id, `'diagram.sequence.drag'`, is unchanged.
  
  ```ts
  // before
  import { SEQUENCE_DRAG_ACTION_ID } from '@weasel-js/diagram';
  // after
  import { DRAG_SEQUENCE_ACTION_ID } from '@weasel-js/diagram';
  ```
  
  <!-- entry: breaking api -->
- 5066ab8: The connector tool's drag action is `diagram.drawConnector` (`DRAW_CONNECTOR_ACTION_ID`), verb first like the other action ids.
  
  `CONNECTOR_ACTION_ID` (`'diagram.connectorDraw'`) is renamed `DRAW_CONNECTOR_ACTION_ID` (`'diagram.drawConnector'`).
  
  ```ts
  // before
  bindings: [{ spec: { kind: 'drag' }, actionId: CONNECTOR_ACTION_ID }], // 'diagram.connectorDraw'
  // after
  bindings: [{ spec: { kind: 'drag' }, actionId: DRAW_CONNECTOR_ACTION_ID }], // 'diagram.drawConnector'
  ```
  
  <!-- entry: breaking api -->
- 44c2bd0: Each diagram editing helper returns one entry for `ambient`, with its layer inside, instead of a layer and a contribution.
  
  The helpers are `createDiagramPortsContribution`, `createDiagramWaypointsContribution`, `createDiagramEdgeEndsContribution`, `createDiagramLabelsContribution`, `createDiagramContainersContribution`, `createDiagramSequenceContribution` and `createDiagramOffPageContribution`. There is no layer to register by hand any more, and `createDiagramContribution` is gone: `createDiagramPortsContribution` is the connect gesture. Layers are hit in `ambient` order, the last first.
  
  ```tsx
  // Before
  const { layer, contribution } = useMemo(() => createDiagramPortsContribution({ participants }), [participants]);
  useEffect(() => canvasRef.current?.registerLayer(layer), [layer]);
  <SceneCanvas ref={canvasRef} ambient={[contribution]} />
  
  // After
  const ports = useMemo(() => createDiagramPortsContribution({ participants }), [participants]);
  <SceneCanvas ambient={[ports]} />
  ```
  
  <!-- entry: rank=10 breaking api -->
- 6200d28: `layoutPoses`, `bodyFollower`, `waypointFollower` and `documentBoundsOf` take a `LayoutFrame` where they took a `PoseDescriptor`.
  
  This is breaking for a caller that passed its own descriptor in that position. Wrap it with `layoutFrameOf`:
  
  ```ts
  // before
  waypointFollower(scene, descriptor);
  // after
  waypointFollower(scene, layoutFrameOf(descriptor));
  ```
  
  <!-- entry: breaking api -->
- 761c418: A layout's `Graph` holds its boxes in `clusters`, which was `groups`, and a `GraphNode` names the one it is in with `cluster`, which was `group`.
  
  ```ts
  // before
  const inside = graph.groups?.find((g) => g.id === node.group);
  // after
  const inside = graph.clusters?.find((c) => c.id === node.cluster);
  ```
  
  <!-- entry: breaking api -->
- 761c418: `grid`'s `groupColumns` option is `clusterColumns`.
  
  ```ts
  // before
  grid({ columns: 3, groupColumns: { services: 2 } });
  // after
  grid({ columns: 3, clusterColumns: { services: 2 } });
  ```
  
  A Diagram JSON file written with `groupColumns` in a page's layout still loads: `@weasel-js/diagram-formats` reads it as `clusterColumns`.
  
  <!-- entry: breaking api data -->
- 5a4c0ad: The helper that grows a pose to fit its body's floor is `growToBody`, since it never shrinks one.
  
  `sizeToBody` is renamed `growToBody`; its arguments are unchanged.
  
  ```ts
  // before
  const pose = sizeToBody(at, measureBody(spec, measure));
  // after
  const pose = growToBody(at, measureBody(spec, measure));
  ```
  
  <!-- entry: breaking api -->
- 3ebb282: The label entry for `ambient` is `createDiagramLabelsContribution`, since it carries the label's selection and text editing as well as its drag.
  
  `diagramLabelDrag` is renamed `createDiagramLabelsContribution`; its options are unchanged.
  
  ```ts
  // before
  const labels = diagramLabelDrag({ scene, selected });
  // after
  const labels = createDiagramLabelsContribution({ scene, selected });
  ```
  
  <!-- entry: breaking api -->
- cf82793: The layout helper that turns world placements into moves, dropping pinned and unmoved nodes, is `movesFrom`.
  
  `translated` is renamed `movesFrom`; its arguments are unchanged.
  
  ```ts
  // before
  return translated(graph, placed, pinnedSet(graph, opts), opts.tolerance);
  // after
  return movesFrom(graph, placed, pinnedSet(graph, opts), opts.tolerance);
  ```
  
  <!-- entry: breaking api -->
- c757e23: The layout helper that turns canonical slots into moves is `placeSlots`, which no longer reads as the iterating `untilSettled`.
  
  `settle` is renamed `placeSlots`; its arguments are unchanged.
  
  ```ts
  // before
  return settle(graph, slots, opts);
  // after
  return placeSlots(graph, slots, opts);
  ```
  
  <!-- entry: breaking api -->
- ac3e936: diagram's options take the pose descriptor as `poseDescriptor`, the name `<SceneCanvas>` gives the same thing; they took `geometry`.
  
  This covers every options bag that reads a pose's bounds through one: the shape, label, group, mark, port, edge, graph, layout, live-layout and connect options among them. A sequence root's saved `geometry` is a different thing and is unchanged.
  
  ```ts
  // before
  registerDiagramShape({ geometry: RECT_POSE_DESCRIPTOR });
  // after
  registerDiagramShape({ poseDescriptor: RECT_POSE_DESCRIPTOR });
  ```
  
  <!-- entry: breaking api -->
- 859b0c3: The two rankings `layered` and `chain` use are named for their algorithms: `simplexRanks` (network simplex) and `longestPathRanks`.
  
  `ranksByLength` is renamed `simplexRanks` and `ranksOf` is renamed `longestPathRanks`; their arguments are unchanged.
  
  ```ts
  // before
  const ranks = ranksByLength(graph, backEdges(graph));
  const plain = ranksOf(graph, backEdges(graph));
  // after
  const ranks = simplexRanks(graph, backEdges(graph));
  const plain = longestPathRanks(graph, backEdges(graph));
  ```
  
  <!-- entry: breaking api -->
- a1a4caf: `SeqRect` (`@weasel-js/diagram`) and `EffectBox` (`@weasel-js/diagram/effect`) are gone; both are geom's `Rect`, the same `x`, `y`, `width`, `height`.
  
  ```ts
  // before
  import type { SeqRect } from '@weasel-js/diagram';
  // after
  import type { Rect } from '@weasel-js/geom';
  ```
  
  <!-- entry: breaking api -->
- f40681f: The effect editor's rename-cluster action is `diagram.renameCluster`, under the `diagram.` prefix every other diagram action id uses.
  
  A binding or keymap naming `'effect.renameGroup'` uses `'diagram.renameCluster'`; its params are unchanged.
  
  ```ts
  // before
  bindings: [{ spec: { kind: 'doubleClick' }, actionId: 'effect.renameGroup' }],
  // after
  bindings: [{ spec: { kind: 'doubleClick' }, actionId: 'diagram.renameCluster' }],
  ```
  
  <!-- entry: breaking api -->
- 2dac7b8: The reorder helper that lays out drop slots along an axis is `slotsAlong`, which no longer suggests sequence diagrams.
  
  `sequenceSlots` is renamed `slotsAlong`; its arguments are unchanged.
  
  ```ts
  // before
  const slots = sequenceSlots('x', items);
  // after
  const slots = slotsAlong('x', items);
  ```
  
  <!-- entry: breaking api -->
- e4dc727: The helper that returns the ops inserting a stencil is `stencilInsertOps`, named for what it returns.
  
  `stencilBuild` is renamed `stencilInsertOps`; its arguments and its `{ id, ops }` result are unchanged.
  
  ```ts
  // before
  const { id, ops } = stencilBuild(stencil, bounds, { layer: 'shapes', newId });
  // after
  const { id, ops } = stencilInsertOps(stencil, bounds, { layer: 'shapes', newId });
  ```
  
  <!-- entry: breaking api -->
- cbbafe8: The line jumps command is `createToggleHopsAction`, with the id `diagram.toggleHops`, since it turns jumps on or off.
  
  `createSetHopsAction`, `SET_HOPS_ACTION_ID` (`'diagram.hops'`) and `SetHopsOptions` are renamed `createToggleHopsAction`, `TOGGLE_HOPS_ACTION_ID` (`'diagram.toggleHops'`) and `ToggleHopsOptions`.
  
  ```ts
  // before
  menuRun({ hops: SET_HOPS_ACTION_ID }); // 'diagram.hops'
  // after
  menuRun({ hops: TOGGLE_HOPS_ACTION_ID }); // 'diagram.toggleHops'
  ```
  
  <!-- entry: breaking api -->
- 67f65a0: diagram's tool factories are `createConnectorTool` and `createStencilTool`, paired with `useConnectorTool` and `useStencilTool`.
  
  This is a breaking rename: `connectorTool` and `stencilTool` are gone, with no alias. Their arguments are unchanged.
  
  ```ts
  // before
  const tool = stencilTool(FLOWCHART_STENCILS[0]);
  // after
  const tool = createStencilTool(FLOWCHART_STENCILS[0]);
  ```
  
  <!-- entry: breaking api -->
- 761c418: The diagram trait's `group` field is `cluster`, and its box's derive key is `'diagram:cluster'`, which was `'diagram:group'`.
  
  A scene saved under the old names still loads: `withDiagramRegistry` carries `upgradeClusterNames`, a core `NodeUpgrade` under `DIAGRAM_CLUSTER_UPGRADE`, which rewrites each old node as `loadScene` or `loadState` reads it. A registry built without `withDiagramRegistry` adds it to its `upgrades` to do the same.
  
  ```ts
  // before
  scene.add({ kind: 'mark', layer: 'main', pose, data: { diagram: { group: { inset: 12 } } }, dependsOn: members });
  // after
  scene.add({ kind: 'mark', layer: 'main', pose, data: { diagram: { cluster: { inset: 12 } } }, dependsOn: members });
  ```
  
  <!-- entry: rank=5 breaking api data -->
- f5bd421: `DiagramView` takes its held pick as `selection` and reports changes through `onSelectionChange`, as other components do.
  
  `selected` is renamed `selection` and `onSelect` is renamed `onSelectionChange`; their values and the callback's arguments are unchanged. `EffectChart` and `EffectEditor` keep their `selected` and `onSelect`.
  
  ```tsx
  // before
  <DiagramView specs={specs} selected={id} onSelect={setId} />
  // after
  <DiagramView specs={specs} selection={id} onSelectionChange={setId} />
  ```
  
  <!-- entry: breaking api -->
- 47991e7: `checkPipeline` reports a repeated cluster id as `duplicate-cluster`, and names the cluster a problem is about in `cluster`.
  
  They were `duplicate-group` and `group`. The messages are unchanged.
  
  ```ts
  // before
  problems.filter((p) => p.kind === 'duplicate-group').map((p) => p.group);
  // after
  problems.filter((p) => p.kind === 'duplicate-cluster').map((p) => p.cluster);
  ```
  
  <!-- entry: breaking api -->
- 47991e7: The effect pipeline's cluster edits are named for clusters, from `clusterStages` and `dissolveCluster` to `uniqueClusters`.
  
  `groupStages`, `ungroup`, `renameGroup`, `moveToGroup`, `setGroupBox`, `moveGroup`, `groupContents`, `nextGroupId` and `uniqueGroups` are `clusterStages`, `dissolveCluster`, `renameCluster`, `moveToCluster`, `setClusterBox`, `moveCluster`, `clusterContents`, `nextClusterId` and `uniqueClusters`. Their arguments are unchanged; a new cluster's id is `cluster`, `cluster-2`, and so on.
  
  ```ts
  // before
  import { groupStages, ungroup } from '@weasel-js/diagram/effect';
  const next = ungroup(groupStages(doc, ['a', 'b']), 'outer');
  // after
  import { clusterStages, dissolveCluster } from '@weasel-js/diagram/effect';
  const next = dissolveCluster(clusterStages(doc, ['a', 'b']), 'outer');
  ```
  
  <!-- entry: breaking api -->
- 47991e7: An effect pipeline names its boxes `clusters`, of type `EffectCluster`, and an effect doc keeps their sizes in `clusterBoxes`.
  
  They were `groups`, `EffectGroup` and `groupBoxes`. A doc saved under the old names still loads through `readEffectDoc`, which reads them as the new ones; code building a pipeline or a doc writes the new names.
  
  ```ts
  // before
  const pipeline: EffectPipeline = { stages, wires, groups: [{ id: 'g', members: ['a', 'b'] }] };
  const doc: EffectDoc = { pipeline, places, groupBoxes: { g: box } };
  // after
  const pipeline: EffectPipeline = { stages, wires, clusters: [{ id: 'g', members: ['a', 'b'] }] };
  const doc: EffectDoc = { pipeline, places, clusterBoxes: { g: box } };
  ```
  
  <!-- entry: breaking api data -->
- 47991e7: `EffectEditor`'s cluster pick and ref methods are named for clusters, with the same on-screen labels.
  
  `selectedCluster`, `onSelectCluster`, and the ref's `cluster`, `dissolveCluster` and `renameCluster` were `selectedGroup`, `onSelectGroup`, `group`, `ungroup` and `renameGroup`. The edits still report themselves as 'Group', 'Ungroup' and 'Rename group'.
  
  ```tsx
  // before
  <EffectEditor ref={editor} selectedGroup={picked} onSelectGroup={setPicked} … />
  editor.current?.group(ids);
  // after
  <EffectEditor ref={editor} selectedCluster={picked} onSelectCluster={setPicked} … />
  editor.current?.cluster(ids);
  ```
  
  <!-- entry: breaking api -->
- 08c1713: `runPipeline` hands an evaluator a `many` input as an array of every reached wire's value. A bypassed stage passes the first one on.
  
  An evaluator for a stage with a `many` input reads `inputs[port]` as `unknown[]` instead of one value.
  
  <!-- entry: breaking fix -->
- 47991e7: The effect editor's action that drags a cluster by its title is `diagram.reorderClusters`.
  
  It was `diagram.reorderGroups`; a binding or keymap naming it uses the new id, with the same params.
  
  ```ts
  // before
  bindings: [{ spec: { kind: 'drag' }, actionId: 'diagram.reorderGroups' }],
  // after
  bindings: [{ spec: { kind: 'drag' }, actionId: 'diagram.reorderClusters' }],
  ```
  
  <!-- entry: breaking api -->
- 899a776: `ForceOptions.groupStrength`, how hard a cluster draws its members together, is `clusterStrength`.
  
  ```ts
  // before
  force(graph, { groupStrength: 0.4 });
  // after
  force(graph, { clusterStrength: 0.4 });
  ```
  
  <!-- entry: breaking api -->
- 744fbce: The path, text, rig, diagram and measure actions act on the `operands` dep, the selection by default.
  
  This is breaking for code that runs these actions with deps it builds by hand: each now declares `operands` in `requires` and reads it where it read `selection`, as core's editing actions do. On a `<SceneCanvas>` nothing changes, since `operands` answers with the selection unless a host sources its own. Selecting actions (diagram's edge pick and sequence-part pick, following an off-page tag) still read `selection`.
  
  ```ts
  // before
  snipAtCrossingsAction.invoker.run({ scene, selection, applyOps });
  // after
  snipAtCrossingsAction.invoker.run({ scene, operands: selection, applyOps });
  ```
  
  <!-- entry: rank=0 breaking api -->
- fd2cbc8: `@weasel-js/diagram`, `plot`, `labkit`, `svg` and `editor` need `@weasel-js/text-tools` installed beside them.
  
  This is breaking: add `@weasel-js/text-tools` to an app using any of them. Diagram and plot canvases turn on `textTools.text` themselves, so their labels paint and edit as before; labkit's annotation layer mounts text-tools' text tool.
  
  <!-- entry: breaking -->
- 0362193: Bindings and triggers of the plugin packages' actions that read params are checked against their `ActionParamSchema` entries.
  
  Each package merges its entries into routing's schema from its own `actionParamSchema.ts`: the diagram's label, waypoint, lane, container-title, off-page, rename-group, and sequence actions; `hud.press`, `hud.release`, `hud.doubleClick`, `hud.contextMenu`, `hud.longPress`, and `hud.wheel`; `loupe.aim` and `loupe.magnify`; `minimap.center` and `minimap.zoom`; `bone.pick`, `weight.paint`, and `weight.click`; `lab.zoom`, `camera.tap`, and `loupe.follow`; `loupe.compare.with` and `loupe.compare.dpr`; and `camera.dolly`. New exported types: diagram's `DrawMessageParams` and `WrapFragmentParams`, `HudPointParams`, `HudWheelParams`, `LoupeAimParams`, `MinimapZoomParams`, `WeightBrushParams`, `LabZoomParams`, `DollyParams`, guides' `DistanceReadoutParams`, and forge's `ForgeCompareParams` and `ForgeComparison` from `@weasel-js/forge/shell`.
  
  This is breaking for code that passes one of these ids params its entry does not declare: that is now a type error. `useDocClipboard`'s `commands.paste.keys` takes `clipboard.paste`'s params. The diagram's `*ScratchOf` readers take the hit as `unknown`.
  
  <!-- entry: breaking api -->
- 55d8e65: What each sequence tool adds is a tool option and its action's params, so the last-operation panel can change a drawn message's arrow.
  
  `SequenceToolsOptions` drops `participant`, `arrow`, `fragment` and `mark`. Each is an option of its tool (`SEQUENCE_PARTICIPANT_OPTIONS` `kind`, `SEQUENCE_MESSAGE_OPTIONS` `arrow`, `SEQUENCE_FRAGMENT_OPTIONS` `type`, `SEQUENCE_MARK_OPTIONS` `mark`), kept in the `toolOptionValues` dep. `<DiagramView toolOptionValues>` publishes one.
  
  ```tsx
  // before
  const tools = useSequenceTools({ commit, arrow: () => arrow });
  // after
  const values = createToolOptionValues();
  setToolOption('diagram.sequence.message', SEQUENCE_MESSAGE_OPTIONS, values, 'arrow', 'reply');
  <DiagramView tools={useSequenceTools({ commit })} toolOptionValues={values} … />
  ```
  
  <!-- entry: rank=5 breaking api -->
- 4e54b4e: Group, ungroup, a reparenting drop, a clone or paste landing, and a follower move refuse whole rather than put a node in a singular frame.
  
  They promise every node stays where it is shown, and no pose stored in a frame scaled to nothing keeps that promise. Each leaves the scene and its history as they were, and `group` and `ungroup` report `NotApplicable`. A container whose frame is singular takes no children by drop, insert or paste, and an insert asked into one lands at the top of the tree. In diagram, releasing members into one does nothing; in symmetry, a center change for a group in one is ignored.
  
  <!-- entry: behavior -->
- 4e54b4e: A move, nudge, rotate, resize, flip, align or distribute leaves a node stored in a singular frame where it is and transforms the rest.
  
  No stored pose in a frame scaled to nothing follows the edit, so such a node is not written. Path edits, slicing and boolean operations pass it over too, and a layout pass does not move it.
  
  <!-- entry: behavior -->

### Minor Changes

- 8bd0c2d: `AvoidRouter.beginPreview()` starts a drag's run of previews. A frame over its budget keeps a connector only at a route this drag previewed.
  
  <!-- entry: api -->
- e448c6f: `AvoidRouter.forget(ids)` makes the router's next update reroute those connectors. For a host that did not store the routes it was given, such as a locked connector's.
  
  <!-- entry: api -->
- 1b291e6: BPMN's end event is an outline of its own, `endEvent`, its heavy ring filled in the stroke's color, and the end-event stencil places it.
  
  <!-- entry: new api fix visual -->
- 2aae9c7: The connect action and connector tool take `edgeDerivePath`, so an edge drawn with custom `routers` or a `frame` keeps its preview's shape.
  
  Without one, development warns when `routers` or `frame` is set and `commit` is not.
  
  ```ts
  const derivePath = edgeDerivePath({ routers }); // registered in the scene's registry
  createConnectorTool({ participants, routers, router: 'wavy', edgeDerivePath: derivePath });
  ```
  
  <!-- entry: api fix -->
- 043cdcc: `applyDiagramEdit` and `applyNodeResizes` store what a `DiagramView` reports back into its `DiagramData`.
  
  `applyDiagramEdit(data, edit)` writes an `onEdit` report the way `onMove` and `onEditContainer` say to store one: each moved node's `at`, pinned, its new region, each rerouted edge's `routed` and `routedPorts`, a region's `box`, a pool's lanes, a released container's members. `{ pin: false }` leaves what moved unpinned, for data built with `layout: 'none'`.
  
  <!-- entry: rank=5 api new -->
- ab9b2a8: `containerBuild` and `stencilInsertOps` take a `composition` option, the scene's, to store lanes, titles and rows under.
  
  It defaults to `RIGID_POSE_COMPOSITION`.
  
  <!-- entry: api -->
- 1daf5d8: `diagramColorOf` and `diagramFontSizeOf` read back the color and text size that `setDiagramColor` and `setDiagramFontSize` set.
  
  `diagramColorOf(scene, id, 'text')` skips a header row, which takes the box's fill, and finds a connector's labels by what they depend on rather than by id.
  
  <!-- entry: api -->
- 7eba566: `ContainerLayoutKey` names the layout keys `containerShape` returns: the five `DIAGRAM_*_LAYOUT` constants.
  
  <!-- entry: api -->
- 3f6ce6c: `diagramDropParentAt` takes an optional `canDropInto` asking which regions admit an insert.
  
  It defaults to `diagramCanDropInto` on the scene, and reads `isLocked` and `isHidden` off the scene when it has them.
  
  <!-- entry: api -->
- a4bf5e1: Diagram bodies, labels and sequences committed while their face was still loading can be measured again once it lands.
  
  `useFaceRemeasure(scene, { measure })` does it for the life of a component, `installFaceRemeasure` returns the unsubscribe, and `remeasureText` runs it once. A body grows to what its rows need and never shrinks; the writes are untracked, so undo never brings back a size measured in the wrong face.
  
  <!-- entry: new api -->
- e82b401: A collapsed node's body carries the rows it hides on its trait, as `DiagramNode.folded`, so a reader of the scene can recover the whole node.
  
  <!-- entry: api -->
- 34e26b9: `setDiagramColor` with `'fill'` leaves header text in the role's `headerText` where the theme names one.
  
  That is how a shape built with that fill is drawn. `setDiagramColor` now takes a `theme` option, as `setDiagramStyle` does, defaulting to the scene's own.
  
  <!-- entry: fix api -->
- 6200d28: A diagram can live on a plane of its own: every diagram reader takes a `frame`, a `LayoutFrame` saying how a pose's box is read and moved there.
  
  Layout, ports, edge routing, cluster and anchor boxes, label and off-page tag stations, the connect gesture and the painters all read geometry through it. Unset, the frame is the pose descriptor's own space (`layoutFrameOf(poseDescriptor)`), so a 2D canvas and its saved data are unchanged. A 3D host whose descriptor answers in screen pixels passes the projection onto the diagram's plane; stored waypoints, routes and port anchors are then coordinates on that plane.
  
  ```ts
  const ground: LayoutFrame<Pose3> = {
    box: ({ p, s }) => ({ x: p[0] - s[0] / 2, y: p[2] - s[2] / 2, width: s[0], height: s[2] }),
    translate: (pose, dx, dy) => ({ ...pose, p: [pose.p[0] + dx, pose.p[1], pose.p[2] + dy] }),
    fromBox: (b, pose) => ({ p: [b.x + b.width / 2, pose.p[1], b.y + b.height / 2], s: [b.width, pose.s[1], b.height] }),
  };
  layoutDiagram(scene, sceneParticipants(scene), 'layered', { poseDescriptor, frame: ground });
  ```
  
  `frameFor`, `layoutFrameOf`, `AUTO_LAYOUT_FRAME` and the `FrameOptions` and `LayoutFrame` types are exported.
  
  <!-- entry: rank=10 new api -->
- bfc26b4: The pieces of `SequenceLayout`, the edge-end options and the router's held ends are exported.
  
  `SeqHeadPlace`, `SeqLifelinePlace`, `SeqMessagePlace`, `SeqActivationPlace`, `SeqNotePlace`, `SeqFragmentPlace` and `SeqBoxPlace`; `EdgeEnds` and `EdgeEndOptions`; and `HeldEnd` and `ResolvedAvoidOptions`, from the root and `@weasel-js/diagram/layout`.
  
  <!-- entry: api -->
- 8fbb4b2: `DiagramView` takes `onEdit`, which hears one gesture's moves, routes and container edits together as one `DiagramEdit`.
  
  A container dragged with its members reaches `onMove` and `onEditContainer` as separate reports; `onEdit` gets them as one, a microtask after the last, so a host can store the drag as one undo entry. Setting it turns on dragging and container editing as those two do.
  
  <!-- entry: rank=5 api new -->
- 7ce0db4: `DiagramView`'s `onSelect` hears a pick a drag makes, so a property panel follows the node being moved.
  
  `useMirroredSelection` takes the selection store's `subscribe` as a fourth argument to report such changes.
  
  <!-- entry: fix api -->
- c9c39dd: A `DiagramView` given `onConnect` draws its ports even when `portOptions` names no color.
  
  A port with neither `fill` nor `stroke` is drawn in `DEFAULT_PORT_FILL` outlined in `DEFAULT_PORT_STROKE`, both exported.
  
  <!-- entry: rank=5 fix visual api -->
- 672e827: `readEffectDoc` checks an `EffectDoc` read from a file, refusing one with a wrong-typed field with an `EffectDocShapeError`.
  
  ```ts
  import { readEffectDoc } from '@weasel-js/diagram/effect';
  
  const doc = readEffectDoc(JSON.parse(text)); // throws "Not an effect document: doc.pipeline.stages[0] is not an object"
  ```
  
  <!-- entry: api -->
- d689e44: Release members is disabled over a container whose release would move a locked node, or whose members could not keep their places.
  
  New `canReleaseMembers(scene, id)` answers whether `releaseMembers` would change anything for `id`.
  
  <!-- entry: fix api -->
- 2b1c344: `Router`, `RouteRequest`, `ResolvedRoute` and `Port` take a point type, `Vec2` by default, and `bezierFor` builds the smooth router in any dimension.
  
  `straight` routes points of any type. `bezierFor(components)` takes how to read a point as numbers and back; `bezier` is `bezierFor(VEC2_COMPONENTS)`. `orthogonal` and `avoid` stay on the plane.
  
  ```ts
  const bezier3 = bezierFor<[number, number, number]>({ of: (p) => p, point: ([x, y, z]) => [x!, y!, z!] });
  ```
  
  <!-- entry: api -->
- 6121e6b: `diagramThemeErrors(value)` lists what keeps a value from being a whole `DiagramTheme`, each error naming where.
  
  <!-- entry: api -->
- dd7e196: `useDiagramTools` builds every tool diagram ships, and the `DIAGRAM_TOOLS` set names them.
  
  That is the connector, a tool per stencil and the sequence tools; `STENCIL_TOOLS` holds one set per stencil group.
  
  `createStencilTools(stencils)` keys a tool per stencil by its insert kind, and `stencilToolSet(group)` names a group's.
  
  ```tsx
  const tools = useDiagramTools({ connector: { participants }, sequence: { commit } });
  <SceneCanvas tools={tools} … />
  ```
  
  <!-- entry: api new -->
- 51978f9: `checkPipeline` reports a stage or cluster that two clusters name as `duplicate-member`, on the later cluster.
  
  <!-- entry: api fix -->
- 6d731a9: `checkPipeline` reports a wire whose `id` an earlier wire already has as `duplicate-wire`.
  
  <!-- entry: api fix -->
- bfd5db9: `checkPipeline` reports effect clusters that hold each other in a loop as a `cluster-loop` problem, naming every cluster in it.
  
  `EffectProblem` gains the `cluster-loop` kind and a `clusters` field listing the loop's clusters; `cluster` is the first of them.
  
  <!-- entry: new api -->
- ef600c0: `checkPipeline` reports a stage or port id starting with `~` as a `reserved-id` problem, and the rack and lanes looks throw an error naming it.
  
  Those ids are kept for the lane nodes and skip and tap ports the looks make.
  
  <!-- entry: fix api -->
- 2c2021d: `EffectRunner.idle()` settles once every run and step asked for so far has finished.
  
  A caller that owns the source images it hands the runner awaits it before closing a replaced one, since no run reads that image after.
  
  <!-- entry: api -->
- b74a24f: An effect runner's `setOptions` starts a step run under way over, as `setPipeline` does.
  
  An option `setOptions` is handed as `undefined` goes back to its default, and `setSources(undefined)` hands the next run no sources.
  
  <!-- entry: fix api -->
- 8bea5be: `@weasel-js/diagram/effect` exports `EffectRunnerSettings`, the type of what `EffectRunner.setOptions` takes.
  
  <!-- entry: api -->
- 932b85d: `markShape` and `registerMarkShape` take an `id`, so a mark painter with its own `geometry` can register beside `DiagramView`'s.
  
  ```ts
  registerMarkShape({ id: 'chart:mark', geometry: CHART_POSE });
  ```
  
  <!-- entry: api -->
- da0d0d0: `DiagramView`'s `onEditLabel` hears which end label a double-click landed on, as a second `end` argument.
  
  `createEditEdgeLabelAction`'s `commit` is handed the pressed label's id as a third argument, and the new `labelEndOf(edgeId, labelId)` reads it as `'from'`, `'to'` or `null`.
  
  ```tsx
  <DiagramView onEditLabel={(edge, end) => (end ? editEndLabel(edge, end) : editLabel(edge))} />
  ```
  
  <!-- entry: api fix -->
- 46c6d05: `outlineRegistry` lists every outline name and the definition it resolves to, with the definitions a `registerOutline` call shadows.
  
  The built-ins report source `'kit'`.
  
  <!-- entry: api -->
- 4d0042b: `outlineRings(outline, bounds)` answers an outline as one closed ring per subpath, and `rayHit` accepts those rings.
  
  `outlinePolyline` now closes each subpath on its own; cast a ray at `outlineRings` where the outline may have more than one.
  
  <!-- entry: api -->
- 8d7296a: A tool set can carry a `label`, and every set the kit ships has one: `toolSet('make', ids, { label: 'Make' })`.
  
  A shortcut sheet heads a set's tools with it, and `withoutTools` keeps it.
  
  <!-- entry: api -->

### Patch Changes

- 85e334d: `applyDiagramEdit` stores a released lane: the lane leaves its pool and its members go to the region holding the pool.
  
  <!-- entry: fix -->
- 85e334d: `applyDiagramEdit` hands a released pool's lane members to the region that held the pool.
  
  <!-- entry: fix -->
- 06d4d46: The avoid router prices crossing another connector where both run along the same grid line, so `crossPenalty` steers routes apart there too.
  
  <!-- entry: fix -->
- 8bd0c2d: A drag under avoid routing no longer shows routes or connector data left from a drag before it, a cancelled one included.
  
  <!-- entry: fix -->
- f4ad599: The avoid router reroutes a connector a moved label comes within `labelClearance` of, where it used to check only `clearance`.
  
  <!-- entry: fix -->
- e448c6f: Avoid routing reroutes a locked connector on the first edit after it is unlocked when an edit while it was locked disturbed it.
  
  <!-- entry: fix -->
- 08b07ae: The avoid router no longer hangs an edit when a shape's box is NaN or infinite.
  
  <!-- entry: fix -->
- a4ef1f7: A connector the avoid router found no path for is read along the line through its waypoints. Its label obstacle stands on that line, and a shape moved onto it reroutes the connector.
  
  <!-- entry: fix -->
- 7e971ee: Avoid routing takes what an undo, redo or history jump leaves as routed. The next drag and edit route against those shapes, labels and routes.
  
  <!-- entry: fix -->
- 7dc55af: `buildGraph` leaves out an edge from a container or pool to something it holds, as `diagramScene` does.
  
  <!-- entry: fix -->
- 4f264d0: Values held between two bounds go through geom's `clamp` and `clamp01` rather than local copies.
  
  A loupe whose `minFactor` is above its `maxFactor` now settles on the low bound, as `clamp` does, where it settled on the high one.
  
  <!-- entry: rank=-5 behavior -->
- de28465: `useConnectorTool` rebuilds its tool when the `frame` option changes, so a 3D host's new projection reaches the connect action.
  
  <!-- entry: fix -->
- bfc26b4: Every type a public signature names can now be written down by a consumer.
  
  Types the declarations named through private aliases are written out, or are geom's `Point` and `Rect`.
  
  <!-- entry: internal -->
- 0698b8a: `addLane` places the new lane in its pool wherever the pool draws, in a scene whose poses do not compose too.
  
  <!-- entry: fix -->
- 09b9ec7: `addLane` throws a `RangeError` for a negative or fractional index.
  
  <!-- entry: fix behavior -->
- 7808c46: A pool whose title is locked shows no add-lane button, and `diagram.addLane` passes a press there on rather than throwing.
  
  <!-- entry: fix -->
- 5f9bea2: `diagram.addLane` passes a click on a lane boundary on to the next binding that hears it; it adds a lane only from its button.
  
  <!-- entry: behavior -->
- fa33365: In a themed scene, `addLane` given a style restripes the lanes it moves along, as it does without one.
  
  <!-- entry: fix visual -->
- e0f4c91: Registering an outline under a built-in outline's name replaces it without a development warning.
  
  <!-- entry: behavior -->
- 68ad237: `costText` writes a stage's cost with `@weasel-js/quantity`'s `formatNumber`, so a cost of a second or more groups its thousands (`1,235 ms`).
  
  <!-- entry: rank=-5 behavior -->
- 42aab0c: Several `<DiagramView>`s on one page register the diagram painters without conflict.
  
  `registerDiagramShape()` and `registerMarkShape()` with no options share one painter.
  
  <!-- entry: fix -->
- e3a1721: Installing @weasel-js/diagram no longer brings in the prefs store: it depends on @weasel-js/prefs-schema.
  
  <!-- entry: perf -->
- c526e13: Dragging a shape over a text mark or a sequence no longer reparents the shape under it.
  
  `diagramCanDropInto` admits a drop only into a region or a group with no diagram trait.
  
  <!-- entry: fix -->
- 831a2b2: A shape inserted on a container lands in it where the container overhangs the body of the one it is in.
  
  <!-- entry: fix -->
- adb8862: Points placed along a diagram edge or outline land exactly on a segment's far end.
  
  <!-- entry: fix -->
- 036700d: `DiagramView`'s `fit()`, and its refit after a layout run settles, frame a diagram with containers or pools around where its shapes are drawn.
  
  <!-- entry: fix -->
- f9cb915: The grid layout places a node or group whose id names an `Object.prototype` member, such as `constructor`, like any other.
  
  <!-- entry: fix -->
- 865f78e: A double-click on the edge between a region's header and its body no longer edits the title; that edge is the body's.
  
  <!-- entry: fix -->
- 37f3652: A hidden lane offers no resize boundary.
  
  <!-- entry: fix -->
- 8386869: diagram's body, header-band, and group-grip hit tests use geom's `rectContainsPoint`.
  
  <!-- entry: internal -->
- 7821156: A connector label whose `at` names an `Object.prototype` member, such as `toString`, stands in the middle of its connector.
  
  <!-- entry: fix -->
- 8f3e8e5: A rotated pool's lane boundaries and add-lane button sit where the pool draws them, and resize along the turned stack.
  
  <!-- entry: fix -->
- 596acb7: A theme stripes a pool's lanes by where they sit in the stack, so a lane added between others leaves no two neighbors alike.
  
  <!-- entry: fix visual -->
- d091135: A lane can be dragged only into a pool stacking the same way as its own.
  
  <!-- entry: fix behavior -->
- c153b90: Growing a lane past the lanes after it keeps them below it once the drag ends, as the preview showed.
  
  <!-- entry: fix -->
- 72e1c0e: Resizing a lane in a turned pool keeps the pool's start edge in place, so the boundary stays under the pointer.
  
  <!-- entry: fix -->
- 6ac2b44: A lane's boundary is not offered, and its resize does not run, where a later lane holds a locked node the resize would move.
  
  <!-- entry: fix -->
- 1804d61: A lane boundary is not offered, and a drag there goes to whatever else is under it, where the resize would move a locked lane or title.
  
  <!-- entry: fix -->
- 72e1c0e: A lane resize previews the lane's and the pool's titles where they draw in a scene whose poses do not compose.
  
  <!-- entry: fix -->
- d747443: The layered layout breaks cycles and ranks nodes along a chain of any length, where a long one used to overflow the stack.
  
  <!-- entry: fix -->
- 5c81350: `diagram.layout` is disabled when the layout would move nothing: an empty diagram, one laid out already, or every participant locked.
  
  The layout runs once per change to the scene or its source, however often `enabled` is asked, and the run after it writes that same answer.
  
  <!-- entry: behavior -->
- 31df350: `DiagramView`'s `layout()` and the layout action move a container with what it holds, leaving its members inside it.
  
  <!-- entry: fix -->
- 7606b26: `layoutDiagram` runs the layered layout for an unlisted algorithm such as `constructor`, and an unknown image `blend` draws as normal.
  
  <!-- entry: fix -->
- ba5c5d5: `diagram.layout` is disabled after a layout as it promised, rather than staying on for places it wrote a rounding error away from.
  
  <!-- entry: fix -->
- 166946e: `useLiveLayout` runs an `algorithm` name it does not ship, `constructor` included, as `layered`.
  
  <!-- entry: fix -->
- b4772dc: A pool drawn narrower than its header builds its lanes, and `addLane` adds one, inside its body rather than at a negative width.
  
  <!-- entry: fix -->
- dcb2e4d: `createDiagramNodes` gives no kind's trait to a connector, label, anchor, mark, sequence part or lane.
  
  <!-- entry: fix -->
- 934dc61: `outlineFromD` throws on path data that does not parse or draws nothing, as a mark's path data already does.
  
  The same goes for its `detail`, and a `content` box with no area throws a `RangeError`.
  
  <!-- entry: fix -->
- eba59c7: The warning for an outline name nobody registered prints only in development, like the diagram's other warnings.
  
  <!-- entry: rank=-5 behavior -->
- 028398e: A diagram's overlays, header clicks, item drop targets, and group reordering place a scrolled container's members where the view shows them.
  
  <!-- entry: fix -->
- 786d7e4: Diagram sequences, avoid routing, and plot handles read world poses through core's `worldPoses`, reading what they read before.
  
  <!-- entry: internal -->
- e458d95: A pool resized smaller than its lanes can shrink to grows back to hold them, rather than drawing lanes past its edge.
  
  <!-- entry: fix visual -->
- 840a01b: `createDiagramPortsContribution` with a renamed connect action (`id`) keeps its ports grabbable: the port layer keeps the id `diagram-ports`.
  
  <!-- entry: fix -->
- c119620: Effect charts treat stage ids, port ids and value types like `constructor`, `toString` and `__proto__` as ordinary names.
  
  A stage with the id `__proto__` now plans its audio node, keeps its place when moved, and records its values and previews. A stage named for an `Object.prototype` member counts as unreached when the run never reached it, and a value type so named gets a series color instead of a function. A document's places, routes, labels and group boxes no longer find built-ins for such ids.
  
  <!-- entry: fix -->
- bc47b9e: `DiagramViewApi.rectOf` gives a node's client rect where it is drawn when an ancestor draws the diagram scaled.
  
  <!-- entry: fix -->
- d3c9045: Releasing a lane's members leaves them drawn above the pool they sat in, rather than hidden under its fill.
  
  <!-- entry: fix visual -->
- 5f2eac9: Release members is unavailable on a lane while a lane after it holds a locked node, which the restack would move.
  
  <!-- entry: fix -->
- 3a650b6: Rename group is disabled where it would open no name field, such as from a palette with no point to find a group at.
  
  <!-- entry: fix -->
- cf3e7dd: `DiagramView`'s `onResize` and a resized container's box edit report a box inside a container or lane in world, as `onMove` does.
  
  <!-- entry: fix -->
- 9bd1284: A shape, connector or container whose style names an `Object.prototype` member, such as `constructor`, draws in the theme's default style.
  
  <!-- entry: fix -->
- 7a21cbd: A node sized to its rows under a `roundRectOutline` gets the box its drawn corners need; `Infinity` no longer sizes an infinite one.
  
  A radius that is negative or `NaN` now throws a `RangeError`.
  
  <!-- entry: fix visual -->
- 554a3c7: A router command is disabled when every selected connector already uses that router; its button still shows as pressed.
  
  <!-- entry: behavior -->
- 187d21a: A router command is disabled as locked where it would change a locked connector, and running it changes nothing rather than throwing.
  
  <!-- entry: fix -->
- 2aef76e: A connector whose `router` names an `Object.prototype` member, such as `toString`, is drawn straight.
  
  <!-- entry: fix -->
- bc99ea3: `diagramScene` leaves no layout room for labels when its `labelPlacement` option stations them at an end or a fraction of the route.
  
  <!-- entry: fix visual -->
- 9b59a03: `setDiagramStyle` and `setDiagramColor` leave a sequence and its parts alone.
  
  `diagramStyleOf` answers `null` for them: a sequence draws its parts from its data, so an edit there was lost at the next redraw.
  
  <!-- entry: fix -->
- 963678e: `setThemeValue` throws a `RangeError` for a role, lane body or series color the theme does not have.
  
  It had returned a theme with a partial role or holes in an array. Appending one color at the end of `series` still works; make a role with `addThemeRole`.
  
  <!-- entry: fix -->
- 932b85d: `registerDiagramShape` and `registerMarkShape` called twice with the same options register one painter instead of throwing.
  
  <!-- entry: fix -->
- ab9b2a8: A stencil drawn into a scene whose `composition` is not the rigid default stores its rows, lanes and titles where they draw.
  
  <!-- entry: fix -->
- 8daaf5a: A stencil drawn inside a container under a plain group or an envelope becomes that container's member.
  
  <!-- entry: fix -->
- 3f6ce6c: A stencil drawn over a locked or hidden container, or one the scene's `canDropInto` refuses, lands in the region around it instead.
  
  <!-- entry: fix -->
- 963f8fd: Alt and an arrow key no longer reorder a diagram member while a drag is in flight.
  
  <!-- entry: fix -->
- 0a5cd7a: Move along (Alt and an arrow key) is disabled where the step moves nothing, so the key falls through.
  
  That is a step along the other axis, or past either end.
  
  <!-- entry: fix -->
- e4e3b6a: The diagram style edits by hand leave a locked shape, connector or text row as it is, and edit the rest.
  
  `setDiagramStyle`, `setDiagramColor` and `setDiagramFontSize` had thrown partway through.
  
  <!-- entry: fix -->
- c39e272: Applying a diagram theme sets outline widths and dashes as building in that theme does, not only colors.
  
  A width or dash an item's `colors` sets is recorded in its trait's new `ownLine` and kept.
  
  <!-- entry: fix visual -->
- 119b6c5: A scene whose `diagram:theme` holds a theme that does not check draws in the fallback theme instead of crashing.
  
  `diagramThemeFrom` checks a whole theme with `diagramThemeErrors` and warns once per value in development.
  
  <!-- entry: fix -->
- c95ff39: `parseDiagramTheme` checks a theme's optional fields, and refuses a non-finite font size or an empty `series`.
  
  The optional fields are the header colors, outline widths and dashes, and the connector's label color, width, dash, markers and trim.
  
  <!-- entry: fix data -->
- 493f964: A text row a smaller theme font size takes below 1 returns to its own size when a theme steps it back up.
  
  <!-- entry: fix visual -->
- eaa8ff5: `diagramThemeFromTokens` takes `paper`'s color for a token that does not parse as a color.
  
  The shipped `--wzl-fg-muted` is relative color syntax, so "Match chrome" had painted muted text and connectors with it and saved a theme that did not check.
  
  <!-- entry: fix visual -->
- 9bd1284: A document whose theme is named `constructor`, `toString` or another `Object.prototype` member gets the fallback theme.
  
  <!-- entry: fix -->
- 185a234: Diagram theme editing and theme files treat a role named `toString` or `constructor` as a role only when the theme holds it.
  
  <!-- entry: fix -->
- 862459a: `applyDiagramTheme` and a late-loading font's remeasure leave locked shapes, labels and sequences as they stand, where they threw.
  
  <!-- entry: fix behavior -->
- 67598c9: Double-clicking a lane's header, or the header of a container inside another, edits that region's title wherever its pool or parent sits.
  
  <!-- entry: fix -->
- d747443: The tree and radial layouts lay out a chain of any depth without overflowing the stack, and a deep tree lays out in linear time.
  
  <!-- entry: fix perf -->
- 9709a41: A rotated container or pool takes title double-clicks and stencil inserts where it is drawn.
  
  <!-- entry: fix -->
- 90d75a5: A scene whose diagram type is named `constructor` or another `Object.prototype` member reads as a flowchart.
  
  <!-- entry: fix -->
- 9acf4ce: `diagramScene` warns in development, once per id, when an edge end or a member names an id the data never declares.
  
  The edge or member is still left out.
  
  <!-- entry: fix -->
- 50c0635: A diagram naming a theme this build does not ship warns in development, once per theme name, and still draws with the fallback theme.
  
  <!-- entry: fix -->
- 5eac231: An outline name that is not registered paints as the registered `rect`, including one a `registerOutline('rect', …)` put there.
  
  <!-- entry: fix visual -->
- ee18e9e: `DiagramView`'s connect previews with the router its reported edge draws with: `portOptions.router`, which the edge names, else `'bezier'`.
  
  <!-- entry: fix visual -->
- eba59c7: The diagram's once-per-name warnings remember at most 256 names, so a long session no longer keeps every one.
  
  <!-- entry: rank=-5 perf -->
- 4ad74a4: diagram's document bounds and diagram-formats' export read world poses through core's `worldPoses`.
  
  <!-- entry: internal -->
- b7d8fb2: Edge-end handles, reconnects, waypoint handles and route commands resolve an edge's ends on the plane the `frame` option names.
  
  <!-- entry: fix -->
- c64e46f: Double-clicking an edge's end label edits that label, rather than the edge's middle label.
  
  <!-- entry: fix -->
- 23e50c1: `runPipeline` closes the previews it made when its signal aborts partway, so an effect runner reset mid-run no longer leaks them.
  
  <!-- entry: fix -->
- 78aa95d: An audio stage missing a discrete setting, such as a noise stage saved without its color, plays with its stage type's default.
  
  An unknown wave, filter type or noise color is reported on its stage before any engine exists.
  
  <!-- entry: fix -->
- 15bd121: A cluster that two clusters name is dragged by its title among the members of the first, the cluster it is drawn in.
  
  <!-- entry: fix -->
- ec49e8c: Dragging or resizing an effect cluster whose clusters hold each other in a loop no longer hangs the editor.
  
  <!-- entry: fix -->
- 6d731a9: An effect chart or editor whose pipeline has two wires sharing an id draws both, the second in the warning color, instead of throwing.
  
  <!-- entry: fix -->
- 6cf8816: An effect stage whose `type` names an `Object.prototype` member, such as `toString`, fails with "no evaluator" instead of rejecting the run.
  
  <!-- entry: fix -->
- 7cbda84: Clearing `sources` in `useFollowAudioRunner` takes the old buffer away from the live runner.
  
  A file stage stops playing it and reports that it has no source audio.
  
  <!-- entry: fix -->
- c6aae22: Adding a stage in the effect editor no longer hangs the page when the view is panned far from the origin.
  
  <!-- entry: fix -->
- 4b25e60: Pressing a group title in the effect editor no longer overflows the stack when the pipeline's groups hold each other in a loop.
  
  <!-- entry: fix -->
- 708d9a3: Grouping or moving an effect group together with one of its own members keeps the group, the member still inside it.
  
  <!-- entry: fix -->
- 44892a1: A live audio stage whose node fails to build, such as a 0-second reverb, shows the error on its stage.
  
  The stage is left out of the graph, and the rest of the pipeline keeps playing and following edits.
  
  <!-- entry: fix -->
- 85c4174: A live audio runner keeps following edits after an edit whose new source failed to start.
  
  <!-- entry: fix -->
- da46a5c: A live audio wire into a port its node lacks is left out of the graph and named on that stage.
  
  The rest of the pipeline keeps following edits.
  
  <!-- entry: fix -->
- 6debed8: Pausing or resetting a live audio runner while `play()` waits for the engine to unlock keeps it stopped once the unlock finishes.
  
  <!-- entry: fix -->
- 8da4737: When one stage's level change fails in a live audio runner, the other stages' level changes in the same edit still reach the graph.
  
  <!-- entry: fix -->
- 360ef8d: The rack and lanes looks put a looped pipeline's longest path on their main line whatever order its stages are listed in.
  
  <!-- entry: fix visual -->
- 6cf8816: An effect stage input named for an `Object.prototype` member, such as `constructor`, takes the value wired into it.
  
  <!-- entry: fix -->
- e8957b6: A value kind whose `show` or `preview` throws fails only its stage, as a throwing evaluator does. The previews already made for that stage are closed.
  
  <!-- entry: fix -->
- 23e50c1: An effect runner's `dispose` works when called on its own, as `subscribe` already did.
  
  <!-- entry: fix -->
- 23e50c1: An effect runner step under way when the pipeline or sources change starts over on the new ones, and frees what the dropped step made.
  
  <!-- entry: fix -->
- 3fc3c93: The ERD entity stencil's fields read type first, then name and keys (`int` / `id PK`), so a placed entity exports with its keys.
  
  <!-- entry: fix data -->
- 2b51070: A hop right by a bend, or exactly two radii from the next, draws instead of vanishing when its stored position was rounded.
  
  <!-- entry: fix visual -->
- 711846c: While dragging, a connector another follower reroutes, as avoid routing does, hides its line jumps, as do the connectors jumping over it.
  
  <!-- entry: fix visual -->
- bf0869d: While dragging, a connector attached to a node whose pose derives from the dragged one hides its line jumps.
  
  This includes a container that fits its children, when a child is dragged.
  
  <!-- entry: fix visual -->
- 012eac4: While dragging with line jumps on, a connector keeps the pose the drag or an earlier follower gives it instead of its stored one.
  
  <!-- entry: fix visual -->
- 280f109: A connector rerouted while locked gets line jumps for its new route at the first edit after it is unlocked.
  
  <!-- entry: fix -->
- 1bc1b5c: After an undo, redo, `loadState` or untracked write, the next edit computes line jumps against the routes the scene has then.
  
  <!-- entry: fix -->
- fc2594c: A hidden connector, or one on a hidden layer, no longer makes the connectors crossing it jump.
  
  Hiding or showing one recomputes the jumps around it.
  
  <!-- entry: fix visual -->
- 6a5449e: A connector hops a crossing near a vertex its route runs straight through: `edgeHops` and `withHops` treat only real bends as bends.
  
  <!-- entry: fix visual -->
- cb89cf1: An item drag asks the host again for a drop whose target and container ids join like another's.
  
  <!-- entry: fix -->
- 09d5ade: A layered layout keeps two hops apart when their end and edge ids run together.
  
  <!-- entry: fix -->
- 601b526: A layered edge between two level pins goes around past a node between them that reaches further toward the next rank than either end.
  
  <!-- entry: fix visual -->
- 08979e8: A layered edge between two level pins goes around a cluster box between them that neither end is in, rather than straight through it.
  
  <!-- entry: fix visual -->
- 19f10ce: A layered layout places the long edge between two level pins by its ends on every pass, rather than at the last pass's detour.
  
  <!-- entry: fix -->
- 2a875e8: A layered layout leaves a long edge's run in place when it lies inside the box a cluster's `minWidth` widens.
  
  <!-- entry: fix visual -->
- 0325a0e: A layered layout keeps pins clear of a cluster's box as drawn, widened to its `minWidth`.
  
  A nested cluster pads its parent's column only on the side it reaches, so a pin just clear of the drawn box is no longer refused.
  
  <!-- entry: fix visual -->
- 56784d5: Comparisons of two lists entry by entry go through registry's `sameList` rather than hand-written loops.
  
  <!-- entry: internal -->
- 3a0ae45: A live layout that restarts or fails mid-run no longer leaves edges drawn along the abandoned run's routes.
  
  <!-- entry: fix visual -->
- bdd33c6: The mind map's subtopic stencil is a plain box, a shape Mermaid mind maps hold, so a palette map exports without a warning.
  
  <!-- entry: fix visual -->
- 060c64c: `useMirroredSelection` tells a one-id `selected` from a set, and two sets apart, whatever their ids hold.
  
  <!-- entry: fix -->
- 4d0042b: A port on an outline drawn in separate pieces, such as `person`'s head and body, sits on a piece, not in the gap.
  
  <!-- entry: fix -->
- 65dfc8b: Reconnecting an edge end under a `frame` places the edge's other end, and its handles, on that frame's plane, where the candidate ports are.
  
  <!-- entry: fix -->
- 85fc2ee: Remove waypoint leaves a locked or hidden connector alone, as its handles are not drawn there, rather than throwing on a locked one.
  
  <!-- entry: fix -->
- 7fdffc0: A press on a node whose cluster boxes hold each other through `dependsOn` no longer hangs the reorder action.
  
  <!-- entry: fix -->
- 47f47ae: Reset route is disabled with `ActionDisabledReason.Locked` while a selected connector it would clear is locked.
  
  <!-- entry: fix -->
- 897ac02: A sequence activation still open where its lifeline is destroyed ends at the destruction's cross, not the diagram's foot.
  
  <!-- entry: fix visual -->
- 000d836: `setMessageArrow` leaves the data as it was for an arrow differing only by an explicit `both: false` or `async: false`.
  
  So it no longer commits an empty undo entry.
  
  <!-- entry: fix -->
- f7968a0: `insertMessage` and `setMessageArrow` throw, naming it, on an arrow name not in `SEQ_ARROWS`, and the Message tool draws a call for one.
  
  <!-- entry: fix -->
- e67a371: A sequence box never draws around a lifeline it does not hold when a participant is dragged or added.
  
  One landing between two members of a box joins it, and a member dragged away from the rest of its box leaves it.
  
  <!-- entry: fix -->
- 44ea8a6: Dragging a sequence message or fragment previews all of it, a number's digit and a fragment's label and steps included.
  
  <!-- entry: fix visual -->
- cd86873: A sequence diagram with any locked part takes no edit, and `commitSequence` leaves it as it stands rather than throwing.
  
  <!-- entry: fix -->
- 894f261: A sequence message whose `head` names an `Object.prototype` member, such as `toString`, is drawn with no arrowhead.
  
  <!-- entry: fix -->
- 894f261: `sequenceSpecs` throws, naming the id, when two parts would share a scene id, as a participant `A/text` beside `A` would.
  
  <!-- entry: fix -->
- e408338: The Participant tool's click on empty canvas starts a sequence whose lifeline stands at the click, under any theme's font.
  
  <!-- entry: fix -->
- 0177219: Readers of saved shapes take only a plain object where they expect a record, as registry's `isPlainObject` says.
  
  That is scene snapshots and documents, DTCG color values, diagram theme files and compound menu values. A class instance, `Map` or `Date` in their place, which no JSON text can produce, is now refused as a wrong shape instead of read as a record.
  
  <!-- entry: rank=-5 behavior -->
- b915832: `createSpecHops`, and a `DiagramView` given `hops`, no longer make an edge hop over a hidden edge spec or one inside a hidden spec.
  
  <!-- entry: fix visual -->
- 962563d: `createSpecLabelPlacer` places a label again when only its `inset` changes.
  
  <!-- entry: fix -->
- db6b387: `createSpecLabelPlacer` places a split connector's label on the stubs it draws. Other labels no longer dodge the undrawn line between its pages.
  
  <!-- entry: fix visual -->
- 41149dd: `createSpecRouter` routes an edge between two nodes outside a cluster around the cluster's box, as avoid routing on a live scene does.
  
  <!-- entry: fix -->
- 73e93db: `createSpecRouter` routes a self-loop that names both its ports, as avoid routing on a live scene does.
  
  <!-- entry: fix -->
- 3fbc4d6: `useStencilInsert` warns in development when a tool inserts a stencil it was not handed, such as a container with no `containers` option.
  
  <!-- entry: fix -->
- 0f77df5: A stencil-inserted shape's rows keep their places through a theme change or a font remeasure.
  
  <!-- entry: fix visual -->
- 2a7c91b: A stencil's body sizes its rows for the `font` they are drawn in, as `diagramScene` does, so a larger face no longer overflows its row.
  
  <!-- entry: fix visual -->
- d97fb3b: Badge shapes and effects, `CurveEditor`'s curves and BPMN outlines write SVG numbers with `trimNumber`: `100.00` is now `100`.
  
  <!-- entry: rank=-5 internal -->
- 017fa7a: The UML abstract-class stencil carries `<<abstract>>` and marks `draw()*`, so it exports to Mermaid as abstract.
  
  <!-- entry: fix data -->
- 5f6c2d7: The UML interface stencil's stereotype reads `<<interface>>`, so a placed interface exports to Mermaid as an interface.
  
  <!-- entry: fix data -->
- f652afe: `useEffectRunner` lets go of `sources`, `kinds`, `previews` or `previewSize` once the caller stops passing it, so the next run uses the default.
  
  <!-- entry: fix -->
- 5b8e066: These packages watch for resizes through react's `watchResize` rather than a `ResizeObserver` of their own.
  
  <!-- entry: internal -->
- 4254248: Moving both ends of a locked connector moves the ends and leaves its waypoints where they are, not refusing the move.
  
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
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [9c88969]
- Updated dependencies [d764d06]
- Updated dependencies [f1bc116]
- Updated dependencies [76b3ad2]
- Updated dependencies [8994b94]
- Updated dependencies [3e90820]
- Updated dependencies [cefbb9f]
- Updated dependencies [a124808]
- Updated dependencies [dec059b]
- Updated dependencies [acb98a5]
- Updated dependencies [f2eb510]
- Updated dependencies [c8a41db]
- Updated dependencies [5aaee6b]
- Updated dependencies [de547d5]
- Updated dependencies [420e20a]
- Updated dependencies [b550d25]
- Updated dependencies [139e26a]
- Updated dependencies [b5b0782]
- Updated dependencies [0bcb260]
- Updated dependencies [670ec07]
- Updated dependencies [99c457e]
- Updated dependencies [3b7ffd3]
- Updated dependencies [3b7ffd3]
- Updated dependencies [7a9a5c7]
- Updated dependencies [357c9f1]
- Updated dependencies [e765b9c]
- Updated dependencies [12ded8a]
- Updated dependencies [e225656]
- Updated dependencies [50e06ce]
- Updated dependencies [df2ae04]
- Updated dependencies [c8c9daa]
- Updated dependencies [e0afaa7]
- Updated dependencies [4b16186]
- Updated dependencies [5aa7bc1]
- Updated dependencies [6b9ca79]
- Updated dependencies [2a07382]
- Updated dependencies [e3b0356]
- Updated dependencies [9bd892d]
- Updated dependencies [feec844]
- Updated dependencies [f834acb]
- Updated dependencies [19d6faa]
- Updated dependencies [9fa0d8d]
- Updated dependencies [2c152a0]
- Updated dependencies [2d723fd]
- Updated dependencies [dce9e3e]
- Updated dependencies [ca79b0e]
- Updated dependencies [00ef3bb]
- Updated dependencies [460b0ac]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [a98ad34]
- Updated dependencies [5f856dc]
- Updated dependencies [2395f92]
- Updated dependencies [8ec33cf]
- Updated dependencies [bf69022]
- Updated dependencies [e3f3d97]
- Updated dependencies [3edbcb1]
- Updated dependencies [78aa95d]
- Updated dependencies [92c64fe]
- Updated dependencies [daccd3c]
- Updated dependencies [9a73a90]
- Updated dependencies [9a9fbab]
- Updated dependencies [aca518c]
- Updated dependencies [67c3b2c]
- Updated dependencies [ecf98ab]
- Updated dependencies [193c9dc]
- Updated dependencies [ecf98ab]
- Updated dependencies [4c1e42c]
- Updated dependencies [ad37a86]
- Updated dependencies [73ed793]
- Updated dependencies [1ed1116]
- Updated dependencies [6eb73fc]
- Updated dependencies [78a0bd6]
- Updated dependencies [f9a83f5]
- Updated dependencies [1f5fce4]
- Updated dependencies [8f614dd]
- Updated dependencies [1187c1d]
- Updated dependencies [1006f01]
- Updated dependencies [d62b081]
- Updated dependencies [577483a]
- Updated dependencies [5d46bea]
- Updated dependencies [dba05ed]
- Updated dependencies [5fad4f9]
- Updated dependencies [5161d64]
- Updated dependencies [013e9cb]
- Updated dependencies [df2ae04]
- Updated dependencies [6b1a5a6]
- Updated dependencies [9bc4172]
- Updated dependencies [9629632]
- Updated dependencies [426933f]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [f2ba5e1]
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
- Updated dependencies [74f7bf4]
- Updated dependencies [9249b26]
- Updated dependencies [f20931c]
- Updated dependencies [15072f4]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [edcd3a6]
- Updated dependencies [3bf5d6c]
- Updated dependencies [b5d4882]
- Updated dependencies [21d7e6b]
- Updated dependencies [ff7314a]
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
- Updated dependencies [174d6ef]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [e8df1fc]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [7f1cc2d]
- Updated dependencies [af88833]
- Updated dependencies [b29cf9e]
- Updated dependencies [6821bac]
- Updated dependencies [9707f7c]
- Updated dependencies [f88b38b]
- Updated dependencies [b68c9a2]
- Updated dependencies [39f4ad4]
- Updated dependencies [a66885d]
- Updated dependencies [b90239c]
- Updated dependencies [35a99f3]
- Updated dependencies [687d98f]
- Updated dependencies [105a6bf]
- Updated dependencies [c71fb10]
- Updated dependencies [cc3910a]
- Updated dependencies [4f451f8]
- Updated dependencies [cf2a57b]
- Updated dependencies [7a5e072]
- Updated dependencies [bb5880a]
- Updated dependencies [29d293c]
- Updated dependencies [a63b723]
- Updated dependencies [0c07b8d]
- Updated dependencies [a83c9bd]
- Updated dependencies [14a0949]
- Updated dependencies [76a1854]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
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
- Updated dependencies [d917fd4]
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
- Updated dependencies [935346c]
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
- Updated dependencies [cfc0732]
- Updated dependencies [711be7d]
- Updated dependencies [3a8b706]
- Updated dependencies [471581b]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [fcc5602]
- Updated dependencies [f6ee3ea]
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
- Updated dependencies [f9b150c]
- Updated dependencies [583bd6d]
- Updated dependencies [d353c85]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [b6863aa]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [36dac61]
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
- Updated dependencies [cbd9a26]
- Updated dependencies [c3da9af]
- Updated dependencies [824eca6]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [8c17e91]
- Updated dependencies [50900c3]
- Updated dependencies [d916cae]
- Updated dependencies [98df398]
- Updated dependencies [77670c1]
- Updated dependencies [c131bff]
- Updated dependencies [c117e62]
- Updated dependencies [89f4197]
- Updated dependencies [95a1a63]
- Updated dependencies [a343f1b]
- Updated dependencies [221fe20]
- Updated dependencies [cc5b0c3]
- Updated dependencies [9455fc1]
- Updated dependencies [6606d90]
- Updated dependencies [5879169]
- Updated dependencies [959af37]
- Updated dependencies [890ce71]
- Updated dependencies [5e44587]
- Updated dependencies [da15963]
- Updated dependencies [e95a396]
- Updated dependencies [8e5f1cf]
- Updated dependencies [57df97b]
- Updated dependencies [4daf896]
- Updated dependencies [dbf591e]
- Updated dependencies [d4a593d]
- Updated dependencies [662f94f]
- Updated dependencies [956a71a]
- Updated dependencies [7001f43]
- Updated dependencies [558f742]
- Updated dependencies [39422f9]
- Updated dependencies [b1cfa76]
- Updated dependencies [bb7be0b]
- Updated dependencies [1cee200]
- Updated dependencies [9339b45]
- Updated dependencies [4be1a3f]
- Updated dependencies [787c496]
- Updated dependencies [37514fc]
- Updated dependencies [bebd64f]
- Updated dependencies [4baee32]
- Updated dependencies [8745b50]
- Updated dependencies [df2ae04]
- Updated dependencies [7dbeddb]
- Updated dependencies [dbf591e]
- Updated dependencies [839a4b2]
- Updated dependencies [1810479]
- Updated dependencies [d598b83]
- Updated dependencies [8257aa7]
- Updated dependencies [8c2d558]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [65e8ece]
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
- Updated dependencies [8882b53]
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
- Updated dependencies [ef687f1]
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
- Updated dependencies [921e20e]
- Updated dependencies [2202a32]
- Updated dependencies [f522122]
- Updated dependencies [36dc93a]
- Updated dependencies [36b25c8]
- Updated dependencies [87f3d38]
- Updated dependencies [11b0336]
- Updated dependencies [00a0e96]
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
- Updated dependencies [0bb9ac6]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [6661cbf]
- Updated dependencies [dc881e4]
- Updated dependencies [7b298cb]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [fa5c2d9]
- Updated dependencies [4810ef4]
- Updated dependencies [4bda721]
- Updated dependencies [744fbce]
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
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [e4a8c4f]
- Updated dependencies [e4a8c4f]
- Updated dependencies [a791e92]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [968362b]
- Updated dependencies [fd2cbc8]
- Updated dependencies [c5e5476]
- Updated dependencies [d7de41f]
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
- Updated dependencies [e06225e]
- Updated dependencies [e0f4c91]
- Updated dependencies [38095a2]
- Updated dependencies [d30164d]
- Updated dependencies [04d5af6]
- Updated dependencies [04d5af6]
- Updated dependencies [c98a300]
- Updated dependencies [04d5af6]
- Updated dependencies [e7d580b]
- Updated dependencies [cdbafb8]
- Updated dependencies [3005391]
- Updated dependencies [3311dde]
- Updated dependencies [5b11625]
- Updated dependencies [afbe8c3]
- Updated dependencies [8bf1866]
- Updated dependencies [c4bcb94]
- Updated dependencies [7785bd5]
- Updated dependencies [e59f1ae]
- Updated dependencies [a8ff1e9]
- Updated dependencies [25e8f76]
- Updated dependencies [3a07b60]
- Updated dependencies [b73c8ef]
- Updated dependencies [6274bad]
- Updated dependencies [758459f]
- Updated dependencies [70213a5]
- Updated dependencies [b72cf48]
- Updated dependencies [b34f11e]
- Updated dependencies [04d5af6]
- Updated dependencies [5603bef]
- Updated dependencies [126d17f]
- Updated dependencies [d17a134]
- Updated dependencies [4e68cf0]
- Updated dependencies [ff5f066]
- Updated dependencies [f164d0e]
- Updated dependencies [586ca31]
- Updated dependencies [ba8d3a0]
- Updated dependencies [857e1fc]
- Updated dependencies [d868c48]
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
- Updated dependencies [59e80c0]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
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
- Updated dependencies [f5e0446]
- Updated dependencies [f6c305d]
- Updated dependencies [00a1f20]
- Updated dependencies [6451f0c]
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
- Updated dependencies [fd6c009]
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
- Updated dependencies [9521334]
- Updated dependencies [0177219]
- Updated dependencies [091bd67]
- Updated dependencies [670aeb3]
- Updated dependencies [6a9b37e]
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
- Updated dependencies [6222db5]
- Updated dependencies [cfebac4]
- Updated dependencies [415e5b8]
- Updated dependencies [033c46f]
- Updated dependencies [e68cb62]
- Updated dependencies [bf09aae]
- Updated dependencies [c6fbf4b]
- Updated dependencies [88a5b5e]
- Updated dependencies [29135cb]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [16e4b0b]
- Updated dependencies [7bc2c18]
- Updated dependencies [dc5efa8]
- Updated dependencies [510347b]
- Updated dependencies [8f28726]
- Updated dependencies [fb69a95]
- Updated dependencies [a45338c]
- Updated dependencies [fb69a95]
- Updated dependencies [3f575e2]
- Updated dependencies [c6b831f]
- Updated dependencies [4f9848f]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [ff8c1f9]
- Updated dependencies [a6e8651]
- Updated dependencies [26cdc89]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [c11f37e]
- Updated dependencies [cb6e47b]
- Updated dependencies [e39dbc5]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [1347e05]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [98d2f9a]
- Updated dependencies [ad94222]
- Updated dependencies [4069e86]
- Updated dependencies [201717b]
- Updated dependencies [cf2ad81]
- Updated dependencies [6bdf14d]
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
- Updated dependencies [2b0def2]
- Updated dependencies [80b8f57]
- Updated dependencies [1a9548b]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [012b439]
- Updated dependencies [780c368]
- Updated dependencies [b5e97b8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [42af0bf]
- Updated dependencies [de2d442]
- Updated dependencies [4c592ae]
- Updated dependencies [3a28bbb]
- Updated dependencies [6fb8869]
- Updated dependencies [a0d5f84]
- Updated dependencies [6153ae7]
- Updated dependencies [6a06f54]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [e970fad]
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
- Updated dependencies [cbf500e]
- Updated dependencies [c5a7102]
- Updated dependencies [3871e2f]
- Updated dependencies [c3f3d9a]
- Updated dependencies [5548d73]
- Updated dependencies [e824816]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [45559fc]
- Updated dependencies [685bc3d]
- Updated dependencies [6111c56]
- Updated dependencies [bce203a]
- Updated dependencies [accc590]
- Updated dependencies [4b0b9df]
- Updated dependencies [f9ed89f]
- Updated dependencies [cea89d2]
- Updated dependencies [a23ebea]
- Updated dependencies [8d3c536]
- Updated dependencies [62aede0]
- Updated dependencies [e3a1721]
- Updated dependencies [72544b9]
- Updated dependencies [0cc203a]
- Updated dependencies
- Updated dependencies [86019a4]
- Updated dependencies [fd2cbc8]
- Updated dependencies [4bee28f]
- Updated dependencies [50cf32b]
- Updated dependencies [9d1f28d]
- Updated dependencies [f4115e7]
- Updated dependencies [c62a3d3]
- Updated dependencies [67cb364]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [d497853]
- Updated dependencies [d4888dd]
- Updated dependencies [91bd051]
- Updated dependencies [e2f8ef6]
- Updated dependencies [f19cbf2]
- Updated dependencies [9e1861a]
- Updated dependencies [8992639]
- Updated dependencies [eb5c5f9]
- Updated dependencies [e0e02f9]
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
- Updated dependencies [774e9cc]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [1fe6cab]
- Updated dependencies [0481f49]
- Updated dependencies [b8bb2d4]
- Updated dependencies [6276cc6]
- Updated dependencies [6276cc6]
- Updated dependencies [677a841]
- Updated dependencies [b8bb2d4]
- Updated dependencies [cafdd8c]
- Updated dependencies [969aab0]
- Updated dependencies [61c9926]
- Updated dependencies [09dcf56]
- Updated dependencies [5024537]
- Updated dependencies [7489853]
- Updated dependencies [a0d7dfc]
- Updated dependencies [7d77794]
- Updated dependencies [8fb09ad]
- Updated dependencies [ba7e062]
- Updated dependencies [a5c1865]
- Updated dependencies [0d977b8]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [371b695]
- Updated dependencies [bdc9108]
- Updated dependencies [0c18df0]
- Updated dependencies [d268d21]
- Updated dependencies [c4783b4]
- Updated dependencies [de9d942]
- Updated dependencies [cdede50]
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
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [12816b7]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [5b8e066]
- Updated dependencies [fca9c3c]
- Updated dependencies [087e02c]
- Updated dependencies [abdc064]
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
  - @weasel-js/geom@2.0.0
  - @weasel-js/animator@2.0.0
  - @weasel-js/ui-input@2.0.0
  - @weasel-js/quantity@2.0.0
  - @weasel-js/audio@2.0.0
  - @weasel-js/text@2.0.0
  - @weasel-js/font@2.0.0
  - @weasel-js/text-tools@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/clock@2.0.0
  - @weasel-js/react@2.0.0
  - @weasel-js/icons@2.0.0
  - @weasel-js/prefs-schema@2.0.0
  - @weasel-js/simulation@2.0.0

## 1.19.1

### Minor Changes

- 4916272: `reorderPreset` and `groupReorderPreset` install a reorder that works beside the `move` feature.
  
  Pass one in `features` rather than `ambient`: its drag is tried ahead of the move's on the same press, and hands off to the move once it leaves `region`.
  
  ```tsx
  <SceneCanvas features={['pick', 'move', reorderPreset({ slots, region, commit })]} />
  ```
  
  <!-- entry: api -->

### Patch Changes

- d74dbb8: A diagram frees a swapped-out picture once its replacement fails to load, rather than holding it decoded while the failure is drawn.
  
  <!-- entry: fix -->
- 413ee4c: `<DiagramView>` turns its keyboard shortcuts on for `onDelete` even with `pickEdges={false}`, and no longer for `pickEdges` alone.
  
  <!-- entry: fix -->
- 1ba8505: A node whose outline is registered, or unregistered, after the node was first drawn is painted and picked by its new outline.
  
  <!-- entry: fix -->
- 3d476d8: A `registerOutline` disposer removes only its own registration, even when run twice or when one definition is registered twice.
  
  <!-- entry: fix -->
- 4916272: `DiagramView` with `onReorder` and `onMove` reorders a container member dragged within its container, and moves it once dragged out.
  
  <!-- entry: rank=5 fix -->
- d66e6e4: `DiagramView` gives a shape resize handles only with `onResize`, and a container or pool only with `onEditContainer`.
  
  <!-- entry: fix -->
- 95d4dc0: `<DiagramView selected>` selects a node that arrives in the same render as the prop naming it, such as a stage just added from a palette.
  
  <!-- entry: fix -->
- 9496bb6: `DiagramView` and the effect editor no longer free the images and preview textures they still draw when React StrictMode remounts them.
  
  <!-- entry: fix perf -->
- ce1f1a7: A pen's eraser end presses, drags and draws on a canvas and on kit controls as its tip does; its barrel button is a secondary press.
  
  `isPrimaryPress(e)` and `pressButtonOf(e)` are new, exported from `@weasel-js/gestures` (and `isPrimaryPress` from `@weasel-js/routing` and `@weasel-js/core`): the one answer to which button a pointer press was made with.
  
  <!-- entry: fix api -->
- c65c8dd: A sequence drag's custom `commit` receives the deps its drag started with, `applyOps` included, when the dispatcher drives it.
  
  <!-- entry: fix -->
- Updated dependencies [e17dbd6]
- Updated dependencies [c91c39c]
- Updated dependencies [d65a34b]
- Updated dependencies [5159b4f]
- Updated dependencies [c93b396]
- Updated dependencies [c9adfef]
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
- Updated dependencies [08dd689]
- Updated dependencies [58298fa]
- Updated dependencies [97be45c]
- Updated dependencies [71c3f85]
- Updated dependencies [7e954c5]
- Updated dependencies [5159b4f]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [216d193]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [039b7ad]
- Updated dependencies [d254251]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [0cbbb94]
- Updated dependencies [8562ebe]
- Updated dependencies [6d1a52e]
- Updated dependencies [ca3a89a]
- Updated dependencies [5461e84]
- Updated dependencies [5c64825]
- Updated dependencies [8941d77]
- Updated dependencies [f611d11]
- Updated dependencies [e6959cc]
- Updated dependencies [59485d4]
- Updated dependencies [141697f]
- Updated dependencies [28404b3]
- Updated dependencies [e17dbd6]
- Updated dependencies [b4e8f97]
- Updated dependencies [3fd5c6f]
- Updated dependencies [250c105]
- Updated dependencies [a09ed24]
- Updated dependencies [8562ebe]
- Updated dependencies [16900c1]
- Updated dependencies [2c3416d]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/animator@1.19.1
  - @weasel-js/core@1.19.1
  - @weasel-js/ui-input@1.19.1
  - @weasel-js/quantity@1.19.1
  - @weasel-js/font@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/simulation@1.19.1
  - @weasel-js/clock@1.19.1
  - @weasel-js/icons@1.19.1
  - @weasel-js/audio@1.19.1

## 1.19.0

### Patch Changes

- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- 01eac83: Spreading parallel connector runs apart no longer pushes one into a shape's clearance. A connector the update did not reroute, whose run would be spread back beside a shape that moved next to it, is rerouted.
  
  <!-- entry: fix visual -->
- b1309b2: The obstacle-avoiding router retries a connector with no path only when something it depends on changes, rather than on every update. A connector that a label's interim spot blocked is routed in the same update.
  
  <!-- entry: perf fix -->
- b1309b2: Moving a whole diagram moves its obstacle-avoiding routes with it, rather than switching between equally short paths.
  
  <!-- entry: fix visual -->
- b1309b2: `canvasMeasure` reports a `capCenter` of 0 for a 0px font, rather than `NaN`.
  
  <!-- entry: rank=-5 fix -->
- 5e38ac7: An item's `colors` holding a `__proto__` key, as `JSON.parse` reads one, stays a plain key of the style `diagramScene` draws it in.
  
  <!-- entry: rank=-5 fix -->
- 814ff67: An eased live layout lands each node exactly on its target on the last frame. It also stays finite easing between the two ends of the double range.
  
  <!-- entry: rank=-5 fix -->
- 93d0c9d: The force layout pushes a node or group sitting inside another group's box clear of that box in one tick, past its far edge by the padding.
  
  <!-- entry: fix visual -->
- b1309b2: `labelSpotAt` reads a route fraction inside 0 to 1 for a label at a vertex beside a stretch too short to see.
  
  <!-- entry: rank=-5 fix -->
- 9263a07: A connector label dropped back where it stood no longer jumps to another stretch of its route. `labelSpotAt` reads a label two stretches are equally near on the stretch that stands it where it is.
  
  <!-- entry: fix -->
- 6d1672c: `radial`, and `layered` and `tree` with more than one pinned node, move nothing on a second run, as every layout promises.
  
  <!-- entry: fix -->
- b123a8b: A live layout no longer mistakes two graphs for one when node ids hold `>`, `,` or `|`, so a stale plan cannot land on a changed graph.
  
  <!-- entry: rank=-5 fix -->
- 7a7c2ef: The `orthogonal` and `bezier` routers stay finite between ports and waypoints near the ends of the double range.
  
  <!-- entry: rank=-5 fix -->
- f4d1040: Where nothing measures text, a diagram row, edge label or header estimates one glyph per character, so an emoji no longer counts twice.
  
  <!-- entry: fix -->
- 48ef8f7: `diagramScene` refuses data in which two specs would share an id, with an error naming the id. That covers a node named like another item's part (`a/1` beside a node `a`, or `G/label` inside a titled group `G`), an edge whose `id` is a node's, and one edge `id` given to two different edges. An exact repeat of an edge is still dropped.
  
  <!-- entry: behavior fix -->
- 8ccd5eb: A self-edge on a node with no east-facing port loops at the same corner however the node's ports are listed, taking the north-facing side.
  
  <!-- entry: rank=-5 fix visual -->
- 69f482f: `formatParam` shows every decimal place of a step written in exponent form: a step of `1.5e-7` shows eight places. `@weasel-js/diagram` now depends on `@weasel-js/quantity`.
  
  <!-- entry: fix -->
- 471752d: The `force` layout no longer flings nodes that start on or near the same point thousands of units apart. Repulsion treats two bodies as at least 10 world units apart, so a stacked pair settles at the spacing a separated pair does.
  
  <!-- entry: fix visual -->
- 30c0e8e: A unit catalog in `@weasel-js/quantity` gives each unit one symbol, compact form and spoken name, read wherever units are shown or typed.
  
  Each entry has a unit's canonical name, its symbol, a compact form for tight spaces (`″` for `in`, `′` for `ft`), the aliases that read as it, its spoken names or `Intl` unit, its CSS unit, and whether its glyph attaches to the number (`°`, `′`, `″`, `%`). `catalogUnit`, `unitSymbol`, `unitSpellings`, `withUnit` and `speakUnit` read it, and `registerUnit` adds or replaces a unit and returns a function that takes it back out. The `unit` display, the bytes and duration displays' speech, `parseNumber`'s alternate spellings and `prefsCss`'s CSS units all read the catalog, in place of the tables each kept.
  
  `UnitDisplay` and a prefs unit take `compact: true` for a unit's compact form, and a unit is written as the catalog writes it, so `unit('deg')` and a prefs unit with `suffix: 'deg'` show `°`.
  
  In `@weasel-js/ui`, a field's or readout's unit whose glyph attaches stays on the value's line in every layout, including an inline slider row that hangs word units below its readout, and is out of flow, so the field is the same size with it as without. The catalog decides which units attach: a property field's string `unit`, a menu number row's `suffix` and a read-only readout all ask it. `QuantityText`'s `unit` takes `compact` and marks an attaching unit `data-attach`.
  
  Breaking: `unit('"')` now shows `12″` and `unit("'")` shows `1′`, the compact forms those marks are aliases of, and a unit named by an alias shows its symbol (`deg` shows `°`). A degree passed as `<sup>°</sup>` still draws as given but no longer attaches; pass the string `'°'`. `ResolvedPrefUnit.suffix` is the text a field shows, the catalog's form of the one written. Typed text reads every spelling the catalog knows for a unit a table accepts, so a field accepting `deg` also reads `°`. A scale indicator's label is spoken through the catalog, `Scale: 10 feet`.
  
  <!-- entry: rank=20 breaking api new visual pick -->
- Updated dependencies [0896b71]
- Updated dependencies [aaeec8d]
- Updated dependencies [bbfb059]
- Updated dependencies [8d3f30f]
- Updated dependencies [24fe08a]
- Updated dependencies [ebc9f52]
- Updated dependencies [63ce1c6]
- Updated dependencies [ec703b3]
- Updated dependencies [eb8743c]
- Updated dependencies [871e410]
- Updated dependencies [5be32af]
- Updated dependencies [857c097]
- Updated dependencies [b1309b2]
- Updated dependencies [ee0609a]
- Updated dependencies [2f08388]
- Updated dependencies [eefb1a0]
- Updated dependencies [9abfeda]
- Updated dependencies [6b016f5]
- Updated dependencies [3994bb8]
- Updated dependencies [4920b0f]
- Updated dependencies [944c448]
- Updated dependencies [587a69e]
- Updated dependencies [6b016f5]
- Updated dependencies [0f566f9]
- Updated dependencies [233a559]
- Updated dependencies [e0ea2ba]
- Updated dependencies [b37ae7a]
- Updated dependencies [626d76d]
- Updated dependencies [6f8374d]
- Updated dependencies [1840e27]
- Updated dependencies [93ed93d]
- Updated dependencies [65ee9a0]
- Updated dependencies [3932826]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [b1309b2]
- Updated dependencies [153719c]
- Updated dependencies [bce00fd]
- Updated dependencies [98a8020]
- Updated dependencies [6d7aae1]
- Updated dependencies [326d7be]
- Updated dependencies [2740ed4]
- Updated dependencies [6ff27f5]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [cd31516]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [056d901]
- Updated dependencies [a5c9cf0]
- Updated dependencies [0717d38]
- Updated dependencies [0dd9f6e]
- Updated dependencies [88147f8]
- Updated dependencies [e97950f]
- Updated dependencies [874d96f]
- Updated dependencies [1b65290]
- Updated dependencies [309adac]
- Updated dependencies [0a8d096]
- Updated dependencies [4355423]
- Updated dependencies [9ce04e0]
- Updated dependencies [5bd979f]
- Updated dependencies [ca98945]
- Updated dependencies [b0e09ef]
- Updated dependencies [9975edb]
- Updated dependencies [88b4697]
- Updated dependencies [0e15698]
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
- Updated dependencies [c913ef0]
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [3b3289a]
- Updated dependencies [fbb67d5]
- Updated dependencies [68383ed]
- Updated dependencies [a43fd34]
- Updated dependencies [d83feb6]
- Updated dependencies [14398f2]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [faaeb54]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [7a7c2ef]
- Updated dependencies [041dbf7]
- Updated dependencies [4ff3e3e]
- Updated dependencies [785627a]
- Updated dependencies [3e4a895]
- Updated dependencies [302c660]
- Updated dependencies [0cff741]
- Updated dependencies [b1309b2]
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
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [7b9e651]
- Updated dependencies [efac12a]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [2f5f287]
- Updated dependencies [eaff448]
- Updated dependencies [c7756c5]
- Updated dependencies [c7756c5]
- Updated dependencies [20c4979]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [44aa42f]
- Updated dependencies [a612a95]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [3643214]
- Updated dependencies [b8ea958]
- Updated dependencies [10199c0]
- Updated dependencies [b1309b2]
- Updated dependencies [644c5c7]
- Updated dependencies [521cab5]
- Updated dependencies [8936d41]
- Updated dependencies [8936d41]
- Updated dependencies [8936d41]
- Updated dependencies [7b56e88]
- Updated dependencies [279a193]
- Updated dependencies [521cab5]
- Updated dependencies [76da952]
- Updated dependencies [228d835]
- Updated dependencies [521cab5]
- Updated dependencies [e198aad]
- Updated dependencies [7dd964d]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [30c0e8e]
- Updated dependencies [592f6ec]
- Updated dependencies [352b221]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/geom@1.19.0
  - @weasel-js/animator@1.19.0
  - @weasel-js/audio@1.19.0
  - @weasel-js/ui-input@1.19.0
  - @weasel-js/clock@1.19.0
  - @weasel-js/font@1.19.0
  - @weasel-js/quantity@1.19.0
  - @weasel-js/icons@1.19.0
  - @weasel-js/registry@1.19.0
  - @weasel-js/simulation@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- ea6c53b: Fixes to tiled layer stacking, ruler ticks zoomed far out, the obstacle-avoiding router's spatial index, and sizes in plot and snapPoint that hung on huge values.
  
  - A tiled layer draws a `space: 'screen'` source in its place among its sources. Before, every screen-space source was drawn under all the tiled ones, so a HUD listed last sat under the backdrop.
  - `rulerTicks` lays out no ticks once labeled ones would sit under a pixel apart. Zoomed out past the longest step a unit system has (a `PIXELS` document near the zoom floor), it made hundreds of thousands to millions of ticks per ruler, every frame.
  - The obstacle-avoiding router no longer hangs on a connector whose waypoint is infinite, and no longer walks millions of cells for one a billion units away: its spatial hash checks an item or a query spanning thousands of cells by its box instead of filing or visiting each cell.
  - Packet charts hold bits per row to 1–128 and draw fields up to bit 4095 (512 bytes); radar charts draw 1–20 rings. The editors' inputs carry these maxima and clamp a larger value typed in, and a spec loaded from text is held to them when drawn. A huge value used to hang the chart: `bitsPerRow: 1e9` built a billion-key scale, a field to bit `1e12` cut billions of row pieces, and `ticks: 1e9` drew a billion rings. A NaN bits per row or ring count now falls back to the default (32, 5).
  - `snapPoint({ pattern: 'grid' })` offers at most 129 × 129 points, those around the dragged child's pose, where a spacing tiny next to the container listed billions of drop targets.
- 3d522ea: Fixes for hangs and crashes far from the origin, at a zero gap, and on Mermaid ids given twice.
  
  - A gantt task counted in days or weeks from a start past what a `Date` holds (a huge `x` or `X` date) is no longer walked day by day, which never ended.
  - `rulerTicks` lays out no ticks once the view is panned so far that ticks a step apart are one number, where the tick loop never ended.
  - `linesIn` lists no lines of a pitch that far out, where it grew an array until it threw, so a grid layer drawn there draws none.
  - `snapPoint`'s grid pattern counts its points from 0, so a dragged pose too far out for grid indices to count offers points instead of hanging.
  - A tiled parallax layer panned that far draws no copies, where its copy loop never ended.
  - The avoid router checks an item or query so far out that its cell indices stop counting by its box, where the spatial hash's cell walk never ended.
  - The avoid router files an obstacle in its visibility graph only over the search window and its points, in at most 4096 strips. An obstacle running to infinity, or spanning a vast window, ran out of memory, and a box with a NaN side left every other obstacle out of the graph.
  - `layered` with a `nodeGap` of 0 places nodes joined by a long edge at finite positions; every node landed at NaN.
  - A Mermaid architecture diagram naming a service, junction or group twice is refused, naming the line, as Mermaid refuses it. Before, it read into a page that could not be drawn or written.
  - A Mermaid mind map node repeating another's id reads with a unique one (`a_2`), as Mermaid draws both. Before, the page could not be drawn or written.
- 5d2451b: Cmd-click toggles and Shift-click selects a range, by default. This changes the defaults: anyone relying on Shift-click toggling a node, or on Cmd-click picking past groups, has to move.
  
  - `useSelection`'s `extend` key now defaults to Cmd on Apple platforms and Ctrl elsewhere, and `range` defaults to Shift. Passing `extend: 'shift'` keeps the old behavior: Shift toggles and nothing ranges.
  - On a canvas, a Shift-click selects every node a click there could select whose center lies in the box the last node clicked and the pressed one span, read where each is drawn (turned and framed), of any kind. A group whose center lies in the box comes whole; inside an entered group, the range stays inside it.
  - `select.deep`, which selects the node under the pointer past every group, moves from Cmd-press to Cmd+Alt-press (Ctrl+Alt off macOS). With Shift it ranges among the nodes around the one it picked.
  - `UseSelectToolOptions.between` sets what a range covers; `useSelectTool` defaults it to the box rule above, and `useSelectToolWith` without it walks the selection's order. `SelectionApi.applyClick` takes the range as an optional third argument, and `@weasel-js/select`'s `SelectContext` takes it as `between`, ahead of `order`.
  - `<SceneCanvas>` sources a `selectRange` dep: the range its select tool applies, read by an action that applies a click outside the tool. A diagram's edge-label click uses it, so Shift-click on a label ranges by the same box rule instead of by paint order.
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [99b8ada]
- Updated dependencies [1549044]
- Updated dependencies [0c77d00]
- Updated dependencies [db5276d]
- Updated dependencies [fc38c90]
- Updated dependencies [91b9542]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [7924629]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [be6244b]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/core@1.18.2
  - @weasel-js/animator@1.18.2
  - @weasel-js/audio@1.18.2
  - @weasel-js/ui-logic@1.18.2
  - @weasel-js/clock@1.18.2
  - @weasel-js/react@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/simulation@1.18.2
  - @weasel-js/font@1.18.2
  - @weasel-js/icons@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

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
- Updated dependencies [c9fb4d6]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/simulation@1.18.1
  - @weasel-js/font@1.18.1
  - @weasel-js/icons@1.18.1
  - @weasel-js/animator@1.18.1
  - @weasel-js/audio@1.18.1
  - @weasel-js/clock@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1
  - @weasel-js/ui-logic@1.18.1

## 1.18.0

### Patch Changes

- 4161bcd: Fixes from an audit of core's canvas, tools and input:
  
  - A paste that lands in a container or on a page puts the members of a pasted envelope group where they were drawn; they were stored in world coordinates under the container's frame and landed offset by it.
  - An Alt-drag clone snaps to its own source, which stays where it was. `SnapBegin` takes `exclude`, the nodes that offer no targets, which defaults to `ids`.
  - A Shift-drag on empty canvas marquees and adds what it takes to the selection; the select tool's marquee forbade Shift, so it did nothing.
  - A drag started with a modifier already held now starts: every shape tool (rect, ellipse, line, polygon, star, text, sticky, image, pencil, diagram stencils) with Shift, Alt or Ctrl; move, resize, rotate, clone and measure with Shift or Ctrl; anchor and handle drags, the anchor marquee, balance grips and diagram waypoints with the keys their roles read. Their bindings left those keys out, which the matcher reads as forbidden. `roleMods(roles)` builds a binding's `mods` from an action's modifier roles, and `INSERT_DRAG_MODS` is the insert drag's.
- d370754: Fix connector edge cases in `@weasel-js/diagram`.
  
  - A self-edge that names a port at only one end now loops around a corner from that port. Before, it drew a zero-length edge or a line straight through its node.
  - `commitReconnectToScene` now moves the edge and its labels onto the page both ends share, or into the page run, the same way a connect does.
  - The avoid router no longer hangs when `margin` is 0 or less.
  - The avoid, label placement, line-jump and off-page passes now skip locked connectors and labels. Before, moving a shape near one threw an error and the move failed.
- 0f72734: Fixes left from the third audit round:
  
  - labkit: calling a `watch3d` unsubscribe a second time does nothing; it could delete a listener set registered later for the same trial.
  - labkit: `PresentationState.time` and `labkit:seek`'s `time` are documented as what they are, shown time: the clock's `origin` plus the time into the pass.
  - diagram: adding an edge label with the default double-click edit and committing its first text are one undo entry, so an undo after typing takes the label away instead of leaving it empty and invisible. `dropEmptyEdgeLabel` removes an emptied new label within that entry.
  - core: `textEditJoin(id)` gives a batch that makes a node for a text edit the options that let the edit's commit join its undo entry. `useSceneTextEdit` ends that run when the edit ends, so a later edit of the node stays its own entry.
- b93c1dd: Fixes from an audit of ui-logic, editor and the icon packages, and one definition each for decisions several packages answered separately:
  
  - The icons plugin reads the namespace of an `icons.gen` compiled to JavaScript, so its `icon()` calls are rewritten as a TypeScript one's are.
  - Releasing an icon table a second time no longer bumps the registry's version and notifies its subscribers.
  - `envPx` reads a token set to a bare `0` as 0px, as CSS does, instead of using its fallback or throwing.
  - New in geom: `trimNumber(n, places = 6)`, which pathToD, svg and the renderer's mesh writer now share. The mesh writer kept four decimal places where its comment said it matched svg's six; it now writes six.
  - New in geom: `rectBetween(ax, ay, bx, by)`, the rect two corners span, used by core's drag rect, marquee, area select, anchor marquee, insert extent, measurement and parallax, and by diagram's segment boxes.
  - New in registry: `freshId(base, taken, opts)`, the first free numbered id, used by core's `nextPageId`, diagram's stage, wire, group and sequence ids, and labkit's snapshot names.
  - paint exports `byteHex` and `lerpHueDeg`. core's `withAlpha01` and p-touch's lbx colors write hex through the first. theme's ramps blend hues through the second, so two anchors exactly opposite now blend the positive way round, as CSS's `shorter` does, where before they went the negative way.
  - gestures' `matchKey` takes a readonly key list, and routing's key bindings match through it.
  - ui-logic's `clampTo` is now geom's `clamp` under another name, and is deprecated.
- b616cad: Fixes from a second audit of core's scene, viewport, selection and geometry:
  
  - `usePointerStylus` commits the last sample its throttle held back once the gap has passed, so a pen that comes to rest inside the gap no longer leaves the state on an older sample.
  - `unionBounds` folds a box with a negative width or height by the span it covers, as `unionAABB` does.
  - `sceneNodeClientRect` returns a positive rect at the box's screen top-left under a flipped (y-up) view.
  - `RECT_POSE_DESCRIPTOR.lerp` (and `ROTATED_POSE_DESCRIPTOR.lerp`) interpolates `rotation` the short way round, as the descriptor's `axes` do; it carried the start angle through and jumped at the end.
  - `AUTO_POSE_DESCRIPTOR` has a `lerp`, dispatching to the rect or Path descriptor, so `tweenPose` and `springPose` no longer throw on the default descriptor.
  - `setLayerVisible`, `setLayerLocked`, `setLayerParallax` and `renameLayer` record no undo entry and leave the version alone when handed the value the layer already has.
  - A fit with nothing to fit lands on the view Cmd-0 gives. `HOME_VIEW` and `resetView` define that view once: the canvas's `viewport.recenter`, else `HOME_VIEW`, the world origin at 100%. `fitViewToBounds`, `fitViewToPage`, `fitZoom`, `fitToBounds` and `computeFitViewport` now return `null` for content with no extent on either axis (`hasExtent`), with no warning and no fall to `ZOOM_FLOOR`; `fitViewToBounds` no longer hands back the current view for it. This is a breaking change to those return types. `viewport.zoom`'s Fit Content, the off-page follow and the editor's page fits resolve `null` to the reset view, `useAutoCenter` waits for content before it centers, and `ViewAnimationApi.animateToBounds` returns `false` without moving. `fitViewToBounds` fits a lone line along the axis it has; Fit Content no longer centers a lone point at the current zoom, and goes to the reset view instead.
  - `scene.update` and `scene.setPose` record no undo entry, leave the version alone and notify no one when handed the data or pose the node already has, compared by structure as the declared-field setters compare. A drag whose pointer holds still for a frame still lands as one undo entry.
- ef454d2: Fix diagram placement in paged scenes and diagram-formats ids
  
  - A label added by double-clicking an edge goes on the edge's page in a paged scene, as a connect places the edge, instead of at the top of the tree outside the page run.
  - A sequence started by the Participant tool goes on the page under the click in a paged scene, instead of outside the page run.
  - `documentFromScene` sizes the one page of a scene with no pages around its shapes. Connectors, stored as an empty box at the origin, no longer stretch the page back to (0, 0).
  - A DOT cluster whose short name and full name are both node ids gets a container id no node holds.
  - New `edgeLabelIdOf` and an exported `groupLabelIdOf` name the label node of an edge and of a group, which several places spelled out by hand.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [bf2e0c3]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [b4163e6]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [6cd51e2]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [7e83b0f]
- Updated dependencies [12c538a]
- Updated dependencies [5f9b5d0]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [27d8adb]
- Updated dependencies [56e54c0]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [229d0e7]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [8c39a05]
- Updated dependencies [b470ff1]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
- Updated dependencies [a287c54]
  - @weasel-js/core@1.18.0
  - @weasel-js/audio@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/font@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/animator@1.18.0
  - @weasel-js/clock@1.18.0
  - @weasel-js/icons@1.18.0
  - @weasel-js/registry@1.18.0
  - @weasel-js/ui-logic@1.18.0
  - @weasel-js/simulation@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/animator@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/ui-logic@1.17.3
  - @weasel-js/audio@1.17.3
  - @weasel-js/clock@1.17.3
  - @weasel-js/font@1.17.3
  - @weasel-js/icons@1.17.3
  - @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3
  - @weasel-js/simulation@1.17.3

## 1.17.2

### Patch Changes

- cda0a20: Undoing an insert restores the selection from before it. The insert and place actions clear the selection at the press, and the pen and spiro tools select the path they finish or continue; each of those changes now commits in the same undo entry as the node, so under an `applyOps` history that knows nothing about the selection, undo no longer leaves it empty or still on the node it removed. A pen join commits its selection the same way.
  
  This changes two dep contracts, which breaks a consumer's own `insert` or `editAnchors` dep. Both take a `CommitSelection` (`from`, the selection before the change, and `selectNode`): `InsertDep.commit` as a fourth argument and `EditAnchorsDep.applyEdit` as a fifth, both named `select`. A dep that applies ops appends `commitSelectionOps(select, id, label)` to its batch. An insert that applies none must set the selection itself, to the new node with `selectNode` and to nothing otherwise; an edit that commits nothing changes no selection. A dep that ignores `select` leaves the selection empty after an insert, and the pen and spiro tools no longer select what they draw or continue through it. These batches now carry a `setSelection` op, so a consumer history's adapter needs `setSelection`. kernel3d's `createInsert` passes `select` to `mint` as a third argument.
- Updated dependencies [d15e917]
- Updated dependencies [46ab1ff]
- Updated dependencies [3dfa153]
- Updated dependencies [4eaadcc]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [d08837f]
- Updated dependencies [35c291a]
- Updated dependencies [e13e539]
- Updated dependencies [6242fbb]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [62e6961]
- Updated dependencies [466c30b]
- Updated dependencies [060b0ee]
- Updated dependencies [05acca8]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/core@1.17.2
  - @weasel-js/audio@1.17.2
  - @weasel-js/animator@1.17.2
  - @weasel-js/clock@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/ui-logic@1.17.2
  - @weasel-js/simulation@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/font@1.17.2
  - @weasel-js/icons@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/animator@1.17.1
  - @weasel-js/clock@1.17.1
  - @weasel-js/simulation@1.17.1
  - @weasel-js/audio@1.17.1
  - @weasel-js/font@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/icons@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/ui-logic@1.17.1

## 1.17.0

### Patch Changes

- 08ebffc: The `avoid` router found no route, and the connector fell back to `orthogonal`, whenever the target port faced away from the source with no obstacle corner beyond it: bottom to bottom with the target below, east to west with the target to the west, or a self-loop from one side to the next. The search graph had no line crossing the one the route must arrive along. It now casts one just behind each target.
- 8e0ac8a: During a drag, the `avoid` router's previews kept connectors `clearance` away from other connectors' labels rather than `labelClearance`, so a connector that passed close by a label detoured while the drag ran and jumped back when it ended.
- fd16536: `fitDiagram` and its `DiagramFit` options are exported from `@weasel-js/diagram`: the view `DiagramView` opens on, for a host that holds the view itself through `view` and `onViewChange`. A ref on `EffectEditor` now reads `visible()`, the world rect it shows, and `rectOf(id)`, where a stage, group or wire is drawn in client coordinates, as a ref on `DiagramView` already does.
- 20aef2e: A body takes a `header` row, `{ kind: 'header', text, style?, id?, pad?, aside? }`, only as its first row. It is a band across the top of the node, flush with its bounds rather than inset by the outline or the padding, as tall as its text's line plus `pad` (default `HEADER_PAD`) above and below, with its text set left at the body's padding; the other rows lay out below it as before. Its text is centered on the face's caps, midway between baseline and cap height, where the measure reports the face's metrics, and on its line box where it does not. The band is filled in the node's stroke and clipped to its outline, so a `roundRect` keeps its rounded corners, and its text is drawn in the node's fill. `NodeStyle` takes `header` and `headerText` to color the two otherwise. A node's minimum width covers the header's text and its padding.
  
  A header's `aside` is a second text in the band, set right at the body's padding from the right edge in the title's face, on the title's line, in the title's color at `HEADER_ASIDE_OPACITY` (0.7). The band's minimum width then covers title, `HEADER_ASIDE_GAP` (8), aside and the padding on both sides, and the title's box stops that gap short of the aside's. Its text node carries `bodyAside: true` beside its title's `bodyRow`. A theme recolors it with the title, and laying the body out again (`relayoutBodies`, a resize) moves it with the band. `diagram-formats` reads a header row back from a scene as a header, with its `aside` and `pad`.
  
  `MeasureRowText` may return `capCenter`, how far below the top of a line box the caps' middle falls. `rendererMeasure` and `diagramScene`'s own estimate read it from the registered face's metrics, and `canvasMeasure` from the context's font and glyph bounds.
  
  `DataNode` takes `collapsed`: a node whose first row is a header is built as that row alone, sized to its band and as wide as it would be open. One with no header is drawn whole.
  
  `DiagramView` takes `onHeaderClick(nodeId)`, called on a click (not a drag) anywhere on a node's header band, its text included, after `onSelect`.
  
  `RowTextStyle` takes `tracking` (extra space after each character, in em) and `weight` (a numeric font weight, over `bold`). Both reach the row's scene text as `letterSpacing` and `fontWeight`, and `canvasMeasure`, `rendererMeasure` and `diagramScene`'s own estimate measure with them.
  
  `roundRectOutline(maxRadius)` makes a rounded-rect outline with its own corner radius, to register under a name of its own: `registerOutline('card', roundRectOutline(5))`. The built-in `roundRect` is `roundRectOutline(10)`.
- 1d87afe: A `slot` row takes `image: { src, opacity? }`, and `diagramScene` fills the slot's box with it through the kit's image painter instead of drawing an empty frame; a slot with an image needs no `id`. When a node's image `src` changes, `DiagramView` gives it the last picture that node decoded as `image.previous`, so it keeps drawing that until the new one is ready. `DiagramView` frees an image from the kit's image cache once nothing needs it (a held-over picture as soon as its replacement has decoded), and every image it draws when it unmounts, so a view whose pictures change often, a new data URL per edit, does not hold every one it has shown until the cache's byte budget runs out.
- 1b720a8: Where nothing measures text, an edge label's and a sequence diagram's estimated width now count the style's `tracking`, as a shape's rows already did; every estimate in the package comes from one function.
- 454e8e1: The selection outline can follow a node's shape instead of its box. Set `outline: { follow: 'shape' }` on the `selectionOverlay` slot, or on `createSelectionOverlayLayer` / `createSelectionOutlineLayer` with `scene`, and each node's silhouette is stroked outward from its drawn edge (past its own stroke, when it has one) at the outline's width in screen pixels. An open path, such as a wire, is outlined around the band its stroke covers. A group, an unstroked open path, or a node with no outline to trace keeps its box, and `pad` applies to boxes only. Additive; the default stays `'box'`. An `outline` given without a `paint` now keeps the default color rather than painting nothing.
  
  `nodeOutline` takes an optional pose and silhouette context, for reading a node's outline somewhere other than its stored pose.
  
  `DiagramView` outlines selected shapes along their outlines, and an item carried over a shape highlights the shape rather than its box; a container keeps its box in both.
  
  `@weasel-js/geom` exports `flatSubpaths`, a path flattened into point runs split by whether each encloses area.
  
  `@weasel-js/renderer` no longer throws `RangeError: offset is out of bounds` cutting an inner or outer stroke against a fill made of sliver triangles.
- Updated dependencies [38e8c77]
- Updated dependencies [986134b]
- Updated dependencies [a7f57b8]
- Updated dependencies [b0c009e]
- Updated dependencies [f7dc7c8]
- Updated dependencies [46a7b46]
- Updated dependencies [b5cd64f]
- Updated dependencies [ceb8c55]
- Updated dependencies [efcc47a]
- Updated dependencies [2772d2a]
- Updated dependencies [d28ff77]
- Updated dependencies [217246e]
- Updated dependencies [9e2e425]
- Updated dependencies [5067c7a]
- Updated dependencies [561550a]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
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
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [9778eee]
- Updated dependencies [34203da]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/animator@1.17.0
  - @weasel-js/react@1.17.0
  - @weasel-js/audio@1.17.0
  - @weasel-js/core@1.17.0
  - @weasel-js/clock@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/simulation@1.17.0
  - @weasel-js/font@1.17.0
  - @weasel-js/ui-logic@1.17.0
  - @weasel-js/icons@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- 847875c: Keep a scene's marks on an output target's dot grid. The document holds the grid as `kit:outputGrid` (`OUTPUT_GRID_KEY`), so setting it is an undoable edit. A scene's new `quantize` option takes a `QuantizeRule`: its `stored` half answers the pose or data the document holds on the grid, and runs on every committed write, on every node when the grid changes (in the same undo entry), on a document as it is built or loaded, and on resize, move and insert previews; its `drawn` half answers where the scene walk draws a node, while picking keeps the stored pose. core adds `quantizeSize` and `outputGridOf`; geom adds `snapToPitch` (whole dots, never below one) and `alignToGrid`. The `insert` dep gains `peek`, the node `build` would insert with no id minted and the palette not advanced, which core's insert dep and diagram's stencil insert implement; an `insertPreview` overlay's new `lands` fits the preview to where the quantize rule lands the shape.
- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/animator@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/ui-logic@1.16.2
  - @weasel-js/audio@1.16.2
  - @weasel-js/clock@1.16.2
  - @weasel-js/font@1.16.2
  - @weasel-js/icons@1.16.2
  - @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2
  - @weasel-js/simulation@1.16.2

## 1.16.1

### Patch Changes

- 72330bf: Pages are scene nodes. A paged scene has a page run, a root group that lays out its pages in a column or a row, and each page is a group under it that frames and clips what is on it. Content on a page is that page's child, in the page's own coordinates with the origin at its top-left, so a page's content moves with it and dragging onto another page reparents. A scene with a page run is in Pages mode; one without is Continuous. Pages are 2D only.
  
  This is breaking for a consumer that wrote `core:pages` directly, or placed content on pages in world coordinates: the pages are no longer a document value, and a node on a page is positioned relative to it. Stored scenes convert on load: `adoptLegacyPages` turns a `core:pages` value into page nodes and moves each root onto the page holding it, as one untracked batch. `PAGES_DOC_KEY` remains only as the key that conversion reads.
  
  The page edits (`setPages`, `addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`) and readers (`pagesOf`, `placedPagesOf`) keep their names and now work on the nodes. Content placed outside every page goes onto the nearest page unless the page run's `pasteboard` flag is on. A node that follows others (`dependsOn`, such as a connector) goes on the page its ends share, else into the page run. Pages and the run are never selected, deleted, copied or grouped by the scene tools, and the run refuses drops and inserts of anything but followers. A layer lock never locks a page or the run; only its own `locked` flag does. Group and the boolean group made from members on more than one page put the new group on the page the members overlap most. Turning the pasteboard off puts what sits off every page on the pages, in the same undo entry, and `setPages` on a Continuous scene puts what it holds on the new pages.
  
  Page and run nodes hold `data: undefined` whatever the scene's `TData`, so code walking `scene.nodes` and reading `data` must skip page structure (`isPageStructure`). A page's node id is its page id (`Page.id`) unless another node already held that id when the page was made: then the node gets a fresh id and `PageInfo.id` keeps the page id. `pagesOf`, `placedPagesOf`, `pageOfNode` and the page edits all speak page ids; `pageNodeOf` gives the node for one.
  
  - `@weasel-js/core` exports `createPageRun`, `pageRunOf`, `isPaged`, `pageOfNode`, `PAGE_RUN` and `pageRunLayout`, `PAGE_CLIP` and `pageClip`, `adoptLegacyPages`, `placeOnPages` (moves world-space specs onto their pages, measured by `AUTO_POSE_DESCRIPTOR` unless told otherwise), `addOnPages` (adds specs and places them), `pageNodeOf`, `pasteboardOn`, `replaceDoc` (makes a scene's document values a given set, clearing the rest), `followerHome`, `isPageStructure`, `withoutPageStructure`, `contentRoots`, and, from the routing barrel, `insertSite` with `InsertSite` and `InsertSiteOptions`, whose `descriptor` measures the insert against its page. Nodes gain `page` and `pageRun` fields, which save with the scene, and scenes gain `setPage` and `setPageRun`. `LayoutContainer` and `LayoutChild` gain an optional `node`.
  - `@weasel-js/editor`: `usePages` takes `{ paging }` as its last argument, `'continuous'` (the default) or `'single'`, which settles the view fitted to one page through the new `usePageSettle`. `adoptSnapshotPages` converts a snapshot saved with `core:pages`, which `nodeSpecsFromSnapshot` now does; both take a `pages` option, the pages a snapshot with neither page nodes nor `core:pages` gets. `snapshotRebuildsTree` says whether a load rebuilds the tree, so the undo stack saved beside it is stale, and `useSessionPersistence` drops that stack, taking the same `pages` option. `usePageFit`'s `page` may be `null`.
  - `@weasel-js/diagram`: `OffPageEdgeInput` is now `{ id, fromPage, toPage, offPage? }`, each end's page read from its page ancestor, and `OffPageSplitInput` loses `pages`. `OffPageMarkerOptions` loses `geometry` and its type parameter. A stencil drawn on a paged scene lands on the page under it.
  - `@weasel-js/diagram-formats`: `DocumentScene` gains `pages`. `addDocumentScene` replaces a scene's content, pages and document values with a `DocumentScene` in one undo entry, locked content included, keeping the pasteboard setting; a node in it named like a page no longer collides with that page. `addOnPages` is now core's, re-exported here, and takes the scene's own spec type.
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
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/animator@1.16.1
  - @weasel-js/ui-logic@1.16.1
  - @weasel-js/clock@1.16.1
  - @weasel-js/font@1.16.1
  - @weasel-js/icons@1.16.1
  - @weasel-js/react@1.16.1
  - @weasel-js/simulation@1.16.1
  - @weasel-js/audio@1.16.1

## 1.16.0

### Patch Changes

- 63056ee: A stroke can now draw only part of its path. `Stroke.trim` is a `StrokeTrim`, `{ start?, end?, pace? }`, and the stroke draws the stretch between `start` and `end` in the order the path was authored. Each edge is a `TrimAt`: a bare number is a fraction of the whole path, `{ length }` an absolute distance, `{ anchor }` a vertex index (`2.5` is halfway along the segment after anchor 2) and `{ subpath }` a subpath index. `pace` (`TrimPace`) says what a fraction is a fraction of: `'length'` (the default) moves at constant speed, and `'anchor'` gives every segment an equal share. An edge omitted is the path's start or end, and a window whose start is at or past its end draws nothing. Lengths are exact arc lengths in the path's own space, so the cut doesn't move with zoom or flattening tolerance. Tween `end` from 0 to 1 to draw a line on, then `start` after it to draw it off.
  
  `markerStart` and `markerEnd` sit at each visible run's ends, so an end arrow rides the growing line; a run cut from a closed subpath takes neither. `markerMid` shows on the vertices inside the window. Dashes keep the pattern the untrimmed stroke has, so drawing on reveals the pattern rather than sliding it. Picking hits only the visible part of the stored trim. SVG and PDF export write the visible geometry, with curves split rather than flattened. SVG also writes `stroke-dashoffset` where a run starts mid-pattern. Import recovers no trim. Outlined text ignores its stroke's trim, since each glyph is stroked on its own.
  
  To animate a trim without ops or undo, `Animator.trimOverrides` is a `TrimOverrideRegistry` (with `TrimOverride` and `TrimEdge`), read at draw time the way vertex-color overrides are. `<SceneCanvas animator>`, `<SceneViewCanvas animator>` and `MinimapCanvas` paint it and repaint when an override is set or cleared. `renderSceneToCanvas`, `renderSceneToPixels` and `createPathLayer` take `trimOverrides` beside `colorOverrides`. core exports both as one `PaintOverrides` type, which each of those argument types extends. `NodePaintCtx.trim` and `NodeInk.trim` carry a node's trim to its painter. In diagrams, `EdgeStyle.trim` trims an edge, and `DiagramViewProps.animator` animates it by the edge's scene node id. The draw.io, Mermaid and DOT writers warn when they drop a trim, and the scene reader reads it back.
  
  New exports:
  
  - paint: `StrokeTrim`, `TrimAt`, `TrimPace` and `strokeTrimKey`, a stable cache key per trim. core re-exports the three types.
  - geom: `lengthTable`, `pathLengthTable`, `LengthTable`, `LengthRun`, `LengthSpan`, `lengthAtAnchor`, `anchorAtLength`, `lengthAtSubpath`, `lengthAtSegmentFraction`, `closingAnchor` and `pointAtLength`: exact pen-order arc length over 2D or 3D runs of lines and Bézier curves. Also `curveSpan`, `lengthAtCurve`, `runSegments`, `CurvePosition` and `CurveSpan`, which name a place on a path as a segment and curve parameter so every flattening cuts at the same point. Also `segmentLength(coords, dim, a?, b?)` and `segmentTAtLength(coords, dim, length, total?)` over flat control points, and the new fields `StrokeHitTestOptions.span` and `Polyline.closeAnchor`. In `geom/tessellate`: `polylineAtCurve` and `PolylinePlace`. In `geom/3d`: `pointAtLength3`.
  - stroke: `resolveTrim`, `trimSpan`, `trimmedPath`, `TrimmedPath`, `trimmedRuns` and `TrimmedRun`. `splitForDash` takes an optional `phase`.
  - animator: `ColorOverrideRegistry.subscribe`.
  - svg: `SvgStroke.trim` and `SvgStroke.dashOffset`. svg now depends on `@weasel-js/stroke`.
  
  Breaking and behavior changes:
  
  - `buildSceneViewCommands` (core) takes a `PaintOverrides` object as its seventh argument instead of a `ColorOverrideRegistry`. Pass `{ colorOverrides }` where you passed the registry.
  - `ColorOverrideRegistry.has(id)` (animator) no longer counts a target that was asked for and never moved. It is true only for an override from `set`, or for a target an animation has committed.
  - `measurePath` and `pointAlongPath` (geom) now measure exact arc length rather than a flattening. Lengths and points move by up to a few hundredths of a unit on curved paths, and a label at 0.5 now sits where a trim at 0.5 cuts. `flattenTolerance` now affects only the headings and the `nearest` search.
  - Rounded corners are measured by their exact arc length rather than by a fixed 32-step table, so corner segment lengths change slightly.
  - `pathThroughPoseFrame` (geom) rounds a path's `corners` before applying a stretch or skew, as the renderer does, and returns them already rounded. A uniform frame still keeps them as corners.
  - `extractPolylines` records, in `closeAnchor`, the anchor of a closing point it drops as a duplicate of the first.
  - Diagram edges whose style sets no width now draw at `EDGE_STROKE_WIDTH`, 1.5, instead of 2 (`DEFAULT_EDGE_STROKE` and `themeEdgeStroke`).
  - `svgPaintFromKit`, `svgStrokeFromKit` and `SvgKitPose` moved to their own module in svg; they are still exported from the package root.
- f9cfd00: Degree and radian conversions in these packages use geom's `DEG_TO_RAD` and `RAD_TO_DEG` instead of
  writing `Math.PI / 180` out by hand. Results are unchanged up to floating-point rounding.
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/geom@1.16.0
  - @weasel-js/animator@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/ui-logic@1.16.0
  - @weasel-js/audio@1.16.0
  - @weasel-js/clock@1.16.0
  - @weasel-js/font@1.16.0
  - @weasel-js/icons@1.16.0
  - @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0
  - @weasel-js/simulation@1.16.0

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
- Updated dependencies [be83637]
- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/audio@1.15.2
  - @weasel-js/core@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/animator@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/ui-logic@1.15.2
  - @weasel-js/clock@1.15.2
  - @weasel-js/simulation@1.15.2
  - @weasel-js/font@1.15.2
  - @weasel-js/icons@1.15.2

## 1.15.1

### Patch Changes

- 24e218c: An edge can carry `endLabels` `{ from, to }`: text drawn beside each end, a multiplicity or a role, as labels at
  `'start'` and `'end'` whose ids `endLabelIdOf` gives. A label at `'start'` or `'end'` takes an `inset`, which stands
  it that far along the route from the end so it clears the shape there. New outlines `'start'`, `'end'`, and `'bar'`
  draw a state machine's start dot, end bullseye, and fork or join bar; an `OutlineDef` can name a `solid` part, filled
  in the stroke's color, and `outlineSolid` builds it. A body's `field` rows carry `bodyField` on their scene node, so a
  reader can tell one from a text row. This adds API.
- 5070176: A `grid` layout, in `LAYOUTS` and exported: nodes stand in rows of a fixed number of columns, left to right and top
  to bottom, as a block diagram does. Its `grid` layout option gives the top level's `columns`, each group's own under
  `groupColumns`, how many columns an item `spans`, and how many empty cells it `skips` before it. A group, or a
  container fitted to what it holds, is a grid of its own inside its cells. `diagramScene`'s `layout` now also names
  `'radial'` and `'grid'`.
  
  Two outlines: `person`, a head over a body with rounded shoulders, its rows in the body; and `disk`, a drive seen
  from above, standing over its label as the other devices do.
- 9862244: A `DiagramType` names the `notations` its graph pages are written in: UML class `class`, ERD `er`, mind map
  `mindmap`, flowchart `FLOWCHART_NOTATION`. `diagramNotationOf` gives the one a scene's type writes, and
  `diagramTypeOfNotation` the type a notation opens as. `documentFromScene` gives a graph page with no notation of its
  own the one its scene's type writes, so a chart drawn as a UML class diagram exports as a Mermaid `classDiagram`;
  `documentSpecs` emits `diagram:type` when every graph page's notation names one type, so an imported class diagram
  opens with the UML stencils. A page whose notation is `FLOWCHART_NOTATION` writes as a flowchart in a chart of
  another type. This adds API.
- a5e5db3: New diagram types State, Requirement, C4, Block, Architecture, and Kanban, with stencil groups `STATE_GROUP`,
  `REQUIREMENT_GROUP`, `C4_GROUP`, `ARCHITECTURE_GROUP`, and `KANBAN_GROUP` whose shapes write as their Mermaid
  constructs: a state's start, end, choice, fork, note, and composite and concurrent states; requirements and elements;
  C4 people, systems, containers, components, stores, queues, and boundaries; architecture services by Mermaid's built-in
  icons, junctions, and groups; a kanban board and its cards. Block diagrams draw with the flowchart's shapes on a grid.
  A `DiagramStencil` can name a `themeRole`, kept on its trait and resolved by `StencilInsertOptions.theme`; a
  `ContainerStencil` can name its `title` and its first `lanes`; `DiagramTypeEdge` takes a `dash`. A stencil's field
  rows now carry `bodyField`, so they read back as fields. The Mermaid requirement writer names each block by its name
  row rather than its id. This adds API.
- 0e5b3d8: A sequence diagram can be built from nothing with pure edits of its `SequenceData`: `addParticipant` (with
  `newParticipant` minting one), `removeParticipant`, `setParticipantOutline`, `insertMessage` with a named arrow from
  `SEQ_ARROWS`, `insertNote`, `insertMark` for activations, creations and destructions, `wrapSteps` to put a run of
  steps in a loop, alt, opt, par, critical, break or colored region, `addSection`, `removeSection`, `setFragmentType`,
  `unwrapFragment`, `removeStep` and `removeStepAt`, `setMessageArrow`, `setMessageActivation`, `addBox`, `removeBox`
  and `setAutonumber`. `freshSeqId` mints an id nothing in the sequence uses.
  
  Removing a participant removes every message to or from it, every mark naming it, and it from every note and box; a
  note or box left naming no one goes too. Fragments stay, even emptied.
- 2560c69: `SEQUENCE_TOOLS` gains Mark, which clicks an activation's start or end, a creation, or a destruction onto the lifeline
  nearest the click, at the row nearest it (`createAddMarkAction`; the host picks the kind through the `mark` reader).
  `sequenceSelectionOf` reads a selection as one sequence's selected participants, messages, notes, fragments, and
  boxes, falling back to the scene's only sequence, so a panel can offer the edits that fit. `commitSequence` keeps a
  selected part selected through the rebuild, where it used to drop the selection.
- dd4ab9b: Sequence diagrams can be authored on the canvas. `useSequenceTools` (or `sequenceTools` outside React) builds the
  tools in `SEQUENCE_TOOLS`: Participant clicks a lifeline in where the click falls between two, and on empty canvas
  starts a new sequence (`startSequence`); Message drags from one lifeline to another, inserted at the row of the press
  and previewed as it goes, a release on its own lifeline making a self-message; Note clicks a note over the nearest
  lifeline, or beside it when the click is off to one side, and drags one across several; Fragment drags across rows to
  wrap them. The host picks the participant kind, the arrow, and the fragment type through the options' readers. Each
  tool binds its gesture on a sequence's heads, messages and notes as well as on open canvas, and each edit is one undo
  entry through `commit`.
  
  A click on a head, a message, a note, a fragment's tab, or a box's label strip selects the node drawing it, and
  `createSequenceDeleteAction` turns Delete on such a selection into an edit of the sequence: a head removes its
  participant and everything naming it. Fragments can be dragged to another row by their tab. `DiagramView` deletes a
  sequence's selected parts through `onEditSequence`, and takes `tools` and `onToolsCreated` to host the tools. A
  sequence's selected parts take no resize handles under `diagramResizable`.
- 479ecc6: Sequence diagrams. `SequenceData` holds participants and steps — messages, notes, activations, `create` and
  `destroy`, and fragments with sections — plus boxes and `autonumber`; `sequenceSpecs` draws it as one root node
  holding the data, every head, lifeline, message, activation, note, and fragment a child of it, each in the theme's
  roles. `moveStep`, `moveParticipant`, `reconnectMessage`, and `setSequenceText` are the edits as pure functions;
  `DiagramView`'s new `onEditSequence` turns them on as drags and in-place text editing, and `diagramSequence` does the
  same on a scene that is the document, each edit one undo entry. New outlines: `boundary`, `control`, `entity`,
  `collections`, and `queue`. Additive: sequence roots and parts take no connectors and are left alone by
  `themeWrites`, while `applyDiagramTheme` draws them again in the new theme.
- 238a49c: A sequence's lifeline marks can be selected and deleted. An activation bar and a destruction's cross are taken hold of
  on the canvas like a head or a message; Delete on a bar removes the marks or message flags that open and close it, and
  on a cross the `destroy` mark. `SeqActivationPlace` names its `opener` and `closer` and `SeqLifelinePlace` its
  `destroyedBy` as `SeqMarkRef`s, and the parts drawn for them carry those refs. `removeMarks` removes marks by their
  places and clears message flags; `removeMarksOf` removes every mark of a kind naming a participant, such as the
  `create` that draws a head partway down.
- Updated dependencies [d2110bc]
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [8b52282]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
- Updated dependencies [13b0604]
  - @weasel-js/font@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/animator@1.15.1
  - @weasel-js/clock@1.15.1
  - @weasel-js/ui-logic@1.15.1
  - @weasel-js/simulation@1.15.1
  - @weasel-js/audio@1.15.1
  - @weasel-js/icons@1.15.1
  - @weasel-js/react@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [3f13a49]
- Updated dependencies [f77e789]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [e05ddd3]
- Updated dependencies [30bf607]
- Updated dependencies [0e60598]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [c41c917]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [746fab0]
  - @weasel-js/core@1.15.0
  - @weasel-js/font@1.15.0
  - @weasel-js/geom@1.15.0
  - @weasel-js/clock@1.15.0
  - @weasel-js/animator@1.15.0
  - @weasel-js/headless@1.15.0
  - @weasel-js/audio@1.15.0
  - @weasel-js/icons@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/simulation@1.15.0

## 1.14.2

### Patch Changes

- 301a320: `layered` keeps a group in one rank wherever the edges between its members allow it: `ranksByLength` now
  charges a group for every rank its members spread across, so one member with a longer route below it no
  longer pulls the group's box across several ranks, and wires into the group no longer detour around the
  column that box reserved. A group's box also closes any stretch none of its members covers to `nodeGap`,
  so members that placement spread apart are drawn packed. Both change where nodes land on graphs with groups.
- c06637e: `layered` keeps long edges inside the drawing. Where a run of placeholders sits past the node that sets the
  drawing's edge in its rank, that node now moves beyond the run, so the wire no longer runs outside every node
  and group box for its whole length; a run going around its own sibling (a skip edge) stays where it was. A
  wire passing a group's box now enters and leaves level with the box's edge, so its turns clear the box. The
  `bezier` router no longer lets a leg between two facing ports swing past either end along the axis they face,
  which flattens long legs between near ranks. All three change where nodes land and how wires are drawn.
- Updated dependencies [012cae5]
- Updated dependencies [56f9771]
- Updated dependencies [ae38d2e]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
  - @weasel-js/core@1.14.2
  - @weasel-js/font@1.14.2
  - @weasel-js/clock@1.14.2
  - @weasel-js/animator@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/simulation@1.14.2
  - @weasel-js/audio@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/headless@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/animator@1.14.1
  - @weasel-js/audio@1.14.1
  - @weasel-js/clock@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/font@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/headless@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/simulation@1.14.1

## 1.14.0

### Patch Changes

- d8fbd3d: `Affordance` takes an optional `regionsAt(state, wx, wy, view)`: the regions a press at that world point can hit, in the order `regions` lists them. The affordance hit test reads it in place of `regions` when it is there, so an affordance with many regions can answer from an index. This adds API.
  
  The diagram port layer and edge-label layer use it. A `ParticipantSource` may carry a `generation()`, and `sceneParticipants` gives it one from the scene's version and its overrides' generation, so the port layer hit-tests through an index of the ports' points instead of laying out every participant's ports on each press. The label layer and `labelUnder` index each scene's draggable labels against its version. Both answer exactly what they answered before; a source without a generation is tested the old way.
- 0c6c086: `ToolPalette` takes `carryGhost(tool)`: what follows the pointer, centered on it, while a tool `carryTool` carries is on the move. `DragGhost` takes `centered`, which makes `at` its center, and `bare`, which draws its children with no surface under them. `@weasel-js/diagram` exports `StencilGhost`, a stencil's outline as an SVG at the size a click places it, in a node style and at a zoom, for a palette to carry. This adds API.
- 436f034: `central-topic` draws its outline as an oval of four circular arcs instead of an ellipse, flatter across the top, so it holds solid rows and columns at 16px 1x where the ellipse stepped through gray on every side. `blend` is redrawn on the pixel grid at a stroke one pixel wide, with a larger circle, so it no longer renders gray at 1x.
- 99fc88d: Diagram types and stencil groups. A `StencilGroup` is a named list of stencils, and a `DiagramType` names the groups a new diagram opens with, the router and end markers its new connectors take, and the layout auto layout runs. `STENCIL_GROUPS` ships the `flowchart` and `containers` groups (`FLOWCHART_STENCILS` and `CONTAINER_STENCILS` are unchanged), and `DIAGRAM_TYPES` ships the `flowchart` type. A scene saves its type and shown groups under `DIAGRAM_TYPE_DOC_KEY`: `diagramTypeDocOf` and `diagramTypeOf` read it, falling back to flowchart, and `setDiagramType`, `addStencilGroup`, and `removeStencilGroup` write it as one undo entry each. `groupStencils`, `groupStencilIds`, `isContainerStencil`, and `diagramTypeEdgeStroke` serve a host building its palette and connector tool from them. `layoutDiagram` runs a layout from a graph source and applies it as one undo entry; `createLayoutAction` now goes through it.
  
  `MenuButton` rows take `checked`, which draws them as check rows.
- 0145603: Two new stencil groups and diagram types. `NETWORK_GROUP` holds a server, database, cloud, router, switch, firewall, laptop, desktop, phone, printer, user, and internet globe; `BPMN_GROUP` holds start, intermediate, and end events, a task, a subprocess, the exclusive, parallel, inclusive, and event-based gateways, a data object, and a data store. `DIAGRAM_TYPES` gains `network` (straight links with no end marker) and `bpmn` (orthogonal flows ending in an arrow), each opening with its own group and the containers.
  
  The devices, events, and gateways are new built-in outlines (`server`, `router`, `switch`, `firewall`, `laptop`, `desktop`, `phone`, `printer`, `user`, `globe`, `event`, `intermediateEvent`, `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`, `eventGateway`, and `subprocess`) seeded in the outline table, so a saved chart naming one paints without its group imported. Devices, events, and gateways keep their proportions and lay their label out in a strip under the drawing. The actor's figure now stands on its label strip when its box is too narrow for it, rather than leaving a gap above the label.
  
  `DiagramStencil` takes an optional `style`, a partial node style laid over the one the body is drawn in; the BPMN end event uses it for its heavier ring. Each new stencil has a palette glyph in the `diagram` icon namespace.
- b2bd005: Org chart and mind map diagram types. `radial` is a new layout in `LAYOUTS`: the first root sits in the middle, its branches are dealt right and left in graph order to keep the two sides balanced by node count, and each side grows away from the root as a horizontal tree whose subtrees never interleave; further trees stack below, and a second run moves nothing. `subtreeBlocks`, the block packing `tree` and `radial` share, is exported for layouts of your own.
  
  `STENCIL_GROUPS` gains `org` (`ORG_STENCILS`: person, executive, assistant, and dashed vacancy cards, each a name over a title, and a department box) and `mindMap` (`MIND_MAP_STENCILS`: central topic, main topic, subtopic, and a floating note), each with palette glyphs. `DIAGRAM_TYPES` gains `orgChart` (org cards and containers, unmarked orthogonal connectors, laid out with `tree`) and `mindMap` (unmarked curved connectors, laid out with `radial`), also exported as `ORG_CHART_TYPE` and `MIND_MAP_TYPE`.
- e1bbdcd: Diagram outlines are now a registrable table. `registerOutline(name, def)` adds a named outline (or shadows a built-in until disposed), `outlineFromD(d, opts)` builds one from unit-square SVG path data, and `outlineDetail` gives the strokes an outline draws over its fill. `Outline` widens to any registered name; an unregistered one paints as `rect` and warns once. Eleven built-ins join the flowchart seven: `roundRect`, `cylinder`, `document`, `note`, `cloud`, `triangle`, `octagon`, `folder`, `cube`, `actor`, and `doubleEllipse`. Each keeps its content box inside the visible shape, and `diagramShape` strokes a cylinder's rim, a note's fold, a folder's tab, a cube's front edges, and a double ellipse's inner ring.
  
  New stroke markers: the crow's-foot family `crow-one`, `crow-many`, `crow-zero-one`, `crow-one-many`, and `crow-zero-many`, and `triangle-hollow` for UML generalization. `KitMarkerKey` lists them.
  
  DOT, Mermaid, and draw-style XML read and write the new outlines and markers where the format has a counterpart. Mermaid's writer no longer throws on an outline it has no brackets for: it writes a rectangle and warns. draw-style XML reads `rounded=1` below the stadium arc as `roundRect`, a hollow `block` head as `triangle-hollow`, Mermaid reads `(text)` as `roundRect`, and DOT and Mermaid read a double circle as `doubleEllipse`. DOT reads `onormal` as `triangle-hollow`.
- 726d80b: Add UML class and ERD stencils and diagram types to `@weasel-js/diagram`. The `uml` group holds class, interface, abstract class, package, note, actor, use case, and component; the `erd` group holds entity, weak entity, relationship, and attribute. The `umlClass` type routes new connectors orthogonally to an open arrowhead, and `erd` draws them from `crow-one` to `crow-many`.
  
  A body takes a new `divider` row, a rule across its content box that the outline painter draws in the body's own stroke, and a row's text style can now be `italic`. A built body records each row's height, so `bodyFollower`, a new transform follower, lays a resized body's rows out again inside its new box. `DiagramStencil` takes `padding`, `gap`, and `verticalAlign`. Two outlines are added: `component` and `doubleRect`.
  
  `@weasel-js/diagram-formats` reads divider rows back from a scene, leaves them out of DOT, Mermaid, and draw-style XML text without a warning, and writes and reads an italic row in draw-style XML.
- b4a8e98: A decision drawn as its symbol in a `direction: 'down'` rack runs down the column: the signal enters at its top, its exits leave at its bottom, and its control inputs enter on the side the side stages hang on. `BranchOptions` takes `direction`, `'right'` or `'down'`, and `controlSide` takes `'left'` and `'right'` for a symbol running down; every symbol in `BRANCH_SYMBOLS` follows both. A symbol running down is its row form mirrored across its diagonal, so a hexagon, demux, comparator or fork draws with a path outline rather than its named one. This adds API.
- 60c7c69: `DiagramView` takes `bounded`, which keeps the view on the diagram: panning and zooming stop where the view would show more than the diagram and `fitPadding` world units around it, and a view showing more than all of it centers it. It takes `refit: 'always'` too, which refits a view still on its last fit whenever the specs change, not only once they run past what it shows. `EffectEditor` passes `bounded` and `refit` through, with `maxScale`, so a small pipeline can zoom up to fill its box. This adds API.
- fc0962a: The router commands (Straight, Orthogonal, Curved, Around shapes) and Line jumps carry glyphs, `diagram:routerStraight`, `diagram:routerOrthogonal`, `diagram:routerCurved`, `diagram:routerAvoid` and `diagram:lineJumps`, so an action bar or a menu drawing them shows an icon.
- 8b14236: A "may this land here?" check can now refuse with a reason. `DropVerdict` is `true`, `false` (a
  silent no), or `{ refuse: string }`; over a refusal the canvas outlines the target in the
  `refused` overlay role and shows the reason beside the pointer, and a release there does nothing.
  
  - **Breaking:** `CanConnect` returns a `DropVerdict` rather than a `boolean`, and so does core's
    `CanDropIntoDep`. A function returning a boolean still fits; code that calls one and treats the
    answer as a boolean must test for `true`.
  - `DiagramView` takes `canReparent(ids, container)`, asked before a drag moves nodes into a
    container or lane they are not in.
  - A `DataContainer` takes `reorder: 'x' | 'y'`: `onReorder` drags its members along that axis and
    Alt with an arrow key steps the selected one, as a group's. **Breaking:** `ReorderChange` names
    the group or container as `parent`, in place of `group`.
  - `DiagramView` takes `onDropItem` and `canDropItem` for items carried in from a list outside the
    canvas, made a source with `dragItemProps(item)`. The report gives the item, what it landed on,
    the container that would hold it, and its index among that container's members.
  - `DiagramViewApi.rectOf` and overlays place a container's members in the world rather than in
    the container's frame, and a stencil drawn into a nested container finds it.
  - Core: move behaviors can publish overlays, routing has a `reason` overlay that `SceneCanvas`
    shows beside the pointer, and a `target` overlay role outlines what a drag would drop into.
- 41ebe89: `DiagramView`'s fit now takes in each edge's waypoints and stored route as well as its node and group boxes, so a wire routed around the nodes, past all of them, is no longer cut off at the canvas edge. `fitDiagram` changes the same way.
- 47330a3: The port affordance reads a `ParticipantSource` with a `generation()` once per generation: painting reuses those ports, and the regions built from them, instead of laying out every participant's ports each frame. The press index builds over the same list. A source without a generation is read every frame as before.
- db4b0aa: A member of a `DataContainer` marked `reorder` can now be dragged out of it: the reorder drag hands off to the move once the pointer leaves the container's box, and `onMove` reports where it lands. A group's members still only reorder. Adds `ReorderOptions.region`, the box a reorder drag stays a reorder in.
- 1298c24: `useEffectRunner` takes `clock`, a `ClockHandle` from `@weasel-js/clock`, to play on in place of its own frame loop: the play time is the clock's `elapsed`, so pausing, rate, seeking and the clock's visibility gate move the runner with the rest of a trial, and the host's `useClockLoop` syncs it. The runner plays while the clock does, and its `play` and `pause` set the clock's rate. `EffectRunner.seek(seconds)` moves the play time whether or not it plays and runs the pipeline there; a seek made while a run is still going runs once more after it, at the latest time. This adds API.
- 76edfb1: `DiagramView` can pick several at once: `selectionMode="multiple"` lets Shift-click add a node, group or edge to the pick or take it out, `selected` takes an array as well as one id, and `onSelect` gets every id picked as a second argument beside the latest pick. Adds API; an `onSelect` taking one argument keeps working. `EffectEditor` picks this way, and its `onSelect` likewise gets every stage and group picked as a second argument, for `EffectEditorApi.group`.
- 270bc4f: `EffectEditor` drags a selected wire's label under every look. Where it was put goes in the doc's new `labels`, by wire id, as a place along the wire and a distance off it, so it holds when the look changes; under `lanes` it wins over where the look would put the label. Resetting the label hands it back to the look, and removing a wire drops its placement. `setWireLabel` makes the same edit outside the editor.
- 7242ab2: An `EffectPort` input can take several wires: `many: true` lets `EffectEditor` join a second output to it, and a third, where it used to join only a free input. The same output still cannot be wired to it twice. Every input of the audio stage types now sets it, since the audio runner already sums every wire into an input, so two sounds combine at any stage's input without a Mix. A pipeline saved before this keeps its stages' ports as they were.
- 14f8583: `@weasel-js/geom/nd` exports `createSettledCache()`: a value built only once its source holds still. Each `read(key, build)` passes the source's key as a tuple; the first read at a new key answers null, and the second at the same key builds and keeps the value (`reads` moves which read builds it, and `reads: 1` makes it a plain memo). Keys match element by element under `Object.is`. This adds API.
  
  Core's pick index, the diagram port and label indexes, and kernel3d's snap box index now use it, in place of three copies of that rule. They build at the same reads as before.
- 3c3a219: `@weasel-js/headless` holds the arithmetic of moving items within a list, which ui's reorderable lists, trees, bars, tabs and token fields and diagram's reorder drags and Alt+arrow step now share: `moveItems`, `movedIndex`, `isNoopDrop`, `nudgeGap`, `gapByMidpoint`, `nearestGap`, and the Alt+arrow chord `isNudgeChord`/`nudgeOf`. A destination is a gap counted before the moved items are taken out, and a selection of several items moves in one go.
  
  ui's internal `movedOrder` now takes that gap rather than the entry's final index. A page tab no longer moves on Alt+Ctrl or Alt+Cmd with an arrow, only on Alt and an arrow, as every other reorderable list already did.
- 5c8636b: More text fields leave a key to an input method mid-composition, so confirming a Japanese or Chinese candidate with Enter no longer commits, runs or adds what is half typed: `LayerList`'s rename field, `ListEditor`'s entries, `TokenField`, `CommandPalette`'s search, `UnitField`, a `PropertyField` text or number field, and the schema editor's key and number fields in `@weasel-js/ui`, and the effect editor's group title field in `@weasel-js/diagram`.
- 5b7d0ac: Breaking: an immediate action's params carry the event's point as `world`, a `WorldPoint`, in place of `worldX`/`worldY`, and a click's press point as `press` in place of `pressX`/`pressY`. Read `params.world.x` where you read `params.worldX`, and pass `{ world: { x, y } }` where you passed `{ worldX: x, worldY: y }`: to `trigger`, as a menu's params, and to an invoker called directly. The new exported `ImmediateParams` type names every field the dispatcher puts in the bag; cast `params` to it to read them. `trigger` asks `enabled` at `params.world`. A parallax plane now carries `press` into the plane as it already did the release point. The align and flip actions' `'pointer'` reference reads `world` too. The input events themselves are unchanged: a `ClickEvent` still has `x`/`y` and `pressX`/`pressY`, and `useClipboardOps`' `paste(at)` keeps its `{ worldX, worldY }` shape.
- 1968706: `createItemDropAction` and `itemDropContribution` take `requires`, the deps their `report` reads beyond the scene, and `report` gets the canvas's deps as its second argument, so a host on a `SceneCanvas` of its own can add the dropped item through `insert` and snap it through `snap`. This adds API.
- baf354e: The `diagram:mindMap` glyph's branches leave the central topic's corners at 45 degrees instead of curving off its sides, so at 16px they no longer merge into the topic's walls.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
- d9896bb: The `rack` look takes `direction: 'right' | 'down'`. `'right'` (the default) draws as before. `'down'` draws the main line as a column: each stage takes the main signal in at its top edge and sends it out at its bottom, side ports sit on its left or right edge facing out of it, a stage grows taller rather than wider to keep its side ports apart, and the look's reorder runs along `y`, so dragging a stage in `EffectEditor` moves it up or down the column. Under `'down'`, `side: 'below'` hangs the side stages on the column's right and `'above'` on its left; a collapsed skip's arc runs down the opposite edge. This adds API.
- 03d30ee: The `rack` look no longer draws a wire through the stages it passes. A wire from a stage's main output into the side input of a stage further down the line, past at least one stage, now leaves from a tap on the source's side-stage edge, a port named `~tap:<output>` spread among that edge's side ports, so its curve runs beside the line. `EffectEditor` maps the drawn edge back to its wire, and a run reads it as the output it taps.
- c8fcbc2: `radial` keeps a branch on the side of the root it was dragged to. On a mind map whose branches already stand on both sides of the central topic, a branch clear of the root stays on its side when the layout runs again, and the branches near the root are dealt to the lighter side after those. A map with every branch on one side, as `tree` or `layered` leaves one, is still dealt afresh and balanced.
- a80f8be: A scene composes poses by default. A child's stored pose is now relative to the frame of the nearest container above it that defines one (`RIGID_POSE_COMPOSITION`), so moving a container writes one pose, rotating it rotates its contents, and resizing it leaves them where they draw. A container whose pose derives from its children (`dependsOn: 'children'` with a `derivePose`) is an envelope, not a frame: its children share the frame above it.
  
  **This breaks a consumer that stores absolute child poses.** To migrate:
  
  - A scene whose `TPose` is not a rect pose must name its composition: `useScene` and `createScene` require `composition` in the type unless `TPose` is a `RectPose`. `IDENTITY_POSE_COMPOSITION` keeps every pose world; under it a container groups its children and never carries them. kernel3d's scenes name it.
  - Saves: `toJSON` writes version 3, whose child poses are local. `sceneFromJSON`, `Scene.loadState`, and `specsFromSerialized` read a version 1 or 2 save as world and make each pose local as it loads, under the scene's composition (`SpecsFromSerializedOptions.composition`). A recorded history from before is not restored: `SCENE_HISTORY_FORM` is 4.
  - Specs or ops you build with world poses for children: put them through `localizeWorldPoses(specs, composition)`, or `localizeInScene(scene, specs)` when they land under a container already in the scene. `worldPosesOf(specs, composition)` reads them back as world, and `heldInFrame(scene, id)` names what a container's frame holds.
  - `sceneToAdapter`'s `setPose` no longer moves a container's descendants by the same delta, and a container's pose target no longer shows them traveling beside it: the frame carries them. `PoseCascade` and the `cascade` argument of `scenePoseTarget` and `sceneClipTargets` are gone.
  - The group action makes a frame group, whose pose is authored, under any composition; it no longer derives an envelope's pose from its members under the identity strategy.
  - `resolvePreviews` answers each entry's pose in world, and a previewed frame brings the children it carries.
  - `SnapTarget.slotPose` is world, as documented; `snapToContainer` stores it in the target's frame.
  - `diagramScene` returns each spec's pose in its container's frame (`composition`, default `RIGID_POSE_COMPOSITION`; pass `IDENTITY_POSE_COMPOSITION` to read the layout in world). Body rows, container titles, lanes, and members are stored relative to what holds them; `DiagramView`'s reports, `diagramLayoutOf`, and `documentFromScene` stay in world.
  - `svgNodesFromKit` folds a tree's `composition` when it has one, and `unpackSvgFiles` stores each imported node in its container's frame.
- b668624: `hops` and `labels="dodge"` on `DiagramView` read each shape and edge end where it draws, as `router="avoid"` now does. Both read a container member's pose, which specs store in the container's frame, as a world box: an edge to a member found no crossing where it crossed, and a member covering a label did not move it.
- e9ea01b: `createSpecRouter` reads each shape and port where it draws, folding its pose through the containers above it, so `router="avoid"` routes an edge to and around a container's members where they are. Since specs began storing a member's pose in its container's frame, it read that pose as a world box: an edge to a member started off its shape, and the members between two others were no obstacle. It takes a `composition` option, which must match the one `diagramScene` was given; the default is the same.
- 928f014: A `step` branch symbol turned down a column (`direction: 'down'`) sets its title out past its widest cut label. Turned, the title and the cut labels both sit on the right edge, and a cut near the middle overlapped the title. Along a row, and turned with control from the right, where the title moves to the other side, nothing changes.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [cc0e73a]
- Updated dependencies [79357fc]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [a1b06d8]
- Updated dependencies [9912c13]
- Updated dependencies [3d36f5e]
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
- Updated dependencies [61e07e5]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [ec07e24]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [1c046e3]
- Updated dependencies [11e2b7d]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [6a69c27]
- Updated dependencies [b0a55a6]
- Updated dependencies [6cb0cf6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [81d08f7]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [d68c4f8]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [230a206]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8e2c8c8]
- Updated dependencies [cc0e73a]
- Updated dependencies [4f68c3a]
- Updated dependencies [ebe1f55]
- Updated dependencies [0fc0e50]
- Updated dependencies [3401898]
- Updated dependencies [058fcdf]
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [871a56b]
- Updated dependencies [f645651]
- Updated dependencies [7507e13]
- Updated dependencies [1e54d33]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [ca31c35]
- Updated dependencies [d5c4ee6]
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
  - @weasel-js/animator@1.14.0
  - @weasel-js/font@1.14.0
  - @weasel-js/clock@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/headless@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/simulation@1.14.0
  - @weasel-js/audio@1.14.0
  - @weasel-js/icons@1.14.0

## 1.13.0

### Patch Changes

- e70d2cd: A node is a mark or a group, and the two now behave differently:
  
  - A group never paints, whatever its data: a `shape` or `path` on a group draws nothing, and only its members draw. A mark with children paints itself and its children. A group is hit anywhere in its box, even with no member under the press or after its last member is deleted.
  - Ungroup dissolves only groups; a mark with children is left whole.
  - The area hit test's `includeContainers` option is now `includeGroups` (breaking for a custom `hitTestArea` dep). Marquee and lasso take a mark and its children, and a group only when asked for.
  - A mark's drawn bounds include its own ink as well as its children's.
  - Any node may clip, repeat (`copies`), lay out and set units for its children, and `'inherit'` fills and strokes read from any parent.
  - A drop or an insert lands in a mark only when the `canDropInto` dep admits it; with no dep, a group admits and a mark does not. An insert asks `canDropInto` with an empty list, since the new node is not minted yet.
  - Diagram bodies, containers, pools and lanes are marks, so they paint again and take drops through `diagramCanDropInto`. A stencil body still takes nothing, and a press inside an unfilled lane hits the lane.
  - In a diagram scene, `kind === 'group'` no longer identifies a body or a region. A region is a node where `diagramContainerOf(node)` is not null. A diagram group box is one where `diagramGroupOf(node)` is not null. A body is a node where `diagramNodeOf(node)` is not null and neither of those is. `isDiagramBody(node)` asks that, and `isBodyOrRegion(node)` asks for either.
- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- d5a9a80: A path effect whose source has an `'inherit'` fill or stroke paints that source in what it inherits from its containers, and follows a container's paint when it changes; it used to read as none. `DerivedDep` gains an optional `inherited`, which every dependency the scene builds carries, so any derivation can read the paint a dependency shows. `diagram:mark` resolves an `'inherit'` fill and stroke too.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- fb5bb67: Stories that were filed as components of their own now sit under the component they show: the arc labs are `On An Arc` stories of `Bar`, `RadioGroup`, `Slider`, `SwatchStrip`, `Tabs` and `ToggleBar`, `Along`'s labs are stories of `Along` beside a new `Default` story, the Prefs and ControlPanel extras are stories of `Prefs` and `ControlPanel`, `Keyboard Layouts` is a story of `KeyDiagram`, and the effect chart lab is `EffectChart`'s `Lab`. Their story ids change with their titles. Lab screens carry the `lab` tag.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
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
- Updated dependencies [8c39126]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [4c113da]
  - @weasel-js/core@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/animator@1.13.0
  - @weasel-js/audio@1.13.0
  - @weasel-js/font@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/simulation@1.13.0

## 1.13.0-rc.0

### Patch Changes

- e70d2cd: A node is a mark or a group, and the two now behave differently:
  
  - A group never paints, whatever its data: a `shape` or `path` on a group draws nothing, and only its members draw. A mark with children paints itself and its children. A group is hit anywhere in its box, even with no member under the press or after its last member is deleted.
  - Ungroup dissolves only groups; a mark with children is left whole.
  - The area hit test's `includeContainers` option is now `includeGroups` (breaking for a custom `hitTestArea` dep). Marquee and lasso take a mark and its children, and a group only when asked for.
  - A mark's drawn bounds include its own ink as well as its children's.
  - Any node may clip, repeat (`copies`), lay out and set units for its children, and `'inherit'` fills and strokes read from any parent.
  - A drop or an insert lands in a mark only when the `canDropInto` dep admits it; with no dep, a group admits and a mark does not. An insert asks `canDropInto` with an empty list, since the new node is not minted yet.
  - Diagram bodies, containers, pools and lanes are marks, so they paint again and take drops through `diagramCanDropInto`. A stencil body still takes nothing, and a press inside an unfilled lane hits the lane.
  - In a diagram scene, `kind === 'group'` no longer identifies a body or a region. A region is a node where `diagramContainerOf(node)` is not null. A diagram group box is one where `diagramGroupOf(node)` is not null. A body is a node where `diagramNodeOf(node)` is not null and neither of those is. `isDiagramBody(node)` asks that, and `isBodyOrRegion(node)` asks for either.
- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- d5a9a80: A path effect whose source has an `'inherit'` fill or stroke paints that source in what it inherits from its containers, and follows a container's paint when it changes; it used to read as none. `DerivedDep` gains an optional `inherited`, which every dependency the scene builds carries, so any derivation can read the paint a dependency shows. `diagram:mark` resolves an `'inherit'` fill and stroke too.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- fb5bb67: Stories that were filed as components of their own now sit under the component they show: the arc labs are `On An Arc` stories of `Bar`, `RadioGroup`, `Slider`, `SwatchStrip`, `Tabs` and `ToggleBar`, `Along`'s labs are stories of `Along` beside a new `Default` story, the Prefs and ControlPanel extras are stories of `Prefs` and `ControlPanel`, `Keyboard Layouts` is a story of `KeyDiagram`, and the effect chart lab is `EffectChart`'s `Lab`. Their story ids change with their titles. Lab screens carry the `lab` tag.
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
- Updated dependencies [8c39126]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/animator@1.13.0-rc.0
  - @weasel-js/audio@1.13.0-rc.0
  - @weasel-js/font@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/simulation@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 22d571c: The `chain` layout, and the `rack` look built on it, now leave room for group boxes across the line as well as along it. The gap between two levels of hung nodes widens by the inset of a group ending at one and starting at the other, so a box's inset no longer overlaps an outsider hung past it when the inset is wider than `nodeGap`. On a vertical line it also widens for a group's `minWidth`, which before it honored only on a horizontal one. Grouped chain layouts with hung nodes come out slightly taller (or wider) than before.
- b571ad6: A node's `fill: 'inherit'` or `stroke: 'inherit'` now takes its nearest enclosing container's fill or stroke whole. If that container inherits too, the lookup keeps going up, and at the root it is none. A container's fill and stroke are only a source: the built-in `kit:shape` and `kit:path` painters no longer paint a container's own fill or stroke, and its interior is no longer hit for picking.
  
  The scene's draw wrapper passes the resolved paint to painters as `ctx.inherited` on `NodePaintCtx`, and pickers pass it on `NodeInkCtx`. A painter's memo has to key on it: `nodeMemo` takes an extra reference-compared key for this, and the paint stays the same object while its sources are unchanged. **A custom painter that does not read `ctx.inherited` paints an `'inherit'` field as none.** Pass the field and `ctx?.inherited?.fill` to `resolveFill` (or `resolveStroke`) to pick it up. `diagram:shape` reads it. Readers outside a painter can use `inheritedPaintIn(scene, node)` and `withInheritedPaint(data, inherited)`, and `paintAbove(scene, node)` says what inheriting would paint.
  
  SVG import turns a `<g>`'s fill and stroke into its container's, and a child that sets none of them gets `'inherit'`. A gradient, or a child faded further than its group, is still copied onto the child. Export writes a container's paint on its `<g>` and leaves the attribute off a child that inherits a solid one.
  
  `SelectionPanel` adds an Inherit choice beside None for a node's fill and stroke, showing the paint it would take. `PaintField` and `PaintInput` offer it when given `inherit` (`{ paint, onInherit }`); their `value` may be `'inherit'`, and `onChange` is unchanged.
- 0510091: `DiagramView` fits again when new specs run past what it shows, while the user has not panned or zoomed it, and `fit()` on the ref fits it on demand, even after they have.
  
  A `DiagramOverlay` placed beside its target is kept inside the view when neither side of the target has room for it, rather than overflowing the near side.
  
  `diagramScene`'s `nodeStyle`, `groupStyle` and `edgeStyle` may answer `undefined` to keep the default look, and the no-theme defaults are exported as `DEFAULT_NODE_STYLE`, `DEFAULT_GROUP_STYLE` and `DEFAULT_EDGE_STYLE`.
- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- d5270fe: The `lanes` look now routes a wire around each group box that holds neither of its ends, taking a lane-edge corridor clear of the box and changing height outside it; a wire into or out of a group still crosses that group's boundary to reach its port. A group's box, its title included, now stays inside the lanes its members stand in: each member keeps the group's top and bottom inset clear of the lane edge, so charts with groups come out slightly taller than before.
- 3aaee5d: `useLiveAudioRunner` no longer remakes its runner when `nodes` is rebuilt in render with the same entries, so `nodes={{ ...audioStageNodes, mine }}` written inline stops re-rendering forever. Adding, dropping or replacing a stage type's node still remakes it.
- 24f2495: An absent fill or stroke now means none everywhere, read through `resolveFill` and `resolveStroke`. This breaks three things that used to fill in a default:
  
  - **A text node built without a `fill` now draws no glyphs.** Write `fill: { paint: solid('#000') }`, or `DEFAULT_TEXT_FILL`, now exported from `@weasel-js/text` and `@weasel-js/core`. `DEFAULT_TEXT_STYLE.fill` is `null`. The text insert, the sticky note and SVG import write black themselves.
  - **A derived part with no `fill` or `stroke` no longer takes its node's.** Write `INHERIT` (`'inherit'`) for that; `DerivedPart` allows it, and `resolvePartPaint` is the one reading of a part's paint.
  - **`diagramShape` drops its `defaultFill` and `defaultStroke` options.** An outline paints what its data names; `diagramScene` already writes the default style onto every node. SVG import writes SVG's initial black onto text that names no fill, and SVG export writes `fill="none"` for text that has none.
  
  `setFill` and `setStroke` write None as a record with no `paint` rather than `null`, so a stroke keeps its width and dash; a `paint: null` passed when the gesture starts used to be read as no paint given and painted the default color. The selection panel shows a fill or stroke paint as a paint, None or Mixed, never unset; `nestedPaintValue` is that reading. Booleans, Outline Stroke and the character bar read a fill with no paint as unfilled. Core re-exports `resolveFill`, `resolveStroke`, `INHERIT` and their types.
- f461572: `DiagramView` now draws a node's perimeter port labels. A node's `portLabels` are children of its
  container and sit outside its box, and a container clips its children to its painter's
  silhouette, so every one of them was clipped away. `buildBody` now gives the container a `clipFromPose` that clips nothing.
  
  Core exports that clip as `clipNothing` (from `@weasel-js/core` and `@weasel-js/core/math`),
  for any container whose children may draw outside it. Every scene's registry carries it under
  `CLIP_NOTHING`, so a container using it saves and loads with no registry entry of the consumer's.
  A symmetry group now uses it too, and still saves under `SYMMETRY_CLIP_KEY`.
- Updated dependencies [dbd6711]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [6f601f7]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/audio@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/animator@1.12.0
  - @weasel-js/simulation@1.12.0
  - @weasel-js/font@1.12.0
  - @weasel-js/icons@1.12.0

## 1.11.1

### Patch Changes

- 267d5e4: Connectors can route around shapes. The `avoid` router draws a connector orthogonal, with few bends,
  clear of every shape, and with parallel runs spread apart. Its route is computed when the scene is
  edited and stored on the edge as `diagram.route`, so a saved file draws it without rerouting and
  undo restores it exactly; a stored route that no longer fits its ends draws as `orthogonal`.
  `useAvoidRouting(scene)` (or `installAvoidRouting` outside React) reroutes whatever each edit
  disturbed in that edit's own undo entry, and reroutes the connectors near a dragged shape every
  frame. Containers, pools, and group boxes are in the way only of connectors with neither end inside
  them; lane bodies never are; headers always are. Dragging a segment of an `avoid` connector pins
  only that segment. `DiagramView` takes `router="avoid"`, and `createAvoidRouter` — the search alone,
  over plain boxes and ports — is in `@weasel-js/diagram/layout`. New commands set the selected
  connectors' router (`SET_ROUTER_ACTION_IDS`), and layout no longer writes waypoints to an `avoid`
  connector.
  
  Core adds scene edit passes: `scene.addEditPass(pass)` hears each live edit's added, removed,
  posed, re-parented, and data-changed ids once its own mutations and the arrival handler have run,
  and its ops join the same undo entry. Passes never re-trigger on their own writes, and undo, redo,
  and history replay never run them. While any pass is added, a bare scene call runs as an edit of
  its own.
  
  weaselchart's connector tool draws connectors that route around shapes, and Format › Connector
  picks Around shapes, Orthogonal, Straight, or Curved for the selected connectors. Charts saved
  before keep the router they have.
- 922cddf: Diagrams get containers and swimlane pools, and core's layouts and drops carry and filter nested nodes.
  
  - core: a layout pass that moves a child container now takes that container's descendants along, under absolute poses, in the same edit; so does a layout drop that shifts siblings, in its preview and its commit. `carriedDescendants(source, root, translate)` and `sceneCarrySource(scene)` are the helper behind both. A new optional `canDropInto(parent, ids)` dep (`CanDropIntoDep`) decides which containers a move may drop into: reparent-on-drop passes over a refused container, the layout drop skips it, and a child leaving its layout container does not land in it.
  - diagram: `CONTAINER_STENCILS` offers Container, Pool (rows), and Pool (columns). A container is a titled box whose members move with it and stay put when it is resized; a pool stacks lanes that reorder by their headers, resize by the boundary after each (`diagram.resizeLane`), and grow by the button past the stack (`diagram.addLane`). `diagram.releaseMembers` removes a container and keeps what it holds. `diagramCanDropInto(scene)` is the drop filter, `diagramContainers` returns the lane layer and the contribution, and `diagramContainerLayout` and `laneStackLayout` register through `withDiagramRegistry`. `useStencilInsert` takes `containers`, and a stencil drawn inside a container or a lane becomes its member. Lanes take no connectors, and `diagramResizable` refuses them.
  - core: a container with a layout is arranged again whenever one of its children's poses is written — a nudge, an align, a panel edit — not only when its children or its size change, in the same undo entry as the write.
- d5a4102: Breaking at the type level for custom `commit` and `canConnect` callbacks: the ends of a `PendingEdge` and the arguments of `CanConnect` are now a `ConnectEnd`, which is a port or a shape's body, where they were always a port.
  
  `@weasel-js/diagram` gains editing surface. Edges connect onto a shape's body (`connectBodies`, the `bodies` option, and a connector tool), and a selected edge's ends reconnect by dragging a handle. A label action (`editEdgeLabelAction`, `edgeLabelSpec`, `labelSize`) creates and edits an edge's label. Stencils (`FLOWCHART_STENCILS`) come with `useStencilInsert` and `useStencilTool`. `DiagramView` takes `onReconnect`, `onDelete`, `onEditLabel`, `connectBodies` and `ambient`, and its ref has `worldAt`. `diagramResizable` keeps resize handles off edges and labels. `DataEdge` and `EffectWire` take an optional `id`, and the `ellipse` outline is new. For effect pipelines there is an edit model, stage types with typed params, and `EffectEditor`, an editable node graph.
  
  `@weasel-js/core` exports `createDeleteAction` and `commitDeleteToScene`, so a consumer can swap how a delete commits.
- 9cd12f7: Edge labels are obstacles, and they dodge. An `avoid` connector now routes around every other
  connector's label, 4 world units clear (`labelClearance`), and never around its own; within one
  commit a label is restationed on its connector's new route before the next connector routes.
  `AvoidEdge.label` carries it, filled from the scene and from `DiagramView`'s specs. An obstacle's
  `kind` may now be `'label'`.
  
  After any edit, `useLabelPlacement(scene)` (or `installLabelPlacement` outside React) moves a label
  that sits on a shape, another label, or another connector along its own connector, or across it,
  to the nearest clear station, in that edit's own undo entry, and sizes a label to the text an edit
  gives it. The chosen station is stored on the label trait as `placed`, which `labelDerivePose`
  reads before `at` and `offset`; `dodge: false` opts a label out. Labels hold still during a drag
  and settle on release. `DiagramView` takes `labels="dodge"`, `createSpecLabelPlacer` is that step
  on its own, and `placeLabels` — the placement alone, over plain boxes and routes — is in
  `@weasel-js/diagram/layout` with `labelCenter`.
  
  Core adds `documentDepOf(scene, id)`: a dependency at the pose and path the document holds, with
  no override counted, for a reader such as an edit pass.
  
  weaselchart places edge labels, so a shape dropped on a label moves the label off it on release.
- e5ba382: Connectors can jump each other. While a scene's `HOPS_DOC_KEY` document value is set, wherever two
  connectors cross, the one later in render order bows over the other in a half circle of the value's
  `size`. A hop bulges toward −y on a horizontal run and toward −x on a vertical one, whichever way the
  connector travels, and to the left of travel on a diagonal. Crossings near either connector's ends
  or a bend, and collinear overlaps, make no hop, and hops closer than twice their radius merge into
  one longer hop. A connector split across pages neither hops nor is hopped over. Each connector stores its hops as `diagram.hops`, so a saved file draws them with no
  pass running, and a hop no longer on its connector's route does not draw.
  
  `useHops(scene)` (or `installHops` outside React) recomputes the hops an edit disturbed in that
  edit's own undo entry, and turning the value on or off recomputes or clears them all in the one
  entry that sets it. While a drag is in progress, the connectors it moves, and those hopping over
  them, draw without hops until release. `diagramWaypoints` carries a Line jumps toggle
  (`SET_HOPS_ACTION_ID`), `DiagramView` takes `hops`, a radius, and `edgeHops`, the crossing finder
  over plain polylines, is in `@weasel-js/diagram/layout`.
  
  Core's `TransformFollower.preview` gets a second argument: the data the followers before it
  previewed, by id, so a follower can build on a route an earlier one previewed. A follower that
  calls `preview` itself now passes it. `useAvoidRouting`'s drag preview reads the waypoints a
  `waypointFollower` registered before it carried, rather than carrying them itself, so without one
  the preview leaves waypoints where the commit will.
  
  weaselchart adds Format › Connector › Line jumps.
- 8e317f5: Off-page reference markers. On a scene with pages, a connector whose two shapes sit on different
  pages no longer draws across the gap: each end draws a short stub out of its shape, ending at a tag
  that reads the other page's name and a reference letter, such as "Page 2 · A".
  `useOffPageMarkers` (or `installOffPageMarkers` without React) splits and joins connectors as edits
  move their ends or change the pages, in that edit's own undo entry, and writes
  `DiagramEdge.offPage`. The tags are text nodes with a background (`offPageTagSpec`, registry key
  `diagram:offPageTag`), colored by the theme. `diagramOffPage()` binds a double-click on a tag to
  selecting the shape at the far end and fitting the view to its page. `offPageSplits` is the split
  rule as arithmetic, and `offPageOps` runs the pass over named connectors.
  
  A split connector's `ResolvedRoute` carries its two `stubs`, it shows no route handles, and the
  `avoid` router leaves it out until it joins again. An edge label on a path with several subpaths
  sits on the first (`subpathOf`).
  
  `pageName` (core) is the name a page shows, its own or "Page" and its place, and `PageTabs` uses it.
- d3787a4: An effect pipeline can be run, not only drawn. `runPipeline` evaluates it in `runOrder` with an
  `EffectEvaluator` per stage type and an `EffectValueKind` per value type, filling each stage's cost,
  values, and previews; a stage nothing reaches is skipped, a bypassed stage passes its input through,
  a throwing evaluator records its `error`, and stages on a cycle never run. A stage with no outputs
  shows and previews what reached its inputs (`shownPorts`), so a sink shows the finished result. `createEffectRunner` runs
  one pipeline whole, a stage at a time (the run's new `at`), or every frame while playing, and closes
  the previews of runs that are off screen; `useEffectRunner` plays it through `useVisibleRaf`.
  `IMAGE_STAGE_TYPES`, `imageEvaluators`, `imageValueKinds`, and `testCard` run image pipelines on
  `OffscreenCanvas`. `paintRun` outlines the stage a run is `at` and writes a stage's `error` where its
  cost goes, and `EffectEditor` takes a `run`, fading the port dots of unreached stages as
  `EffectChart` does.
  
  weaselchart's pipeline mode has a Run menu (Run, Step, Play, Pause, Reset, and Choose Source
  Image…) and View › Show Values and Show Previews; its stage palette is now `IMAGE_STAGE_TYPES`.
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
- 7ffc196: Connector routes are editable, and whole-node transforms carry other nodes along through one dep.
  
  - core: a `transformFollowers` dep holds every `TransformFollower`, `{ preview(frame), finish(ops, label) }`, and each whole-node transform (move, resize, rotate, flip, align, distribute, nudge, transform again) finishes its batch and previews its frame through all of them in order. `useTransformFollower` adds one. Path edit's constraint links are now one of them, so `EditAnchorsDep.transformOps` and `EditAnchorsDep.transformPreview` are gone; that is breaking for anyone who called them. `writtenBy(scene, ops)` reads the pose and data a batch leaves each node it writes.
  - diagram: a selected edge shows handles along its route. Under `straight` and `bezier`, a dot on each waypoint moves it and a hollow dot in each leg inserts one; under `orthogonal`, a bar slides its segment, jogging where it touches a port. A double-click removes a waypoint or straightens a jog. Drags snap into line with neighboring stops and port axes. `diagramWaypoints` returns the handle layer and a contribution carrying the drag, the double-click, and the `diagram.resetRoute` command; the math is exported on its own (`routeHandles`, `dragSegment`, `simplifyStops`, and the rest). `waypointFollower(scene)` carries waypoints along with a move of both ends. `DiagramView` takes `onEditRoute`, and `EffectEditor` keeps wire routes in `EffectDoc.routes` (`setWireRoute`). `edgeRouter` answers an edge's resolved route, as `edgeDerivePath` draws it.
- 11e1ecb: The container stencils carry palette glyphs. `ContainerStencil` takes an `icon`, and
  `CONTAINER_STENCILS` sets one on each: a box with a title band for Container, a box with a left
  header and two stacked lanes for Pool (rows), and a box with a top header and two lanes side by
  side for Pool (columns). The glyphs are diagram's own `diagram` icon namespace, published as
  `@weasel-js/diagram/icons` and found by the icons build plugin through the package's
  `weaselIcons` field; an app that registers tables by hand adds this one beside the kit's.
- 853ce69: A dep source is handed `below`, which reads the source it displaced, in its own scope or one above, so a source can handle part of a dep and pass the rest to the default (`DepSource`, accepted by `useDepSource` and `DepRegistry.register`). A source taking no argument works as before. `useStencilInsert` uses it: a kind no stencil names goes to the `insert` dep beneath it, so core's rect, ellipse and text tools work beside stencils.
- 10da7a0: A body's label rows are centered in their row (`rowTextStyle`, used by `diagramScene` and by stencils alike); field rows stay left-aligned. `formatParam` shows a number to as many places as its control's `step` has, and never prints `-0.0`. `EffectEditor` pins every stage where it shows on a drag, as adding a stage already did, so layout no longer moves the stages nobody placed, and a delete clears its picked wire. `dropEmptyEdgeLabel` removes an edge label whose edit ended with no text; pass it as a text edit's `onEnd`.
  
  `CanConnect` takes a third argument, `moving`: the edge and end a reconnect is carrying, absent for a new connect. A connect or reconnect no longer lands on the body of a shape with no ports, which left an edge with nothing to route to. A reconnect's preview aims its fixed end the way the committed edge will, at the first waypoint when there is one, through `endAims`, the one rule both now share.
- 1729b01: `DiagramData` takes containers and pools. `containers` lists regions by id, each a container with
  `members` or a pool with `lanes`; `diagramScene` builds each as a scene container holding its
  members, outer regions first. A container with a `box` is laid out as one node of that size and its
  members ride along with it, a member with no `at` seeded inside it in rows; one with no `box` is laid
  out as a group and fits its members. A pool always has a box, and its lanes stack at their `size` or
  share what the box leaves. An edge with an end inside a boxed region ranks against the outermost one.
  Under `theme`, regions take the theme's container and lane colors, or a `style` role's, and their
  titles the theme's face. A node named by both a group and a region is refused: `diagramScene` throws.
  
  `DiagramView` takes `onEditContainer`, which reports a region moved or resized (`box`), a lane
  boundary dragged, a lane reordered by its header, or a lane added (`lanes`), a header
  double-clicked (`title`), and Release members (`release`), keeping none of them until the specs
  follow. `NodeMove` carries `parent` when a drop changed the region a node is in, `onDelete` reports a
  deleted region with everything inside it, and the view lets shapes drop only into containers and
  lanes. `router="avoid"` routes around regions and their headers as the scene router does, and
  `diagramLayoutOf` also returns the boxes layout gave containers and pools.
  
  `regionSpecs` and `firstLanes` are exported, so stencils and data build regions one way, and
  `editContainerTitleAction` reports a double-click on a header. The data types moved to their own
  module; every import path is unchanged.
- 06f7bca: `DiagramData` takes `pages`: `diagramScene` splits a connector between pages into stubs with off-page tags, as chart mode's edit pass does.
- 455a34f: `@weasel-js/diagram-formats` reads and writes draw-style XML as `DRAW_XML`, listed in
  `DIAGRAM_FORMATS`. It is the format that keeps a chart laid out: one `<diagram>` per page, each a
  graph model of cells with a style string and a geometry. Reading takes pages written out or
  compressed (base64 of raw deflate of the URI-encoded model), and a bare graph model as one page.
  It keeps places and sizes, outlines (rhombus, ellipse, hexagon, parallelogram, trapezoid, and a
  rounded rect of arc size 50 or more as a stadium), fill, stroke, and font colors, font size,
  family, and bold, HTML text with its tags stripped and its breaks kept, containers, swimlane pools
  of lanes, groups, routers, waypoints, exit and entry points as the nearest compass port, edge
  labels and where along the edge they sit, and arrowheads. A shape it does not know becomes a rect,
  with a warning, as do edges with a loose end and merged layers. Writing spells out every color
  under the document's theme, lays out a page whose nodes have no place, writes an avoiding
  connector as orthogonal along its route, and leaves out edges between pages, with a warning.
  
  `@weasel-js/diagram` exports `NODE_STROKE_WIDTH`, `LANE_STROKE_WIDTH`, and `EDGE_STROKE_WIDTH`,
  the outline widths it draws with when a style gives none. `@weasel-js/svg` exports `escapeAttr`
  and `escapeText`, the escaping it writes XML with.
- 46224b6: Groups now work under the `rack` and `lanes` looks. Layouts that have groups change: the `chain`
  layout keeps each group's members together and moves stages outside a group out of its columns,
  and the `lanes` look gives each group columns of its own. `EffectEditor` reorders a group by
  dragging its title and renames it by double-clicking the title under both looks, moves a run of
  stages along the chain as one, and refuses a stage drop that would split a group. In
  `ReorderItem`, `grip` accepts `null` for an item that has gaps but can't be picked up, and a
  `'bar'` drag now moves everything an item `carries`.
- ef71bf5: `@weasel-js/diagram-formats` gains the interchange document every diagram format reads and writes.
  A `DiagramDocument` is a list of pages, each a sheet size and a `DiagramData` in coordinates from
  the page's corner, plus the edges that run between pages and the theme. `documentFromScene(scene)`
  reads a diagram scene into one, keeping only the colors the scene's theme would not give;
  `documentSpecs(doc, { layer, theme, measure })` turns one back into scene specs and the
  `core:pages` and `diagram:theme` document values, laying out once any page whose nodes are not all
  placed. A `DiagramFormat` has `detect`, and `read` and `write`, each returning its warnings;
  `DIAGRAM_FORMATS` lists them, `detectFormat` picks one by content and then by extension, and
  `readDocument` reads a file with it. `DIAGRAM_JSON` is the first format: the document as JSON.
  
  In `@weasel-js/diagram`, a `DataNode`, `DataEdge`, `DataContainer`, and `DataLane` take `colors`
  of their own, which `diagramScene` draws over the theme and lists in the trait's `ownStyle`, so a
  theme change leaves them. A `DataEdge` takes a theme role in `style`. `diagramScene` takes a
  `layer`. `dataNodeStyle`, `dataEdgeStyle`, and `dataRegionStyle` give the style each data item is
  drawn in.
- 4a74f67: One reorder drag: `createReorderAction` carries an item of any drawn sequence and takes a `show`
  option, `'bar'` (the default) for an insertion bar or `'slide'` to slide the other items into place.
  `DiagramView`'s `onReorder` is now built on it through `groupReorderSlots`, and the pipeline editor's
  stage and lane reorders use it too; `onReorder` behaves as before.
  
  Breaking: `createSlotReorderAction`, `slotReorderContribution`, `slotReorderBinding`,
  `SLOT_REORDER_ACTION_ID`, and `reorderBindings` are gone. Use `createReorderAction`,
  `reorderContribution`, `reorderBinding`, and `REORDER_ACTION_ID` (`'diagram.reorder'`), whose
  `slots` now also hears the press point. `createReorderAction` no longer takes a report callback;
  `groupReorderContribution(report)` is what `onReorder` installs. A move's `commit` hears `order`
  beside `id`, `from`, and `to`, and an item lands in the gap nearest its middle rather than the
  pointer.
- e30f4df: `DiagramView` can hold DOM against its nodes, groups and edges, report what the pointer is over, and let a group's members be dragged into a new order. All three are additive.
  
  - `overlays` places each `DiagramOverlay` against its target after every paint: centered on it, or beside it through geom's `placeRect`, flipping inside the view. An edge's place is the midpoint along its route. The view now renders a box around its canvas to hold them, and `className` goes on that box rather than on the canvas.
  - `onHover` reports the node, group or edge under the pointer; `pickEdges` lets a click or a hover land on an edge whatever editing callbacks are set. `rectOf(id)` and `subscribeFrame` on the ref give a target's client rect and when to read it again.
  - A `DataGroup` with `reorder: 'x' | 'y'` lets `onReorder` drag any member along that axis, carrying everything inside a member that is a group, or step the picked one with Alt and an arrow key. It reports `{ group, order }` and moves nothing. `layered` keeps such a group's members in the order given across every rank instead of sorting them by crossings. `createReorderAction`, `createStepReorderAction`, `reorderBindings` and `reorderContribution` are exported for use outside `DiagramView`.
  
  `SceneCanvas` takes `onHover`, called when the topmost pickable node under the pointer changes. `@weasel-js/react` exports `adoptCss`, `adoptCssOnce` and `styleRootOf`, the stylesheet adoption core's canvas and `KitSettingsFromPrefs` now share.
- e7ba51a: Diagram themes. A `DiagramTheme` holds a style per role (`DIAGRAM_ROLES`: default, accent, muted, positive, warning, negative), connector and label colors, container and lane looks, a page color, a font, and a color series. `DIAGRAM_THEMES` ships `paper`, `night`, `blueprint`, `pastel`, and `mono`, and `diagramThemeFromTokens(read)` builds one from resolved `--wzl-*` values.
  
  - A theme writes literal colors into the scene. `applyDiagramTheme(scene, theme)` recolors every shape, text row, group, connector, and label and saves the theme as the `diagram:theme` document value, as one undo entry; `themeWrites` is its pure half, and `diagramThemeOf` reads the value back.
  - `DiagramNode` and `DiagramEdge` gain `style` (a role id) and `ownStyle` (the colors set by hand, which a theme leaves). `setDiagramStyle` names a role and recolors in it; `setDiagramColor` sets a fill, stroke, or text color by hand. `diagramStyleOf` reads either back.
  - `DiagramSceneOptions.theme` draws each `DataNode` in its new `style` role, and edges, groups, labels, and text in the theme. `stencilBuild` and `useStencilInsert` take `font`. `roleStyle`, `roleEdgeStyle`, `themeEdgeStroke`, `themeFont`, `themeLabelFont`, and `themeLabelStyle` turn a theme into what the insert paths take.
  - The effect looks take `theme` in their options (`LookThemeOptions`; default `night`, `LOOK_THEME`), reading stage styles, lane bodies, and type colors from it. Under `night` they draw exactly as before. `typeColors` takes the series and `stageStyle` and `sceneStyles` the theme, as optional last arguments.
- 8c2a9a9: `DiagramView` takes `onResize`. With it set, a selected node shows resize handles; the box resizes
  live under the drag, and on release the view reports `{ id, x, y, width, height }` for each resized
  node and changes nothing until the specs follow. Store the box as the data node's `width`, `height`,
  and `at`; the size is a minimum, so a box dragged smaller than its rows grows back to them.
  `diagramResizable` now refuses a group's box, whose size comes from its members.
  
  Core adds `createResizeAction({ commit })`, the resize action with its commit swapped: `commit` is
  handed each resized node's pose at release, and the scene is left as it was.
- 13fc67f: An edge label can be dragged along and beside its edge. `diagramLabelDrag({ scene, selected })`
  returns a layer and a contribution: a drag on a label (`diagram.moveLabel`) stores where it was
  dropped as a fraction along the route (`at`), an offset from the line (`offset`), and
  `dodge: false`, so label placement leaves it there and it keeps its spot when the edge reroutes. A
  click on a label selects its edge, and a double-click edits its text. Locked and hidden labels do
  not drag. With no `commit` the drag writes the scene in one undoable entry; `DiagramView` reports it
  through `onMoveLabel` instead. `diagram.resetLabel` (`RESET_LABEL_ACTION_ID`) puts the selected
  edges' dragged labels back to `LABEL_PLACEMENT`, which the main entry now exports.
  
  Geom adds `PathMeasure.nearest`, the arc length along a path nearest a point.
  
  All of it is additive. weaselchart adds label dragging and Format › Connector › Reset label.
- adadf5e: Scene edit passes now compose. `scene.addEditPass(pass, { order })` runs passes by ascending
  `order` (default 0), ties in the order they were added, and each pass hears the edit's own changes
  plus every write the passes before it made; it still runs once per edit, and undo, redo, and
  history replay still run none. This changes what a second pass hears: it used to miss the first
  pass's writes. `SceneEditSummary.docChanged` lists the document-value keys an edit set.
  
  Diagram exports `DIAGRAM_PASS_ORDER`, where each of its passes runs, and avoid routing installs its
  pass at `DIAGRAM_PASS_ORDER.avoid`. The routers (`straight`, `orthogonal`, `bezier`, `avoid`,
  `ROUTERS`) moved to their own module; the package exports them as before.
- d863c74: `EffectEditor` edits wire routes under the `rack` and `lanes` looks as well as `nodeGraph`. A
  selected wire shows its route handles, and a drag reports `'Edit route'` with the route in the new
  `EffectDoc.lookRoutes`, kept by look and by wire together with where the wire's two ports were drawn.
  Since these looks move stages on every reorder or added stage, a route is drawn only while both
  ports are still there, and otherwise the look routes the wire itself. Reset route gives the wire
  back to the look. `setLookRoute`, `applyLookRoutes`, `pruneLookRoutes`, and `wireEnds` are exported
  from `@weasel-js/diagram/effect`, and so is `setWireRoute`, which the README already named.
  
  A reorder now drops the routes, under every look, of the wires it rewires or removes, so a new wire
  that takes a freed id starts unrouted. Removing a wire or a stage drops its routes under every look.
  Files saved before have no `lookRoutes` and load unchanged.
  
  weaselchart's pipeline mode gains Format › Connector › Reset route.
- b3aa7cb: `documentFromScene` exports a shape sitting in the gap between pages on the nearest page rather
  than the first, and marks a connector cross-page exactly when the scene's off-page split does. A
  connector from a gap shape to another page stays whole, keeping its waypoints in world
  coordinates. core gains `pageHolding`, the page a box is on, else the nearest one.
  diagram gains `documentBoundsOf`, the box a node has in document space, which off-page splitting and
  export now both read.
- cf036c2: Add `@weasel-js/diagram/effect-audio`, which plays an audio pipeline through a patchable `@weasel-js/audio` graph. `createLiveAudioRunner` (and the `useLiveAudioRunner` hook, or `useFollowAudioRunner` for a runner the caller makes later) edits the graph as the pipeline changes, so a delay keeps its tail when another stage is tweaked. `AUDIO_STAGE_TYPES` is the palette, `audioStageNodes` maps each stage to its graph node, and `drawScope` and `drawSpectrum` draw a stage's output into its preview. `@weasel-js/audio` is an optional peer dependency.
- 672d5cd: `EffectEditor` edits a pipeline's groups. Under `nodeGraph` each group is a titled container: drag
  a stage into or out of it, drag the box to carry what it holds (the stages, the boxes inside it,
  and the routes of wires between them, as one `'Move'`), resize it (`'Resize group'`), or
  double-click its title to rename it in place (`'Rename group'`). A resized box is stored in the new
  `EffectDoc.groupBoxes`; a group with none fits its members, so older docs load unchanged. Under
  `rack` and `lanes` groups draw as before. `selectedGroup` and `onSelectGroup` pick a group under
  every look, and the ref gains `group`, `ungroup`, and `renameGroup`.
  
  The edits are plain functions in `@weasel-js/diagram/effect`: `groupStages`, `ungroup`,
  `renameGroup`, `moveToGroup`, `setGroupBox`, `moveGroup`, `groupContents`, and `nextGroupId`.
  `removeStages` drops the box of a group it leaves empty, and no longer drops a group that was
  empty before it ran. `EditorScene` gains `groupOf`.
  
  `EffectEditor` now reports a drag's moves a microtask after `DiagramView` does, so that a group
  box's move and the stage moves it carried arrive as one edit.
- b85addf: Route-handle drags now snap through the canvas's `snap` dep instead of a private snapper: a dragged bend or segment still lines up with the stops beside it and with a port's axis within `snapPx`, and now also with the canvas's other sources, such as a grid. Ctrl suspends snapping, Shift holds a dragged bend to the axes and diagonals, and the alignment marks are drawn by the canvas's snap readout rather than as the action's own guide overlay. The edited edge offers no targets, and the canvas's default anchor snapping (`'path-snap'`) is left out for these drags. `snapPoint`, `portTarget` and `stopTarget`, and their types `SnapTarget` and `Snapped`, are removed.
- f819e61: Breaking for anyone naming ui's shape glyphs: the plain shapes move out of `@weasel-js/ui` into `@weasel-js/icons`, under a namespace of their own, so `ui:shapeHexagon` is now `shape:hexagon`, and every package may name them without depending on ui. Their table is `@weasel-js/icons/shapes`, and ui's `kitIcons` includes it. There is one new glyph, `shape:trapezoidSide`, a trapezoid on its side with its narrow end west.
  
  `ToolPalette` takes `columns`, which lays each group out as a grid that many buttons across, and `onToolDragStart`, which makes each button a drag source. `ToolGroup` takes `columns`, and `ToolButton` takes `onDragStart`.
  
  A `DiagramStencil` takes an `icon`, its tool's palette glyph, and each of `FLOWCHART_STENCILS` has one.
  
  `@weasel-js/icons-plugin` reads a workspace package's source table when the table its manifest declares is not built yet.
- ac892f8: `EffectEditor` takes `look`: `'nodeGraph'` (default), `'rack'`, or `'lanes'`, with that look's options. Under rack and lanes, connecting, reconnecting, and deleting work as under node graph, and a stage on the main line drags along it to another place, which rewires the pipeline (`'Reorder'`). Under lanes a lane drags by its label (`'Reorder lanes'`). `editorScene(doc, look, options)` replaces the node-graph-only signature, which is breaking for a caller that passed options second.
  
  The effect model gains `chainLinks`, `moveInChain`, and `canMoveInChain`; `EffectDoc.laneOrder` with `setLaneOrder`; `laneTypeOf`; and `order` and `laneOrder` on `EffectLookResult`, which `rack` and `lanes` fill. `@weasel-js/diagram` adds `createSlotReorderAction`, `slotReorderContribution`, and `sequenceSlots`, which drag one item of any drawn sequence along its axis and draw an insertion bar. Core's overlay strokes and routing's `OverlayRole` add the `insert` and `refused` roles that bar draws in.
- Updated dependencies [70b12d1]
- Updated dependencies [ca1f524]
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
- Updated dependencies [ee2f0fc]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
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
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/audio@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/simulation@1.11.1

## 1.11.0

### Patch Changes

- 4447e67: A canvas host given no `width`/`height` fills its parent and follows it as it resizes: `Canvas`,
  `SceneCanvas`, `LeanSceneCanvas`, `DrawCanvas`, `SceneViewCanvas` and `MinimapCanvas`, each with a new
  `onResize` reporting every size. Nothing paints until the first measure. On a resize the view keeps
  its transform, so more or less of the world shows; `DiagramView` and `EffectChart` refit until the
  user pans or zooms, and `MinimapCanvas` refits its overview. `DrawCanvas`'s `draw(size)` gets the
  measured size. Core exports `SurfaceSizeProps` and `viewportWorldRect`; labkit's
  `TrialSceneCanvas` fills through `SceneCanvas` instead of measuring its own trial.
  
  `createGridLayer`'s `bounds` is now optional and receives the paint's view and canvas size. Omitted,
  the grid covers whatever the canvas shows, its lines held on world multiples of `spacing` as the view
  pans, and any set of lines that would sit closer than 4px on screen is left out.
- e3637c9: EffectChart fixes and additions:
  
  - `rack` widens a stage on its line so the side ports along its top or bottom sit at least `SIDE_PORT_GAP` (24) apart, however many there are.
  - Branch symbols take `{ controlSide, style, tints }`. `rack` passes `controlSide: 'bottom'` with `side: 'below'`, so a control wire comes straight up from the stage driving it; a symbol's title then moves above it, and a diamond takes control in by its lower-left edge, keeping its bottom vertex for the second exit. A symbol's lines, dots and ticks take the `text` color of `style` (default `stageStyle(stage)`), so a bypassed decision draws dim and a look can restyle it; a bar's bands take `tints`.
  - `EffectLook`'s options parameter defaults to `never` rather than `unknown`, so `[nodeGraph, rack]` is an `EffectLook[]` without a cast. Breaking for code that called a plain `EffectLook` with options: give it the options type, `EffectLook<MyOptions>`.
  - `EffectChart` takes `minScale`, default `EFFECT_MIN_SCALE` (0.5), so a large chart opens readable at its start instead of fitted whole and tiny.
  - Under a run, a `switch` symbol is thrown to the output the decision took, and `EffectChart` fades the port dots of stages the run never reached.
  - `edgeIdOf` escapes `.`, `>`, `:`, `/` and `\` in an edge's ends, ports and label with a backslash, so two different edges never share an id. Breaking for code that built an edge id by hand for ids, ports or labels holding those characters; use `edgeIdOf`.
- 29a90e3: `edgeIdOf` tells an empty-string port or label apart from none: `{ from: 'a', fromPort: '', to: 'b' }` is `edge:a.->b`, no longer `edge:a->b`, and an empty label adds a trailing `:`. Two such edges used to share an id, so `diagramScene` drew only the first.
- 9c24f2b: `onMove`'s `EdgeRoute` now carries `ports`, the ports a layout run named, and an edge is reported
  when only its ports change. Store them as the new `DataEdge.routedPorts`, which `edgeIdOf` does not
  read, so storing them no longer renames and replaces the edge. Breaking for code that builds an
  `EdgeRoute` or assumes a reported route always has new waypoints.
  
  A live run eases routes for every layout, `force` included, and each eased frame draws an edge
  through the ports the run will commit, so an edge that changes faces no longer jumps on arrival. An
  edge to a group reads the group's box from the same frame.
  
  `layered` holds far more pins: a pin's band slides or deepens to cover it, the gaps toward other
  pinned ranks shrink together, a node with no room between two pins moves past one, and a group's
  column moves or widens as one so no outsider lands in its box. `LayeredPlan.unheld` is left for
  pins no arrangement can reach.
  
  `chain` routes an edge between a chain node and a node hung beside it on a track of its own, orders
  the hung row by the ports it connects to, and grows the gap to keep tracks 12 apart, so a fan of
  side stages into one `rack` stage never crosses. `rack`'s spread side ports face straight out.
  
  The `lanes` look routes a wire around the stages in its lane, each wire in a shared corridor on its
  own track, places labels clear of every stage, and keeps a decision's title and cut values inside
  its lanes and column. `EffectChart` picks only stages, so clicking a lane or group box no longer
  leaves it highlighted.
  
  A perimeter port can carry a `label` (`PortSpec.label`, or `portLabels` by port id on a `BodySpec` or
  `DataNode`), drawn outside the node beside its wire. Layout lays each node out at its bounds grown by
  the room its labels take (`DiagramNode.margin`, `GraphNode.margin`), and a group's box takes it in.
  A port's alternative `sites` may carry their own `normal` (`PortSite`).
  
  `diagramLayoutOf(specs)` reads where a `diagramScene` build's layout put each unpinned node, and the
  routes and ports it wrote, in `onMove`'s shapes, so a host can keep a diagram still across edits.
  
  Under `layered`, an edge between two nodes that pins leave level along the rank axis runs straight
  between their facing sides, or around past both when a node sits between them, instead of looping
  round.
- 72a0ea2: `layered` reads a port where `portsOf` puts it on the node's outline rather than at its anchor, and reads a port with several places at the one nearest where the wire's other end falls among the node's wires on that side, while ordering, rather than at their mean. `GraphNode` carries the node's `outline`.
  
  The compass ports `diagramScene` names under `layered` are marked as layout's: an `EdgeEnd` records the port layout named as `laidOut` (`layoutOwnsPort`), and `LayoutPlan.ports`, which `layeredPlan` now fills, carries them to `routesOf` and `routeWrites`. A later layout names an end again while it names no port or still names that one, so an edit that turns which way an edge runs no longer leaves it leaving by the old face. A live `layered` run or the layout action now names ports on a hand-built scene's edges that name none, as `diagramScene` does.
  
  Breaking: `DiagramLabel`'s `at: { waypoint: k }` is replaced by `at: { near: { x, y } }`, which stations a label where its route passes nearest that point, so a bend added or removed before it leaves it on its stretch. `LayoutPlan.labels`, `LayeredPlan.labels` and `LayeredRoute.labelAt` carry that point instead of a waypoint index.
  
  A group box `diagramScene` makes depends on the labels of the wires with both ends inside it, so a long label no longer spills out of it.
  
  A live eased run eases each route it will write along with its nodes, published as the edge's path on the override channel, rather than drawing long edges through their old bends until it arrives.
  
  Core: `moveSources` and `shapeSources` no longer hand back a node that derives only its path when they reach it through a derived node, so moving or turning a group box that depends on a wire's label does not write the wire's placeholder pose.
- 4f7c861: A live layout and `DiagramView`'s `layout()` take a `LayoutPlanner`: an object whose `plan(graph, opts)` answers with a whole `LayoutPlan`, now or as a promise. The run asks it once, with the graph as it stands, and eases to the answer as it eases to `layered`'s, with the same route easing and the same moves, routes and ports reported to `onMove`. While the answer is pending, a newer request, `cancel`, `stop`, or a graph that moved or changed drops it, and `isRunning()` is true. A change of shape mid-run asks the planner again. A planner that rejects starts no run and reports the reason to the new `onError` option (`DiagramView`'s `live.onError`), or to `console.error` when that is unset; it is never left an unhandled rejection. `plannerPlan` lays a planner's graph out by footprint the way `planOf` does, and `DiagramLayout` names what `layout()` takes. `DiagramView` now fits again once a layout run settles, while the view is still its fit. `@weasel-js/diagram-elk` adds `elkPlanner(opts)`, ELK as a `LayoutPlanner`. Additive.
- b919c0d: `EffectChart` has two more looks, both in `EFFECT_LOOKS`. `lanes` gives each value type a horizontal lane and stands each stage across the lanes of the types it reads and writes, as tall as they are, with each port in its own type's lane; lanes grow until what stands in them fits (`lanes`, `laneHeight`, `rankGap`, `router`, `colors`, `showParams`, `showValues`, `branch`, `measure`; `laneId`, `LANE_INSET`). `compact` draws each stage on one line with no ports drawn and one line between two stages however many wires join them, a decision as a one-line hexagon by default with a line per exit (`router`, `nodeGap`, `rankGap`, `colors`, `branch`; `COMPACT_PADDING`). It shows no params or value rows.
  
  Five more branch symbols: `'hexagon'`, `'step'`, `'comparator'`, `'crossover'` and `'fork'`, a bare dot whose conditions sit on its wires. `'step'` and `'crossover'` need a sound `split` and `'comparator'` exactly two outputs; each draws a diamond otherwise. `wireEdges(pipeline, color)` builds the port-to-port edges `nodeGraph` and `lanes` draw. Additive.
- ffd8829: A hidden or locked node shows no ports. `sceneParticipants` marks each participant `hidden` or `locked` from the scene's `nodeGates`, and the port layer neither draws nor hits a marked participant's ports, and a connect never lands on one. A node is hidden by its own flag, an ancestor's, or a hidden layer; locked by its own lock, an ancestor's, or a locked layer. `ParticipantPose` gains the two optional fields, so a hand-written participant source can set them too. The graph still reads every participant, so layout places a hidden node as before.
- 14b7551: Chrome now stays off a layer the view hides with `layerVisibility` or leaves out of `layerOrder`, not only off a layer the scene itself hides. In a `<CanvasView>` panel that hides a layer, a node on it that is selected on the surface shows no outline, resize or rotate handles, path anchors, or warp handles there, and none of them can be grabbed there. A diagram's ports are not drawn on such a layer, a press there does not grab one, and a connect drag started in that view does not land on one.
  
  To make that possible, `ChromeState` carries `layerIsPainted(layerId)` for the view it was built for, the same answer `ViewApi.layerIsPainted` gives, and its `selection` leaves out ids on a layer that view does not paint (`multiActive` and `unionBounds` follow). `buildChromeState` takes `layerIsPainted` and `layerOf` for this, and a view reads each id's layer through its adapter's `getNode`. `paintsLayer(gate, layer)` is the one test every piece of chrome uses: `gate` is a `ChromeState` or a `ViewApi`. In the diagram package, `sceneParticipants` reports each participant's `layer`, and `offersPorts` takes the view as a second argument. Additive.
- eec8a5b: An `EffectRun` can carry a picture per output: `previews: { [port]: ImageBitmap }` on a stage's entry. A look's `showPreviews` option (on `nodeGraph`, `rack` and `lanes`) keeps a slot per output, `previewSize` big (default `PREVIEW_SIZE`, a 48-unit square, or `{ width, height }`), laid out from the first draw so a run filling it never lays the chart out again. Until a run fills a slot it draws as an empty frame, and it fades with its stage. `paintRun` fills it by a data edit, so a run that hands back the same bitmap writes nothing to the scene and uploads nothing; `EffectChart` frees the texture of a bitmap the next run no longer shows, and of every one it shows when it unmounts. `RunRowOptions` is the shared type of `showValues`, `showPreviews` and `previewSize`, and `previewRowId(port)` names a slot.
  
  `bitmapSrc(bitmap)` (renderer, re-exported by core) names an `ImageBitmap` made at runtime as an image `src`, so an image node draws it with no load. The same bitmap always gets the same name; the cache holds it weakly and never drops it to fit its budget, and `releaseImage` frees its textures and retires the name.
  
  A body's `slot` row takes a `width`: the body is at least that wide and the slot's box is that wide, centered. In `diagramScene`, a slot with an `id` becomes a scene node of that name, an empty frame, ready to be filled by a data edit. `DiagramSceneData` gains `image`.
  
  `lanes` widens a source or sink stretched taller than it measured, so its round ends no longer eat into its rows.
- 16b7ad7: A custom `Path` outline is drawn in a unit square and stretched over its node's box, as a mark's path data is, so it follows its node when layout or a drag moves it. Breaking: a `Path` outline built in world coordinates now has to be rebuilt in the unit square.
  
  `diagramScene` parses each drawn mark's `d` as it builds the scene and throws on path data that does not parse or draws nothing, naming the node and the mark's index, rather than painting a truncated path or nothing at first paint.
  
  `DiagramView` fits its view again when `width`, `height` or a fit option (`minScale`, `maxScale`, `anchor`, `fitPadding`) changes, as long as the view is still the fit it last applied; once the user pans or zooms, a resize leaves the view where they put it. The refit reaches `onViewChange`.
  
  `DiagramView`'s `onMove` takes a second argument: every edge whose route a layout run rewrote, as `EdgeRoute` (`{ id, waypoints }`, with `id` the edge's `edgeIdOf` and `waypoints` empty when the run left it straight). Stored as the data edge's new `routed` field, a route survives the data being laid into a scene again and stays layout's to replace; `waypoints` still means the author's own route.
- a988460: `EffectChart` draws a run of its pipeline.
  
  - **`run` prop.** An `EffectRun` sits beside the pipeline, keyed by stage id: each stage's `cost`
    in milliseconds, a decision's `taken` output, and each output's `values` as text. The chart
    fades a stage the run never reached and its wires, fades a decision's wires to outputs it did
    not take, writes each cost above its stage's corner, and fills in value rows. A run edits the
    scene in place: no new layout, no refit, and only the changed fields are written, so it may
    change every frame. `paintRun` and `costText` are exported for a chart of your own.
  - **`showValues`** on `nodeGraph` and `rack` keeps a row per output for a run's value
    (`valueRowId`, `NO_VALUE`).
  - **Breaking:** `stageRows(stage, showParams, withPorts)` is now
    `stageRows(stage, { showParams, withPorts, showValues })`.
  - **Body rows.** A `label` or `field` row may carry an `id`, which names its scene node
    `<body id>/<row id>` so it can be found again; and a `field` may carry `room`, a value it is
    measured at least as wide as.
  - **`EffectLookResult.exits`** maps the edges that stand in for a decision a look does not draw,
    such as `rack`'s skip arcs, to the exit each one is, so a run's `taken` reaches them.
  - **Renderer:** text now honors a solid fill's `opacity`, in its glyphs, its color glyphs (emoji)
    and its decoration rules. It was ignored, so faded text drew at full strength.
- a083eaf: `@weasel-js/diagram/effect` is new: `EffectChart` draws an effects pipeline given as plain data, with stages, the typed ports each reads and writes, the wires between them, and groups. How the pipeline is drawn is a look, a function from a pipeline to what `diagramScene` takes; `nodeGraph` gives every port a named row and `rack` runs the main signal along one line with the rest hung beside it. `EffectChart` takes the pipeline, which it compares by content, a look, the look's options, a size, a `background` paint, and the usual `selected` / `onSelect`, and reports `checkPipeline`'s findings through `onProblems`. A stage that sends the signal one of several ways draws as a branch symbol (`diamond`, `bar`, `demux`, `switch`), and one with `split` draws its cut values as ticks on a bar. `checkPipeline` reports a wire that names a missing stage or port, runs the wrong way, or joins two types, a repeated stage, port or group id (`duplicate-group` for a group whose id repeats another's or a stage's), and the other ways a pipeline can be wrong.
  
  For writing a look, the entry also exports what the shipped looks are built from: `uniqueStages`, `uniqueGroups`, `drawableWires` and its `DrawableWire` type, `stageRows`, `exitLabel`, `stageStyle`, `wireStyle`, `isControl`, `kindOf`, `portOn` and `PROBLEM_COLOR`.
  
  The rest is additive in `@weasel-js/diagram` itself, and nothing existing changes:
  
  - `DiagramView` takes `ports="show"`, to draw ports with nothing to connect.
  - `portOptions.fill` may be a function of the port.
  - `portOptions.shape` may be `'circle'`.
  - `portOptions.showsPort` picks which of a node's ports show; `createPortAffordance` takes the same option, and `createConnectAction` takes it to keep a connect from landing on a hidden port.
  - `'trapezoid'` is an outline.
  - A data node takes `marks`: shapes in a unit square stretched over its box, and text pinned to a point on it. `diagramMarkOf`, `markShape`, `registerMarkShape` and the `DataMark` and `DiagramMark` types are exported.
  - `chain` is a layout, exported and accepted by name as `layout: 'chain'` in `diagramScene`, `layout('chain')` on a `DiagramView` and `algorithm: 'chain'` in `createLayoutAction`. It stands one run of nodes on a line and hangs the rest beside it; the `chain` and `chainSide` layout options pick the run and the side, and the run is the longest path when `chain` is unset or names no node.
- 4af4627: `layered` builds the layout around every pinned node, not only the first. Each pin after the first
  keeps its place across its rank, with the rest of the rank pushed clear of it, and the gap on the
  first pin's side of its rank stretches or shrinks to reach it, so a long edge no longer runs through
  a second pin and a re-run moves nothing. A pin it cannot reach — one that would shrink a gap below a
  quarter of `rankGap`, or that has too little room beside another pin in its rank — is laid out
  around as before and named in the new `LayeredPlan.unheld`.
- 6812344: `layered` routes long edges and leaves labels room on a live scene too.
  
  - **Under `order: 'seeded'`.** An edge spanning ranks now stands in each rank it crosses and a
    labeled edge gets a rank of its own, as under `'barycenter'`. An edge keeps its place in a rank
    the way a node does, from where its route crosses that rank now (`GraphEdge.waypoints`, which
    `buildGraph` fills in), so a second run still moves nothing. This changes where a seeded layout
    puts nodes in any graph with a long or labeled edge.
  - **Written to the scene.** The layout action and a live `layered` run write each long edge's
    waypoints, and station its label in the room left for it, in the same undo entry as the moves.
    `buildGraph` reads a scene label's size as its edge's label room.
  - **Whose route it is.** `DiagramEdge.laidOut` records the waypoints layout wrote, and layout
    rewrites a route only while the edge's waypoints still match them (`layoutOwnsRoute`). An edge
    someone has bent, and the label on it, are left alone, and get no room in the ranks the edge
    crosses (`GraphEdge.authored`); so is a label put at `'start'`, `'end'` or a fraction.
    `diagramScene` marks the routes it lays out the same way. A layout that routes nothing
    (`tree`, `force`, `chain`) takes layered's routes back off.
  - **`diagramScene`.** A label whose edge sets `labelPlacement` at `'mid'` now gets room beside
    its wire like an unplaced one, at that placement's offset. Routes come from any layout with a
    `plan`, not only `layered`.
  - **Locked layers.** `applyLayout` skips a node, edge or label on a locked layer instead of
    throwing.
  - **New surface.** `LayoutFn` may carry a `plan` returning `LayoutPlan` (`moves`, `waypoints`,
    `labels`); `layered.plan` is `layeredPlan`, and `planOf` reads any layout's. `routesOf` and
    `routeWrites` turn a plan into scene edits, and `applyLayout` takes them as `routes`.
    `usePoseRun` takes `commitWith`, writes of the caller's own made inside the commit's batch.
  - `expand`'s `placeholders` and `labels` options are gone; it always adds both.
- 89229df: `layered` reads ports and leaves labels room.
  
  - **Ports.** The layout graph carries each node's ports (`GraphNode.ports`) and the ports an edge
    names (`GraphEdge.fromPort`, `toPort`); `buildGraph` and `diagramScene` fill them in. Ordering
    reads each wire at the port it joins, so wires into one node arrive in the order of its ports,
    and placement lines up the two ports a wire joins rather than the two centers.
  - **Port places.** A `PortSpec` may list other places it can sit in `sites`. An edge meeting the
    port takes whichever place faces its next point; `portSitesOf` resolves them all. The decision
    diamond's second exit may now leave by its top vertex as well as its bottom.
  - **Label room.** Under `order: 'barycenter'`, an edge whose `GraphEdge.label` gives its label's
    size gets a rank of its own between its ends, with room beside its wire. `layeredPlan` reports
    where (`labels`), and `diagramScene` sets each label there unless its edge sets
    `labelPlacement`. `DiagramLabel.at` takes `{ waypoint }`, a place between two of the edge's
    waypoints.
  
  Behavior changes: a diagram with labeled edges laid out by `diagramScene` is taller (or wider)
  than before, and lands in a different place. Inside a group, `layered` keeps each member where
  placement lined it up instead of centering each rank in the group's column. An edge end with no named port now aims at the
  edge's first or last waypoint, not the other node, when it has waypoints. A smooth (`bezier`)
  route passes two waypoints level on one axis along that axis.
- 298b28b: `layered` lays diagrams out differently, so a diagram laid out before this lands somewhere else
  after it. Ranks keep edges as short as they can (network simplex, exported as `ranksByLength`),
  so a node with no inputs sits beside what it feeds instead of in the first rank, and nodes are
  lined up with their neighbors across ranks (Brandes–Köpf) instead of packed and centered. Under
  `order: 'barycenter'`, which `diagramScene` uses, an edge spanning ranks stands in each rank it
  crosses, so ordering counts its crossings and placement leaves it room; ordering also swaps
  neighbors to clear crossings and keeps the best order it finds. An edge closing a cycle is turned
  around for layout, so it gets a route too.
  
  New `layeredPlan(graph, opts)` returns the moves with each node's rank and each spanning edge's
  waypoints; `diagramScene` draws those edges through them. `LayeredRouteInput` changes shape: it
  takes `ranks` and `waypoints` from a plan in place of `graph`, `boxes` and `clearance`.
  `GraphEdge` gains an optional `origin`, the edge as drawn, on edges `expandGroupEdges` made for
  an edge to or from a group.
- 36eca7a: Breaking: `useAnimator` moved to `@weasel-js/animator/react`; the root entry has no React. `@weasel-js/core/math` no longer reaches routing or animator in its types. geom exports `FramedBox`. New `@weasel-js/font/metrics` entry carries `parseBmFont`, the face-metric readers and `cssFamilyName` with no DOM in its types, and `@weasel-js/diagram/layout` measures through it, so neither it nor `@weasel-js/diagram-elk` needs a browser. `faceMetricsOf` takes any value with `entry` and `outlineFace`, a `ResolveResult` included.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [6a53aaa]
- Updated dependencies [193ba96]
- Updated dependencies [09c3e5f]
- Updated dependencies [535aaaa]
- Updated dependencies [ed0e096]
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
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
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
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [e901a2b]
- Updated dependencies [57725cc]
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
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/animator@1.11.0
  - @weasel-js/font@1.11.0
  - @weasel-js/simulation@1.11.0

## 1.10.1

### Patch Changes

- cdf60a1: `DiagramView` pans on a drag that starts on empty canvas, as its docs say. The select tool behind picking marquee-selected on that drag, and as the active tool's binding it outranked the view's drag-pan, so the view never moved. The diagram picks one node at a time, so it drops the marquee; a click on empty canvas still clears the pick.
- 00f60ff: `diagramScene` routes a `layered` diagram's edges. An edge running down the ranks leaves its source by the face toward the next rank and arrives at its target's face toward the last, where it used to take whichever side faced the other end, and an edge that skips ranks gets waypoints through the gaps in each rank it crosses, so it goes around the nodes and group boxes in its way. An author's `fromPort`, `toPort` and `waypoints` win; an edge running back up the ranks, and every other layout, keep the facing rule. `layeredRoutes` is the pass on its own.
  
  The `bezier` router passes a waypoint without a corner; it used to draw each leg between two waypoints as a straight line.
  
  A group's box fits its label. `DiagramGroup` gains `minWidth`, which `diagramScene` sets from the label, `groupDerivePose` widens the box to evenly, and `layered` and `tree` leave room for in a layout running down or up; `GraphGroup` carries it too, and `boxAround` is the box rule on its own.
  
  Breaking: a label's `offset` is the gap between the route and the label's near side, where it was the distance to the label's center, so a label beside a vertical edge no longer straddles it.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [3fda6e6]
- Updated dependencies [67a7de8]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [566f15e]
- Updated dependencies [ee59ccd]
- Updated dependencies [f22f5ce]
- Updated dependencies [92e6291]
- Updated dependencies [2216d1b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [f8faa63]
- Updated dependencies [3bc85c9]
- Updated dependencies [d8b51a4]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [bd6c203]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1
  - @weasel-js/animator@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/simulation@1.10.1

## 1.10.0

### Patch Changes

- 96a63de: add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.
  
  core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.
  
  `@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
- 3603da3: The force layout takes `createSimulation` and its types from `@weasel-js/simulation`, where they live, and no longer through `@weasel-js/core/math`. `@weasel-js/simulation` is a new peer dependency of `@weasel-js/diagram`.
- de319ce: Types a public signature names are exported now, so a consumer can write them down and the API reference links to them. All additions; nothing is renamed or removed.
  
  - core: `ViewLike`, `TargetTransform`, `WeightEnv`.
  - diagram: `DiagramRouter`, `DiagramTextStyle`, `DiagramDerivePose`, `Forest`.
  - font: `DynamicFace`.
  - forge: `ArgCondition`, `ComponentHistory`, `StoryGlobals`, `StoryLayout`, `StoryViewport`, `TimelineSpan`; from `/frame`, `Channel`, `ToFrame`, `FromFrame`, `ConfigAnswers`, `FaultPhase`; from `/shell`, `StoryRegistryOptions`, `StoryChanges`, `IndexEntry`, `CssVarReport`, `TrialFrameCalls`, `Libraries`, `SchemaDescription`, `DescribedShape`, `DescribedEntry`, `SectionDescription`.
  - guides: `SnapToGuidesInsertArgs`, `SnapToGuidesMoveArgs`, and `SnapToGuidesResizeArgs`, each from its own subpath.
  - hud: `AttachHudOptions`, `SourceRect`, `LoupeBaseOptions`.
  - labkit: `MarkPose`, `AnnotationStorage`, `PaintedMark`, `ControlPanelProps`, `ControlPack`, `LoupeBindings`; from `/state`, `InstrumentHooks`; from `/config`, `Branching`, `Fields`, `FieldValues`, `Variants`, `VariantValues`.
  - paint: `InCommandUnits`, `WithPatternHandle`.
  - quantity: `FractionOptions`.
  - renderer: `ShaderStage`, `UniformArray`.
  - routing: `ToolScopes`.
  - svg: `SvgDraftPose`.
  - text-dom: `OverlayRunBase`.
  - theme: `DtcgDocument`; from `/engine`, `SemanticCommon`, `DtcgGroup`, `DtcgAxesExtension`, `DtcgLayer`.
  - ui: `ButtonBase`, `ButtonRegular`, `ButtonIconOnly`, `ToggleBarCommonProps`, `ToastFn`, `Fold`, `DistributiveOmit`, `WalkCtx`, `OverlayPoint`, `DocumentCodec`, `OpenedDocument`, `SchemaRoot`, `AnyNode`, `CurveSamplePoint`.
  
  The names for types that had none of their own to export under (`StoryGlobals`, `TimelineSpan`, `CurveSamplePoint`, the `Diagram*` three, `ShaderStage`, `DtcgGroup`, `ToggleBarCommonProps`) were chosen by an agent.
- 3a92afc: Breaking: the paint model's serialized shape changed in three ways, and its type names in two. Nothing reads the old shapes.
  
  **A fill is a record holding a paint, as a stroke is.** Every `fill` slot now takes a `Fill`, `{ paint?: Paint }`, where it took a bare paint: node data, draw commands (`CommandFill`), text styles and runs, and the affordance and overlay paint options. `fill: { color: '#abc' }` becomes `fill: { paint: { color: '#abc' } }`, beside `stroke: { paint: { color: '#000' }, width: 2 }`. `fill: null` still means no fill, and a fill with no `paint` paints nothing. `commandFill(fill, box)` resolves a node's fill for a draw command the way `commandStroke` resolves its stroke; resolving a bare paint is `commandPaint`.
  
  **A paint names its variant under `kind`, not `fill`.** `{ fill: 'linear-gradient', … }` becomes `{ kind: 'linear-gradient', … }`, the word the paint-kind registry already used. A solid still omits it. `asPaint` takes `{ kind: string }`.
  
  **Each built-in tile is its own paint kind.** `{ fill: 'pattern', pattern: { tile: 'hatch', color, lineWidth }, units }` becomes `{ kind: 'hatch', color, lineWidth, units }`, and likewise `crosshatch`, `dots`, and `chunks`. A tile a consumer rasterized itself is `{ kind: 'texture', texture: handle }`. `TilePatternSpec` is now a union keyed on `kind`, so a tile's own fields are checked instead of being optional on every tile. An SVG exported before this change carries its tiles in the old shape and loses them on import, with a warning.
  
  Follows from the fill record: `DEFAULT_SHAPE_FILL` is a `Fill`, `createPathLayer`'s `getFill` returns a `CommandFill`, `setFill` and `setFillOpacity` write the record, and the default node properties describe `data.fill` as an object with one `paint` field, as `data.stroke` is. A node whose `fill` is a string or a bare paint now paints no fill. `SelectionPanel` built from those default properties no longer offers "None" for a fill, since it offers none for a paint nested in a record; clearing one goes through the `setFill` action.
  
  A tile paint has a `color`, so `'color' in paint` no longer means solid. `isSolidPaint(paint)` answers that.
  
  Renames: `FillStyle` is `Paint`, and `GradientUnits` is `PaintUnits`. The paint types named as fills are named as paints: `GradientPaint`, `MeshGradientPaint`, `CommandPaint`, `PosedPaint`, and `SolidPaint`, with `isGradientPaint` and `isMeshGradientPaint`. `isPatternSpec` is gone; `isTilePaint` and `isPatternPaint` replace it.
  
  Adds API: `Fill`, `CommandFill`, `commandFill`, `PatternPaint`, `TilePaint`, `TexturePaint`, `TileKind`, `PatternPlacement`, `TILE_KINDS`, `isTileKind`, `isTilePaint`, `isPatternPaint`, `isSolidPaint`, `tileSpecOf`, `patternPlacementOf`, and `seedTile`. A paint kind can name a `family` (`PaintKindFamily`); kinds sharing one are a single segment in `PaintInput`'s kind bar, and the built-in tiles and `texture` share `patternFamily`.
- Updated dependencies [dfc0dda]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [7140b5a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [1837952]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [2c6246d]
- Updated dependencies [de60e10]
- Updated dependencies [2892438]
- Updated dependencies [b310df0]
- Updated dependencies [2a5d8ef]
- Updated dependencies [3994be7]
- Updated dependencies [e80de55]
- Updated dependencies [b3ba3d9]
- Updated dependencies [126116b]
- Updated dependencies [9296fb4]
- Updated dependencies [6ba0496]
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [d675fed]
- Updated dependencies [d635e84]
- Updated dependencies [dc1f09c]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [06003a5]
- Updated dependencies [da0335e]
- Updated dependencies [7bac60f]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [1bd7fdc]
- Updated dependencies [87dd1ad]
- Updated dependencies [3bacb3e]
- Updated dependencies [6b03b7e]
- Updated dependencies [b260415]
- Updated dependencies [66d5455]
- Updated dependencies [d58d2e8]
- Updated dependencies [eb7f534]
- Updated dependencies [3adb0d9]
- Updated dependencies [7548e82]
- Updated dependencies [eb3114f]
- Updated dependencies [0a37db1]
- Updated dependencies [a275f78]
- Updated dependencies [605ace8]
- Updated dependencies [0db7e81]
- Updated dependencies [6bb8035]
- Updated dependencies [5d82ef9]
- Updated dependencies [bc15034]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [1c9bc4e]
- Updated dependencies [525800f]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [bb3e633]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [b3d4383]
- Updated dependencies [a6dff38]
- Updated dependencies [27c1c86]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [0d1c052]
- Updated dependencies [71512af]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [bb53d86]
- Updated dependencies [18920a4]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [6139898]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [7b9de2d]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [af48ee3]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [1956417]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [d02d059]
- Updated dependencies [74f364f]
- Updated dependencies [01d6e4e]
- Updated dependencies [32b3cc9]
- Updated dependencies [70413dd]
- Updated dependencies [fcf44fa]
- Updated dependencies [a91e5cd]
- Updated dependencies [91a479a]
- Updated dependencies [7afbc13]
- Updated dependencies [8f38287]
- Updated dependencies [936679d]
- Updated dependencies [813aea2]
- Updated dependencies [42f24c8]
- Updated dependencies [499af9b]
- Updated dependencies [8cc746f]
- Updated dependencies [a21947b]
- Updated dependencies [de07db0]
- Updated dependencies [4d3ff3f]
- Updated dependencies [85cb886]
- Updated dependencies [aed6320]
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [3558fbb]
- Updated dependencies [fa0ecbe]
- Updated dependencies [bffba0a]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [4b0a7d7]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [5c9d69f]
- Updated dependencies [bbb538e]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [0e1f269]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [b8eba2f]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [222fd80]
- Updated dependencies [4042637]
- Updated dependencies [70cf20d]
- Updated dependencies [6073365]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [0cef6a3]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/geom@1.10.0
  - @weasel-js/animator@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/simulation@1.10.0

## 1.9.4

### Patch Changes

- 9ad839d: A `PathDrawCommand`'s `fill` and `stroke` are now `CommandFill` and `CommandStroke`: a pattern must name a registered texture, and no paint may be in `'bounds'` units, so a tile spec or a box-relative gradient on a hand-built command is a type error where it used to draw blank or in screen space. This is a breaking change to types: code that passes a node's `FillStyle` or `Stroke` straight into a command now calls `commandFill(fill, box)` or `commandStroke(stroke, box)`, which resolve both. Options that feed commands directly (`createPathLayer`'s `getFill` and `getStroke`, affordance paints, selection overlay and guide strokes, overlay role strokes) take the narrowed types. `<Canvas backgroundFill>`, `<DrawCanvas background>`, the rect fallback painter, a marker's own fill, and `diagramShape` now resolve their paint, so a tile spec or `'bounds'` gradient there paints.
- 339888c: A diagram group may be a member of another group. `DataGroup.members` and a group box's `dependsOn` can name groups as well as nodes; the outer box is drawn around the inner box and behind it, and `layered`, `tree`, and `force` keep a nested group's members together inside its parent's. `GraphGroup.members` is every participant inside a group through any nested group, `GraphGroup.parent` names the group it sits in, and `GraphNode.group` is a node's innermost group. A group id in `members` was ignored before.
- 6b67d5d: `@weasel-js/diagram/layout` no longer loads React. Its body builder imported
  `cssFamilyName` from the `@weasel-js/core` barrel, which pulled the whole kit
  into a subpath meant for a server with no DOM; it now imports from
  `@weasel-js/font`, which `@weasel-js/diagram` declares as a peer.
- 0d56482: An edge from a node to itself that names no ports now draws: it leaves by the node's east-facing side, returns by its north-facing one, and passes a point off the corner between them, which `edgeDerivePath` hands the router as a waypoint. It drew nothing before, both ends having picked the same port. `selfLoop` is the rule, `selfLoopStandoff` on `edgeDerivePath`'s options sets how far out the turn is (half the node's shorter side by default), and waypoints the author set are used in place of the rule's point.
  
  The `orthogonal` router no longer doubles back after a waypoint: where splitting the next leg at its midpoint would start back the way the route came, it turns at the waypoint. A route through a waypoint that overshot the next stop changes shape.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- f06caab: Moving or nudging a node whose pose is derived from an id list (`derivePose` with a `dependsOn` list) now moves the nodes it derives from, through however many derived nodes that takes; a pose written to the derived node itself was overwritten on the next read. A diagram group's box is pickable again, so dragging it, or its title, moves the group's members.
- fd57f62: The `force` layout now reads groups: a group's members are drawn toward their centroid (`ForceOptions.groupStrength`, default 0.2), and a group's box is pushed clear of every other group's box and of every node outside it. A graph with no groups relaxes exactly as before.
- 2711a79: `layered` (under the default `'seeded'` order) and `tree` now return an arrangement a second run keeps when the graph has groups. A group that pushed an outsider out of its column changed the order the next run read, so a re-run moved nodes again. New export `untilSettled` runs a layout until a pass moves nothing.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [4c4aa40]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [9d54d0a]
- Updated dependencies [d99eb26]
- Updated dependencies [0a2eba9]
- Updated dependencies [3df6f75]
- Updated dependencies [719b2eb]
- Updated dependencies [095c055]
- Updated dependencies [4b0688a]
- Updated dependencies [103f988]
- Updated dependencies [c567961]
- Updated dependencies [6ba9cad]
- Updated dependencies [3f18dbe]
- Updated dependencies [8d25bd4]
- Updated dependencies [bb078c0]
- Updated dependencies [663248a]
- Updated dependencies [c2a2a5d]
- Updated dependencies [92c8af4]
- Updated dependencies [9b4fc5c]
- Updated dependencies [e023a51]
- Updated dependencies [184be75]
- Updated dependencies [9ad839d]
- Updated dependencies [fb505bb]
- Updated dependencies [0aaeebc]
- Updated dependencies [e589003]
- Updated dependencies [ec79c3f]
- Updated dependencies [1c401e3]
- Updated dependencies [158e471]
- Updated dependencies [001aaae]
- Updated dependencies [a843f5a]
- Updated dependencies [2fda51b]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [8f23c57]
- Updated dependencies [a7c9133]
- Updated dependencies [c289df7]
- Updated dependencies [eb123ad]
- Updated dependencies [f06caab]
- Updated dependencies [2b3b637]
- Updated dependencies [55fd8a6]
- Updated dependencies [fc8068c]
- Updated dependencies [efcb538]
- Updated dependencies [1268f79]
- Updated dependencies [452fffc]
- Updated dependencies [01f9a06]
- Updated dependencies [41bddcc]
- Updated dependencies [94abaef]
- Updated dependencies [20c2d26]
- Updated dependencies [f5d50b0]
- Updated dependencies [b39b0f3]
- Updated dependencies [eefcc9a]
- Updated dependencies [f66ec41]
- Updated dependencies [1896646]
- Updated dependencies [ccf595e]
- Updated dependencies [546fd8a]
- Updated dependencies [310c9db]
- Updated dependencies [ad0b554]
- Updated dependencies [7da269f]
- Updated dependencies [f21325d]
- Updated dependencies [bb5c5dc]
- Updated dependencies [04caa20]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
- Updated dependencies [234f718]
- Updated dependencies [5e1cbe4]
- Updated dependencies [8fa3cbc]
- Updated dependencies [fb297fb]
- Updated dependencies [657872c]
- Updated dependencies [110142d]
- Updated dependencies [39b26f9]
- Updated dependencies [3a4fa8e]
- Updated dependencies [71f5742]
- Updated dependencies [e39b73c]
- Updated dependencies [cf3d535]
- Updated dependencies [7c2e054]
- Updated dependencies [243984f]
- Updated dependencies [c527f50]
- Updated dependencies [b8a988c]
- Updated dependencies [9e51015]
- Updated dependencies [ab164dd]
- Updated dependencies [68dcc32]
- Updated dependencies [20617cc]
- Updated dependencies [71f5742]
- Updated dependencies [07d7cfe]
- Updated dependencies [2010b82]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
- Updated dependencies [9d9eb3b]
- Updated dependencies [cc57bc6]
- Updated dependencies [420ba9c]
- Updated dependencies [abe11f9]
- Updated dependencies [316ecd0]
- Updated dependencies [fae67cb]
- Updated dependencies [b4f06f1]
- Updated dependencies [427ea6c]
- Updated dependencies [dcc041e]
- Updated dependencies [0a17152]
- Updated dependencies [f356bd0]
- Updated dependencies [9472e9a]
- Updated dependencies [928cafc]
- Updated dependencies [95e64cd]
- Updated dependencies [d01459d]
- Updated dependencies [1eee4df]
- Updated dependencies [cca79cf]
- Updated dependencies [5cd52f3]
- Updated dependencies [cad8bd9]
- Updated dependencies [190622a]
- Updated dependencies [36c6ca0]
- Updated dependencies [747e03e]
- Updated dependencies [6983df3]
- Updated dependencies [399033f]
- Updated dependencies [2d1c6af]
- Updated dependencies [e31a360]
- Updated dependencies [33e0710]
- Updated dependencies [a8e964e]
- Updated dependencies [b444e46]
- Updated dependencies [e4d444f]
- Updated dependencies [bdf0a97]
- Updated dependencies [0641010]
- Updated dependencies [667ca34]
- Updated dependencies [e06409e]
- Updated dependencies [1268f79]
- Updated dependencies [4d559ca]
- Updated dependencies [60ac0a5]
- Updated dependencies [93780f6]
- Updated dependencies [188604d]
- Updated dependencies [036d768]
- Updated dependencies [9f70b3c]
- Updated dependencies [812118e]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [20cb4c6]
- Updated dependencies [0a83dfb]
- Updated dependencies [b413e19]
- Updated dependencies [d8b791e]
- Updated dependencies [dc856b3]
- Updated dependencies [0b93821]
- Updated dependencies [8b405d0]
- Updated dependencies [6fd724f]
- Updated dependencies [a145539]
- Updated dependencies [279d88f]
- Updated dependencies [60edb93]
- Updated dependencies [66f7465]
- Updated dependencies [9c10943]
- Updated dependencies [e98e95b]
- Updated dependencies [8261c9c]
- Updated dependencies [4787e75]
- Updated dependencies [c2ec0c3]
- Updated dependencies [16559ef]
- Updated dependencies [ba7cc48]
- Updated dependencies [569a013]
- Updated dependencies [ac8491b]
- Updated dependencies [5601761]
- Updated dependencies [7123087]
- Updated dependencies [1ca2395]
- Updated dependencies [47d868f]
- Updated dependencies [77fe781]
- Updated dependencies [d18b041]
- Updated dependencies [97bcbef]
- Updated dependencies [a53f3da]
- Updated dependencies [cd5ff3e]
- Updated dependencies [ec3c147]
- Updated dependencies [24bdb50]
- Updated dependencies [5d1ffd6]
- Updated dependencies [6b42996]
- Updated dependencies [6122f67]
- Updated dependencies [50cb70e]
- Updated dependencies [e9a28a0]
- Updated dependencies [ea6842f]
- Updated dependencies [54faddb]
- Updated dependencies [0cf2bf4]
- Updated dependencies [c5389a8]
- Updated dependencies [a1ea9ff]
- Updated dependencies [8953d33]
- Updated dependencies [8d56051]
- Updated dependencies [d16306d]
- Updated dependencies [b931128]
- Updated dependencies [a200c36]
- Updated dependencies [2bbcc5a]
- Updated dependencies [d3635ee]
- Updated dependencies [2098025]
- Updated dependencies [6a4a8ad]
- Updated dependencies [5b8578a]
- Updated dependencies [d8e003d]
- Updated dependencies [b3b209e]
- Updated dependencies [72002f8]
- Updated dependencies [26c11b8]
- Updated dependencies [44e1258]
- Updated dependencies [40533db]
- Updated dependencies [d71fc46]
- Updated dependencies [4334f6d]
- Updated dependencies [bb28e63]
- Updated dependencies [3dff419]
- Updated dependencies [611573e]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/core@1.9.4
  - @weasel-js/font@1.9.4
  - @weasel-js/geom@1.9.4

## 1.9.3

### Patch Changes

- b3e3fc6: `diagramScene` takes `groups`: each draws a box around its member nodes, with an optional label inside it, and `layered` and `tree` keep a group's members together. Each group gets a column on the cross axis that nothing else enters, in every rank from its first member's to its last, and rank gaps widen where a box needs the room. The box is a scene node that derives its pose from its members, so dragging a member carries it along. An edge naming a group meets the box, and ranks against the group's first stage.
  
  Underneath, `Graph` carries `groups` and each `GraphNode` its `group`, and `buildGraph` reads a group from a node whose trait carries `group`, its `dependsOn` naming the members, so `applyLayout`, `useLiveLayout` and `DiagramView` keep groups together too. `packClusters`, `rankGaps` and `expandGroupEdges` are exported for a custom `LayoutFn`. `groupDerivePose` and `anchorDerivePose` (a node held at a point on another's bounds, as a group's label is) are registered by `withDiagramRegistry`. `fitDiagram` frames group boxes as well as node boxes. Groups are flat, and `force` ignores them.
- 37bcee9: An edge label is no longer read as a diagram participant. The default trait reader took its `data.diagram.label` for a participant's trait, so a scene layout (`applyLayout`, `useLiveLayout`, `DiagramView`) gave every label a slot of its own, and the port affordance gave each one four ports.
- 6a1afa1: Canvas text in a CSS generic family — `sans-serif`, `monospace`, `system-ui` and the rest — now renders in that family. The dynamic glyph atlas quoted every family, and a quoted `"sans-serif"` names a font nobody has, so the browser drew it in its default serif; every `DiagramView` on default options was affected.
  
  Every font string the kit builds now goes through one helper, `cssFamilyName`, exported from `@weasel-js/font` and `@weasel-js/core`: a generic keyword stays bare, a single named family is quoted, and a family list passes through as written. `fontString` and the DOM face's fallback therefore now quote a named family (`"Helvetica"`), which CSS reads the same.
- c28a3cb: A canvas no longer claims Space or Enter when focus is on a control those keys activate — a button, a link, a checkbox — so a mounted canvas stops canceling a focused button's activation with its held-Space pan. Other shortcuts still reach the canvas from a focused button. The test is exported as `activatesFocusedControl`, beside `isEditableTarget`.
  
  `DiagramView` takes `enableKeybindings`, and a view-only diagram (no `onMove` or `onConnect`) now defaults it off, so it no longer takes held Space from the rest of the page. Pass `enableKeybindings` to keep a view-only diagram's keys on.
- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/core@1.9.3
  - @weasel-js/geom@1.9.3

## 1.9.2

### Patch Changes

- 227a3fb: `diagramScene` builds every box through `buildBody`, so a data node can set its `outline`, `rows` (label, field, ports and slot, with bold text), `padding`, `gap`, perimeter `ports`, `pinned`, a starting `at` and a minimum `width`/`height`. `lines` remains shorthand for label rows. Edges take `fromPort`/`toPort`, a per-edge `router`, `waypoints` and `labelPlacement`; `EdgeStyle` adds `dash`, `markerStart`, `markerEnd` and a `label` color, and `NodeStyle` adds `dash`. Options add `layout` by name (`'layered'`, `'tree'`, `'force'`), `measure`, `outline`, `padding`, `gap`, `minWidth` and `labelPlacement`, and `layoutOptions` now merge over the barycenter default instead of replacing it.
  
  Box sizes change: padding is the body's uniform 8 rather than 12 by 8, and rows are spaced by `gap`.
  
  `BodySpec.ports` replaces a body's four compass ports. `BodySpec.verticalAlign` (`'top'`, `'center'` or `'bottom'`) places the rows as a block when a body is taller than they need, and defaults to `'center'`: a body used to stack its rows from the top, so one built taller than its content now draws them lower. Data nodes and `diagramScene` options take `verticalAlign` too. A row's fallback height now follows its `fontSize` when no `measure` is given.
  
  `DiagramView` adds `maxScale`, `fitPadding`, `background`, and a controlled `view` with `onViewChange`.
- 3ba97df: `reconcileSpecs(scene, prev, next)` brings a scene from one list of node specs to another: it adds and removes by id and writes only the fields that changed between the two lists, as one untracked step. What the scene did since `prev` survives unless `next` changes that same field.
  
  `DiagramView` no longer remounts on a new `specs` array. It reconciles the new specs into the scene it holds, so the view, the pick and anything moved stay put. `onMove` turns on dragging and reports every node a drag or a layout run moved. `onConnect` makes ports grabbable and reports the edge a connect describes without drawing it, and `canConnect` and `portOptions` configure that. A `ref` gets `layout(algorithm)`, which re-runs a layout animated from where the nodes stand, and the run's `live` controls; `live` configures the run.
  
  `diagramScene` gives every spec an id, and takes `layout: 'none'` to leave each node at its `at`.
  
  `fitDiagram`'s scale and anchor arguments are now one options object.
- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
  - @weasel-js/core@1.9.2
  - @weasel-js/geom@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/geom@1.9.1

## 1.9.0

### Minor Changes

- 2540471: Add `diagramScene` and `DiagramView`, a laid-out read-only diagram from plain nodes and edges, and `order: 'barycenter'` for `layered`, which reorders ranks to reduce crossings.
  
  <!-- bump-approved: minor: maintainer — 1.9.0 release requested 2026-10-07 -->

### Patch Changes

- c06cc26: Read action deps at their declared `DepSchema` types instead of casting them.
- 1b22863: `fitViewToBounds` takes `anchor: 'start'`, which shows the left or top edge of bounds that overflow the viewport instead of their middle. `DiagramView` passes it through, alongside a new `minScale` floor on its initial fit.
- 63d0bf8: `<SceneCanvas onClick>` reports every click with the node under it, after the click's own behavior has run, including a click on a node that is already picked. `DiagramView` uses it, so `onSelect` fires on a re-click, and it now pans on a plain drag as well as the wheel. `diagramScene` throws on a repeated node id and drops a repeated edge with the same ends and label.
- 24b2eaf: `SceneRegistry`, `DerivedDep`, `DerivePathFn` and `DerivePoseFn` take the scene's data and layer types after the pose (`SceneRegistry<TPose, TData, TLayer>`), defaulting to `unknown` and `string`. A `derivePath` or `derivePose` on a `Scene<MyData, MyLayer, MyPose>`, or in its registry, now reads its node's and its dependencies' `data` and `layer` typed instead of casting. `withKitRegistry` and `withDiagramRegistry` carry the same parameters through. Existing `SceneRegistry<TPose>` spellings are unchanged.
- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
  - @weasel-js/core@1.9.0
  - @weasel-js/geom@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [7e72192]
- Updated dependencies [bf522cf]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/core@1.8.1
  - @weasel-js/geom@1.8.1

## 1.8.0

### Patch Changes

- 4db0f2e: `PoseOverrides` has a new method, `read(id)`. It returns what a node is drawn and picked with: every source of overrides for that node folded into one, as of the last write or `commit()`. `get(id)` still returns the entry a writer stored, by reference. Painting, picking and `effectivePose` now call `read`. Today the only source is the entries table, so `read` and `get` agree. Once animations write overrides too, `read` will fold them in with the table.
  
  Anyone who implements `PoseOverrides`, or the `overrides` of a `PoseSource` stand-in or of diagram's `ParticipantScene`, has to add `read`. For a stand-in, `read: (id) => entries.get(id)` reproduces the old behavior.
  
  Core now depends on `@msb235/blits`, which does the folding.
- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
  - @weasel-js/core@1.8.0
  - @weasel-js/geom@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/core@1.7.3
  - @weasel-js/geom@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [b18ef4a]
  - @weasel-js/core@1.7.2
  - @weasel-js/geom@1.7.2

## 1.7.1

### Patch Changes

- 3712d90: A live `force` run now finishes when the graph stops moving rather than when alpha cools. It ends once no node has moved `restDistance` world units (default 0.1) for `restTicks` ticks in a row (default 5), which on a small graph is a few dozen frames instead of three hundred. Nothing rests while a node is being dragged. `restDistance: 0` restores the old behavior. Both options, and `dragAlpha`, are now accepted through `useLiveLayout`'s `force` option.
- 27bcf57: Every op factory's argument type can now be imported by name from `@weasel-js/core`: `InsertArgs`, `DeleteArgs`, `TransformArgs`, `ReparentArgs`, `SetDataArgs`, `SetLayerArgs`, `SetPathArgs`, `SetTextArgs`, `SetSelectionArgs`, `ReorderArgs` and `MoveToIndexArgs`, with the shapes they reference, `SiblingSlot`, `PlacedNode` and `ReorderRestoreEntry`. Core also exports `KeyBinding` (the parameter of `matchesKeyBinding`), `rangeWeight` and `unboldPatch`. `@weasel-js/diagram` exports `ForceBody`, the element type of `ForceRelaxation.bodies`.
  
  The default align, distribute, boolean and edit icons are now marked `@experimental` on each component; the tag had sat on a file header where it marked nothing.
  
  Breaking: `DispatcherViewTarget` and `ViewIdResolver` are off `@weasel-js/routing/react`. They moved to `@weasel-js/routing/internal`, which is not public API. `rectsEqual` is off `@weasel-js/labkit/surface`.
- 3755e17: Refs that event handlers, timers and message listeners read no longer hold
  what an abandoned concurrent render computed. The gesture dispatcher,
  `useDepSource`, `useOngoingAction`, `ActionsProvider`, `useTools`,
  `useContributions`, the ui components with drag or dismissal handlers
  (`Callout`, `CurveEditor`, `LayerList`, `ResizeHandle`, `Timeline`'s graph
  lane), `useAsyncOptions`, `useReorderDragList`, forge's trial shell and
  `useLiveLayout` now publish their latest props on commit only.
  
  `ContributionsApi` is now rebuilt from each render's entries instead of reading
  them through a ref, so its `entries`, `overlays()` and `scopedBindings()` answer
  correctly when read during render. Its identity is kept while the entry list
  holds the same entries, and changes when an entry is added, removed or
  replaced — a consumer building its entry objects inline every render now gets a
  new API object each render.
  
  Because a dep source now publishes on commit, `ActionBar` re-checks each
  action's `enabled` after it commits and re-renders if a dep changed in the same
  render.
- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [276bad1]
- Updated dependencies [efc5727]
- Updated dependencies [108551d]
- Updated dependencies [a5bc201]
- Updated dependencies [4e18c9f]
- Updated dependencies [112c781]
- Updated dependencies [ac2e76e]
- Updated dependencies [9c164e2]
- Updated dependencies [85d62a7]
- Updated dependencies [dfd926f]
- Updated dependencies [3d80c9f]
- Updated dependencies [a1ecaac]
- Updated dependencies [886fefd]
- Updated dependencies [04b0b96]
- Updated dependencies [27bcf57]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/geom@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [b1142a7]
- Updated dependencies [96adc78]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [ad0378f]
- Updated dependencies [da20f95]
- Updated dependencies [b4227b8]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [52078c5]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [fc3de06]
- Updated dependencies [b8f2007]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [bc2a7ef]
- Updated dependencies [6819653]
- Updated dependencies [793987a]
- Updated dependencies [ca2f45f]
- Updated dependencies [082c63f]
- Updated dependencies [242e9f7]
- Updated dependencies [f8f0160]
- Updated dependencies [455e4bc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [2336d9c]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [3a20620]
  - @weasel-js/core@1.7.0
  - @weasel-js/geom@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [b209a8e]
- Updated dependencies [7683659]
  - @weasel-js/core@1.6.1
  - @weasel-js/geom@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [0cf6a0d]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [5345efb]
- Updated dependencies [87fd8a8]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/geom@1.6.0

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
- 8ffd746: State the port-curve rule once, in `@weasel-js/geom`.
  
  A routed edge leaves a port along its normal and arrives at the next against
  that port's normal, with the controls reaching 0.4 of the straight-line
  distance. That rule lived inside `@weasel-js/diagram`'s `bezier` router with
  its reach constant module-private, so a 3D consumer had no way to share even
  the number.
  
  It is now `portControls` / `portCurvePoints` / `PORT_REACH`, exported from
  both `@weasel-js/geom` and `@weasel-js/geom/3d`. One implementation over loose
  components sits behind both, so the two dimensions cannot disagree: every
  operation in it is closed on the plane z = 0, and a planar problem answered
  through the 3D entry returns the same numbers, not an approximation. Each
  barrel wraps it in its own tier's currency — scalars for 2D, matching
  `cubicEvalAt`, and `Vec3` for 3D.
  
  `bezier` is unchanged in behavior; it calls through. `@weasel-js/diagram` now
  declares the `@weasel-js/geom` peer it had been importing without.
  
  Also moves `Vec2`'s declaration out of `core/geometry/polygonHitTestRect.ts`,
  a polygon-versus-rect hit-testing helper it had been an incidental local in,
  into `core/geometry/vec2.ts`. No API change — the barrel exports the same
  type from a place you would look for it.
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2

## 1.5.1

### Patch Changes

- a80e8db: `@weasel-js/diagram/layout` and `@weasel-js/core/math` are new subpaths that a
  Node process can import: measuring a box from its rows, ranking a graph,
  relaxing one under forces, and finding where on a box's perimeter an edge
  should leave, with no React in the module graph. A server rendering a diagram
  needed all of that and could not have it — the diagram barrel reaches `live`
  (a hook) and `connect` (an interaction), and core's reaches the canvas.
  
  `layout` exports `measureBody`/`sizeToBody`, `layered`/`ranksOf`/`backEdges`,
  `force`, `tree`, `COMPASS` and the rest of `ports`, `outline` and `onOutline`.
  A caller with its own nodes and edges implements `Graph` — an interface, not a
  class — over what it already has, so `buildGraph`, which reads one out of a
  scene, is not needed and is not there. The routers stay behind: they live with
  the scene registry, and they are typed in `Vec2`, so a consumer routing in
  three dimensions cannot call them regardless.
  
  The seven modules behind it now import `@weasel-js/core/math` rather than the
  core barrel. Every symbol they took is in the subpath, so this narrows what
  they ask for rather than moving anything.
  
  `scripts/check-react-free.mjs` (`npm run check:react-free`) walks each entry's
  **built** closure, through sibling packages' `exports` maps, and fails on a
  React specifier. Sources cannot answer this question: `core/math` re-exports
  nineteen leaf modules that each import only numbers, and its first build still
  pulled a megabyte of canvas — one leaf reached core's own barrel, and
  `splitting: true` put the result in a chunk the entry imported.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1

## 1.5.0

### Patch Changes

- 9190fc9: Follow-ups a 3D lab turned up while driving core's dispatcher over a WebGL
  viewport. Each one is a place the kit assumed its own 2D renderer.
  
  **`classifyTarget` and `affordanceAt` now take the world point their types
  promise.** Both were handed the raw client point at every dispatcher call site,
  so `<SceneCanvas>` and `<CanvasView>` each wrapped their thunk in the same
  `clientToWorld` they also passed the dispatcher, and a consumer hit-tested in
  one space while reading `ctx.world` in another. The conversion happens once now,
  where the event arrives. Behavior-identical for both kit consumers; a consumer
  passing no `clientToWorld` sees identity. **If you pass either option to
  `useGestureDispatcher` yourself and convert coordinates inside it, remove your
  conversion.**
  
  **`InvocationCtx.screen` carries a screen point, and is optional.** It was
  filled from the same field as `ctx.world`, so it had never been screen-space.
  It now comes from the event's client coordinates and is absent where the event
  carries none — a keystroke, a UI-driven trigger, a synthetic probe. A
  view-mutating drag still wants `drag.screenDelta`. A click's `ctx.world` is the
  click's own position rather than the origin.
  
  **`scene.history` publishes the `History` a `Scene` already owned.** The kit's
  `undo`/`redo` actions resolve a `history` dep and a consumer had nothing to give
  them, so `<SceneCanvas>` cast the Scene itself through `unknown`. It is a façade
  rather than the private engine: mutating members route through the scene's own
  wrappers, so an action-driven undo bumps the version and notifies subscribers.
  
  **`resolveOverlays` is the overlay half of the in-flight gesture channel.**
  `resolvePreviews` already answered for the ghosts a gesture displaces; this
  answers for the chrome it draws that is no node at all — a marquee rect, a lasso
  trail, an insert outline — in world geometry, with every degenerate case
  dropped. `insertPreviewExtent` is exported alongside it.
  
  **Every overlay variant is now geometry, and the layer owns the paint.**
  `OngoingOverlay`'s `'commands'` variant — arbitrary `DrawCommand[]`, which only
  core's own 2D renderer could execute — **is gone**, along with the `opaque` flag
  on the resolved form and the `action.commands` chrome id. Its two producers
  publish the new `'polyline'` variant instead: a run of world points plus a
  one-word `OverlayRole` (`'cut'` for `slice`, `'connector'` for
  `@weasel-js/diagram`'s `connect`) that a painter maps to a stroke, falling back
  to plain chrome for a role it does not know. `useDispatcherOverlayLayer` draws
  both exactly as they were drawn before, and
  `DispatcherOverlayStyle.roles` is where a consumer restyles one.
  **`ConnectActionOptions.stroke` is removed** — an action no longer names a
  paint; use `roles: { connector: … }` on the layer's style.
  **If you produced a `'commands'` overlay**, publish a `'polyline'` for a line,
  or paint it from a render layer of your own.
  
  **labkit stacks two surface buffers around the trial DOM.** The shared buffer
  sat over the trials, which is right for a mark annotating an instrument and
  wrong for an opaque renderer that buries its own pane. `useSurfaceCanvas('under')`
  asks for the lower buffer; the default is unchanged. **`SurfaceCanvasContext`
  now carries `{ over, under }` rather than one canvas** — a consumer providing it
  directly must update the value.
  
  **labkit labs get their own chrome regions.** Every region was per-trial, so a
  lab-level control had nowhere to go and `LabPalette` existed by casting a
  two-field object through `as unknown as TrialChromeContext`. `<Lab labChrome>`
  takes contributions shaped exactly like a trial's, against a real lab context.
  
  `docs/extending.md` now states the contract for mounting tools outside
  `<SceneCanvas>`, including the half that was written down wrong: capability
  eligibility resolves through `RuleCtx.allowedCapabilities` and `getRuleCtx`, not
  the `activeTool` dep.
- 6f5ff46: Pose geometry is supplied once. `<SceneCanvas poseDescriptor={…}>` tells every
  built-in action, the selection chrome, picking and area select how to read and
  rewrite this scene's poses; it defaults to `AUTO_POSE_DESCRIPTOR` (rect and
  `Path` poses). A pose of any other shape now works end to end — before, dragging
  one into a container wrote `NaN` into it.
  
  Breaking:
  
  - `PoseProjection` is renamed `PoseDescriptor`, and gains a required
    `fromBounds(bounds, template)` and an optional `withRotation(pose, rotation)`.
  - `ResizePose` and `AlignBounds` are removed; use `Bounds`.
  - `RotateGeometry`, `AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` are
    removed.
  - Removed options, replaced by the descriptor: `selectTool.resize.geometry` and
    `useResizePolicy({ projection })` (use `<SceneCanvas poseDescriptor>`);
    `UseRotateOptions.geometry` and `UseMoveOptions.translatePose` (both were
    unread); `poseBounds` on `useSelectTool`, `arrayAdapter`, `sceneToAdapter`,
    `MinimapCanvas` and `nestedHitTester` (use their `poseDescriptor` option);
    `arrayAdapter`'s `intersectsRect` and `translatePose`; the selection overlay's
    `getBounds` and `fromBounds`; the alignment behaviors' `projection`.
  - `Canvas`'s `geometry` prop is renamed `poseDescriptor`. `SceneCanvas`'s own
    `geometry` prop — the `pickEvery` / `boundsOf` hit-test overrides — is a
    different prop and keeps its name.
  - `computeFitView`'s fourth argument is a `PoseDescriptor`, not a bounds
    function.
  - `sceneToAdapter`'s `cascadeContainerPose` is a boolean; the cascade translates
    through the descriptor.
  - The kit's built-in painters only draw rect poses. A node with any other pose
    needs its own painter.
  - `Scene` has a read-only `registry`. For a custom pose kind,
    `unionOfChildrenVia(descriptor)` builds the container-union function to
    register under `UNION_OF_CHILDREN`.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0

## 1.4.4

### Patch Changes

- fc00dae: Hand a derivation its dependencies' paths, and label an edge with one.
  
  `DerivedDep` is now `{ node, pose, path }`. The path resolves on first read and
  memoizes, so a route costs the same whether one node reads it or five, and a
  dependency nobody asks about costs nothing. `resolveDerivedPath` moves beside
  `derivedPose` in `core/scene` — a pose can now derive from a dependency's path —
  and picks up the cycle guard the pose side already had.
  
  `pointAlongPath(path, t)` is the new geometry primitive underneath: where a path
  is at a fraction of its length, and which way it heads there, measured along the
  flattened arc.
  
  In `@weasel-js/diagram`, an edge label is an ordinary leaf node with
  `dependsOn: [edge]` and `LABEL_DERIVE_POSE`. Its trait says where it sits —
  `at: 'start' | 'mid' | 'end'` or a fraction, plus an `offset` perpendicular to
  the route — and it reads the edge's resolved path rather than routing again, so
  a label and its arrowhead can never disagree about where the edge went.
- 60ba9d9: A stroke marker on a derived path is drawn.
  
  `markerStart` / `markerMid` / `markerEnd` reached the `kit:derived` painter
  intact and were then dropped: the painter emitted its stroke command and
  returned, where `kit:path` follows with a marker pass. So an arrowhead on a
  diagram edge — the whole reason markers and derived geometry landed in the same
  release — silently drew nothing. Its own `ink` had been reserving the hit-test
  reach for the marker all along, which is the shape of the bug: the pointer could
  already grab past the end of a line with no head on it.
  
  A connect-authored edge now carries `markerEnd: 'arrow'` by default. An edge
  runs *from* one node *to* another and a plain line does not say so;
  `DEFAULT_EDGE_STROKE` is exported for a consumer overriding `commit` who wants
  the rest of it.
- 6aff403: `buildBody` turns a `BodySpec` into the scene nodes that draw it.
  
  The container carrying the trait, and one leaf per row that wants drawing —
  placed by the same `layoutBody` walk the row ports anchor against, so a label
  and its ports cannot drift apart, and posed by `sizeToBody(at, measureBody())`,
  so the authored size is grown to clear the rows and never shrunk. A row's data
  is the consumer's, through one callback that is handed the row's text already
  formatted; returning `null` leaves that row undrawn, which is what a `ports` or
  `slot` row usually wants.
  
  Also fixed: a row port and a compass port could land on the same point, and one
  of them was then grabbable nowhere. `bodyTrait` anchors a `ports` row's entries
  at `u: 0` and `u: 1`, which for a row near the vertical middle put them exactly
  where `w` and `e` already were — the later region won the hit, and a node
  declaring six ports offered four. A row port on a side now takes that side's
  compass default with it: a body that says where its inputs attach has said what
  that side is for.
- edd6f53: Ports are grabbable, and dragging one onto another authors an edge.
  
  `diagramPorts` returns the two halves the gesture needs: a port affordance layer
  for `CanvasExtensionApi.registerLayer`, and a `Contribution` for `ambient`. They
  come back together because attaching one without the other fails quietly — the
  layer alone paints ports that start no gesture, and the contribution alone binds
  a hit nothing reports. `registerLayer` is the only attach route the kit
  hit-tests; a `Contribution.overlay` is painted and never hit.
  
  Connect is an ordinary drag binding gated on the port layer's affordance kind,
  not a mode and not a tool, so it starts from whatever tool is active. The
  preview is a real routed edge — the same router the committed edge will use,
  resolved by the same function, so it cannot promise something the release will
  not do. The commit is one `add`, which undoes in one step.
  
  Typed validity is `canConnect`, defaulting to "a port may not join itself, and
  two ports that both declare a `type` must declare the same one". An untyped port
  joins anything, so an untyped diagram stays fully connectable. It is applied
  where candidates are gathered rather than at the commit: an illegal port is
  never a candidate, so the edge will not snap to it and releasing over it does
  nothing.
  
  A port claims the whole `'pointer'` protocol so a port drag is never a move of
  the node underneath. That means `pointerDown` and `click` need bindings too —
  an exclusive claim bars every binding whose target does not consult the
  affordance, so a bundle that binds only `drag` leaves the press with nowhere to
  go and the dispatcher drops it, along with the drag it would have become.
  
  Also fixed: an edge's trait and a participant's trait live under the same
  `data.diagram` key, and the reader could not tell them apart. An edge read as a
  participant declares no ports, so it collected the four defaults on the
  degenerate pose an edge carries — four grabbable ports in the middle of nowhere.
  `from` and `to` are now what distinguishes the two.
- ed400a3: Edges. A `DiagramEdge` is an ordinary leaf scene node with
  `dependsOn: [from, to]` and a `derivePath` that runs a **router**, so it
  re-routes whenever either end moves and there is no parallel graph to keep in
  sync. Being a scene node is what buys it selection, hit-testing, hover,
  styling, z-order, SVG export, undo and copy/paste for free.
  
  Three routers ship: `straight`, `orthogonal` (leaves along each port's facing
  before turning) and `bezier` (leaves along one normal and arrives against the
  other, which is what makes an edge read as plugged into its port). Consumers
  register their own in the same shape. Author-dragged `waypoints` are data on
  the edge and the router routes *through* them — manual control authors
  constraints on the path, never the path itself, so a hand-tuned edge still
  follows a moved endpoint.
  
  An end that names no port resolves to the one **facing** the other end rather
  than the nearest: on a wide node the far-side port is often closer in a
  straight line, and an edge leaving through its own node reads as a bug however
  short it is.
  
  Ports are now cast from the node's bounds onto its outline. The bounds anchor
  is what makes a port survive a resize, but it is not where the ink is — a
  parallelogram's west anchor sits in the gap beside its leaning edge, and an
  edge ending there ends in empty space. `rayHit` casts the anchor back onto the
  flattened outline along the ray from the node's center, which is the direction
  an edge leaves anyway.
  
  `withDiagramRegistry` merges the edge router under a consumer's registry so an
  edge round-trips through `toJSON` without them wiring the key.
  
  Edge labels are not built yet: a label positioned along the route needs the
  routed path, which a derivation is not handed.
- 3d89141: Layout: `layered`, `tree` and `force`, and the action that runs one.
  
  A layout is a plain function of the graph — no scene, no ops, no history. It
  hands back the new top-left for every node that **moves**, and a node already
  standing where the layout wants it is absent from the answer, so re-running a
  layout on an arrangement it produced writes nothing and pushes no undo entry.
  
  Three rules keep a re-layout from scrambling a diagram someone has arranged.
  There is no RNG anywhere in the path, so the same graph always lays out the same
  way. Within-rank order is seeded from where the nodes already sit on the cross
  axis rather than from crossing-minimization, so two branches an author dragged
  into an order come back in it. And a node carrying `pinned: true` never moves,
  with the rest of the layout translated to sit around it — with no pin, the
  layout lands on the diagram's own bounding box rather than at the origin.
  
  `layered` ranks by longest path, breaking cycles with a depth-first walk in node
  order so a loop draws as an edge running back up the page. `tree` centers a
  parent over its children's block; a graph that is not a tree still lays out,
  since roots are the nodes nothing points at and anything the walk cannot reach
  becomes a root of its own. `force` is an iterative relaxation seeded from the
  current positions — **the one layout that is not idempotent**, since re-running
  it keeps relaxing.
  
  `buildGraph` reads the adjacency index from the same participant source the port
  affordance takes, per invocation rather than maintaining one. `createLayoutAction`
  rebuilds it on each press and writes the whole move as a single `scene.batch`,
  carrying a container's whole subtree — `setPose` does not cascade, and a built
  body would otherwise walk out from under its own label rows.
  
  In core, `createSimulation` is the velocity-Verlet integrator with no clock
  attached: `tick()` is the only thing that moves a node, so a pure function can
  run a whole relaxation and read the result. `useSimulation` is now that
  integrator on a frame loop and is otherwise unchanged. `SimulationCore` and
  `SimulationOptions` name the halves, and forces can be handed a seeded `random`
  in place of `Math.random`.
- 4a128c4: New package `@weasel-js/diagram` — the skeleton of weasel's node-link
  diagramming: flowcharts, pipelines, code-flow diagrams, simple visual
  programming. Arc 3 of the diagram design; edges, routing, the connect gesture
  and layout are still to come.
  
  **`DiagramNode` is a trait on an existing scene node, not a node type the
  package mints.** A text block, an image, a path, a group or a plain rect all
  become participants by carrying it, and nothing has to be authored through this
  package to take part. Two ways to attach it, both answered by the default
  reader: on the node's own `data.diagram`, or by kind — `createDiagramNodes`
  takes predicates over `data` the way `createNodeRouting` does, so a class of
  node takes part without being stamped one at a time.
  
  **Ports default to the perimeter, so a node needs to say nothing to be
  connectable.** `portsOf(node, pose)` resolves every port to a world point and
  an outward normal, reading bounds through the pose descriptor and carrying the
  node's rotation. Anchors are normalized against the bounds — `{ u, v }` from
  the top-left — so a port stays where it was put when the node is resized.
  
  **The body builder is optional**, for nodes that should look like a flowchart
  box: `rect`, `diamond`, `stadium` and `parallelogram` outlines plus a `Row[]`
  body of labels, fields, port rows and slots. Rows measure a floor, and the
  authored pose is maxed against it rather than set to it — adding a row can grow
  a node, nothing shrinks one back — which is what keeps resize, align,
  distribute, guides, snapping and undo free of a special case. Text measurement
  is a seam rather than an import; `canvasMeasure` adapts a 2D context.
  
  Rows lay out in the shape's **content box**, not its bounding box.
  `contentBox` reports the largest axis-aligned box inside an outline — a
  diamond's inscribed rect, a parallelogram minus its lean, the flat span between
  a stadium's ends — and `boxForContent` inverts it so the floor grows to suit.
  Without it a diamond's label is placed against the bounding box, lands outside
  the diamond, and the silhouette clip removes it: the label simply vanishes.
  
  `registerDiagramShape` paints a node whose trait names an outline, and reports
  the outline as its silhouette so picking and clipping follow the diamond rather
  than its box. Rows are not painted there — a built body's rows are ordinary
  scene nodes, so the kit's own text painter draws them and text editing,
  selection and styling work on them unchanged.
  
  Core exports `AUTO_POSE_DESCRIPTOR` and `isPathLike`, which were already
  general-purpose but reachable only from inside the package. A peer package
  computing a node's bounds needs the kit's own default descriptor rather than a
  second copy of it.
- b8d2940: Layout you can watch, and push against.
  
  `usePoseRun` is the transport: each frame it asks a producer for poses,
  publishes them to the scene's ephemeral override channel — the one a drag
  already writes to, which `effectivePose`, derived geometry and the pick source
  read — and commits the lot as one batch when the producer says it is done or
  the consumer stops it. Cancel drops the frames and the document is untouched.
  It runs behind `useVisibleRaf`, and it knows nothing about layout.
  
  A node carrying an override the run did not publish belongs to another gesture:
  the run never writes it, never commits it, and reports it to the producer as
  pinned. Dragging a box mid-run is therefore the consumer's ordinary move tool,
  with no gesture contributed by the diagram package.
  
  `useLiveLayout` in `@weasel-js/diagram` drives it. `force` relaxes one tick a
  frame off the same force list the one-shot `force` runs, holding a pinned node
  with `fx`/`fy` while its neighbors answer; `layered` and `tree` ease into a
  target computed once. A node or edge appearing or disappearing re-heats the run.
  
  `SceneNode.pickable: false` makes a node transparent to the hit-test walk, so a
  press lands on what is behind it. Without it the innermost hit wins and dragging
  a labeled box pulls the label out of the box.
- 2942544: Arrive along the receiving port in the `orthogonal` router. A leg whose two
  ends face the same axis now turns twice, at the midpoint of that axis, instead
  of dropping onto the port perpendicular to its facing — an edge between two
  boxes standing side by side landed on the west port from above, which put its
  arrowhead across the corner rather than into the shape.
- ca5b9f9: `layoutRowPorts` places a `ports` row's ports inside the row box, on the same
  terms `layoutBody` places one box per row. Both sides are cut into the same
  number of slots — the longer side's count — so the nth input faces the nth
  output; each port's label box is as wide as its own text and pinned to its own
  edge of the row.
  
  Two things follow. `RowPort.label` is drawn now rather than only measured:
  `buildBody` takes a `portLabel` callback and emits one text node per labeled
  port, the same way `row` emits one per row. And `bodyTrait` anchors each row
  port to its own slot instead of stacking every port on a side at the row's
  vertical center, where a second port was grabbable nowhere.
  
  `buildBody` also marks every leaf it emits `pickable: false`. The innermost hit
  wins, so a body whose rows answer a press is a body that cannot be dragged —
  which each consumer was otherwise left to discover and patch itself.
- Updated dependencies [9ce6f00]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
