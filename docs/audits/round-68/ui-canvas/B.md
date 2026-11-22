# Findings: ui-canvas (round 68)

## Children of an annotation group can never be reordered or moved in the layer list
- where: packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.ts:186 (canMove)
- scenario: with `annotations` given, an annotation layer holds a group with two children. The annotation layer's row lists the group with its children nested (`build(...)` recurses). Dragging one child above the other calls `canMove({ ids: [child], parentId: groupId })`; `annotationLayerOf(groupId)` is `null`, so `into === null`, and `isAnnotation(child)` is true, so the test `layer === into` is `'annotations' === null` → false. Every drop inside an annotation group is refused, even though `onReorder` would handle it (`parent = groupId`). Expected: an annotation may move within its own layer's subtree, which includes its container.
- evidence: read
- severity: low

## Editing one field of a declared `units`/`clip` on a node that declares none writes a malformed scope
- where: packages/ui-canvas/src/components/inspector/SelectionPanel/commitLeaf.ts:42 (writeLeaf)
- scenario: a properties schema keys `units.drawnAt` (the field core's own magnification warning, `useMagnificationCheck.ts:30`, tells consumers to set) on a node whose `units` is `null`/absent. Typing 0.4 runs `setAtPath((field ?? {}), ['drawnAt'], 0.4)` and then `scene.setUnits(id, { drawnAt: 0.4 })`: a `UnitScope` with no `system`, which `UnitScope` requires, so anything resolving that node's unit chain reads `scope.system` as `undefined`. The same holds for any `clip.<field>` leaf on an unclipped node (a partial `NodeClip`). Expected: no write, or a whole value built from the leaf's default, never a partial record of a type with required fields.
- evidence: read
- severity: medium

## CharacterOptions shows "No fill" off, not indeterminate, on a range that mixes no fill with a color
- where: packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx:102 (characterValues) and :118 (characterMixed)
- scenario: a selection spans one run with `fill: null` and one with a solid color, so `effectiveStyle.fill === MIXED`. `characterMixed` adds only `'fill'` to the mixed set, never `'noFill'`, and `characterValues` sets `noFill: false` (`style.fill !== MIXED && …`). The No fill toggle reads as plainly off, claiming every character is filled, while every other control shows its indeterminate state for a mixed key. Expected: `noFill` in the mixed set whenever `fill` is `MIXED`.
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
