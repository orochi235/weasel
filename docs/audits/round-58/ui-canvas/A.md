# Audit round 58 — ui-canvas findings

## While an annotation is picked, a multi-select change to content rows is dropped, and the pick can never be toggled off
- where: packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.ts:174-182 (useSceneLayerList, `onSelectionChange`)
- scenario: `selectedIds` is the content selection plus `picked`. LayerList runs in `selectionMode="multiple"`, so a Cmd/Shift-click (or a toggle-behavior click) hands back the previous set with one id added or removed. With annotation `n1` picked and content `a` selected, Cmd-clicking content row `b` gives `['a', 'n1', 'b']`; `notes` is `['n1']`, so the handler calls `pick('n1')` and returns, and `b` is never added to the content selection. In the other direction, Cmd-clicking the picked row `n1` to deselect it gives `['a']`; `notes` is empty, so only `selection.set(['a'])` runs and `pick(null)` is never called, so the annotation stays picked and still shows as selected. Expected: the content selection follows the content ids in the new set, and the pick follows the annotation ids (cleared when none remain, or set to the newly added one).
- evidence: read (LayerList.tsx:88-90 passes React Aria's multiple-selection set through unchanged)
- severity: medium

## A range whose fill is MIXED between none and a color shows "No fill" as plainly off, not mixed
- where: packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx:97 and :113-124 (characterValues, characterMixed)
- scenario: select text across two runs, one with `fill: null` and one red. `effectiveRangeStyle` gives `fill: MIXED`. `characterValues` sets `noFill: style.fill !== MIXED && …`, which is `false`, and `characterMixed` adds `fill` to the mixed set but never `noFill` (it only checks the schema keys `RangeStyle` holds, and `noFill` is not one). So the toggle says the whole range is filled while part of it is not. Expected: `noFill` is in the mixed set whenever `fill` is `MIXED`, so the toggle shows indeterminate like every other key the range disagrees on.
- evidence: read
- severity: low

## PlotDataPanel keeps showing an edit's error after the chart changes from elsewhere
- where: packages/ui-canvas/src/components/PlotDataPanel/PlotDataPanel.tsx:24-44 (PlotDataPanel, `error` state)
- scenario: a schema `set` throws (for example an invalid value), so the panel shows the message in a `PropertyNote`. The host then passes a different `data`: an undo, a chart loaded from a file, or another chart kind entirely. `error` is only cleared by the panel's next successful edit, so the old message stays under fields it no longer applies to, possibly for a different chart. Expected: the error goes away when `data` is replaced from outside (reset it when `data` is not the value the failing edit started from). A related problem: `onChange` runs inside the same `try`, so an exception the host's own handler throws is caught and shown as a schema error, not propagated.
- evidence: read
- severity: low

## AnchorFields' SeveralAnchors story says `+=10` moves both anchors, but its stand-in writer sets a Mixed field to 10
- where: packages/ui-canvas/src/components/inspector/AnchorFields/AnchorFields.stories.tsx:17-21, 26-30 (Stand, SeveralAnchors)
- scenario: in SeveralAnchors, `x` is `null` (Mixed). Typing `+=10` into X calls `write('x', { by: 10 })`, and `Stand` computes `(now ?? 0) + entry.by`, so X becomes a single 10. The story's own blurb says this moves both anchors by 10, which is the behavior of the real `useAnchorFields` writer. The story shows a reader the opposite of what it describes. Expected: the stand-in keeps per-anchor values, or the blurb doesn't claim an offset on a Mixed field.
- evidence: read
- severity: low

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

<!-- done: 4 findings, files read: 38 -->
