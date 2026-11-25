# Audit round 68 — ui-canvas

## Raising a translucent text fill's alpha to 100% in CharacterOptions keeps the old opacity
- where: packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx:75 (characterPatch), with solidFill at :141
- scenario: a range whose fill is `{ color: '#ff0000', opacity: 0.5 }` shows the swatch `#ff000080` (solidFill folds opacity into the hex). The user drags the swatch's alpha to 100%; the picker commits `#ff0000` (rgbaToHex drops an opaque alpha). characterPatch calls `paintWithColor(prev, '#ff0000')`, and because the color has no alpha of its own, paintWithColor keeps prev's `opacity: 0.5`. The text stays 50% opaque and the swatch goes back to `#ff000080`. The swatch already shows the combined alpha, so the commit should replace opacity rather than inherit it: there is no way to make the fill opaque from the bar.
- evidence: read (paintWithColor / hasOwnAlpha in packages/paint/src/paintDefaults.ts:78,126; rgbaToHex in packages/paint/src/color.ts:139)
- severity: medium

## CharacterOptions shows "No fill" off, not mixed, for a range that is partly unfilled
- where: packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx:102 (characterValues) and :118 (characterMixed)
- scenario: a selection spanning a run with `fill: null` and a run with a solid fill gives `style.fill === MIXED`. characterValues sets `noFill: false` and characterMixed adds only `fill`, never `noFill`. So the No-fill toggle reads plainly off while some of the characters have no fill. Clicking it once (on → `fill: null`) works, but the control claims a state the range doesn't have. It should be in the mixed set whenever `fill` is MIXED.
- evidence: read
- severity: low

## A layer-list drag to the top level picks one parent from the first dragged row, which sends rows from inside a container to the root, not the page run
- where: packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.ts:150 (topParent), used at :194 and :206
- scenario: a scene with a page run and the pasteboard off. Two rows are dragged together to the list's top level: `ids[0]` is a root (parent `null`, such as an annotation-free root kept beside the run) and `ids[1]` is inside a group within the run. topParent reads only `ids[0]`, finds `null`, and returns `null`. `joining` then reparents `ids[1]` to the scene root, although topParent's own rule says a row brought up from inside a container goes to the run when the pasteboard is off. A drag led by the nested row instead sends both to the run. The two orders give two different answers for the same drop.
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

<!-- done: 3 findings, files read: 38 -->
