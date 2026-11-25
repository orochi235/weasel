# Audit round 66 — path-tools.part2

## Join fills a per-anchor channel that cannot be joined with zeros for the dropped path's anchors, rather than dropping it
- where: packages/path-tools/src/pathCommands/joinAnchorData.ts:78-84 (joinedAnchorData)
- scenario: Join two paths where `keep` has fill `vertexColors` and `drop` has a gradient fill, so `solidRgba` gives no base and `fillColors` is null, while some other channel does join (for example, either stroke has `vertexWidths`, so `combined.stroke` is set). `combined` has no `vertexColors`, but `{ ...data, ...combined }` still carries keep's own `vertexColors`, which has `keepAnchors × 4` entries. `anchorDataPatch` remaps it against `before`, which holds keep's and drop's anchors together. `remapAnchorValues` reads `values[o.a * stride + k] ?? 0` past the end of the array for every anchor that came from `drop`, so the output array is the right length and those anchors are transparent black (0,0,0,0). Because the array fits, `withAnchorDataFitting` keeps it, and `reshapeOps` lays the patch over the data after that check ran. The same happens to keep's `stroke.vertexColors` when the stroke colors cannot be joined (drop's stroke paint is not solid) but the fill colors or the widths can. Expected: a channel that cannot be joined is dropped, which is what happens when no channel joins at all (the `return {}` path, whose mismatched arrays `withAnchorDataFitting` strips).
- evidence: read (joinAnchorData.ts; core/src/domains/paths/anchorData.ts `anchorDataPatch`, `withAnchorDataFitting`; geom/src/paths/anchorValues.ts `remapAnchorValues`; core pathNodes.ts `reshapeOps`)
- severity: medium

## `facesAlong` hangs when `step` is 0
- where: packages/path-tools/src/shapeBuilder/shapeBuilder.ts:101-102 (facesAlong)
- scenario: `facesAlong(plan, [{x:0,y:0},{x:10,y:0}], 0)` computes `n = Math.max(1, Math.ceil(10 / 0))`, which is `Infinity`, and the loop `for (s ...; s <= n; s++)` never ends. `facesAlong` is public API (exported from `shapeBuilder/index.ts` and announced in the changelog). The in-package caller guards against this by clamping the scale, but a consumer passing a step derived from a zero zoom, or a literal 0, freezes the tab. Expected: a step that is not positive is clamped or rejected.
- evidence: read
- severity: low

## Files read
packages/path-tools/src/knead/useKneadTool.ts
packages/path-tools/src/outlines/createOutlines.ts
packages/path-tools/src/outlines/createOutlinesAction.tsx
packages/path-tools/src/outlines/outlineStroke.ts
packages/path-tools/src/outlines/outlineStrokeAction.tsx
packages/path-tools/src/outlines/replaceWithPaths.ts
packages/path-tools/src/outlines/useCreateOutlinesAdapter.ts
packages/path-tools/src/overlays/showOverlay.ts
packages/path-tools/src/pathCommands/cutJoin.ts
packages/path-tools/src/pathCommands/joinAnchorData.ts
packages/path-tools/src/pathCommands/livePathEdit.ts
packages/path-tools/src/pathCommands/pieceOrigins.ts
packages/path-tools/src/pathCommands/simplifyOffset.ts
packages/path-tools/src/pathEffects/actions.ts
packages/path-tools/src/pathEffects/effectForms.ts
packages/path-tools/src/pathEffects/hiding.ts
packages/path-tools/src/pathEffects/params.ts
packages/path-tools/src/pathEffects/retarget.ts
packages/path-tools/src/pathEffects/settingsForm.ts
packages/path-tools/src/pathEffects/spine.ts
packages/path-tools/src/pathStructure/directionMarks.ts
packages/path-tools/src/pathStructure/pathStructure.ts
packages/path-tools/src/pathsPreset.ts
packages/path-tools/src/pbt.fixture.ts
packages/path-tools/src/pencil/usePencilTool.tsx
packages/path-tools/src/poise/poiseHandles.ts
packages/path-tools/src/poise/poiseMarks.ts
packages/path-tools/src/presets.ts
packages/path-tools/src/reach/reachToMeet.ts
packages/path-tools/src/reach/useReachTool.ts
packages/path-tools/src/resample/resample.ts
packages/path-tools/src/sand/sand.ts
packages/path-tools/src/sand/useSandTool.ts
packages/path-tools/src/segmentType/convertSegments.ts
packages/path-tools/src/settingsFields.ts
packages/path-tools/src/shapeBuilder/index.ts
packages/path-tools/src/shapeBuilder/shapeBuilder.ts

<!-- done: 2 findings, files read: 37 -->
