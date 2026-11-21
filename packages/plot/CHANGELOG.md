# @weasel-js/plot

## 2.0.0

### Major Changes

- fd2cbc8: `@weasel-js/diagram`, `plot`, `labkit`, `svg` and `editor` need `@weasel-js/text-tools` installed beside them.
  
  This is breaking: add `@weasel-js/text-tools` to an app using any of them. Diagram and plot canvases turn on `textTools.text` themselves, so their labels paint and edit as before; labkit's annotation layer mounts text-tools' text tool.
  
  <!-- entry: breaking -->
- b6ecd37: `plotEditing` is `createPlotEditingContribution`, spelled like the other contribution factories.
  
  ```ts
  // before
  const editing = useMemo(() => plotEditing({ scene }), [scene]);
  // after
  const editing = useMemo(() => createPlotEditingContribution({ scene }), [scene]);
  ```
  
  <!-- entry: breaking api -->
- 43600a8: `plotHandleLayer` is `createPlotHandleLayer`, spelled like the other layer factories.
  
  ```ts
  // before
  registerLayer(plotHandleLayer(scene));
  // after
  registerLayer(createPlotHandleLayer(scene));
  ```
  
  <!-- entry: breaking api -->
- be684c0: Plot's value-dragging action has the id `plot.editValue`, as its "Edit value" label says, and the constant `EDIT_PLOT_VALUE_ACTION_ID`.
  
  ```ts
  // before
  const id = PLOT_DRAG_ACTION_ID; // 'plot.dragValue'
  // after
  const id = EDIT_PLOT_VALUE_ACTION_ID; // 'plot.editValue'
  ```
  
  <!-- entry: breaking api -->
- 44c2bd0: `createPlotEditingContribution` returns one entry for `ambient`, its handle layer inside, instead of a layer to register and a contribution.
  
  ```tsx
  // Before
  const { layer, contribution } = plotEditing({ scene });
  useEffect(() => canvas?.registerLayer(layer), [canvas, layer]);
  <SceneCanvas ambient={[contribution]} />
  
  // After
  const editing = useMemo(() => createPlotEditingContribution({ scene }), [scene]);
  <SceneCanvas ambient={[editing]} />
  ```
  
  <!-- entry: rank=5 breaking api -->
- 70213a5: `niceStep` is no longer exported from `@weasel-js/plot/scales`; import it from `@weasel-js/geom`, which rounds the same way.
  
  ```ts
  // before
  import { niceStep } from '@weasel-js/plot/scales';
  // after
  import { niceStep } from '@weasel-js/geom';
  ```
  
  <!-- entry: breaking api -->
- 92f39f0: `replacePlotData` takes a scene of `RectPose`s, the pose a plot root has, instead of claiming any pose type.
  
  This is a breaking change for a caller whose scene names another pose type; it was read as a `RectPose` all along. A scene typed `Scene<TData, TLayer, RectPose>` needs no change.
  
  ```ts
  replacePlotData(scene as Scene<MyData, MyLayer, RectPose>, rootId, data);
  ```
  
  <!-- entry: breaking api -->
- 3d65b6c: `setGanttEnd` is `setGanttEndDay`: it takes a day number, beside `setGanttTaskEnd`, which takes a written `GanttEnd`.
  
  ```ts
  // before
  const next = setGanttEnd(data, 0, 2, day);
  // after
  const next = setGanttEndDay(data, 0, 2, day);
  ```
  
  <!-- entry: breaking api -->
- e2a52da: `moveGanttTask` is `setGanttStartDay`: it sets a task's start day, while plot's other `move…` functions reorder.
  
  ```ts
  // before
  const next = moveGanttTask(data, 0, 2, day);
  // after
  const next = setGanttStartDay(data, 0, 2, day);
  ```
  
  <!-- entry: breaking api -->
- 05c53c9: `setQuadrantPoint` is `setQuadrantPointAt`: it moves a point to a position and leaves its name and class alone.
  
  ```ts
  // before
  const next = setQuadrantPoint(data, 1, { x: 0.25, y: 0.75 });
  // after
  const next = setQuadrantPointAt(data, 1, { x: 0.25, y: 0.75 });
  ```
  
  <!-- entry: breaking api -->
- 3b37142: `plotTextOf` is `plotTextDatumOf`: it returns the datum of an editable text mark, not its text.
  
  ```ts
  // before
  const datum = plotTextOf(node);
  // after
  const datum = plotTextDatumOf(node);
  ```
  
  <!-- entry: breaking api -->
- 92f39f0: `xyValueAt` takes the value scale and a position along it, rather than a layout and a 2D point.
  
  This is a breaking change: the caller picks the coordinate that runs along the value axis.
  
  ```ts
  // Before
  xyValueAt(layout, point);
  // After
  xyValueAt(layout.value, layout.orientation === 'vertical' ? point.y : point.x);
  ```
  
  <!-- entry: breaking api -->
- dfcae5d: The scales move from `@weasel-js/plot` and its `./scales` entry to `@weasel-js/scale`.
  
  This is breaking: `@weasel-js/plot/scales` is gone, and `@weasel-js/plot` no longer exports `linearScale`, `logScale`, `powScale`, `warpScale`, `timeScale`, `bandScale`, `ordinalScale`, `polarScale`, `formatTick`, `formatNumber` or their types. Import them from `@weasel-js/scale`. A polar scale's points are geom's `Point`, the same `{ x, y }` as plot's `PlotPoint`.
  
  ```ts
  import { linearScale, formatTick } from '@weasel-js/scale';
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- 92f39f0: `axisTicks` gives an axis's ticks as `{ value, position, label }`, for a renderer that draws axes its own way.
  
  It takes the scale and an optional tick count, and nothing about side, theme, or measure. `axisMarks` draws its ticks and labels from it, unchanged.
  
  <!-- entry: new api -->
- 92f39f0: Plot handle drags take a `toPlot` and `fromPlot` hook, so a 3D host can cast the pointer onto the plane a chart lies on.
  
  `createPlotDragAction`, `createPlotEditingContribution`, `createPlotHandleLayer(scene, frame)` and `plotHandles(scene, frame)` accept a `PlotFrame`:
  `toPlot(world, rootId)` reads a world point into the plot's coordinates, and `fromPlot(plot, rootId)` places a handle back in the world. Either one
  left out is the translation by the root's corner, as before. `createPlotFrame(scene, frame)` fills in the defaults.
  
  ```ts
  createPlotEditingContribution({
    scene,
    toPlot: (world, rootId) => castOntoChartPlane(world, rootId),
    fromPlot: (plot, rootId) => projectFromChartPlane(plot, rootId),
  });
  ```
  
  <!-- entry: new api -->
- bfc26b4: `TimeUnit` is exported, the unit `formatInstant` writes to.
  
  <!-- entry: api -->
- 92f39f0: `xyScales` maps an xychart's data to positions with no box, so a 3D host can lay its axes along any direction.
  
  `xyScales(data, valueRange, categoryRange)` returns `{ value, category, slots, slotWidth }`: the value scale, the category axis's bands or numbers, and each row's center and bar share along it. `compileXyChart` lays out its plot through it.
  
  ```ts
  const { value, slots } = xyScales(data, [0, depth], [-width / 2, width / 2]);
  const barTop = value.position(data.series[0].values[2]);
  ```
  
  <!-- entry: rank=5 new api -->
- 23f13f4: `xyValueAt` takes the chart's value axis as an optional third argument and holds the value it reads inside the ends that axis sets.
  
  <!-- entry: api -->

### Patch Changes

- bfc26b4: Every type a public signature names can now be written down by a consumer.
  
  Types the declarations named through private aliases are written out, or are geom's `Point` and `Rect`.
  
  <!-- entry: internal -->
- 786d7e4: Diagram sequences, avoid routing, and plot handles read world poses through core's `worldPoses`, reading what they read before.
  
  <!-- entry: internal -->
- e783994: Linear, log, time, and warp scales map the domain's end exactly onto the range's end, and clipped marks end on their bounds.
  
  <!-- entry: fix -->
- 2e90881: A chart's new series, slices, steps and other items take their numbered names through registry's `freshId` rather than a copy of it.
  
  <!-- entry: internal -->
- 0424362: Dragging a gantt task past the years its `dateFormat` writes stops at the last date the format reads back.
  
  It no longer writes a date that sends the task to the chart's first date.
  
  `YYYY` holds dates to years 0 through 9999, and `YY` to 1969 through 2068.
  
  <!-- entry: fix -->
- 333ec2c: A gantt with a chain of thousands of `after` dependencies, written in any order, draws rather than throwing a `RangeError`.
  
  <!-- entry: fix -->
- 73eb657: Dragging the end of a gantt task longer than 100,000 days, or one whose excluded days stretch it past that, keeps its length.
  
  <!-- entry: fix -->
- 51f04ea: A gantt task of months or years that starts late in a month ends on the target month's last day, as Mermaid draws it.
  
  A task from 2024-01-31 lasting `1M` ends on 2024-02-29, and dragging its end reads back the calendar months it spans.
  
  <!-- entry: fix visual -->
- e1b3f4a: `moveGanttTaskToSection` within one section puts the task before task `at`, as it does across sections.
  
  An `at` equal to the section's length moves it to the end.
  
  <!-- entry: fix -->
- 52b42c2: Setting a gantt task's start or end to the one it has hands back the chart unchanged, whatever order the keys are in.
  
  <!-- entry: fix -->
- 1de58a2: A gantt `todayMarker` stroke written as `rgb(…)` or `hsl(…)` colors the today line.
  
  <!-- entry: fix visual -->
- 8274b0a: Renaming a gitgraph branch renames the checkouts and merges of it that follow, as renaming the main branch does.
  
  `setGitCommandField` refuses a name another branch holds.
  
  <!-- entry: fix -->
- 2f865f0: Changing a gitgraph commit's id renames the cherry-picks of it that follow.
  
  `setGitCommandField` refuses an id another commit holds.
  
  <!-- entry: fix -->
- f28150b: Turning a gitgraph command into a merge or a cherry-pick fills in a branch or commit that the command can take at that point in the history.
  
  A new merge takes the latest other branch created before it, and a new cherry-pick the latest commit with an id on another branch.
  
  <!-- entry: fix -->
- 232697b: `compilePlot`, `plotSchemaOf` and `plotEditorOf` treat a chart whose `kind` is `constructor` or `toString` as a kind they do not know.
  
  <!-- entry: fix -->
- 1c7b2a8: `insertPacketField` throws on a field that starts inside the field before it, as `setPacketStart` does, so a packet's fields never overlap.
  
  <!-- entry: fix behavior -->
- 1962081: `piePercent` writes a slice's share with `@weasel-js/quantity`'s `percent` display, which `@weasel-js/plot` now depends on.
  
  <!-- entry: rank=-5 internal -->
- d2f7077: `pieValueOf` reads very long typed text in time linear in its length.
  
  <!-- entry: fix perf -->
- 1ed4afd: A radar whose `max` is set at or below zero, with no `min`, spans one unit below `max` rather than running from zero backward.
  
  <!-- entry: fix visual -->
- ac1e8b1: A sankey lays out in time linear in its links: one of 5,400 nodes and 10,400 links compiles in about 35 ms rather than 3 to 7 seconds.
  
  <!-- entry: perf -->
- c007853: A sankey link's value typed in place reads as a decimal number, as a pie slice's does: `0x10`, `0b11`, and `0o7` leave the flow unchanged.
  
  <!-- entry: fix -->
- 5f50e9b: Undo and redo in a `PlotView` draw the restored chart at its current size, theme, and measure.
  
  <!-- entry: fix visual -->
- 23f13f4: Dragging an xychart's bar or point past a value-axis end the chart sets stops the value at that end; past a fitted end it still grows.
  
  <!-- entry: fix -->
- f3723ee: An xychart with only one value-axis end set, past every value, keeps its axis the right way up, spanning one unit beyond that end.
  
  <!-- entry: fix visual -->
- 18792d3: An xychart that lists one bar series object twice draws each listing in a slot of its own.
  
  <!-- entry: fix visual -->
- 2c900fd: An xychart row edit leaves a series' missing values missing rather than drawing them as zeros.
  
  Inserting, removing, or moving a row, or setting a value past a series' end, writes a value the series lacks inside its length as `NaN`, which the chart draws as no point.
  
  <!-- entry: fix visual data -->
- a06c164: Prefs' CSS values, a blended theme's lengths and plot mark path data write their numbers with `@weasel-js/geom`'s `trimNumber`.
  
  <!-- entry: rank=-5 internal -->
- Updated dependencies [5099ca3]
- Updated dependencies [e5f53c6]
- Updated dependencies [74e52e2]
- Updated dependencies [617fd6c]
- Updated dependencies [03c5f2f]
- Updated dependencies [fe3c2df]
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
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [a98ad34]
- Updated dependencies [5f856dc]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [643c699]
- Updated dependencies [0dc7968]
- Updated dependencies [ca5bcb0]
- Updated dependencies [6da5a3b]
- Updated dependencies [4fb8cbf]
- Updated dependencies [e468edc]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [6355d18]
- Updated dependencies [3f23bc8]
- Updated dependencies [691b592]
- Updated dependencies [b508e1a]
- Updated dependencies [9249b26]
- Updated dependencies [f20931c]
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
- Updated dependencies [6fb8869]
- Updated dependencies [ec44e4c]
- Updated dependencies [063b00c]
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
- Updated dependencies [cf2a57b]
- Updated dependencies [7a5e072]
- Updated dependencies [bb5880a]
- Updated dependencies [29d293c]
- Updated dependencies [a63b723]
- Updated dependencies [0c07b8d]
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
- Updated dependencies [03c5f2f]
- Updated dependencies [8764186]
- Updated dependencies [f3c2f12]
- Updated dependencies [81f2080]
- Updated dependencies [84a4212]
- Updated dependencies [7542fc9]
- Updated dependencies [319879e]
- Updated dependencies [8d7296a]
- Updated dependencies [398b575]
- Updated dependencies [e6ec996]
- Updated dependencies [9a3bf41]
- Updated dependencies [d3d3973]
- Updated dependencies [22c6086]
- Updated dependencies [efe82c4]
- Updated dependencies [df9dba4]
- Updated dependencies [2729716]
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
- Updated dependencies [3a8b706]
- Updated dependencies [471581b]
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
- Updated dependencies [f9b150c]
- Updated dependencies [583bd6d]
- Updated dependencies [d353c85]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
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
- Updated dependencies [8257aa7]
- Updated dependencies [8c2d558]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
- Updated dependencies [37ce380]
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
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [19f8e39]
- Updated dependencies [8882b53]
- Updated dependencies [0618a25]
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
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [1ba9061]
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
- Updated dependencies [75ef9fb]
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
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [df97f39]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [6661cbf]
- Updated dependencies [dc881e4]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
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
- Updated dependencies [d5d22cb]
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
- Updated dependencies [4d469aa]
- Updated dependencies [419b1f1]
- Updated dependencies [a3136aa]
- Updated dependencies [5b156c6]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [f976095]
- Updated dependencies [af132bc]
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
- Updated dependencies [a3958dc]
- Updated dependencies [6fcc7aa]
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
- Updated dependencies [17d184b]
- Updated dependencies [cabffe5]
- Updated dependencies [f92300d]
- Updated dependencies [d569abf]
- Updated dependencies [76ca845]
- Updated dependencies [431aa8e]
- Updated dependencies [1ac16c5]
- Updated dependencies [a82e65b]
- Updated dependencies [b835405]
- Updated dependencies [bf1cf7b]
- Updated dependencies [c3e773c]
- Updated dependencies [a68cc74]
- Updated dependencies [aef6bf7]
- Updated dependencies [dfcae5d]
- Updated dependencies [1e1e868]
- Updated dependencies [2f32eef]
- Updated dependencies [7ab6c70]
- Updated dependencies [cce50d5]
- Updated dependencies [a8e0b9a]
- Updated dependencies [d510bd3]
- Updated dependencies [1608601]
- Updated dependencies [f4a888f]
- Updated dependencies [684a6cd]
- Updated dependencies [638d22c]
- Updated dependencies [29c0156]
- Updated dependencies [20bb330]
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
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
- Updated dependencies [6222db5]
- Updated dependencies [cfebac4]
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
- Updated dependencies [4069e86]
- Updated dependencies [201717b]
- Updated dependencies [cf2ad81]
- Updated dependencies [6bdf14d]
- Updated dependencies [a8ae2f7]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [555bd8d]
- Updated dependencies [ae6b2a5]
- Updated dependencies [5b0df8a]
- Updated dependencies [78dd590]
- Updated dependencies [d7a156b]
- Updated dependencies [d3f717d]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
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
- Updated dependencies [81da21a]
- Updated dependencies [c9df176]
- Updated dependencies [75518d4]
- Updated dependencies [854cd17]
- Updated dependencies [3aafef6]
- Updated dependencies [e441f69]
- Updated dependencies [85a0736]
- Updated dependencies [47af125]
- Updated dependencies [bd11878]
- Updated dependencies [9331aee]
- Updated dependencies [a722c3d]
- Updated dependencies [9b9f025]
- Updated dependencies [3cf6a17]
- Updated dependencies [3cf6a17]
- Updated dependencies [e246e43]
- Updated dependencies [13f859a]
- Updated dependencies [378f057]
- Updated dependencies [e8148f6]
- Updated dependencies [2165b78]
- Updated dependencies [2405236]
- Updated dependencies [189f069]
- Updated dependencies [5e35297]
- Updated dependencies [dab3f16]
- Updated dependencies [a236fa9]
- Updated dependencies [f7d58d1]
- Updated dependencies [148d382]
- Updated dependencies [5e9987f]
- Updated dependencies [ae102fe]
- Updated dependencies [613fb76]
- Updated dependencies [2509807]
- Updated dependencies [0aa733f]
- Updated dependencies [2dbf2ba]
- Updated dependencies [592ccf8]
- Updated dependencies [4bbf7c0]
- Updated dependencies [73423ec]
- Updated dependencies [bc84e18]
- Updated dependencies [bcf156e]
- Updated dependencies [13de9ee]
- Updated dependencies [c0963ed]
- Updated dependencies [ae7832a]
- Updated dependencies [e34dfcc]
- Updated dependencies [0315c53]
- Updated dependencies [b48a618]
- Updated dependencies [ce0c92a]
- Updated dependencies [8ac733d]
- Updated dependencies [dc784c7]
- Updated dependencies [aa5bf43]
- Updated dependencies [8f1cf20]
- Updated dependencies [33f8369]
- Updated dependencies [7fe0b62]
- Updated dependencies [206f77c]
- Updated dependencies [e57d7a9]
- Updated dependencies [552d4fc]
- Updated dependencies [241691a]
- Updated dependencies [7ba9d98]
- Updated dependencies [4f8619b]
- Updated dependencies [4f8619b]
- Updated dependencies [fb94e87]
- Updated dependencies [2ab2678]
- Updated dependencies [ea29790]
- Updated dependencies [c62a3d3]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [368fb5f]
- Updated dependencies [dd7e196]
- Updated dependencies [963f8fd]
- Updated dependencies [ba59515]
- Updated dependencies [de71f7d]
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
- Updated dependencies [a06c164]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [8fb09ad]
- Updated dependencies [ba7e062]
- Updated dependencies [a5c1865]
- Updated dependencies [0d977b8]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [bdc9108]
- Updated dependencies [c4783b4]
- Updated dependencies [de9d942]
- Updated dependencies [cdede50]
- Updated dependencies [edcb456]
- Updated dependencies [f2b94bc]
- Updated dependencies [4198fea]
- Updated dependencies [0ac8104]
- Updated dependencies [475c725]
- Updated dependencies [adca5ed]
- Updated dependencies [793ac72]
- Updated dependencies [c7db707]
- Updated dependencies [ca65c7b]
- Updated dependencies [987dd51]
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [12816b7]
- Updated dependencies [5b8e066]
- Updated dependencies [fca9c3c]
- Updated dependencies [087e02c]
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
  - @weasel-js/core@2.0.0
  - @weasel-js/editing@2.0.0
  - @weasel-js/geom@2.0.0
  - @weasel-js/quantity@2.0.0
  - @weasel-js/text@2.0.0
  - @weasel-js/theme@2.0.0
  - @weasel-js/text-tools@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/scale@2.0.0

## 1.19.1

### Patch Changes

- Updated dependencies [c91c39c]
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
- Updated dependencies [58298fa]
- Updated dependencies [71c3f85]
- Updated dependencies [7e954c5]
- Updated dependencies [55b0f04]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [216d193]
- Updated dependencies [2f6b0e9]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [0cbbb94]
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
- Updated dependencies [b4e8f97]
- Updated dependencies [bce70ba]
- Updated dependencies [3fd5c6f]
- Updated dependencies [16900c1]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/core@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/text@1.19.1
  - @weasel-js/theme@1.19.1

## 1.19.0

### Patch Changes

- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- ca94f2d: `bandScale` takes its default padding for a `paddingInner` of `NaN` or a `paddingOuter` that is not finite.
  
  <!-- entry: rank=-5 fix -->
- 8ac5c6f: Charts draw only finite geometry from any data.
  
  A quadrant point is held to the unit square, and one with a `NaN` coordinate is not drawn; a negative or non-finite radius or stroke width takes the default, and a radius past the plot is cut to it. A radar value short of the center's is drawn at the center, and a journey step with a `NaN` score draws no face. A packet field's fractional bit is read as the bit it falls in. Sankey flows whose sum is past the double range keep their proportions.
  
  <!-- entry: fix visual -->
- 5f0d749: An xychart's and a radar's data are cut to the plot area, so nothing past it is drawn on the canvas or in any export.
  
  A bar past a fixed end of the value axis is cut at the plot's edge, with its drag handle on that cut end. A line is clipped to the plot, a radar's outline and fill to its rim, and a point whose center falls outside is not drawn.
  
  <!-- entry: fix visual -->
- e6d57fe: The plot clipper holds a rect of zero width or height, or a circle of zero radius, to the segment or point it is.
  
  <!-- entry: rank=-5 fix -->
- e0a3d33: The plot clipper pulls a point that lands a rounding outside the area inside it.
  
  <!-- entry: rank=-5 fix -->
- 7a29e1b: `clipPolygon` no longer answers `NaN` corners where a polygon edge crosses a side of the area only far out.
  
  <!-- entry: rank=-5 fix -->
- 5ea8837: `formatNumber` and a linear, log, pow or warp scale's `format` write a small negative that rounds to zero as `0`, not `-0`.
  
  <!-- entry: fix -->
- a97da18: `formatTick` writes a value or step finer than 1e-100 with an exponent, as `formatNumber` does, so subnormal ticks no longer all read `0`.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: `formatGanttEnd` writes a duration's amount in digits (`0.0000001d`), never with an exponent, so `parseGanttEnd` reads it back as a duration.
  
  <!-- entry: fix data -->
- c75559c: A gantt task whose end is past what a `Date` or a number holds is drawn instead of producing `NaN`.
  
  A duration of months past the year 275760 ends 30 days a month on, and one past the double range ends at its edge. `parseGanttDate` refuses `x` and `X` digits past the double range. A chart whose tasks all sit too far out for a day to move them spans more than one instant.
  
  <!-- entry: rank=-5 fix -->
- dcbcc5d: Editing or removing a gantt task whose id another task also holds keeps the `after` and `until` dependencies on that id.
  
  <!-- entry: fix -->
- e5cbd2e: A git graph commit given no id takes the first `#n` that no commit holds, so the replay no longer stops with `a commit "#2" already exists`.
  
  <!-- entry: fix -->
- a6fb3c0: A git graph places a branch whose `order` is `NaN` as one with no order, by where it was created.
  
  <!-- entry: rank=-5 fix -->
- a6ffc20: `logScale` places a value between ends whose logarithms round together by its distance from the start, the same both ways round.
  
  <!-- entry: rank=-5 fix -->
- 3137efc: `logScale` keeps about twice the tick count across many decades, every few decades, instead of one tick a decade.
  
  <!-- entry: behavior visual -->
- b1309b2: A `logScale` whose ends are too near for their logarithms to differ maps them to the range's ends and gets no tick from outside it. Its `invert` at the range's ends stays finite.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: A `logScale` of a base other than 10 labels small ticks to their own digits, so 1.09e-12 and 1.2e-12 no longer both read `0.000000000001`.
  
  <!-- entry: fix visual -->
- f77795f: An xychart or radar whose values run to millions no longer overflows the call stack while fitting its value range.
  
  <!-- entry: fix -->
- 9723ed2: `niceDomain`, and a `linearScale` with `nice`, keep a domain near `Number.MAX_VALUE` finite. A span too fine for its step, such as `[0, 5e-324]`, is kept as given.
  
  <!-- entry: rank=-5 fix -->
- cc185ab: `niceStep` keeps a rough step whose rounding up would pass the largest double, so `spacedTicks` over the whole double range gives finite ticks.
  
  <!-- entry: rank=-5 fix -->
- d69b413: A pie whose slice values add up past what a number holds draws and labels each slice at its share.
  
  <!-- entry: rank=-5 fix -->
- 6ead2a8: A quadrant chart finds a point's class among its own `classes` only, never an inherited key such as `constructor` or `__proto__`.
  
  <!-- entry: rank=-5 fix -->
- 46dfb3e: `ordinalScale` and `bandScale` list a key their domain names twice once, at its first place.
  
  <!-- entry: fix -->
- b1309b2: Scale ticks finer than 1e-100 apart keep their values and are labeled with an exponent (`1e-300`) instead of all reading `0`.
  
  A span among the subnormals is ticked at multiples of itself, with no tick outside it.
  
  <!-- entry: rank=-5 fix -->
- 3137efc: Linear, power, warp and time scales place a value when the domain's span, or the value's distance from its start, is past the double range.
  
  `linearScale({ domain: [-Number.MAX_VALUE, Number.MAX_VALUE] }).map(0)` is the range's middle, and `invert` sends the range's ends to the domain's exactly. An xychart over values near `±Number.MAX_VALUE` draws its bars.
  
  <!-- entry: rank=-5 fix -->
- dcd3f2c: `spacedTicks` returns no ticks where `minSpacing` spans more of the domain than the largest double, instead of ticks at `NaN`.
  
  <!-- entry: rank=-5 fix -->
- cfd1fc7: `spacedTicks` gives no tick past the domain when its step is far wider than the domain.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: `tickStep` no longer rounds a span near the largest double up to `Infinity`, so such a scale's ticks are finite.
  
  <!-- entry: rank=-5 fix -->
- 3137efc: A time axis labels a month of a year past 9999 whole, as in `10000-02`.
  
  <!-- entry: rank=-5 fix -->
- dcf2a76: `formatTick` and `toFixedPlain` hold `decimals` to the 0 to 100 places `toFixed` takes, rather than throwing a `RangeError`.
  
  <!-- entry: rank=-5 fix -->
- 36504c7: An xychart in a box too short for its axes keeps its axes, bars and points inside the plot instead of drawing them above the chart.
  
  <!-- entry: fix visual -->
- Updated dependencies [0896b71]
- Updated dependencies [aaeec8d]
- Updated dependencies [bbfb059]
- Updated dependencies [65ee9a0]
- Updated dependencies [2595ad3]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [6ff27f5]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
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
- Updated dependencies [a547bff]
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
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
- Updated dependencies [f718790]
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
- Updated dependencies [eaff448]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [3bedaa8]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [c3dc307]
- Updated dependencies [2a9727c]
- Updated dependencies [521bc15]
- Updated dependencies [997e4f3]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [4224853]
- Updated dependencies [4e6aad8]
- Updated dependencies [01b996e]
- Updated dependencies [33633eb]
- Updated dependencies [8e8a341]
- Updated dependencies [ac2ab9d]
- Updated dependencies [c089fd1]
- Updated dependencies [b7f10eb]
- Updated dependencies [355a332]
- Updated dependencies [ada22ef]
- Updated dependencies [1379dff]
- Updated dependencies [b4f5abf]
- Updated dependencies [3c2cddd]
- Updated dependencies [263aa62]
- Updated dependencies [9f52075]
- Updated dependencies [aa35a8f]
- Updated dependencies [2c54d23]
- Updated dependencies [1167180]
- Updated dependencies [1b24a9a]
- Updated dependencies [db86b0c]
- Updated dependencies [fa2b6a2]
- Updated dependencies [37e0907]
- Updated dependencies [f7e4000]
- Updated dependencies [9334505]
- Updated dependencies [fcd1616]
- Updated dependencies [54b81ce]
- Updated dependencies [3643214]
- Updated dependencies [b8ea958]
- Updated dependencies [b1309b2]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [038a0da]
- Updated dependencies [6999cce]
- Updated dependencies [4d16c8a]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/geom@1.19.0
  - @weasel-js/text@1.19.0
  - @weasel-js/theme@1.19.0

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
- Updated dependencies [7fff1b9]
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [6a72bc3]
- Updated dependencies [0c77d00]
- Updated dependencies [fc38c90]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/theme@1.18.2
  - @weasel-js/core@1.18.2
  - @weasel-js/text@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- 791ba1c: Fix xychart category bands, bar and radar drag handles, timeline period moves, sankey value edits, quadrant class order, and PlotView's prop handling.
  
  - An xychart with fewer categories than values now draws the extra rows, numbered as the data table shows them, and a category label written twice gets two bands instead of stacking both rows' bars on one.
  - An xychart bar's drag handle sits on its value end when the bar runs down from the baseline: a value below a value axis that starts above zero, or any bar on a reversed axis.
  - `moveTimelinePeriod` keeps sections that had no periods before the move; it used to drop them.
  - A radar with no `max` can have a point dragged past the rim, so its largest value can grow. Before, the drag stopped at the rim. `polarScale`'s `valueAt` and `radarValueAt` take a new optional `open` argument that reads past the rim.
  - `PlotView` no longer calls `onChange` when the chart is redrawn from a new `data` prop, redraws when the `measure` prop changes, and goes back to the default theme when the `theme` prop is removed.
  - Editing a sankey link's value label and leaving it unchanged no longer rewrites the value. Before, the stored value was replaced by the rounded number the label shows (`0.30000000000000004` became `0.3`).
  - A quadrant chart keeps its classes in order when a class name is all digits; before, such a class jumped to the front when classes were moved, renamed, or read from Mermaid. `QuadrantData` gains an optional `classOrder`, set only when the keys of `classes` would lose the order, and `quadrantClassEntries` and `quadrantClassesOf` read and build the pair. Nothing breaks for consumers: `classes` keeps its type, and data without `classOrder` reads as before. Code that walks `classes` directly should use `quadrantClassEntries` to get the order right.
- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/text@1.18.1
  - @weasel-js/theme@1.18.1
  - @weasel-js/geom@1.18.1

## 1.18.0

### Patch Changes

- 7d409c8: Fix chart scales and Mermaid readers on edge cases
  
  - `spacedTicks` returns no ticks, rather than looping until the array overflows, where the step multiples are past counting (a domain like 1e17..1e17+100), as `ticks()` already did.
  - A time scale spanning decades ticks on 1, 2 or 5 times a power of ten years, so a 40-year span asked for 5 ticks gets 4 rather than 41.
  - A gantt date in years 0 to 99 reads as itself rather than as 1900 to 1999, and `%j` counts its day of the year from its own January.
  - A Mermaid `accDescr { … }` block closed on the line it opens on no longer swallows the statements after it.
  - A Mermaid flowchart reads an `accDescr { … }` block running over several lines instead of throwing.
  - A Mermaid xychart or sequence diagram reads past a `%%{…}%%` directive running over several lines instead of throwing.
  - A quoted front matter title reads the same in a Mermaid sequence diagram and xychart as in every other kind: escapes in double quotes read, `''` in single quotes as one quote.
  - A Mermaid packet diagram writes a gap between fields as an unlabeled field, which Mermaid reads, instead of a field Mermaid rejects for not starting where the one before ends; an unlabeled field reads back as a gap.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [26e836e]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [c675905]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/text@1.18.0
  - @weasel-js/theme@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/text@1.17.3
  - @weasel-js/theme@1.17.3

## 1.17.2

### Patch Changes

- 86783f4: `bandScale(...).invert` on a zero-width range answers the first key, where every band sits. It used to answer `undefined`, which its docs promise only for an empty domain.
- d2800fb: A `logScale` with a base other than 10 labels its powers below 1 with the digits they need. A base-2 scale's 0.125 and 0.25 used to read `0.1` and `0.3`.
- 2c9b792: `logScale` throws on a `base` that is 1, not above zero, or not finite, as `powScale` throws on an exponent of zero. It used to build a scale that mapped every value to `NaN` and ticked none.
- 90600b4: `formatNumber`, `formatTick` and every scale label built on them write a value of 1e21 or more in full digits, as they write a smaller one. Such values used to switch to `1e+21`, so a log axis from 1e20 to 1e22 read `100000000000000000000`, `1e+21`, `1e+22`.
- 436c47d: `powScale` throws on a negative exponent over a domain that reaches zero, as `logScale` throws on a domain not above zero. It used to build a scale that mapped and inverted every value to `NaN`.
- e0a37af: A `timeScale` whose domain reaches past the instants a `Date` can hold (about ±275,000 years from 1970) ticks only the part it can hold. Its `ticks()` used to loop forever.
- Updated dependencies [d15e917]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [c089c61]
- Updated dependencies [cc591ff]
- Updated dependencies [e6e7a72]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [fce3d09]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [d3654a1]
- Updated dependencies [3c8c5af]
- Updated dependencies [cd0738d]
- Updated dependencies [8c4bf4d]
- Updated dependencies [c7dae1d]
- Updated dependencies [c2a7267]
- Updated dependencies [26187c9]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
  - @weasel-js/core@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/text@1.17.2
  - @weasel-js/theme@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/text@1.17.1
  - @weasel-js/theme@1.17.1

## 1.17.0

### Patch Changes

- 3a4cc62: A number pref's slider can space its track other than linearly. A number leaf takes `scale`: `'linear'`, `'log'`, `'sqrt'`, or a `{ to, from }` pair, and labkit's `NumberNode` takes `.scale(...)`, so a segment count where 1–100 matters most, `f.number(16).range(1, 1000).step(1).scale('log')`, gives 1–10, 10–100 and 100–1000 a third of the track each. Only the track changes: the typed value, `step`, `stops`, the arrow keys and the stored value stay in the value's own units. Under a `unit` the scale spaces the shown values. A `'log'` track over a range not above zero warns once in development and is drawn linear. `PropertyField`'s number field takes `scale` as a `ContinuousScaleFactory`, as `Slider` does, and draws its stops where the scale puts them; ui's `prefNumberScale` turns a leaf's `scale`, or a factory, into one, naming its caller in the log warning when given a label. `BandEditor` resolves its `scale` through it too, so its log default now also falls back to linear, rather than throwing, while an edge drag stretches the axis down to zero or below. `PrefSchemaEditor` offers linear, log and sqrt for a number leaf. Additive.
  
  `@weasel-js/plot/scales` adds `powScale({ domain, range, exponent })`, which keeps a negative value's sign so a square-root scale (`exponent: 0.5`) takes zero and negatives, and `warpScale({ domain, range, to, from })`, a scale linear in `to(value)`. Both tick and label in value units, as `linearScale` does. `Scale.kind` and `ContinuousScale.kind` gain `'pow'` and `'warp'`.
- 1d6fe9b: An axis asked for more ticks than the default labeled them at the default's precision: `axisMarks({ ticks: 20 })` on a 0..1 linear scale read `0, 0.1, 0.1, 0.2…` instead of `0, 0.05, 0.1, 0.15…`, and a time axis with hourly ticks labeled each one with its date. Every built-in scale now has `tickFormat(count)`, which returns a formatter at the precision of `ticks(count)`, and `axisMarks` and `axisRoom` label through it. `format(value)` is unchanged. A scale of your own without `tickFormat` is labeled with `format`, as before, and so is a built-in scale whose `format` was replaced (`{ ...scale, format }`), as gantt's `axisFormat` does.
- a4b3961: `ticks()` on a linear, log, or time scale whose domain reached `Infinity`, or a linear scale spanning more than `Number.MAX_VALUE` (say `-1e308..1e308`), never returned. They now return no ticks for an infinite domain and a few for a vast finite one. A time scale reaching back before the year 100 also placed its first ticks in the 1900s, out of order, because `Date.UTC` reads years 0 to 99 as 1900 to 1999.
- d29469c: A linear scale over a domain finer than about 1e-20 put every tick at 0 and labeled each one `0`, and a log scale labeled its ticks below 1e-20 `0`: tick values and labels were rounded to at most 20 decimals. They now round to as many as `toFixed` allows, 100.
- Updated dependencies [d28ff77]
- Updated dependencies [217246e]
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
- Updated dependencies [e603f3f]
- Updated dependencies [34da47e]
- Updated dependencies [5491ac0]
- Updated dependencies [fed446b]
- Updated dependencies [ad2f2a3]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/core@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/theme@1.17.0
  - @weasel-js/text@1.17.0

## 1.16.2

### Patch Changes

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
  - @weasel-js/geom@1.16.2
  - @weasel-js/text@1.16.2
  - @weasel-js/theme@1.16.2

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
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/text@1.16.1
  - @weasel-js/theme@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/theme@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/text@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/theme@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/text@1.15.2

## 1.15.1

### Patch Changes

- 999fba9: Every plot kind can be authored from nothing, not only adjusted. Each kind has pure edits that insert, remove, and reorder every collection its spec holds (`insertPieSlice`, `insertXyRow`, `insertXySeries`, `removeGanttTask`, `insertTimelineEvent`, `insertQuadrantClass`, `insertGitCommand`, `insertSankeyLink`, `insertPacketField`, `moveRadarAxis`, …) and set the fields no drag reaches: titles, axes and their ends, chart options, a task's id, tags, start and end, a commit's every field. `moveGanttTaskToSection` moves a gantt task into another section, keeping its id and the dependencies on it. A removed or renamed gantt task id leaves every `after` and `until` that named it; a removed or renamed quadrant class leaves every point that used it.
  
  `plotSchemaOf(data)` describes a spec of any kind as fields and tables of rows, a table holding tables of its own under each row (a gantt's sections hold their tasks), each read and write going through those edits, so a host builds a form or a grid knowing no kind. `plotRootContaining(scene, id)` names the plot a node is the root or a mark of. `setXyValue` now pads a series shorter than the chart's rows instead of throwing.
  
  `@weasel-js/ui` adds `PlotDataPanel`, which renders that schema for one chart: a row per field, a grid per table with add (at the end, or after any row), remove and drag-to-reorder, rows opening onto the tables they hold.
  
  `@weasel-js/plot` now exports `formatGanttStart`, `parseGanttStart`, `formatGanttEnd` and `parseGanttEnd`, which the Mermaid gantt reader and writer use.
- 69f0788: `PlotData` holds nine more chart kinds besides `xychart`: `gantt` (tasks on a time scale, starts and ends kept as
  written so a task after another moves with it), `timeline`, `pie`, `quadrant`, `journey`, `gitgraph`, `sankey`,
  `packet` (a band scale of bits) and `radar` (on the new `polarScale`). Each compiles to marks through
  `plotSpecs` and is edited as its spec: dragging a task's span or its end, a quadrant or radar point, or a journey
  score; reordering a timeline's periods; and editing text in place, which `foldPlotText` and `usePlotTextEdit` fold
  into one edit of the spec. `PlotView` turns text editing on. A `PlotEditor`'s `handle` may now return several handles,
  each with a `part` and optionally a `box` that takes a press anywhere inside it, and editors may define `text`. This
  adds API.
- 8c13aee: `@weasel-js/plot` now holds the one implementation of scales and ticks, and ui uses it.
  
  `@weasel-js/plot/scales` is a new subpath with every scale and tick helper and no React, DOM or scene. A linear
  scale gains `spacedTicks({ minSpacing, inset })`, which picks ticks by the room between them along the range and
  returns them with their step and shared decimals; `niceStep`, `decimalsOf`, `tickDecimals`, `formatTick`,
  `TickSet`, `TickFormatCtx`, `TickFormatter` and `ContinuousScaleFactory` are exported beside it.
  
  This breaks ui's API. Removed from `@weasel-js/ui`, with what replaces each:
  
  - `niceTicks`, `niceStep`, `stepDecimals`, `tickDecimals`, `formatTick` and their types: import from
    `@weasel-js/plot/scales`; `niceTicks(range, px, opts)` is `linearScale({ domain: range, range: [0, px] })
    .spacedTicks(opts)`, and `stepDecimals` is `decimalsOf`.
  - `linearScale`, `logScale`, `SliderScale` (from `Slider`) and `BandScale` (from `BandEditor`): `Slider`'s and
    `BandEditor`'s `scale` prop now takes a scale factory such as plot's `logScale`, which the control calls with
    `{ domain: [min, max], range: [0, 1] }`. A hand-written `{ toUnit, fromUnit }` no longer fits; build a
    `ContinuousScale` instead. A `Slider` given `logScale` with a `min` of zero or below now throws rather than
    placing its thumbs at `NaN`.
- 728db32: Add `@weasel-js/plot`, charts on the scene graph. Scales (`linear`, `log`, `band`, `time`, `ordinal`), axes, and
  marks (`bar`, `span`, `line`, `area`, `point`, `arc`, `ribbon`, `rule`, `text`) that keep their datum in scene data;
  `PlotData`, a union of chart specs that `plotSpecs` compiles to one root node holding the spec with its marks under
  it; `replacePlotData`, which swaps a spec as one undo entry; and `plotEditing` and `PlotView`, which edit a chart by
  dragging its marks. `xychart` is the first kind: bar and line series over categories or a numeric range.
- Updated dependencies [d2110bc]
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [937167e]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
- Updated dependencies [156bcd0]
  - @weasel-js/text@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/theme@1.15.1
