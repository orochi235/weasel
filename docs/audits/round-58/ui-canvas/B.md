I couldn't finish the findings file: permission to write `.skulkr/out/findings.md` was declined. It holds all five findings, but its "Files read" list and closing line are missing. Here is the whole document:

# Audit round 58, area ui-canvas

## useSceneLayerList's onSelectionChange swallows a content row added while an annotation is picked, and never unpicks
- where: packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.ts:175 (onSelectionChange)
- scenario: with annotations on, `picked: 'n1'` and content selection `['box']`, `selectedIds` is `['box', 'n1']`. A Cmd-click on content row `c` reports `['box', 'n1', 'c']`; `notes` is `['n1']`, so the handler calls `pick('n1')` and returns, and `c` is never selected. A Cmd-click that deselects `n1` reports `['box']`, and nothing calls `pick(null)`, so `n1` stays picked and highlighted. A plain click on a content row also leaves the old annotation shown selected. What should happen: content ids go to `selection.set` whatever else is in the set, and the pick follows the annotation ids, set to null when there are none.
- evidence: read (the test at useSceneLayerList.test.tsx:146 covers only an annotation replacing an annotation)
- severity: medium

## SceneGradientHandles edits `nodeId`'s gradient but commits it to the selection's nodes
- where: packages/ui-canvas/src/components/SceneGradientHandles/SceneGradientHandles.tsx:79 (dispatch)
- scenario: the handles draw `nodeId`'s paint, normalized to `nodeId`'s box, and `edit.commit({ paint })` goes to `setFill`/`setStroke`. Those actions write to `operandContent(ctx.deps)`, which is the selection (editing/src/actions/edit/createPaintAction.ts:108), not `nodeId`. If `nodeId` is not the lone selected node (the prop only says "usually"), a drag writes nothing to `nodeId`. Instead `nodeId`'s gradient, in `nodeId`'s bounds fractions, overwrites the fill of every selected node, and those nodes' own gradients are lost. The handle should target `nodeId`, or the prop should be taken from the selection.
- evidence: read
- severity: medium

## A SelectionPanel draft that ends in a cancel stays in the scene, outside undo
- where: packages/ui-canvas/src/components/inspector/SelectionPanel/commitLeaf.ts:132 (leafWrites)
- scenario: `withDrafts` (ui/Prefs/commitPolicy.ts:47-49) routes a number, string or color field's `onInput` to `writes.draft`, which writes the scene `untracked`. The kit's edit protocol ends such an edit with `onCancel` on Escape, on unreadable text, or on an abandoned opacity drag. `leafWrites` has no cancel, and only a later `commit` or `reset` of the same leaf runs `restore`, so nothing undoes the draft. Take a typed size field under `settleWhenIdle`: the reader types `30`, the draft writes 30, then the reader presses Escape. The node keeps 30, the panel re-reads 30 from the scene, and no undo entry exists, so Undo moves past it to an older step. What should happen: a cancel restores `drafted.get(leaf.path)`, as `restore` already does.
- evidence: read (the draft→restore path is in this file; the missing `onCancel` wiring is the PanelCells/Prefs side)
- severity: medium

## PlotDataPanel offers no way to unset an optional color or boolean field
- where: packages/ui-canvas/src/components/PlotDataPanel/valueControl.ts:24 (valueControl)
- scenario: `optional` becomes `onClear` for number and enum, and turns `''` into `undefined` for string. The `boolean` and `color` branches drop it. quadrant's style columns are `optional: true` with `{ kind: 'color' }` (plot/src/quadrant/schema.ts:35), and their `set` restyles on `undefined`. Once the panel has set a point's color, the panel cannot return it to the inherited default. An optional boolean that is unset also reads as `false`, so the panel cannot tell "unset" apart from "false".
- evidence: read
- severity: low

## CharacterOptions drops a solid fill's `opacity`, shows it, and erases it on the next color edit
- where: packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx:71 (characterPatch), :136 (solidFill)
- scenario: for a run filled `{ paint: { color: '#ff0000', opacity: 0.5 } }`, `solidFill` returns `'#ff0000'`, so the `alpha: true` picker shows opaque red. Any color pick then commits `{ fill: { paint: { color } } }`, which replaces the whole fill record. The opacity is lost, and half-transparent text turns opaque after a hue change. The swatch should fold `opacity` into the `#rrggbbaa` it shows, and the patch should keep it.
- evidence: read
- severity: low

Note: the brief names commit b400d7039e8ac2f03166b3332ac613eba61c689f, which this checkout does not hold (HEAD is a22801b42b). I read the files as they stand in the working tree. None of the listed files have uncommitted changes.

## Files read
packages/ui-canvas/src/components/PlotDataPanel/PlotDataPanel.module.css
packages/ui-canvas/src/components/PlotDataPanel/PlotDataPanel.stories.tsx
packages/ui-canvas/src/components/PlotDataPanel/PlotDataPanel.tsx
packages/ui-canvas/src/components/PlotDataPanel/PlotTableView.tsx
packages/ui-canvas/src/components/PlotDataPanel/index.ts
packages/ui-canvas/src/components/PlotDataPanel/rowIds.ts
packages/ui-canvas/src/components/PlotDataPanel/valueControl.ts
packages/ui-canvas/src/components/Rulers/Rulers.module.css
packages/ui-canvas/src/components/Rulers/Rulers.stories.module.css
packages/ui-canvas/src/components/Rulers/Rulers.stories.tsx
packages/ui-canvas/src/components/Rulers/Rulers.tsx
packages/ui-canvas/src/components/Rulers/index.ts
packages/ui-canvas/src/components/SceneGradientHandles/SceneGradientHandles.tsx
packages/ui-canvas/src/components/SceneGradientHandles/index.ts
packages/ui-canvas/src/components/SceneLayerList/index.ts
packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.ts
packages/ui-canvas/src/components/inspector/AnchorFields/AnchorFields.stories.tsx
packages/ui-canvas/src/components/inspector/AnchorFields/AnchorFields.tsx
packages/ui-canvas/src/components/inspector/AnchorFields/index.ts
packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.stories.tsx
packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx
packages/ui-canvas/src/components/inspector/CharacterOptions/characterSchema.ts
packages/ui-canvas/src/components/inspector/CharacterOptions/index.ts
packages/ui-canvas/src/components/inspector/SelectionPanel/SelectionPanel.module.css
packages/ui-canvas/src/components/inspector/SelectionPanel/SelectionPanel.stories.module.css
packages/ui-canvas/src/components/inspector/SelectionPanel/SelectionPanel.stories.tsx
packages/ui-canvas/src/components/inspector/SelectionPanel/SelectionPanel.tsx
packages/ui-canvas/src/components/inspector/SelectionPanel/commitLeaf.ts
packages/ui-canvas/src/components/inspector/SelectionPanel/declaredFields.ts
packages/ui-canvas/src/components/inspector/SelectionPanel/index.ts
packages/ui-canvas/src/components/inspector/SelectionPanel/nodeModel.ts
packages/ui-canvas/src/components/inspector/SelectionPanel/scopes.ts
packages/ui-canvas/src/icons.gen.ts
packages/ui-canvas/src/index.ts
packages/ui-canvas/src/kitIcons.ts
packages/ui-canvas/src/pbt.fixture.ts
packages/ui-canvas/src/testing/rectScene.ts
packages/ui-canvas/src/testing/withIcons.tsx

<!-- done: 5 findings, files read: 38 -->