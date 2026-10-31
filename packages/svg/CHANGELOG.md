# @weasel-js/svg

## 1.15.0

### Patch Changes

- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
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
  - @weasel-js/geom@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [012cae5]
- Updated dependencies [ae38d2e]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
  - @weasel-js/core@1.14.2
  - @weasel-js/geom@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/core@1.14.1
  - @weasel-js/geom@1.14.1

## 1.14.0

### Patch Changes

- 2f3d924: Text runs can turn their glyphs. A `StyledRun`'s new `rotate` turns each of its glyphs that many degrees, clockwise, each about its own pen on the baseline, as SVG's `rotate` does; the glyphs keep their places along the line. Layout carries it on each `PlacedGlyph` as `rotate`, and the renderer draws it on every tier: atlas and canvas quads, color glyphs and outline glyphs, with painted bounds grown to hold the turned glyph. `textToPath`, `textClusters` and PDF export turn the glyphs the same way.
  
  SVG import reads `rotate` on a `<text>` or `<tspan>` instead of warning: each value turns one glyph, a glyph past the end of a list takes its last value, and a `<tspan>`'s own list wins over the text's. A list naming different angles over white space SVG collapses is reported and not read. Export writes a run's turn as `rotate` on its `<tspan>`.
  
  This adds API: `StyledRun.rotate`, `ResolvedRun.rotate`, `PlacedGlyph.rotate`, `LaidOutOutlineGlyph.rotate`, `glyphTurn`, and `penX` and `rotate` on `LaidOutQuad`. `QUAD_STRIDE` is now 11: each packed quad in `LaidOutGroup.quadData` gains its pen and its turn after `baselineY`, so code reading `quadData` by a hard-coded stride of 9 breaks.
- b0a55a6: A fill or stroke can now tile a picture: `{ kind: 'image', src, width, height }`, a new pattern paint kind beside the built-in tiles. `src` is anything an `<img>` loads, and a `data:` URI makes the paint carry the picture itself, so it saves, copies and exports with nothing stored beside the document. `width` and `height` are the tile's size in paint units; left out, the picture's pixel size is used. The fill draws nothing until the picture has decoded, then repaints.
  
  This adds API. `@weasel-js/paint` exports `ImagePatternPaint`, `TileExtent`, `ResolvablePatternKind` and `isImagePatternPaint`, and `isPatternPaint` now answers true for an image paint. `TexturePaint` takes an optional `width` and `height`, which set its tile size in place of the texture's pixel size. `resolveFillPattern` resolves an image paint to a `texture` paint. Code that switches over every `Paint` kind meets a new member.
  
  `@weasel-js/svg` writes an image paint as a `<pattern>` holding one `<image>` that fills the tile, and reads that structure back from any editor's SVG, `xlink:href` included. An image paint with no `width` and `height` cannot be sized as an SVG pattern and is left out with a warning.
  
  `PatternPicker` gains an image swatch after the tiles that opens a file picker. The picked file is stored as a `data:` URI, re-encoded down to 1024 px on its longest side if larger (an SVG is kept as it is), and the size switch then sets the tile's longest side to 32, 64, 128 or 256 units. A new `readImage` prop replaces that step for an app that stores images elsewhere. `readImageFile`, `seedImagePattern` and `MAX_STORED_IMAGE_SIDE` are exported.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
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
- 7e4c7c4: A boolean group now exports as what it draws. `svgNodesFromKit` writes the path the group derives, in its own paint, then a `<g data-weasel-boolean="<op>" display="none">` holding its children, where it used to write the children as separate visible shapes. Another reader draws the result alone; `parseSvg` keeps that `<g>`, hidden, even without `keepHidden`, and `svgNodesToKitDrafts` drafts it back as a mark with `boolean` set and its children under it, shown. `unpackSvgFiles` inserts such a draft as a boolean group.
  
  This adds API: `SvgGroupNode.boolean`, `SvgKitTreeNode.consumesChildren`, `SvgKitTree.derivedPathOf` (a kit `Scene` needs none) and the mark draft's `boolean`.
- 5967c5c: A boolean group whose result is empty now survives an SVG round trip. `svgNodesFromKit` writes it as its hidden operands with no path before them, rather than a `<path d="">` that `parseSvg` warned about and dropped, and `svgNodesToKitDrafts` reads that back as a boolean group (`boolean` on the mark draft) in the group's own paint, posed over its operands, instead of a plain hidden group.
- 0dd5658: SVG import reads a `dx`, `x`, `dy`, `y` or `rotate` list over white space that `xml:space="preserve"` keeps. Before, it reported such a list as moved by collapsing white space and left it unread, though under `preserve` nothing collapses and every character stays one glyph.
- 2bdc135: SVG import reads glyphs moved up or down off their line: a `dy` or `y` list on a `<text>` or `<tspan>`, and a `<tspan>` moved by `dy` or `y` without an `x`. Each stretch of glyphs at one height becomes a run raised or lowered by `baselineShift`, on top of any `baseline-shift` it already had, and the move carries on to the text after it until a new line or another move, as SVG places it. These used to be reported and dropped. A new line's pitch is now measured from the last line's baseline rather than from wherever the last glyph sat, and a `<tspan>` with an `x` that lands back on its line's baseline stays on that line.
- a4b6c5b: svg import reads an `x` list that places each glyph of a `<tspan>`, or of a `<text>` holding only text, as letter spacing, where a loaded face measures the glyphs: kerned text exported with an `x` per glyph no longer imports run together. A `dx` list on the same element adds on top. With no face to measure them, or in right-to-left text, the list is still reported and only its first value read.
- 16f7828: `serializeSvg` writes a text node's `lineHeight` as `data-weasel-line-height` whenever the style sets one, and import reads it back. A single line used to lose it, since only the pitch between lines stated it. Where the lines' pitch disagrees with the attribute, as after another editor moved them, the pitch wins.
- 0ac4e47: A marker drawn in several parts is joined with geom's `joinPaths`, the same join text and derived paths use.
- 8c7fb03: SVG import reads a `dx` list on a `<text>` that holds `<tspan>`s as letter spacing, handing each value to the glyph it counts to through the text and every tspan; a tspan's own values replace the text's where it has them. A `dx` or `x` list in right-to-left text is read too, as spacing that narrows the gap a `dx` toward +x closes, where a registered bidi engine says every glyph of the run reads right to left; otherwise it is reported unread, as before. The warning for an unread `rotate` no longer mentions advance.
- 3b25c35: SVG import places a `<text>`'s box by where its first glyph lands, not by the `<text>`'s own `y`. A `<tspan>` with its own `x` and `y` that opens a `<text>` with no `y` used to put the box top a line above `y="0"`: `<text><tspan x="10" y="20">A</tspan></text>` now gets its top at 4, not -16.
  
  Another writer's `dy` on `<text>` now moves the first glyph, as SVG says, where it used to be dropped without a warning. Text weasel wrote, which puts the half leading in that `dy`, is told apart by its `data-weasel-width`, and its `dy` stays unread.
- 058fcdf: `serializeSvg` without a `textLayout` now writes a text node's lines where weasel lays them out, for any face the font registry has measured. `dominant-baseline="text-before-edge"` sets the face's ascent on the box top, where weasel's layout first puts half the leading, so every line sat that far off (Inter at 24px: 2.3 up at line height 1.4, 2.5 down at 1.0); a `dy` on the `<text>` now moves them by it. A face nothing measured is written as before. New in `@weasel-js/text`, re-exported by core: `halfLeadingFor(family, weight, style, fontSize, lineHeight)`.
- 1a64358: SVG import reads a `<text>`'s `x` list past its first value when the `<text>` holds `<tspan>` children, where it used to warn and drop it. Each position becomes the letter spacing that puts the glyph there, measured across runs of different styles, as it already was for a list on a `<tspan>` or on a `<text>` holding only text. It is read only where a loaded face measures the glyphs it reaches and no `<tspan>` among them has its own `x` or `dx`; otherwise the warning now says which.
- 99a8383: SVG import now reads a `<text>`'s per-glyph `x` list through a `<tspan>` that has its own `x` or `dx`. Each glyph takes its value from its own `<tspan>` where that list has one, and from the `<text>` otherwise, as SVG does. Before, such a list was reported and only its first value read. A `<tspan>` it reaches that opens a new line with an `x` and a `y` or `dy` starts a new measurement, so the list is read on every line it spans. Like every `x` list, it is read only where a loaded face measures the glyphs.
- 4a8b5be: A laid-out cell's `advance`, and a placed glyph's `step`, now include the kerning before the glyph to its right, so a cell ends at its right neighbor's `x` and the cells tile the line, as `LaidOutCell`'s doc already said. They used to leave it out, so a kerned pair's cells overlapped or left a gap. A combining mark that takes no room keeps an advance of 0, and the glyph it sits on takes the kerning. Caret snapping, text along a path, and two decoration rules meeting at a run boundary now follow the painted glyphs. A consumer that added the kerning back itself will now count it twice.
  
  svg import's right-to-left glyph lists now read each glyph's right edge from the glyph's own advance, so they place glyphs where they did before.
- 1fb8193: A text's `lang` now reaches more than the shaper. `textTransform` and synthesized small caps map case in the run's language, so `i` uppercases to `İ` under `tr`; `transformRunTexts` takes the languages as an optional third argument, `smallCapsText` as a third and `isSmallCapsLetter` as a second, and a tag `Intl` rejects maps as no language. The edit overlay sets the `lang` attribute from the node's style, and each run span from its run, and reads a pasted span's `lang` back as the run's. SVG export writes `xml:lang` on `<text>` and `<tspan>`; import reads `xml:lang` or `lang`, inherited from any ancestor onto the node and a `<tspan>`'s own onto its run. This adds API.
- 9adc0cd: `transformPath` now gives a polygon that lands past `ORIGIN_THRESHOLD` (2^14) with no origin one of its own by default, so resizing a path, `pathInWorld`, and an SVG element's own skew or scale baked in on import keep their fractions far from 0. A rect it promotes to a polygon under rotation is measured from an origin too. Pass `{ autoOrigin: false }` for the old float32-only result. A caller that read a far-out result's `coords` without its `origin` now has to read through `worldCoords`.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
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
- Updated dependencies [61e07e5]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [767713e]
- Updated dependencies [6a69c27]
- Updated dependencies [b0a55a6]
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
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8e2c8c8]
- Updated dependencies [ebe1f55]
- Updated dependencies [0fc0e50]
- Updated dependencies [3401898]
- Updated dependencies [058fcdf]
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [871a56b]
- Updated dependencies [f645651]
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
  - @weasel-js/geom@1.14.0

## 1.13.0

### Patch Changes

- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- ceae749: A mark with children can survive a round trip through SVG. `svgNodesFromKit` takes a `mark` decorator beside `group`: given one, it writes such a mark as a `<g>` holding the mark's own element, then one `<g>` of its children carrying the mark's clip, then a transformed `<g>` of that for each copy, and hands the outer `<g>` to the decorator to tag; a mark whose children are all left out holds its own element alone. `svgNodesToKitDrafts` takes a matching `mark` predicate, and reads a `<g>` it claims as a mark drafted from its first element, with the children of the `<g>` after it as the mark's (hidden where that `<g>` is), that `<g>`'s clip as its `clip: 'outline'`, and baked copies as further children. A clip on the claimed `<g>` itself becomes a clipping group around the mark; a mark draft can now carry `clip`, and `unpackSvgFiles` inserts it. Without either option both walks behave as before. `unpackSvgFiles` moved to its own module and is exported from the same place.
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

## 1.13.0-rc.0

### Patch Changes

- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- ceae749: A mark with children can survive a round trip through SVG. `svgNodesFromKit` takes a `mark` decorator beside `group`: given one, it writes such a mark as a `<g>` holding the mark's own element, then one `<g>` of its children carrying the mark's clip, then a transformed `<g>` of that for each copy, and hands the outer `<g>` to the decorator to tag; a mark whose children are all left out holds its own element alone. `svgNodesToKitDrafts` takes a matching `mark` predicate, and reads a `<g>` it claims as a mark drafted from its first element, with the children of the `<g>` after it as the mark's (hidden where that `<g>` is), that `<g>`'s clip as its `clip: 'outline'`, and baked copies as further children. A clip on the claimed `<g>` itself becomes a clipping group around the mark; a mark draft can now carry `clip`, and `unpackSvgFiles` inserts it. Without either option both walks behave as before. `unpackSvgFiles` moved to its own module and is exported from the same place.
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

## 1.12.0

### Patch Changes

- b571ad6: A node's `fill: 'inherit'` or `stroke: 'inherit'` now takes its nearest enclosing container's fill or stroke whole. If that container inherits too, the lookup keeps going up, and at the root it is none. A container's fill and stroke are only a source: the built-in `kit:shape` and `kit:path` painters no longer paint a container's own fill or stroke, and its interior is no longer hit for picking.
  
  The scene's draw wrapper passes the resolved paint to painters as `ctx.inherited` on `NodePaintCtx`, and pickers pass it on `NodeInkCtx`. A painter's memo has to key on it: `nodeMemo` takes an extra reference-compared key for this, and the paint stays the same object while its sources are unchanged. **A custom painter that does not read `ctx.inherited` paints an `'inherit'` field as none.** Pass the field and `ctx?.inherited?.fill` to `resolveFill` (or `resolveStroke`) to pick it up. `diagram:shape` reads it. Readers outside a painter can use `inheritedPaintIn(scene, node)` and `withInheritedPaint(data, inherited)`, and `paintAbove(scene, node)` says what inheriting would paint.
  
  SVG import turns a `<g>`'s fill and stroke into its container's, and a child that sets none of them gets `'inherit'`. A gradient, or a child faded further than its group, is still copied onto the child. Export writes a container's paint on its `<g>` and leaves the attribute off a child that inherits a solid one.
  
  `SelectionPanel` adds an Inherit choice beside None for a node's fill and stroke, showing the paint it would take. `PaintField` and `PaintInput` offer it when given `inherit` (`{ paint, onInherit }`); their `value` may be `'inherit'`, and `onChange` is unchanged.
- 78f29de: Lenses in weaselforge. Alt+L opens the Loupe keymap, and `l` adds a lens: a bubble showing the patch
  of a story under its reticle, magnified, or rendered with a comparison such as the opposite mode, an
  arg or a DPR, as Swap, Split or Difference. A lens shows a Live second render or, from the dev
  server, Pixels captured in headless Chromium; Playwright is a new optional peer of
  `@weasel-js/forge`, and without it a lens offers Live only. Token, Contrast and pixel-grid readouts
  sit in the lens chrome, and Alt+Slash opens a panel listing every key binding the workshop
  registers.
  
  Everything below is additive.
  
  forge: the shell config takes `capture.allowOrigins`, naming what a capture page may load besides
  the dev server, and `loupe.modeGlobal`, the global an opposite-mode comparison flips. A global
  declaration may give `opposite(value, globals)`, the value that comparison flips it to.
  `<TrialHost>` takes a `copy` prop, which makes the host a second copy of a trial's story, under
  globals of its own. `@weasel-js/forge/shell` exports `followEdits`, and `@weasel-js/forge/frame`
  exports `mountCapture`, which mounts a capture page.
  
  labkit: the loupe entry gains `<LensOverlay>` (whose `renderReadouts` is handed `LensReadoutProps`),
  `<LensActions>`, the lens scene and its ops, the `LensSource` contract, `createLoupeKeymap`,
  `probeUnderLens` and `LENS_REST_MS`. A lab has an `overlay` chrome region, rendered over the trials
  inside the lab surface, and `useLabEntries` reads the ambient entries installed on the lab, its
  keymaps among them. Each lab surface gains a `'top'` canvas layer for one tenant above `'over'`,
  made only while a tenant asks for it; a surface owner offers it by publishing `top` and `claimTop`
  in its `SurfaceCanvases`. `surface.scope()` takes a list of elements as well as one
  (`SurfaceScope`).
  
  Elsewhere: `@weasel-js/core/json` exports `stableStringify` for Node; paint exports `contrastRatio`
  and `wcagLevels`; svg exports `specificity`, `compareSpecificity` and `splitTopLevel`; an action's
  `enabled` may return a reason as text (`ActionUnavailable` in routing, re-exported by core), which
  the command palette shows as written.
- 24f2495: An absent fill or stroke now means none everywhere, read through `resolveFill` and `resolveStroke`. This breaks three things that used to fill in a default:
  
  - **A text node built without a `fill` now draws no glyphs.** Write `fill: { paint: solid('#000') }`, or `DEFAULT_TEXT_FILL`, now exported from `@weasel-js/text` and `@weasel-js/core`. `DEFAULT_TEXT_STYLE.fill` is `null`. The text insert, the sticky note and SVG import write black themselves.
  - **A derived part with no `fill` or `stroke` no longer takes its node's.** Write `INHERIT` (`'inherit'`) for that; `DerivedPart` allows it, and `resolvePartPaint` is the one reading of a part's paint.
  - **`diagramShape` drops its `defaultFill` and `defaultStroke` options.** An outline paints what its data names; `diagramScene` already writes the default style onto every node. SVG import writes SVG's initial black onto text that names no fill, and SVG export writes `fill="none"` for text that has none.
  
  `setFill` and `setStroke` write None as a record with no `paint` rather than `null`, so a stroke keeps its width and dash; a `paint: null` passed when the gesture starts used to be read as no paint given and painted the default color. The selection panel shows a fill or stroke paint as a paint, None or Mixed, never unset; `nestedPaintValue` is that reading. Booleans, Outline Stroke and the character bar read a fill with no paint as unfilled. Core re-exports `resolveFill`, `resolveStroke`, `INHERIT` and their types.
- 92b8df8: A node with no `data.fill` now paints no fill. It used to paint gray (`#888`) in the built-in
  painters and in `svgLeafFromKit`'s export, so a container from Cmd+G drew a gray box behind its
  members, and a shape inserted without a fill showed up gray. This changes what existing scenes look
  like: a node that relied on the gray default needs an explicit `fill`. `DEFAULT_SHAPE_FILL` is
  removed, since nothing falls back to it any more, and `resolveNodeFill` takes no fallback argument.
  
  The rect fallback painter no longer matches containers. A container without `clipFromPose` used to
  take that painter's box as its silhouette and clip its members to it, which cut off the outer half of
  their strokes, since a group's derived pose leaves stroke width out. A container now paints
  nothing, even a `data.fill` it declares, and clips nothing; one that should clip says so with
  `clipFromPose`, and a background behind a group's members is a leaf among them.
- Updated dependencies [dbd6711]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
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

## 1.11.1

### Patch Changes

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
- af18142: The opening doc comments of `@weasel-js/devtools`'s entry and of `@weasel-js/svg`'s `serializePathD` module are marked `@packageDocumentation`, so the API reference reads them as the module's description instead of handing them to every name the file exports. No code changed.
- 3db0ab0: SVG import reads a `dx` list on a `<text>` that holds only text, as it already read one on a `<tspan>`: each shift becomes letter spacing on the glyph before it, and a leading shift moves the text. A `dx` on a `<text>` holding a `<tspan>` still warns and is not read.
- 71d4416: Synthetic-bold text reaches the outline tier. Past the outline threshold, a glyph faked bold from a
  lighter face used to stay on the distance field; it is now drawn as geometry, its outline grown by
  the distance the field's threshold shift moves the edge, so it is as heavy on either side of the
  threshold. A stroked synthetic-bold run, which stayed on the atlas unstroked, is now stroked. A
  grown glyph's `LaidOutOutlineGlyph.d` holds the grown outline, and its `key` names the growth.
  
  `@weasel-js/geom` gains `pathToD`, the inverse of `pathFromD`, also exported from `@weasel-js/core`.
  `@weasel-js/svg`'s `serializePathD` is now that function.
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
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
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
  - @weasel-js/geom@1.11.1

## 1.11.0

### Patch Changes

- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- 679138c: A scene node can be hidden or locked on its own, not only through its layer. `SceneNode.hidden` keeps a node and its whole subtree from being drawn; `SceneNode.locked` keeps a node and its subtree drawn but out of reach, the way a locked layer's nodes are. Both are set through `scene.setHidden(id, hidden)` and `scene.setLocked(id, locked)`, each one undo step that neither lock blocks, or through the new `createSetHiddenOp` / `createSetLockedOp` against an adapter's `setHidden` / `setLocked`. Both go on `AddNodeSpec`, ride a snapshot, and come back with an undone removal. Additive.
  
  `scene.isHidden(id)` is new, and `scene.isLocked(id)` now folds in the node flags. Both answer from `nodeGates`, now exported with `isNodeHidden`, `isNodeLocked` and `hidesSubtree`, which every reader asks: painting, point picking, the marquee and lasso, select-all, path snapping, measurement picking and snapping, sibling spacing guides, the slice and Girth tools, and text editing all pass over a hidden node, and the pickers over a locked one. The selection now drops a hidden node as it drops a locked one, so hiding a layer or a node deselects what it hides.
  
  `@weasel-js/svg`: `svgNodesFromKit` writes a node carrying `hidden` with `display="none"`, which `parseSvg(…, { keepHidden: true })` reads back as hidden, and `unpackSvgFiles` now keeps a dropped file's hidden content, inserting it hidden rather than leaving it out.
- 3eb2abc: A text node can cut its text at its box: `data.overflow: 'clip'` draws the glyphs in a group clipped to the pose box, picks only the lines inside it, cuts the editing overlay to the same box (`TextEditScreenPose.clip`, read through `useSceneTextEdit`'s new `getOverflow`), and exports as an SVG group clipped to the box. Properties offers it as a Clip switch. A node can also carry a minimum size, `data.minSize` (`MinSize`, `minSizeOf`): a resize stops at it whatever the resize policy's constraints, a multi-selection stops where its first member reaches its own, and a scale replayed through transform-again holds to it. An insert or place binding's `minSize` param grows a smaller drag or click to it and is kept on the node. Sticky notes now clip their text and keep a 48 × 48 minimum, both set through `toolOptions.sticky` (`overflow`, `minSize`). An SVG import reads a clipped note back as a clipped group around its text, not as a text node that clips.
- e554ae5: New: a sticky-note tool. `useStickyTool` is a built-in tool id, so `<SceneCanvas defaultTools={['sticky']}>` mounts it (key S), and `BUILTIN_TOOL_IDS` lists it after `text`. A drag draws a note through `insertAction`; a click places one of `size` through the new `placeAction` (id `place`), which commits a node of its binding's `kind` and `size` centered on the click through the same `insert` dep. Either drops into the new note's caret. The note's look (`background`, `fill`, `padding`, `style`, `verticalAlign`, `size`) is the tool's options and `toolOptions.sticky`; `STICKY_DEFAULTS` holds the rest. `stickyData` builds a note's data and `stickyNodeFactory` is the same as an `InsertNodeFactory`.
  
  A note is a plain text node: `kit:text` nodes gain `data.background`, a fill painted over the whole box under the glyphs (and which makes the whole box pickable), and `data.padding`, the inset the text lays out in. `textBoxOf` is that box. `useSceneTextEdit` opens its overlay over the inset box, takes a double-click anywhere in the node's box, and returns `drawOne`, `defaultDrawOne` less the glyphs of the node being edited, for a canvas whose text nodes have a background that should stay painted while the overlay is up. The text properties gain Background and Padding. `svgLeafFromKit` writes a text node with a background as a group of its box and its inset text.
  
  `ShapeKindDescriptor` gains `text`, which says a kind's node is text: an insert of it opens its caret, and its properties carry the text groups.
- f231e4b: `svgNodesToKitDrafts` takes a `keepEmpty` option: an empty group it returns true for is drafted as a container — at its clip's box, or a zero box at the origin — instead of being dropped, and so is any group holding one. Without the option nothing changes.
- e8f60df: `serializeSvg` takes `textLayout`, a function returning the lines a text node lays out into — core's `layoutTextPose`. With it, each laid-out line is written as a `<tspan x y>` at the layout's own position, sitting on its baseline, so another reader draws wrapped text wrapped; each word of a line the layout justified gets its own `x`; and a line holding a larger run is pitched where the renderer puts it rather than at the node's font size times its line height. `parseSvg` reads such a `<text>` back as the same paragraphs, with its wrap, justification, and line height. `svgNeeds` and `warmSvg` take the same option and then list and load every face the text is set in. Without the option the output is unchanged.
- d705830: A stroke can be drawn with a broad nib. `Stroke.nib` is `{ angle, ratio }`: the nib's edge in radians counterclockwise on screen, and its thinnest width as a fraction of its widest. The stroke is its full width moving across the nib and `ratio` of that moving along it, an elliptical pen's width in between, and it multiplies `vertexWidths` where both are set. Each side of a corner keeps its own width, so a square drawn with a level nib has thin level sides and full upright ones right up to the joins; a round join's arc runs between the two. `strokeToPath`, the renderer's ribbon cache, and SVG export follow it, and since a nib only ever narrows a stroke, bounds and culling are unchanged. `@weasel-js/stroke` adds `nibWidthScale`, the nib as a `WidthScale`, and `widestStrokeWidth`, which culling, picking, and flattening now share; picking used to ignore `vertexWidths`. Draw's stroke properties gain a Nib switch with its angle and thinnest ratio.
  
  A `vertexWidths` entry is a `VertexWidth`: a number, the full width centered on the path as before, or a `{ left, right }` pair giving each edge its own distance from the path, `right` being the side the normal `(−dy, dx)` points to, below a path running in +x on screen. Every reader resolves an entry through `vertexHalfWidths(entry, fallback)` in `@weasel-js/paint`: the tessellator, which carries the difference between the sides as the new `Polyline.offsets` through trimming, dashing, and the nib, and centers caps between the two edges; `strokeToPath`; the inner and outer ribbon; bounds, culling, and picking, through `widestHalfWidth`; and SVG, which writes a pair as `left/right` in `wzl:vertex-widths`. `vertexWidthFromSides` writes equal sides back as a number, and `scaleVertexWidth` scales either form. An entry of zero is now a zero width; it used to take the stroke's `width`.
  
  `useGirthTool` (Shift+W), in `@weasel-js/path-tools`, edits `vertexWidths` by dragging the stroke's edges. Hovering near either edge marks the grab point on it and the width point a press there moves: the anchor at that spot, or one inserted between two with `insertAnchorOnSegment`, so the path keeps its shape. The grabbed edge follows the pointer along the path's normal and the other mirrors it, writing a number; dragging inward pinches the stroke, down to zero. Alt-drag moves the grabbed edge alone and writes a pair. The drag moves the edge as drawn, so under a nib the stored width changes by more. Every drag is previewed live and committed as one undo entry. Alt-click on a width point clears it, so it takes the stroke's `width` again. The stroke last touched shows its anchors, with a line across the stroke at each that has a width. `strokeEdgeNear` in `@weasel-js/stroke` is the hit test behind it: the edge of a stroke nearest a point, measured along the path's normal, with each side's distance as drawn.
  
  A dashed stroke now keeps its per-vertex widths, which it used to drop. The anchor-parameter rule that trimming and dashing share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.
  
  SVG has no variable width. `serializeSvg` writes a stroke with `vertexWidths` or a `nib` as its outline: the path keeps its stroke attributes at `stroke-width="0"`, which draws nothing, with the real width, the per-vertex widths, the nib, and its markers in the `wzl` namespace, and the outline follows as a filled path in the stroke's paint that draws the marker heads. A node with an opacity wraps both in one group carrying it, so they composite as one layer. Other viewers draw the outline; `parseSvg` drops it and reads the stroke back off the path, and a transform it bakes in scales the per-vertex widths with the width.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
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

## 1.10.1

### Patch Changes

- cbd5b4d: `@weasel-js/geom`'s six-number affine type is `Affine`, no longer `Mat3`. It sat one capital letter from `mat3`, the namespace over the nine-element column-major `GlMat3` a GL uniform takes, and the two are different matrices. `mat3.toAffine` and `mat3.fromAffine` already named the conversion this way.
  
  Breaking: `import type { Mat3 } from '@weasel-js/geom'` becomes `import type { Affine }`. The values are unchanged, and so are the free functions beside the type (`identity`, `multiply`, `invert`, and the rest).
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- a9cbaa7: `serializeSvg` writes a hard line break in a text node as a line of its own. Each line after the first is a `<tspan>` sent back to the anchor point by `x` and down by `dy`, at the node's font size times its line height, so a reader other than weasel draws the lines where it used to draw one line with a space at each break. A blank line is folded into the next line's `dy`, which carries `data-weasel-lines` so `parseSvg` reads the blank lines back.
  
  Breaking: what `parseSvg` returns for text weasel wrote changes in three ways. A multi-line node comes back with `style.lineHeight` set when it is not the default 1.2, where it used to come back without one. A line that opens in the style the previous line closed in continues that run, so `<tspan>` lines of one style read back as one run holding the breaks rather than a run per line. A break that ended a run is read back at the start of the next run, and an empty run is no longer written.
- 0b5ff3b: `serializeSvg` writes a marked stroke so SVG draws the markers the renderer draws. A path with several subpaths and a start, mid, or end marker is written one subpath to a `<path>`: SVG draws one start and one end marker per `<path>` and a mid marker on every vertex between them, subpath joins included, where the renderer caps each open subpath and marks no join. A fill over such a path is written once, under the strokes, so an even-odd hole stays a hole. A closed subpath, and a `rect` path, is written with no start or end marker, which SVG would draw at its first vertex and the renderer does not. Breaking for a reader of the output that expected one `<path>` per node: these nodes are now a `<g>` of paths, as a path split for `openFill: 'none'` already was.
- a3c34b4: `parseSvg` reads a `<tspan dx>` list. Each glyph takes the shift of the glyph after it as letter spacing, on top of the spacing already in force, so text kerned by hand with `dx` (as Inkscape writes it) keeps its spacing, and the tspan comes back as one run per stretch of glyphs spaced alike. A leading shift lands on the glyph before the tspan, or moves the text's `x` when the tspan opens it. It used to warn and leave the glyphs at their own advance. Still unread, each with a warning: a `dx` on `<text>` itself, a leading shift that opens a later line, and a list on a tspan whose white space SVG would collapse.
- e962494: New package, `@weasel-js/symmetry`: live symmetry groups. A group's copies (a mirror at any angle, both axes, a point, radial, kaleidoscope, or a repeat with an optional glide) are drawn from its real children. Every edit to a child therefore reaches every copy, a click on a copy selects the child it copies, and `bakeSymmetry` turns the copies into real nodes. `createSymmetry(scene).contribution` draws the guide with draggable center, axis, and step handles, sends every tool's shapes into the active group, and keeps a path that is its own image under its group symmetric while its anchors are dragged or nudged.
  
  Core gains what the package is built on, and each piece is usable on its own:
  
  - `ContainerNode.copiesFromPose`: a container draws its subtree again under each affine it returns. Hit tests reach into the copies, and the clip travels with each one. Additive.
  - The `insertInto` dep: the container the `insert` dep puts new nodes into.
  - The `pathSymmetry` dep: transforms that anchor drags and nudges keep a path symmetric under.
  
  `@weasel-js/geom` adds `anchorSymmetry`, `anchorSymmetries`, `translateAnchorsSymmetric`, and `moveHandleSymmetric`. `@weasel-js/svg` writes a container's copies as transformed groups.
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
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
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1

## 1.10.0

### Patch Changes

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
- 54174b6: Fixes: SVG import and export, the booleans, and the renderer's mesh cache disagreed with a path whose open subpaths no fill closes (`openFill: 'none'`, or `setDefaultOpenFill('none')`).
  
  - `parseSvg` stamps `openFill: 'close'` on a `<polyline>` or `<path>` with an open subpath, since SVG always closes one to fill it. Such a path now carries a field it did not, and keeps painting under a `'none'` default.
  - `serializeSvg` writes open subpaths no fill closes with `fill="none"`. A path mixing closed and open subpaths is written as a `<g>` of two `<path>`s, the group carrying the node's opacity, rotation, and metadata, so it reads back as a group of two.
  - `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathDivide`, and the slice cuts leave such an open subpath out of the region. This changes their result for a path that says `'none'`.
  - A mesh the renderer cached under one default rule is rebuilt after `setDefaultOpenFill` changes it, so the default no longer has to be set before the first paint.
  
  Adds API: `splitByClosure(path)` and `hasOpenSubpath(path)` in `@weasel-js/geom`, re-exported from `@weasel-js/core`.
- ce033b4: Fixes: a `<g clip-path>` unpacked into the scene unclipped. A scene container clips to what its painter draws, so `svgNodesToKitDrafts` now gives a clipped group's container the clip as an unpainted path, `data: { path, fill: null }`, and the clip's box as its pose where an unclipped one takes its children's. `unpackSvgFiles` inserts the container with that data, and `svgNodesFromKit` writes a container holding a path back as a group with that `clip`.
  
  Breaking: a container `SvgSceneDraft` now has a `data` field, `{}` when the group is not clipped. A caller building scene nodes from drafts adds each container with `draft.data` where it wrote `{}`.
  
  Carrying the clip as the container's own path, and boxing a clipped container by its clip, were an agent's judgment.
- 655cd75: Adds: `parseSvg` applies the rules inside `@container`, which it skipped whole. A size query is answered against the root `<svg>`, sized by the same viewport `@media` sees, and holds for the root's descendants when the root declares `container-type: size` or `inline-size`, or the `container` shorthand; a named query needs the root to declare that name. `width`, `height`, `inline-size`, `block-size`, `aspect-ratio`, and `orientation` are read in either syntax, an `inline-size` container answers the inline axis alone, and a style query never holds. A document whose root is not a container parses as before.
  
  Making the root the one container, where a caller might have supplied boxes for others, was an agent's judgment.
- 0190e91: Adds API: `parseSvg(svg, { keepHidden: true })` keeps the content SVG does not render, `display="none"` elements and leaves under `visibility="hidden"`, and marks each kept node `hidden`. `serializeSvg` writes a `hidden` node with `display="none"` and leaves it out of the `viewBox` it computes, and `svgNodesToKitDrafts` carries the flag onto the draft, for a caller to map onto whatever it hides a node with. Without the option a parse leaves hidden content out, as before, and `unpackSvgFiles` does not ask for it: a scene node has no hidden state of its own.
  
  The option, the flag's name, and writing a `visibility`-hidden leaf back as `display="none"` were an agent's judgment.
- 076d8e2: Fixes: `svgLeafFromKit` wrote a path leaf whose pose carries a `transform` as though it had none, so a skewed or stretched path exported unskewed. The whole frame, the rotation included, is now baked into the path's geometry and its gradient, and the node carries no `rotation`. Its stroke width takes the uniform part of the stretch, the way `parseSvg` reads a stroke under a skewed element.
- 706f602: Fixes: `serializeSvg`'s `pretty` option did nothing. It now puts each element on its own line, indented two spaces per level. A `<text>` element, and any element holding character data, stays on one line, since whitespace added inside it would be read back as content. This changes the output of every caller that already passed `pretty: true`; without the option the output is unchanged.
- b0d5a6c: `serializeSvg` writes the start and end markers of a path under `openFill: 'none'` where the renderer draws them: one pair on each open subpath. A stroke with either marker is written one open subpath to a `<path>`, and the `<path>` holding the closed subpaths carries neither. Before, a path mixing closed and open subpaths got a pair on its closed half too, and several open subpaths shared one pair. A stroke with no start or end marker is written as before.
- 0d7e206: Fixes: `parseSvg` gave text written as one `<tspan>` per line the default 1.2 line height whatever pitch the lines stated. The pitch, from each line's `dy` or the step between its `y` and the last, is now read as the node's `style.lineHeight`, a multiple of its font size, and sizes the box. Lines at the default pitch leave it unset, as before. Lines pitched unevenly take their mean, which keeps the block's height, with a warning; taking the mean was an agent's judgment.
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
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [d635e84]
- Updated dependencies [dc1f09c]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [da0335e]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [87dd1ad]
- Updated dependencies [3bacb3e]
- Updated dependencies [6b03b7e]
- Updated dependencies [b260415]
- Updated dependencies [66d5455]
- Updated dependencies [eb7f534]
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
- Updated dependencies [bffba0a]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [0e1f269]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [4042637]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/geom@1.10.0

## 1.9.4

### Patch Changes

- a845b8c: `parseSvg` reads a cropped image whose group transform mirrors it and whose inner `<image>` is flipped on the same axis as not flipped; it used to keep the flip.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- 188604d: A box pose's `transform` (a `PoseLinear`: a skew or per-axis scale applied about the box center, inside the rotation) is now drawn and picked. The per-node render wrap, paint culling, painter silhouettes, `axisAlignedBounds`, `unionAABB`, `visualBoundsViaDescriptor`, `poseContainsRotated`, and region picking all read the pose through `poseFrameOf`, and `pathThroughPoseFrame` is the path form of it. `svgNodesToKitDrafts` carries a text or image node's `transform` onto the pose and `svgLeafFromKit` carries it back, so `<text transform="scale(4 1)">` imports as editable text drawn four times as wide. Selection chrome and the resize, rotate, and flip actions still work the unstretched box.
- 0a83dfb: Right-to-left text lays out in visual order everywhere once a bidi engine is registered: `registerBidi(bidi)` (from `@weasel-js/text` or `@weasel-js/core`, with `bidi` from `@weasel-js/bidi`) gives `layoutRuns` an engine to fall back on when its options carry none, so painting, picking, the caret, `measureTextBounds`, and `textToPath` all reorder.
  
  An omitted `direction` now means `'auto'` for alignment as well as for reordering: each paragraph's first strong character decides which edge `start` and `end` are. `TextStyle.direction` and `LayoutRunsOpts.direction` accept `'auto'`, `ResolvedTextStyle.direction` defaults to it, and a text command carries `direction` and the unresolved `align`. `paragraphDirection(text, direction)` answers which way a text reads.
  
  Breaking for a custom engine: `BidiResolver` gains `baseLevel(analysis)`, which `@weasel-js/bidi`'s `bidi` implements. `TextDrawCommand.align` and `TextPoseLayoutInput.opts.align` may now be `start`, `end`, or `justify`.
  
  The edit overlay states the same direction in CSS, and `@weasel-js/svg` writes the direction a text actually reads in and keeps a stated `ltr` through a round trip.
- e98e95b: A run can carry no fill: `StyledRun.fill` accepts `null`, which `resolveRuns` keeps as unfilled where it used to read it as "inherit the node's". The range algebra reads and writes it (`styleAtRange` reports `null`, a `{ fill: null }` patch unfills the range, `undefined` still clears back to inheriting), the edit overlay carries it through an edit, and `@weasel-js/svg` writes it as `<tspan fill="none">` and reads that back.
- 47d868f: `scene.mintId()` gives the id `scene.add` would give a spec with none, from the scene's `generateId` or the kit default. Group, duplicate, clone, paste, slice, the built-in shape tools, the pen tool, an insert factory that returns no id, and an SVG drop now take their ids from it, so a scene with `generateId` holds one id scheme. Ids no longer carry the `paste-`, `pn-`, or `kit-<kind>-` prefixes those paths used to write. `Scene` gains a required member, so a hand-built `Scene` object needs `mintId`.
- 89ecc69: `parseSvg` converts absolute CSS units (`mm`, `cm`, `in`, `pt`, `pc`, `Q`) at 96 per inch wherever it reads a length: geometry attributes, `stroke-width`, `stroke-dasharray`, `font-size`, `letter-spacing`, and the root `width` / `height`. `<circle r="5mm">` now imports with a radius of 18.9 instead of 5, and `ParseResult.width` for `width="210mm"` is 793.7. Font-relative units (`em`, `ex`) still read as their bare number and warn.
- 4604414: `parseSvg` baked an ancestor `transform` into coordinates but left the lengths beside them at source size: under `<g transform="scale(10)">` a 0.5 stroke stayed 0.5 wide, text kept its font size, and a `userSpaceOnUse` gradient stayed where it was while its shape moved. Stroke widths and dashes, font sizes, letter spacing, and user-space gradient geometry now go through the same transform, and text and images under a rotated group turn with it. A stroke under a non-uniform scale takes the uniform part and warns.
- 35231a1: `parseSvg` honored `clip-path` only as an attribute on `<g>`. It is now read through the cascade, so `style="clip-path:url(#c)"` and a stylesheet rule clip a group too, and a `clip-path` on a shape, `<image>`, or `<text>`, which the node model cannot hold, warns instead of being dropped silently.
- aac08d1: `unpackSvgFiles` shrinks an oversized SVG to fit the viewport, and scaled poses and font sizes but not strokes: a 4000-unit drawing with 4-unit strokes landed at 18% size with strokes still 4 wide. Stroke widths, dash patterns, and letter spacing now take the same scale. A non-scaling (`{ px }`) stroke keeps its screen width.
- 2dcd6fb: SVG import converts `em` and `ex` by the element's computed font size wherever a length is read: geometry attributes, `stroke-width`, `stroke-dasharray`, `letter-spacing`, and the root `width` and `height`. `<circle r="2em">` now imports with r = 32, or 20 under `<g font-size="10">`, where it used to import with r = 2 and a warning. A `font-size` in `em`, `ex`, or a percentage resolves against the parent's size, so a percentage on `<text>` no longer falls back to 16px with a warning. `ex` is taken as half an em.
- 4448634: `serializeSvg` wrote characters XML cannot hold, so a text node containing a vertical tab (the soft line break a word processor puts on the clipboard) or another control character saved a file that reopened empty. Those characters are now left out, with a vertical tab or form feed written as a newline. A tab or line break inside an attribute value (a font family, an `href`, namespaced metadata) is written as a character reference instead of coming back as a space, and a color, marker key, or font weight holding `"`, `<`, or `&` is escaped.
- 70315c1: SVG import reads the `font-size` keywords. `xx-small` through `xxx-large` take CSS's sizes for a 16px `medium`, and `larger` and `smaller` scale the parent's size by 1.2. They were read as the 16px default for `em` lengths and dropped from a text node's style.
- 99120b4: `parseSvg` read three gradient details loosely. A percentage on a `userSpaceOnUse` gradient (`x2="100%"`, or the default when the attribute is omitted) was taken as a fraction of one user unit instead of the viewport. A stop with both a translucent `stop-color` and a `stop-opacity` kept only the opacity instead of their product. A radial gradient's `fx` / `fy` / `fr` and a `spreadMethod` of `reflect` or `repeat` were ignored silently; they are still not modeled, and now warn.
- 4c72db6: `parseSvg` ignored `display` and `visibility`, so a layer saved hidden (`<g display="none">`, `style="display:none"`, `visibility="hidden"`) imported as ordinary visible content. An element with `display: none` is now left out with everything under it, and a shape, text, or image whose inherited `visibility` is `hidden` or `collapse` is left out unless it sets `visible` itself.
- 3e3af12: The SVG parser's text, image, marker, clip-path, paint, and shape readers each move out of `parse.ts` into a module of their own. Nothing it reads or returns changes.
- 288e237: `parseSvg` read a geometry attribute like `width="100%"` or `r="5mm"` as its bare number with no warning, so the usual full-page background `<rect width="100%" height="100%">` imported 100 units square. A percentage on a shape, `<image>`, or `<text>` position now resolves against the nearest `<svg>`'s `viewBox` (or its `width` and `height`), and any other unit is still read as its number but reported, the way `stroke-width` already is.
- a02b807: `parseSvg` dropped a `<text>` or `<image>` element's own `transform` unless it was a rotation about the box center, so `<text transform="translate(100 50)">` imported at x = 0 with no warning. The box now moves, scales, and rotates with the transform; a uniform scale reaches the text's font size, letter spacing, and stroke, an image stretches and flips, and a skew or a non-uniform scale on text keeps what the node can hold and warns.
- a1ea9ff: `parseSvg` keeps the skew or per-axis scale of a `<text>` or `<image>` instead of warning and dropping it, and `serializeSvg` writes it back. `SvgTextNode` and `SvgImageNode` gain a `transform` field for it, a `PoseLinear`: the part of the element's transform its box, rotation, and flips cannot hold, applied about the box center inside the rotation. An image that is rotated and scaled by axis, or rotated and mirrored, now imports exactly as a box, a rotation, and a flip. Core gains `PoseLinear`, `RectPose.transform`, and `poseFrameOf` / `poseFrameInverseOf` / `poseLinearOf`, the one composition of a box pose's rotation and `transform` into a matrix; nothing in core paints or picks through it yet.
- 501ee43: Wrapped text written the way Figma, Inkscape, and Illustrator write it, one `<tspan>` per line with its own `x` and a `dy` or a new `y`, imported through `parseSvg` as a single run-together line (`Line oneLine two`), one line tall. Each such `<tspan>` now starts a new line. A list-valued `x` or `y` on `<text>` (per-glyph positions) is still read as its first value, and now warns.
- 8953d33: `transformPath` keeps a rect a rect when the matrix's rotation and shear terms are within 1e-9 of zero, so a rect under a half turn or any composed map that is axis-aligned to rounding is no longer promoted to a polygon. `@weasel-js/svg` now transforms and measures paths with geom's `transformPath` and `boundsOfPath` in place of its own copies.
- b3b209e: `TextStyle.tabSize` sets the distance between tab stops for a text node, in spaces (default 8). It reaches the painter, `layoutTextPose`, `measureTextBounds`, and the edit overlay's CSS `tab-size`, and `@weasel-js/svg` keeps it in `data-weasel-tab-size`. `measureText` and `layoutMarkdown` leave a hanging tab out of a wrapped line the way they leave out a hanging space.
  
  `@weasel-js/svg` reads a `<text>` another writer left without a `direction` as `ltr`, which is what SVG means by it; text weasel wrote keeps an omitted direction as the text's own.
- c90cff1: SVG import warns about glyph positioning it does not read: a list-valued `x` or `y` on a `<tspan>` (as it already did on `<text>`), and a nonzero `dx` or `rotate` on either.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [4c4aa40]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [9d54d0a]
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
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/core@1.9.4
  - @weasel-js/geom@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/core@1.9.3
  - @weasel-js/geom@1.9.3

## 1.9.2

### Patch Changes

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

### Patch Changes

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

- a7f2103: Underline, strikethrough and super/subscript now follow the font's own metrics
  instead of fixed constants. `gen-font` bakes `post.underlinePosition` /
  `underlineThickness`, `OS/2.yStrikeoutPosition` / `yStrikeoutSize` and the
  `OS/2` super/subscript size and offset into a new optional `faceMetrics` block
  in the atlas JSON, and the outline parser reads the same values onto
  `OutlineFace.faceMetrics`, through one shared function, so an atlas and a TTF
  of one font place rules and scripts identically. The overline keeps its
  default offset and takes the underline's weight. A face with no metrics
  (older atlases, the canvas tier, custom parsers) keeps the previous constants.
  
  This changes rendering for the bundled Inter: its underline sits lower
  (0.170 em, was 0.10) and heavier (0.068 em, was 0.05), and `script: 'sub'`
  drops by 0.075 em instead of 0.333 em, with scripts at 60.0% size. The
  committed atlases are rebaked; the PNG is byte-identical.
  
  Additive API: `faceMetricsFromTables`, `faceMetricsOf`, `faceMetricsFor` and
  the `FaceMetrics` types in `@weasel-js/font`; `scriptMetrics`,
  `scriptMetricsFor`, `decorationMetrics` and `DEFAULT_DECORATION_METRICS` in
  `@weasel-js/text` (re-exported from core); an optional `faceOf` argument to
  `layoutMarkdown` and an optional `face` on `PositionedRun`. `SCRIPT_METRICS`
  remains, now documented as the fallback rather than what every run gets.
  
  Fix: `resolveFontVariant` called from inside the glyph-ready notification of
  an atlas that just landed returned a pending miss, because the load was still
  marked in flight. A subscriber that re-resolves synchronously, as
  `useSyncExternalStore` does, now sees the face.
- 9bfdda9: **Breaking:** the mesh-gradient exports moved off `@weasel-js/core` onto a new
  subpath, `@weasel-js/core/mesh`: `MESH_GRADIENT_KIND`, `MESH_BAKE_SIZE`,
  `bakeMesh`, `cornerWeights`, `evalPatch`, `isMeshGradientFill`,
  `isTensorPatch`, `isValidPatch`, `meshBounds`, `meshFromStops`,
  `meshGradientXml`, `meshStops`, `patchBounds`, `patchCorner`, `seedMeshPatch`,
  and the types `BakedMesh`, `MeshBox`, `MeshGradientFill`, `MeshPatch` and
  `MeshPoint`. Change the import path; nothing else about them changed. Any
  import from the subpath registers the kind, as importing them from the root
  did.
  
  With esbuild and code splitting on, importing one symbol from
  `@weasel-js/core` no longer ships the mesh paint: `import { asNodeId }`
  bundled to 19,814 B and now bundles to 133 B. The lazily loaded mesh kind now
  ships as one self-contained file that shares no module with the root barrel,
  which is what esbuild needed.
  
  New: a `PaintKindEntry` can declare its shader programs as `programs`, keyed
  by program id; registering the kind registers them, and re-registering the
  same source is not a duplicate. New root type export: `ProgramSource`.
- 33b7ac2: The `mesh-gradient` paint kind now loads on demand instead of shipping with
  every import of `@weasel-js/core` (about 19 kB minified). A mesh fill that
  arrives as data — a loaded document, an SVG import — draws nothing on the
  first frame that meets it, starts the load, and `<SceneCanvas>` repaints it
  when it lands. Importing anything from `@weasel-js/core/mesh` (`seedMeshPatch`,
  `isMeshGradientFill`, `MeshEditor` in `@weasel-js/ui`, …) still registers it
  at once.
  
  New: `warmPaintKinds(kinds?)` loads kinds ahead of their first use and
  resolves once they are registered; with no list it loads every kind that has
  a loader. Await it before `renderSceneToPixels` or `serializeSvg` on a
  document that may hold a mesh paint — both are synchronous and cannot wait for
  a load. `registerPaintKindLoader(id, load)` declares a kind of your own the
  same way: `load` resolves with its `PaintKindEntry`, and it runs the first
  time the kind is looked up. New type: `PaintKindLoader`.
  
  `<SceneCanvas>` now repaints whenever a paint kind registers, so a kind
  registered after the canvas mounts draws without other help.
  `serializeSvg` warns that an unregistered kind may only need loading, rather
  than that it has no vector form.
- 365c762: A pattern paint takes a `transform`: the tile's rotation, scale and skew about
  its `origin`, as a `PatternTransform` `[a, b, c, d]` in SVG `matrix()` order.
  `composePatternTransform({ rotation, scaleX, scaleY, skewX })` builds one and
  `decomposePatternTransform` reads one back into those parts; both are exported
  from `@weasel-js/paint` and `@weasel-js/core`. The GL renderer samples the tile
  through it, and a transform with no inverse draws nothing.
  
  `@weasel-js/svg` writes the transform as `patternTransform="matrix(…)"`, with
  the origin as its translation, and reads any `patternTransform` list back into
  `origin` and `transform`.
  
  `PatternPicker` (and so `PaintInput`'s pattern mode) has a Rotation field that
  edits the rotation and leaves scale and skew alone; picking another tile keeps
  the rotation.
  
  Additive: a paint without `transform` paints and serializes as before.
- 16a0476: Text runs carry a numeric weight. `StyledRun.fontWeight` (100–900) overrides the node's weight and the `bold` flag, which is now a preset over it: writing either one to a range drops the other. `numericWeight` and `isBoldWeight` (600 and up) are exported as the one reading of a weight.
  
  Taking bold off part of a bold node now writes `fontWeight: 400` over that part and leaves the node alone, instead of lowering the node and re-bolding the rest — so it works at any node weight, including 900, where it used to be refused. `SetFlagResult.applied` is gone, since the edit can no longer be declined. `effectiveRangeStyle` reports the `fontWeight` that renders and reads `bold` off it; `patchRangeStyle` lays an armed style over a range the way a write would.
  
  `listFontWeights(family)` in `@weasel-js/font` reports the weights a family has on the atlas and outline tiers. A new `font-weight` pref kind draws `FontWeightSelect`, which lists those weights (the nine CSS weights for a family with none on file) and reads the family from the `fontFamily` leaf beside it. The text tool's character options and the node panel's Weight field both use it. The overlay and SVG round-trip a run's weight; a tspan `font-weight` other than 700 now reads as the run's weight rather than being dropped.
- 4cb55b7: Text can be set in small caps. `StyledRun` and `TextStyle` take
  `fontVariantCaps: 'normal' | 'small-caps'`. A run overrides the node, and
  `'normal'` on a run turns off small caps it would inherit. Lowercase letters
  are drawn as capitals at a smaller size. The run's `text` is not rewritten, so
  carets, selections and hit tests address what was typed. The small-caps
  reading is applied after `textTransform`, as CSS does it.
  
  This is a synthesis, not the font's `smcp` feature. The small size is the
  face's x-height over its cap height (`smallCapsScaleFor`). A face that states
  neither height gets `SMALL_CAPS_SCALE`, 0.7, which is the factor Chromium and
  WebKit use. `FaceMetrics` gains `xHeight` and `capHeight`, read from `OS/2`
  on both tiers. The bundled Inter atlas carries them now.
  
  `ResolvedRun` gains an optional `sizeMap`, which holds the size each unit of
  its text is drawn at. `fontSize` still sets the line height and the rules, so
  a small-caps word keeps its line and gets one underline. The layout cache keys
  on the size map. The outline-tier size gate reads the run's size, so one word
  is never split across tiers.
  
  The edit overlay sets the lowercase letters of a small-caps run in
  `<span data-small-caps>` pieces. It sizes them at the canvas scale, because a
  browser's own synthesis uses a fixed factor. It re-splits the pieces as you
  type. A plain-text edit now commits the overlay's DOM text instead of
  `innerText`. `innerText` applies `text-transform`, so a node shown in capitals
  committed the capitals as its text. `@weasel-js/svg` writes
  `font-variant="small-caps"`, and `normal` on a tspan, and reads either back.
  
  All of this is additive.
- 2399cd2: `<style>` rules inside `@media` and `@supports` now apply when their condition
  holds, nested to any depth, where before every at-rule was skipped. A parse is
  evaluated as one static render: by default a `screen` whose viewport is the
  root's `width`/`height` (else its `viewBox`, else 300 × 150), with a light color
  scheme and no hover or pointer. The new `ParseOptions.media` overrides any part
  of that. Media queries follow Media Queries 4, including the range syntax
  (`(400px < width <= 800px)`); an unknown feature never matches. `@supports`
  holds only for declarations this parser honors. `<style media>` goes through
  the same evaluator, so `media="screen and (min-width: 500px)"` works now too.
  `@import` is still not fetched, and each one now adds an entry to `warnings`.
  
  This is additive. One behavior change: an SVG whose stylesheet has a matching
  `@media`/`@supports` block now renders those rules. New exports:
  `evaluateMediaQuery`, `DEFAULT_MEDIA_ENVIRONMENT`, `SvgMediaEnvironment`,
  `evaluateSupports`, `SupportsOptions`.
- 513c5a7: `<style>` rules inside `@layer` now apply, ranked as CSS Cascade 5 says,
  where before the whole block was skipped. Named, anonymous and nested layers
  work, as do dotted names (`@layer base.shapes`), the `@layer a, b;` statement
  for fixing their order, and reopening a layer, which keeps its first position.
  Layered rules rank below unlayered ones and a later layer beats an earlier one;
  for `!important` the order reverses. Layer order is shared across every
  `<style>` in the document, and a layer declared inside an `@media` or
  `@supports` block that does not hold is not declared at all. `@container` is
  still skipped, since a static parse has no containers.
  
  This is additive. One behavior change: an SVG whose styles sit in a layer now
  renders them.
- 8e5bcae: Every presentation property the SVG parser reads now goes through one reader,
  and `@supports` asks that same reader, so a declaration `@supports` calls
  honored is exactly one the parser applies without a warning. No public API
  changes. Values the parser used to misread quietly are now read correctly or
  reported in `warnings`:
  
  - `opacity`, `fill-opacity` and `stroke-opacity` accept percentages
    (`50%` was read as fully opaque).
  - `stroke-width`, `stroke-dasharray` and a `<text>`'s `font-size` no longer
    take the number out of an unconverted unit silently: `stroke-width: 2em` is
    still read as 2 but warns, a dash list with such a unit is dropped with a
    warning, and `font-size: 150%` on `<text>` becomes 24 against the 16px
    default instead of 150, with a warning.
  - `font-style: oblique` is read as italic on `<text>` as well as `<tspan>`,
    with a warning; `font-weight: lighter` on `<text>` is dropped instead of
    kept as a string.
  - `text-decoration` reports a token it does not model (`wavy`, a color);
    `blink` is still dropped silently.
  - `fill`/`stroke: context-fill | context-stroke` on a shape outside a marker paints
    nothing, as SVG says, instead of black with a warning.
  - `color: currentColor` inherits, and `stop-color: currentColor`, still black,
    now warns.
- fe9a91e: Add `warmSvg(nodes)` and `svgNeeds(nodes)` to `@weasel-js/svg`. `serializeSvg` is synchronous, and its missing-def warning used to point at `warmPaintKinds()`, which loads every lazily registered kind and fails when any unrelated one does. `svgNeeds` reads the serializer's own paint pre-pass, so it lists exactly the paint kinds the export writes as paint servers — fills and strokes, text and run paints, through nested groups — plus the faces whose font metrics size a sub- or superscript run with its own `baselineShift`. `warmSvg` loads only those. Core now exports `isPaintKindKnown`, and `@weasel-js/text` (re-exported by core) adds `resolveRunFace(run, style)`, the family, weight and style a run is set in, read without touching the font registry. Additive.
- 3a68365: Add justified text. `TextAlign` gains `'justify'`: every line that wraps is
  spread across the box by widening its word gaps equally, and a paragraph's last
  line, or a line with no gap, sits at the start edge. `resolveAlign` maps
  `justify` to that start edge. `LayoutRunsOpts.justify` and
  `TextDrawCommand.justify` carry justification apart from the edge, so
  `justify: true` with `align: 'center'` centers the last lines instead (CSS
  `text-align-last`). The edit overlay sets `text-align: justify` and pins
  `text-align-last` to the same edge, and the property panel's Align bar gets a
  Justify segment with a new `textAlignJustify` icon. SVG export writes a
  justified node at its start edge and records `data-weasel-align="justify"`,
  which the reader turns back into `align: 'justify'`.
  
  This is additive. Code that switches over `TextAlign` exhaustively has a new
  value to handle.
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

- b4227b8: `GradientEditor` offers every registered gradient kind, mesh included, instead of a fixed linear / radial / conic list. A kind counts as a gradient when its registry entry carries the two new optional `PaintKindEntry` slots, `stopsOf` (the stop list a paint reads as) and `fromStops` (a paint built from one); `listGradientKinds()` returns those kinds, and `switchGradientKind(paint, kind)` converts between any two of them. Between linear, radial and conic it is `withGradientKind` and keeps the geometry; to a mesh, a stop list becomes one full-height patch per gap between stops, so a horizontal ramp survives unchanged, and a mesh reads back as the ramp across its patches' top edges. `meshFromStops` and `meshStops` are exported. A mesh value shows `MeshEditor`'s corner colors; a registered kind's own `Editor` wins, as it does in `PaintInput`. `PaintInput` now converts through `switchGradientKind` too, so switching a gradient to a mesh carries its colors instead of seeding a new mesh from one color.
  
  `GradientEditor`'s `value`, `onInput` and `onChange` are now typed `FillStyle` rather than `GradientFill`, since a mesh is not a `GradientFill`; a handler typed to take `GradientFill` needs widening.
  
  `GradientEditor` also takes `svg`, off by default, which limits the choices to what an SVG file carries natively: the linear and radial gradients, blended in sRGB. A value already outside that set keeps its own kind and space on offer. `@weasel-js/svg` exports the rule as `nativeSvgKind(kind)` and `nativeSvgSpace(space)`, the same predicates its serializer uses to decide when a paint needs a fallback color or a `wzl:interpolate` attribute.
- b8f2007: A `MarkerEntry` can declare `reads`, the stroke fields its `path` reads besides `size`. The renderer then reuses a head across stroke objects whose listed fields are equal, so a painter that builds a new stroke every frame no longer rebuilds its heads every frame; a new paint recolors the cached geometry. Every built-in, and every marker `@weasel-js/svg` imports, declares `reads: []`.
  
  A marker's reach — what culling and a path node's grab band reserve for its head — is now measured per value of those fields, or per stroke object for an entry that does not declare them. Before, it was measured once per entry, so a custom head whose shape grows with a stroke field could be culled while still on screen.
- 793987a: `TextStyle.script: 'super' | 'sub'` sets a whole text node as a superscript or subscript. It is the default every run inherits, the way `StyledRun.script` is for one run, and a run naming its own script replaces it.
  
  A run shrunk by a relative size (`script` or `fontScale`) now holds its line open at the size it inherited: `ResolvedRun.strutSize` carries that size, and layout measures the line's height and baseline from it. A superscript alone on a line used to collapse the line to the superscript's own size, which contradicted the rule that a shifted run rides its line rather than reflowing it.
  
  The edit overlay shows a node-level script, and now shows a node-level overline, which it had been dropping. The SVG writer puts a node-level script on `<text>` as `baseline-shift`, which the reader already carries onto every run.
- 7950ba1: `svgNodesToKitDrafts` takes an `options.leaf` hook and hands `nextId` the node each id is for, so an app whose leaf data is shaped differently, or that keeps ids or metadata the document carries, can reuse the walk instead of copying it. `leaf(id, { pose, data }, source)` receives the kit data the default would have written — opacity folded in, gradients rebased — and returns the app's own, or `null` to leave the leaf out; a group left with nothing is dropped like an empty one. `SvgSceneDraft` is generic over the leaf data, and `SvgLeafNode` and `SvgNodesToKitDraftsOptions` are exported. A container's pose no longer inherits its only child's rotation.
- 38ca7d4: Add `svgNodesFromKit`, the inverse of `svgNodesToKitDrafts`: it walks a scene (or any tree with `roots`, `childrenOf` and `get`) back to `SvgNode`s for `serializeSvg`, writing each leaf the way the kit's path, text or image painter draws it. `svgLeafFromKit`, `svgPaintFromKit` and `svgStrokeFromKit` are exported for single leaves, beside the existing `svgImageFromKit`, and `fillDataFromSvg` joins `strokeDataFromSvg` on the import side.
  
  `svgNodesToKitDrafts` now keeps `fill-opacity`, multiplies element and group `opacity` into the paints of the leaves under them, and, when handed a whole `ParseResult`, registers the document's markers as `unpackSvgFiles` does. `fill-opacity` on a gradient-filled shape now survives both parse and serialize.
- 1490e8f: SVG export now writes a marker's inset as `wzl:inset` on its `<marker>` def, and `parseSvg` reads it back, so a re-imported marker that is not registered in the importing session still stops the line short of a filled head instead of running it underneath.
- 440a9ef: A marker reference's `size` survives SVG export and import. `SvgStroke.markerStart` / `markerMid` / `markerEnd` are now the kit's `MarkerRef` rather than a bare key, and `svgStrokeFromKit` keeps the size. The serializer writes a sized reference to a `<marker>` def of its own, drawn in user space at that size so any viewer shows it right, and stamps it with `wzl:key` / `wzl:size`, which `parseSvg` reads back as `{ key, size }` when the key is registered. A marker whose entry writes its own def through `toSvg` still goes out at its own size, with a warning.
- 760017b: `svgNodesToKitDrafts` bounds a `<g>` container by its rotated leaves' axis-aligned boxes rather than their unrotated ones, and `unpackSvgFiles` does the same for its multi-root wrapper and fit-clamp. A container around a rotated shape used to be too small, so its selection box and resize handles missed the shape.
- 58a3a58: `parseSvg` keeps a sized marker reference (`{ key, size }`) whose key the importing session has not registered. The document's `<marker>` def comes back in `ParseResult.markers` under that key, in marker units, so registering it (as `unpackSvgFiles` does) draws the same head. It used to import as an anonymous document marker, losing the key and the size.
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

- 5345efb: A `kit:image` node can crop and mirror its bitmap. `data.image` takes an
  optional `source` — the part of the bitmap to draw into the pose rect, as
  fractions of the bitmap's width and height — and optional `flipX` / `flipY`,
  which mirror the drawn region within the rect without moving it. The painter
  hands both to the renderer's existing `ImageDrawCommand` fields, so hit-testing
  and the silhouette are unchanged. Existing image data draws as before.
  
  `svgNodesToKitDrafts` now carries an `SvgImageNode`'s source rect and flips onto
  `data.image` instead of dropping them, and the new `svgImageFromKit(image, pose)`
  writes a `kit:image` leaf back as an `SvgImageNode`, so a cropped or flipped
  image survives SVG → scene → SVG.
- 3225eb8: `parseSvg` now reads `<style>` elements. Rules match by class, id, type, attribute, descendant and child combinators, and comma lists, and resolve by CSS precedence: presentation attributes lowest, then stylesheet rules by specificity and source order, then `style=""`, with `!important` inverting per CSS Cascade 4. Illustrator-style exports (`<style>.cls-1{fill:#f00}</style>` with `class` attributes) now import with their paint. `style=""` goes through the same declaration parser, so `!important` works there too, and gradient stops honor `stop-color` / `stop-opacity` from `style=""` and stylesheet rules. At-rules (`@media`, `@supports`, `@import`, `@font-face`, …) are skipped, and a `<style>` is no longer reported as an unsupported element.
- d975afa: `text-transform` for styled runs and text nodes
  
  `StyledRun` and `TextStyle` gain `textTransform: 'none' | 'uppercase' |
  'lowercase' | 'capitalize'`, with CSS semantics. A run's value overrides the
  node's, and `'none'` on a run turns an inherited transform off. Only what is
  drawn changes: a run's `text` stays as authored, so carets, selections and
  edits still address the source.
  
  - Case mapping uses JavaScript's locale-independent full mappings, so `ß`
    uppercases to `SS` and a word-final `Σ` lowercases to `ς`. `capitalize`
    titlecases the first letter of each word (`ǆ` → `ǅ`, `ß` → `Ss`) and leaves
    the rest alone; word starts come from `Intl.Segmenter`, the same boundaries
    browsers use, and are found across run boundaries.
  - `resolveRuns` applies the transform, so `ResolvedRun.text` is the drawn
    text. When a transform changes a length, the run carries `srcMap`: where
    each drawn UTF-16 unit came from in the source. Layout reads each cell's
    `srcIndex` / `srcEnd` off it, so both cells of an uppercased `ß` map to the
    one source character, and `caretIndexAt` treats them as one stop.
  - `transformRunTexts` is exported for callers laying text out themselves;
    `layoutMarkdown` uses it.
  - The range helpers (`applyStyleToRange`, `styleAtRange`,
    `effectiveRangeStyle`) carry the new key, the text tool and the node's
    Character properties offer it as "Case", and the edit overlay shows it with
    CSS `text-transform` on the overlay and on each run span.
  - `@weasel-js/svg` writes it as `style="text-transform:…"` on `<text>` and
    `<tspan>` — it is a CSS property, not an SVG 1.1 presentation attribute — and
    reads it back from either spelling or an ancestor.
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

- 894a52c: A conic gradient now survives an SVG round-trip. SVG has no element for one, so it serializes as a `<wzl:conicGradient>` def in `urn:weasel-js:svg` — declared on the root only when a document holds a paint that needs it — and parses back to the same fill. Previously the fill was omitted from `<defs>` with a warning and the `url(#id)` reference dangled, so the shape vanished in every viewer, weasel's own included.
  
  Every reference to a paint SVG cannot express now carries SVG's paint fallback after it (`fill="url(#grad0) #ff0000"`), taken from the paint kind's `colorOf`, or `none` when it has none. A registered kind writing its own `toSvg` gets that envelope without doing anything. On import, a fallback beside a reference this package cannot resolve — Inkscape's mesh gradients, say — is read as a flat fill instead of being dropped with a warning.
- 626bace: A gradient now names the space its stops blend through. `interpolate` on any of
  the three gradient kinds takes `'rgb'` (the default, and what every other vector
  format means by a gradient), `'oklab'`, or `'oklch'` — which travels around the
  hue wheel, so red to blue stays saturated instead of passing through a muddy
  purple. Alpha is linear in every space.
  
  The blend is paid for once, in the 256-texel ramp the shader samples, so a
  perceptual gradient costs a batched frame nothing over an sRGB one. The space is
  part of the ramp atlas key: the same stops under two spaces take two rows.
  
  `sampleGradientStops` and `sampleResolvedStops` take the space as a third
  argument, `bindRamp` as an optional third, and `GradientEditor` grows an
  sRGB / OKLab / OKLCh switch (`spaceSwitch={false}` hides it). `@weasel-js/svg`
  writes `wzl:interpolate` on the gradient's own element and reads it back; a
  renderer that ignores it still paints the gradient, in sRGB.
- 86be3eb: A sixth paint kind: `mesh-gradient`, PDF's shading types 6 and 7. A mesh is a
  set of curved quadrilateral patches, each carrying a color at every corner, so
  its color field bends where the three gradients can only run straight. Twelve
  control points make a Coons patch and sixteen a tensor patch, which is the only
  difference between them.
  
  It is registered through `registerPaintKind` rather than built into the
  renderer, so every slot it uses is one a consumer's own kind can use. The paint
  is rasterized once into a 256-texel bake the shader samples — forward, the way
  every renderer that draws these works, because a paint has to answer "what color
  is this fragment" and inverting a bicubic per fragment does not. Corner colors
  blend through `interpolate`, as a gradient's stops do.
  
  `@weasel-js/svg` writes it as `<wzl:meshGradient>` with every patch's points in
  full — not SVG's abandoned `<meshgradient>`, whose implicit edge sharing gives a
  reader a way to be quietly wrong — and reads it back. A renderer that skips the
  def paints the fallback color beside the reference.
  
  `MeshEditor` in `@weasel-js/ui` edits the corner colors and the blend space, and
  `PaintInput` renders it: before this, a mesh in that control fell through to the
  color field, which wrote a solid back over it.
- b981856: Accept `{ px }` screen-pixel sizes for `fontSize` and `letterSpacing`
  
  `TextStyle.fontSize`, `TextStyle.letterSpacing` and their `StyledRun`
  counterparts now take `number | { px: number }`, the spelling `Stroke.width`
  and `MarkerRef.size` already had. A `{ px }` size holds its on-screen size as
  the view zooms, so a label no longer divides by the view scale at the call
  site.
  
  The unit is one type and one resolver now: `ScreenLength` and
  `resolveScreenLength` live in `@weasel-js/paint`, which both core and text
  already depend on, and `resolveStrokeWidth` delegates to it.
  
  Resolution happens at the entry to layout, not at draw time. A screen-pixel
  size changes the glyph advances and so the wrap points and the measured
  bounds, so `resolveTextStyle`, `resolveRuns`, `textPoseLayoutInput`,
  `layoutTextPose`, `measureTextBounds` and the three command builders
  (`textCommand`, `textCommandFromRuns`, `textCommandFromPose`) each take the
  view scale, defaulting to 1. `ResolvedTextStyle` and `ResolvedRun` keep plain
  world numbers, so everything downstream is unchanged.
  
  `createTextLayer` passes the mean of `view.scale.x` and `view.scale.y`, so
  non-scene text gets this with no consumer change. The `kit:text` node painter
  deliberately does not: it memoizes on `(data, pose)` to keep the renderer's
  layout cache hitting across frames, and keying that on the live camera would
  miss on every zoom frame.
  
  SVG serialization writes a `{ px }` size as that many user units — SVG user
  space has no camera — and the fit clamp on import leaves one alone, since a
  screen-pinned size is not the file's to scale.
- d2b8390: `serializeSvg` now reports through `onWarn` what the document cannot carry the way weasel draws it, where it used to drop it silently: a stroke aligned `inner` or `outer` (SVG has no stroke alignment, so it is written centered), text that wraps at its box width (SVG text does not wrap), and text aligned to the center or bottom of its box (SVG text has no box). Weasel reads the last two back from their `data-weasel-*` attributes; other viewers draw them unwrapped and top-aligned. Each message is reported once per call. `SvgStroke` gains `align` so a bridge from a kit `Stroke` can pass it through and have the loss reported. Additive.
  
  labkit's annotation export passes a mark's stroke alignment through, so it is reported too.
- 0923159: `SvgGroupNode` carries a `clip` outline. `serializeSvg` writes it as a
  `<clipPath>` def plus `clip-path="url(#…)"` on the `<g>`, and `parseSvg` reads
  one back, baking it into the same space the group's children land in — SVG
  applies a group's `transform` to its clip as well, and parse collapses that
  transform onto descendants.
  
  A `<clipPath>` is no longer an unsupported element. One holding several shapes
  still is: SVG unions them and a `Path` is a single outline, so it warns and
  clips nothing rather than clipping wrongly. So does `clipPathUnits="objectBoundingBox"`.
- 20bd67b: An `<image>`'s source rect and flip now survive SVG. `SvgImageNode` gains `source` (the part of the bitmap to draw, as fractions of its width and height) and `flipX` / `flipY`. With any of them set, the serializer writes a `<g data-weasel-image>` around a nested `<svg>` viewport at the box, whose `viewBox` is the source window over a unit-square `<image>`, with the flip as a mirror about that window's center. That is plain SVG 1.1, so every viewer crops and mirrors it the way weasel draws it, and `parseSvg` reads the group back as one image node. An image with neither still writes a plain `<image>`. Additive.
- 5fbec37: `parseSvg` now reads a document's own `<marker>` when a stroke references one the marker registry has no entry for, instead of warning and dropping it. The new `ParseResult.markers` holds a `MarkerEntry` for each: its geometry and paint, `refX` / `refY` as the anchor, the viewBox, `markerWidth` / `markerHeight` and `markerUnits` folded into the size, and `orient` as the orientation (`context-stroke` reads as the line's own paint). Keys are the marker's id plus a hash of what it draws, so two files with the same id never collide, and the strokes in `nodes` name those keys. Nothing draws them until they are registered; `unpackSvgFiles` registers them itself. A reference the document does not define still warns and is dropped.
  
  A marker def written on export now keeps its entry's solid fill and outline colors and a fixed `orient`, where it used to write every marker as `context-stroke` pointing `auto`. It writes `orient="auto-start-reverse"` rather than `auto`, because weasel turns every start marker around, and a start arrowhead in another viewer used to point back into its line.
- cba02cc: A text node's vertical alignment now survives an SVG round-trip. `SvgTextNode` gains `verticalAlign`, written as `data-weasel-vertical-align` beside `data-weasel-width` / `data-weasel-height` and read back by `parseSvg`; `svgNodesToKitDrafts` carries it onto the `kit:text` leaf's `data.verticalAlign`. Previously an export dropped it and a re-import came back top-aligned. Other SVG readers still draw the text at the top of its box, since SVG text has no box to align within. Additive.
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
  - @weasel-js/geom@1.5.1

## 1.5.0

### Patch Changes

- 90f0bd8: Every 2D affine inversion now uses `@weasel-js/geom`'s `invert` and its singularity rule, which judges the determinant against the matrix's own scale.
  
  - SVG import now keeps a transform under a uniformly tiny parent scale, such as `scale(0.0000001)`. It used to call that parent singular and bake the child's rotation into the wrong space. A parent that really is singular now drops the child's transform with a warning, and so does a large parent whose determinant is only rounding. `@weasel-js/svg` now depends on `@weasel-js/geom`.
  - A gradient or pattern measured in `units: 'local'` or `'world'` now draws nothing when that space has no inverse, for example under a group that scales an axis to zero. It used to draw as if untransformed. `mat3.invert` returns `null` for such a matrix instead of the identity, and `PaintBindContext.spaceInverse` now returns `Mat3 | null`, so a registered paint kind should return `null` from `bind` when it gets `null`. Both are type-level breaking changes.
  - In the custom-shader vertex prelude, `v_world` now reads the world origin when the view has no inverse, instead of a scaled mapping that looked plausible and was wrong.
  - `useNodeOverlayFrame`'s `toLocal` now keeps the last mapping that had an inverse while a live view flattens an axis. It used to hand the overlay point back unchanged.
- 2adc840: `<text>` `x` now means what the SVG spec says it means: the `text-anchor`
  point. The serializer used to write the box's left edge beside
  `text-anchor="middle"` or `"end"`, so every other SVG reader drew centered text
  centered on that edge and right-aligned text ending at it. It now writes the
  box's center for `middle` and its right edge for `end` (the left edge for
  `start`), resolving `direction="rtl"` the same way the anchor itself does, and
  the parser converts the anchor point back to the box's left edge.
  
  **SVGs written by earlier versions import shifted.** Centered text in one of
  those files now lands half its box width to the left of where it was saved, and
  right-aligned text a whole box width to the left. Left-aligned text is
  unaffected. There is no detection of older files.
  
  **External SVG text now imports with a measured width.** A `<text>` with no
  `data-weasel-width` used to get a 99999-wide box; now that `kit:text` aligns
  within its box, centered or right-aligned imported text landed about 50000 or
  100000 units right of where the file drew it. The width now comes from the
  kit's text layout with the registered fonts, falling back to an estimate from
  the font size when no registered font can measure the text, and the box is
  placed so the text's anchor lands where the file put it.
  
  **`UNBOUNDED_TEXT_WIDTH` is removed** from the package's exports. The parser no
  longer produces it, so nothing has a sentinel left to check for.
- deb9e79: Text wraps only where its style says so, and everything that lays a text node
  out now agrees. `TextStyle.wrap` (default `false`) breaks lines between words
  at the pose width; without it a line runs as long as its text and the width
  only resolves `align`.
  
  Before this, `kit:text` never wrapped while `createTextLayer`, `textLineBoxes`,
  `caretIndexAt`, `fitTextPose` and the edit overlay all wrapped at the pose
  width. Opening an edit on a `kit:text` line longer than its box reflowed it,
  and a double-click could put the caret on a line the canvas never drew.
  
  **Breaking:**
  
  - `createTextLayer` and `fitTextPose` (`axis: 'height'`) no longer wrap unless
    the style sets `wrap: true`. Add it to text that should keep wrapping.
  - `TextLineBoxesOpts.maxWidth` and `caretIndexAt`'s `opts` argument are gone,
    along with the `CaretIndexAtOpts` type. Both read `style.wrap`.
  - The edit overlay is `white-space: pre` for unwrapped text, sized to its
    content, and never breaks inside a word in either mode.
  
  New: `layoutTextPose` and `textPoseLayoutInput` in `@weasel-js/text`, and
  `textCommandFromPose` in `@weasel-js/core`, which `kit:text` and
  `createTextLayer` both emit. `textLineBoxes` and `caretIndexAt` now resolve
  `align: 'start' | 'end'` against `direction` as the painters do, and
  `useSceneTextEdit` maps a double-click through the node's `verticalAlign`
  (`getVerticalAlign` for custom data), which it used to ignore. SVG export
  writes `data-weasel-wrap="true"` and import reads it back.
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
- Updated dependencies [aa45d32]
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
  - @weasel-js/geom@1.5.0

## 1.4.4

### Patch Changes

- acaa71d: A `{ px }` stroke width survives SVG export as `vector-effect="non-scaling-stroke"`.
  
  `{ px }` means "this thickness once rendered, whatever the view is doing".
  Serializing wrote its number as a plain `stroke-width`, which is a world-unit
  length — so a hairline exported from a zoomed-out view came back a slab, and a
  document had no way to say what the kit's own type says. SVG has the attribute
  for exactly this, and it needs no accumulated transform scale to resolve
  against.
  
  `SvgStroke.width` is now `number | { px: number }`, matching `Stroke.width`.
  Parsing reads `vector-effect="non-scaling-stroke"` off the element rather than
  the cascade, because SVG does not inherit it — a `<g>` carrying it does not
  hand it to its children.
- 4d48493: An unpacked `<text>` keeps its color.
  
  `svgNodesToKitDrafts` built a text leaf as `{ text, style }` and left `fill`,
  `stroke` and `runs` on the floor, so importing an SVG as native scene nodes
  dropped every glyph to the painter's default black and flattened per-`<tspan>`
  styling the parser had already read. All three now reach the leaf.
  
  A `userSpaceOnUse` gradient on a text node — or on one of its runs — is rebased
  onto the leaf's own box, the way a path's already was, so it survives the
  fit-clamp and the drop-point placement. A run carrying an absolute `fontSize`
  takes the fit-clamp scale alongside the node's.
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

## 1.4.3

### Patch Changes

- fc16cac: `Stroke.paint` is optional, and a stroke without one paints nothing everywhere
  rather than throwing.
  
  Such a stroke is real: a property panel that writes one field onto a node with
  no stroke — a width, a cap — materializes a whole stroke around it, and
  documents written before that was fixed still hold them. The painters already
  read one as no stroke. Every other reader dereferenced `paint` unguarded, so a
  document holding one threw on SVG export, on copy, and out of any consumer
  painter or overlay whose command reached the renderer directly.
  
  The type says so now, which is what stops the next reader from assuming
  otherwise. What each one does with an unpainted stroke:
  
  - The renderer skips the stroke pass and paints the fill.
  - The SVG serializer emits no `stroke` attributes at all, the way it already
    does for an absent or zero-width stroke.
  - Text layout keys it as no stroke, so an unpainted run groups with unstroked
    ones instead of splitting a draw call, and does not get pulled onto the
    outline tier to stroke nothing.
  - `setStrokeOpacity` seeds the default stroke color to have something to set an
    opacity on, keeping the width and joins already there.
- 995fde2: A text node's `data.fill: null` is now an explicit no-fill, so stroked-but-
  unfilled text — outline-only display type — renders as such.
  
  Every other node kind already read `null` that way. Text resolved it back to the
  default black, because a `ResolvedRun` had to name a concrete `FillStyle` and
  nothing downstream could skip the fill pass. `ResolvedRun.fill`,
  `ResolvedTextStyle.fill` and `LaidOutGroup.fill` are now `FillStyle | null`, and
  `TextPaint.fill: null` carries through to all three. Absent still means the
  default black.
  
  An unfilled run paints through its stroke alone, which only the outline tier can
  lay down, so layout emits no atlas quads for one and the renderer skips the
  glyph-fill mesh — an unfilled, unstroked run emits nothing at all, not even its
  outline geometry. Underline, strikethrough and overline follow the fill: a rule
  is a solid rect with no stroked counterpart, so an unfilled run draws none.
  Nothing changes for text that has a fill.
  
  Picking deliberately does not follow. `kit:text` still reports `filled: true`
  for `fill: null`, because a text node's silhouette is its line boxes rather than
  its glyph ink — reporting it unfilled would leave a word grabbable within a
  stroke width of a box edge and nowhere near the letters.
  
  `@weasel-js/svg` reads and writes SVG's own spelling of this: `<text
  fill="none">` parses to `fill: null` instead of being dropped as absent, and a
  text node with `fill: null` serializes as `fill="none"` rather than as SVG's
  default black. `SvgTextNode.fill` widens to `FillStyle | null`.
  
  The "Text outlines" demo has a Fill checkbox alongside its Stroke one; the two
  off together is a node with no glyph paint at all.
- Updated dependencies [2de5a37]
- Updated dependencies [10e1ab6]
- Updated dependencies [eb0d6ce]
- Updated dependencies [75969f6]
- Updated dependencies [0d40f94]
- Updated dependencies [713f98a]
- Updated dependencies [85f4a21]
- Updated dependencies [4bb0341]
- Updated dependencies [e0d5580]
- Updated dependencies [edf99d5]
- Updated dependencies [2723cc7]
- Updated dependencies [0ca0aca]
- Updated dependencies [3583ca3]
- Updated dependencies [fc16cac]
- Updated dependencies [6d4bbeb]
- Updated dependencies [995fde2]
- Updated dependencies [6e4fb4d]
- Updated dependencies [b0fba6a]
  - @weasel-js/core@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies [bfb0595]
- Updated dependencies [3b07b13]
- Updated dependencies [8e9eb1d]
  - @weasel-js/core@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1

## 1.4.0

### Patch Changes

- 1b9575f: Keep a `baseline-shift` named on `<text>` itself.
  
  SVG allows `baseline-shift` on a `<text>` element and inherits it to the
  content, but weasel only read it off `<tspan>` children — so
  `<text baseline-shift="super">hi</text>` imported with the shift silently
  dropped. Bare text now carries the shift its `<text>` names, and a `<tspan>`
  naming its own still wins.
  
  It is the only run-level key with no node-level counterpart to be read into,
  which is why it alone went missing.
- Updated dependencies [eb16573]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [36b6ee7]
- Updated dependencies [7a0c568]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [8ddec11]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0

## 1.3.0

### Patch Changes

- 52c7b2a: Depend on `font` and `core` as exact peers
  
  `@weasel-js/font` and `@weasel-js/core` keep registries that consumer code
  writes into — registered faces and glyph-ready subscribers in one, content
  handlers and paint kinds and shape painters in the other. Two physical copies
  in a tree are two registries, so a face registered into one while layout
  resolves against the other lays out nothing and the canvas is blank.
  
  Exact sibling pins are what produced the duplicate: a consumer mixing two
  weasel releases left npm no choice but to nest a second copy, silently. As
  peers, the same mix is an `ERESOLVE` at install time. `font` is now a peer of
  `core`, `hud` and `text`; `core` is now a peer of `svg`, joining `d3`, `hud`
  and `ui`, whose `>=` ranges tighten to exact so no version mix resolves by
  accident.
  
  **This can break an install that currently succeeds.** Anyone resolving a
  mixed set of weasel versions by luck now gets an install error instead of a
  blank canvas. That is the point, but it is a break.
  
  `labkit` deliberately keeps `core` as an ordinary dependency: its build aliases
  every core entry point to core's built files and inlines them, so it never
  resolves core at the consumer and has nothing to peer. The flip side is that
  labkit ships its own copy of core's registries, so a consumer using both still
  has two — this change does not address that.
- 2ea772f: The canvas and the gradient editor now sample one gradient
  
  `buildGradientRamp` carried its own interpolation beside
  `sampleGradientStops`, and the two disagreed three ways: the ramp had no guard
  at either end and extrapolated past the first and last stop, the two picked
  opposite sides of a coincident pair, and they parsed color differently — a stop
  written as a CSS named color rendered on the canvas and threw in the editor.
  
  `sampleGradientStops` keeps its semantics and is now the only implementation.
  `resolveGradientStops` sorts and parses the list once; `sampleResolvedStops`
  returns the color at `t`. The ramp cache builds its texels through those, so
  there is no interpolation math left in the renderer.
  
  Two behavior changes worth naming. `resolveColor` is the surviving parser, so
  gradient stops accept named and functional colors everywhere — but no longer
  hex without a leading `#`, which only the editor path had tolerated and the
  canvas never accepted. And `sampleGradientStops` returns normalized hex at the
  endpoints instead of echoing the raw stop string, so `'red'` comes back as
  `'#ff0000'`.
  
  **SVG export:** a conic gradient left the exporter as a dangling `url(#…)` —
  the element already carried the reference, the built-in serializer returned
  nothing, and the registry's `toSvg` slot has no in-repo implementation, so the
  shape disappeared in a browser with no warning at all. Serialization now falls
  through to the same warning the pattern path already emits when nothing can
  produce a paint server. A consumer that registers a `toSvg` for
  `conic-gradient` still serializes and gets no warning.
- 50bc909: `FillStyle` is open: register a sixth paint kind and it renders, converts
  frames and serializes.
  
  `registerPaintKind(entry)` returns a disposer and `_resetPaintKindsForTests`
  re-seeds the five built-ins, matching the kit's other module-global
  registries. An entry carries the editor's slots (`label`, `seed`, `colorOf`,
  `Editor`), a render slot, both frame-conversion directions, and an SVG
  `<defs>` slot. `listPaintKinds()` enumerates them, and `asPaint` types a
  consumer's own paint as a `FillStyle` — the union itself stays closed, because
  opening its discriminant would widen every built-in member.
  
  Three defects fall out of the same change, each of which a sixth kind hit
  immediately. The renderer's fill dispatch fell off the end of its switch into
  an unguarded cast to the gradient union, so an unknown kind read `stops` off a
  paint with none and threw mid-frame. `fillInPoseFrame` and its inverse returned
  an unknown kind untouched, leaving it painting in screen space on a node that
  moves. `<defs>` emitted nothing for a kind `gradientXml` did not know while
  still writing the `url(#id)` that referenced it.
  
  Registering a kind now bumps the node memo generation, so a node painted
  before the registration repaints rather than holding the frame it resolved
  when the kind was unknown.
- 6a06f6d: Node paint is an object: `data.fill` is a `FillStyle`, `data.stroke` a `Stroke`
  
  Each concept now has exactly one shape. `data.fill` holds a `FillStyle`,
  `data.stroke` a whole `Stroke`, and `null` on either is an explicit "no paint"
  where `undefined` takes the painter's fallback. Two new authoring helpers keep
  hand-written node data short:
  
  ```ts
  data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
  ```
  
  **Breaking, with no compatibility path.** A document written against the old
  shapes renders wrong rather than failing, which is accepted:
  
  - `NodeFill = string | FillStyle` and `NodeStroke = string | Stroke` are gone,
    and so are the string branches of `resolveNodeFill` / `resolveNodeStroke`.
    A node holding `fill: '#f00'` now paints the default grey.
  - `data.strokeWidth` is deleted. A stroke's width is `Stroke.width`.
  - `data.color` — the legacy alias `kit:path` and the rect fallback read — is
    deleted. The fallback painter reads `data.fill` like everything else.
  - `fill: 'none'` is now `fill: null`; `stroke: 'none'` is `stroke: null`.
  - `NodeInkResult` is gone: a painter's `ink` returns `NodeInk` and nothing
    else. A painter returning `{ filled, strokeWidth }` no longer type-checks
    and its reach is read as zero.
  - `@weasel-js/ui` drops `isStrokeObject`, which existed only to discriminate
    the union; `strokeColorOf` and `strokeWithColor` lose their string branches.
  - `@weasel-js/svg`'s `strokeDataFromSvg` returns `Stroke | undefined` instead
    of a `{ stroke, strokeWidth }` pair, and stops flattening a plain solid
    stroke into a color. SVG's `fill="none"` imports as `fill: null`.
  
  **A paint's alpha lives in `opacity`, one slot for every paint kind.** That is
  the only slot a gradient or a pattern has, so it is the slot all of them use,
  and the renderer multiplies a hex alpha by it — the two would fight if both
  carried the value. `solid()` therefore moves an alpha channel out of the hex:
  `solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.
  
  The four setter actions follow: `setFillOpacity` / `setStrokeOpacity` write
  `opacity` rather than splicing hex, so they now work on a gradient fill, which
  they used to leave untouched. `setFill` / `setStroke` given a `color` recolor
  the node's existing paint through the new `paintWithColor`, keeping its opacity
  unless the picked color states an alpha of its own — and `setStroke` keeps the
  stroke's width, cap, join and dash instead of replacing the whole value.
  
  New exports: `solid`, `strokeOf`, `paintAlpha`, `paintWithAlpha`,
  `paintWithColor`, `DEFAULT_SHAPE_FILL`.
  
  `defaultNodeProperties` moves `data.fill` from a `color` leaf to a `paint` one
  — a color control pointed at a `FillStyle` reads `undefined` off a gradient and
  writes a bare string over it — and the `data.stroke` object leaf drops its
  `fromScalar`, which had nothing left to lift.
- 94f2446: Add stroke markers — arrowheads and other line terminators as stroke style.
  
  `markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
  through a new registry (`registerMarker`), shipping eight built-in shapes.
  Unlike SVG, the stroke stops short of a filled head rather than running under
  it to the tip; the distance is declared per marker, so an open V still reaches
  the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
  `<marker>` defs.
- 2b2d971: Keep a stroke's dash, cap, join and gradient paint through SVG import
  
  `unpack` lowered every stroke to a color string plus a width, because that was
  all `data.stroke` could hold — a gradient stroke became `#888888` with a
  warning, and dashes, caps, joins and miter limits were dropped silently. Now
  that `data.stroke` is `NodeStroke = string | Stroke`, the whole `SvgStroke`
  comes through.
  
  A plain solid stroke still arrives as the color-string pair every consumer
  already reads. Anything the pair cannot express — a gradient paint, a dash, a
  cap, a join, a miter limit, a `stroke-opacity` — arrives as the object form,
  with the paint normalized to the leaf's own box exactly as a gradient fill is,
  so a `userSpaceOnUse` gradient survives the fit-clamp and the drop placement.
  
  `strokeDataFromSvg` is exported, so a second importer lowering SVG onto kit
  nodes doesn't have to re-derive which form to write.
- 00c5203: Round-trip overline, superscript and relative run sizes
  
  `<tspan>` now carries the four run fields added alongside superscript support,
  in SVG's own vocabulary rather than a weasel-specific one: `text-decoration`
  gains the `overline` token it previously parsed and dropped, `script` becomes
  `baseline-shift="super"` / `"sub"`, a raw `baselineShift` becomes a
  `baseline-shift` percentage, and `fontScale` becomes a percentage `font-size`.
  Both percentages resolve against the parent in SVG, which is the unit the run
  fields are already in.
  
  One case normalizes rather than round-tripping exactly. `baseline-shift="super"`
  carries the preset's *size* as well as its rise, so a run that overrode only
  the rise has no keyword left to say the size with; it serializes as the two
  primitives the preset stood for and parses back that way. Same rendering,
  different fields — without it the superscript came back full-size at a raised
  baseline.
- c1b8511: **Breaking:** paint leaves `TextStyle`. A text node's color and outline are
  `data.fill` and `data.stroke` — the same two leaves every other node kind
  paints from — and `TextStyle` holds typography only. `TextStyle.fill` and
  `TextStyle.stroke` are gone, with no compatibility read: a document that put
  its color in `style.fill` now renders in the default black rather than
  erroring, so check documents that predate this.
  
  This fixes a real asymmetry rather than only moving fields. `data.stroke`
  already reached text through a fold in the painter, but `data.fill` did not:
  picking a fill color with a text node selected wrote a field nothing read, so
  the canvas did not change. `setFill`, `setFillOpacity`, the opacity scrub and
  the Appearance leaf now all mean the same thing on text as on a rect. The
  duplicate `data.style.fill` control is gone from the text schema with them.
  
  `resolveTextStyle(style, paint)` takes the node's paint as a second argument
  and is what derives the caret and selection colors, so the edit overlay
  matches the glyphs it sits on; `useTextEdit` gained a `getPaint` option for
  the same reason, defaulted by `useSceneTextEdit` from `data.fill` /
  `data.stroke`. `TextPose` gained `fill` / `stroke`, so text drawn through
  `createTextLayer` is painted rather than black. `SvgTextNode` gained the same
  two, and SVG import and export carry text paint there instead of inside the
  style. `StyledRun.fill` and `.stroke` are unchanged and still override the
  node's per range — which is also where a caller with no node at all, a HUD
  widget or a debug overlay, now states its color.
  
  `textCommandFromRuns` is exported from the package root.
- c2ffa49: Alignment can resolve against reading direction
  
  `align` gains `start` and `end` alongside `left` / `center` / `right`, and
  `TextStyle` gains `direction: 'ltr' | 'rtl'`. The split is CSS `text-align`'s:
  the relative pair resolves against the direction, the absolute pair ignores it.
  `resolveAlign(align, direction)` collapses one to the other and is exported for
  consumers that need an edge rather than an intent.
  
  Direction is an input, not something this package discovers. `@weasel-js/text`
  has no DOM, so a consumer that reads `getComputedStyle(box).direction` passes
  what it found; nothing here sniffs an environment.
  
  Defaults are unchanged — `align: 'left'`, `direction: 'ltr'` — so no existing
  layout moves. Making `start` the default alignment is a separate call.
  
  `@weasel-js/svg` carries the direction through: `direction` joins the
  inheritable presentation properties, and `text-anchor` is now written and read
  against it. Two things were wrong before and are worth naming, because both
  rendered plausible output:
  
  - `align: 'start'` serialized to `text-anchor="end"` — the opposite edge — via
    a mapping that assumed three values and read the fourth as its `else`.
  - SVG's initial `text-anchor` is `start`, which under `direction="rtl"` is the
    right edge, while this model's default `align` is `left`. They agree under
    `ltr` and only there, so an RTL document with no explicit anchor imported as
    left-aligned.
  
  This is alignment and round-tripping only. Layout still walks code points in
  logical order with the pen always increasing: there is no bidi reordering and
  no shaping, so a Hebrew or Arabic string aligns to the correct edge and still
  renders in logical order, and Arabic still renders unjoined.
- Updated dependencies [52c7b2a]
- Updated dependencies [3386d64]
- Updated dependencies [ffafb7d]
- Updated dependencies [ba8b139]
- Updated dependencies [3fb3a46]
- Updated dependencies [67bcb05]
- Updated dependencies [47cbb08]
- Updated dependencies [f43e9c2]
- Updated dependencies [bb27e83]
- Updated dependencies [6a33c3f]
- Updated dependencies [c24e7de]
- Updated dependencies [ce82f4a]
- Updated dependencies [be697dc]
- Updated dependencies [e909a3b]
- Updated dependencies [26bbdcf]
- Updated dependencies [546f67d]
- Updated dependencies [3fb3a46]
- Updated dependencies [ccd51cc]
- Updated dependencies [3fb3a46]
- Updated dependencies [d9f110e]
- Updated dependencies [0dd35a1]
- Updated dependencies [1a0bea3]
- Updated dependencies [9d95836]
- Updated dependencies [62a3c46]
- Updated dependencies [5f6c28e]
- Updated dependencies [3cd1ee8]
- Updated dependencies [2ea772f]
- Updated dependencies [f77bd95]
- Updated dependencies [2ea772f]
- Updated dependencies [aba8d91]
- Updated dependencies [2ea772f]
- Updated dependencies [3386d64]
- Updated dependencies [68d2651]
- Updated dependencies [3386d64]
- Updated dependencies [c6c499d]
- Updated dependencies [4f1ef0b]
- Updated dependencies [0114abf]
- Updated dependencies [50bc909]
- Updated dependencies [6a06f6d]
- Updated dependencies [a37ee0b]
- Updated dependencies [611b30e]
- Updated dependencies [9ad8cb2]
- Updated dependencies [c1b8511]
- Updated dependencies [d793d3c]
- Updated dependencies [3386d64]
- Updated dependencies [ce2b5c7]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
- Updated dependencies [84db1f6]
- Updated dependencies [3386d64]
- Updated dependencies [7a746df]
- Updated dependencies [4f19274]
- Updated dependencies [94f2446]
- Updated dependencies [07fd2de]
- Updated dependencies [81213fc]
- Updated dependencies [2f225d7]
- Updated dependencies [68069dc]
- Updated dependencies [5d0ff9c]
- Updated dependencies [c1b8511]
- Updated dependencies [546f67d]
- Updated dependencies [c2ffa49]
- Updated dependencies [4c097ef]
- Updated dependencies [2b86e00]
- Updated dependencies [d933a89]
- Updated dependencies [bca99e3]
- Updated dependencies [5923c8b]
- Updated dependencies [2ea772f]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
  - @weasel-js/core@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [53016f7]
- Updated dependencies [e25e77b]
- Updated dependencies [8e00c13]
- Updated dependencies [c91e186]
- Updated dependencies [cada4da]
- Updated dependencies [889b1d0]
- Updated dependencies [9e6927a]
- Updated dependencies [eafe4be]
- Updated dependencies [ae84ca1]
- Updated dependencies [0514a37]
- Updated dependencies [daa5ce6]
- Updated dependencies [144e70a]
- Updated dependencies [2627cde]
- Updated dependencies [8b583b4]
- Updated dependencies [e61d3e3]
- Updated dependencies [f0cc29c]
- Updated dependencies [438970b]
- Updated dependencies [f2ba2ab]
- Updated dependencies [4ac9273]
- Updated dependencies [8570a23]
- Updated dependencies [7c202d2]
- Updated dependencies [c7b4705]
- Updated dependencies [6a5c047]
- Updated dependencies [49e450c]
- Updated dependencies [6031085]
- Updated dependencies [ccaaecd]
- Updated dependencies [ec0eb08]
- Updated dependencies [726f85e]
- Updated dependencies [601aa6b]
- Updated dependencies [9607185]
- Updated dependencies [58f43e7]
- Updated dependencies [2e22d99]
  - @weasel-js/core@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [27dd91b]
- Updated dependencies [0763205]
- Updated dependencies [b65aadd]
- Updated dependencies [0c13967]
- Updated dependencies [83ba8b0]
  - @weasel-js/core@1.1.0

## 1.0.4

### Patch Changes

- d36953e: SVG import and export lose less on the way through, and installed fonts pick
  one face per variant slot.

  Paint servers are now found wherever they are declared, not just as direct
  children of `<defs>`, and a gradient that inherits another's stops or geometry
  through `href` / `xlink:href` resolves instead of coming back empty.
  Percentages are read as ratios, so `x2="100%"` no longer means 100 bounds
  units, and `gradientTransform` warns rather than silently painting elsewhere.

  Three fidelity bugs in the round trip itself. A leaf's own `transform` was
  decomposed against bounds that had already been through the inherited matrix,
  so a rotation inside a translated `<g>` lost its rotation and moved. Any
  stroke carrying `stroke-opacity` re-serialized with the attribute written
  twice, which is not well-formed XML. And the computed `viewBox` was taken from
  unrotated, untransformed geometry, cropping rotated content out of the export.

  `<text>` now follows SVG's whitespace rules, so importing a pretty-printed
  file no longer drags the source indentation into the document text; weasel's
  own `<text>` carries `xml:space="preserve"` to keep real line breaks. A nested
  `<svg x= y=>` places its children at that origin.

  In the shared `d=` grammar, exponent coordinates (`M1e2 1e2`) no longer read
  the `e` as a command, and arc flags written without separators
  (`A5 5 0 0110 0`) no longer drop the arc.

  `enableLocalFontOutlines` picks the least-qualified face when several installed
  faces reduce to one (weight, style) slot, so "Helvetica Neue Condensed Bold"
  stops displacing "Helvetica Neue Bold" depending on query order.

  **Exported SVG bytes change**: `<text>` gains `xml:space="preserve"`, a stroke
  writes `stroke-opacity` once, and a document containing rotated or
  group-transformed content gets a larger computed `viewBox`.

- Updated dependencies [da7c150]
- Updated dependencies [f7df982]
- Updated dependencies [85be764]
- Updated dependencies [a3db906]
- Updated dependencies [12303bc]
- Updated dependencies [d36953e]
  - @weasel-js/core@1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [5d25a40]
- Updated dependencies [f7077f6]
- Updated dependencies [514c34a]
  - @weasel-js/core@1.0.3

## 1.0.2

### Patch Changes

- 75ba7b1: Three fixes found by re-checking backlog entries against the code.

  SVG gradients survive a round trip. The parser now reads `gradientUnits`
  (`objectBoundingBox` → `units: 'bounds'`, `userSpaceOnUse` → `'world'`) and the
  serializer writes back whichever the paint declares, instead of hardcoding
  `userSpaceOnUse` on the way out — which had been reading a box-relative
  gradient's `0..1` geometry as page coordinates, i.e. a gradient the size of a
  pixel.

  `unpackSvgFiles` keeps gradient fills instead of flattening them to a solid.
  The reason recorded for the flattening — that the `kit:path` painter has no
  gradient slot — had not been true for some time; `NodeFill` is
  `string | FillStyle`, now exported. A `userSpaceOnUse` gradient is normalized
  against the leaf's own box on the way in, so it survives the fit-clamp and
  drop-point placement that move the geometry out from under it. Gradient
  _strokes_ still flatten: `data.stroke` genuinely is a color string.

  `extractUniformNames` skips precision and interpolation qualifiers. `uniform
highp float u_t;` — the common spelling in hand-written GLSL — matched nothing
  at all, so the uniform got no location and every write to it was dropped in
  silence. Comma-separated declarator lists (`uniform float a, b;`) read too.

  Also adds `tests/visual/text-decoration.spec.ts`, a baseline-free assertion
  that underline and strikethrough sit `0.40 em` apart and span only their own
  runs. It measures the gap between two gap-free horizontal ink runs, which is
  something `text.spec.ts`'s 5% diff tolerance cannot see move.

- 7decec1: Four more backlog fixes.

  `@weasel-js/svg` reads and writes `<image>`. A new `SvgImageNode` holds the
  `href` verbatim — an external URL or a `data:` URI, with `xlink:href` accepted
  on the way in — plus a box that inherited transforms collapse onto and an
  element-local rotation. `unpackSvgFiles` maps it onto the `kit:image` painter's
  `data.image.src`, so a dropped SVG carrying raster content now keeps it instead
  of dropping the element on parse. `preserveAspectRatio` is not modeled: the box
  is taken literally and written back as `none`, and a non-`none` source warns.

  `pickTopMostHit` resolves sibling z-order. An adapter can supply `getZIndex(id)`
  or `compareZ(a, b)`; both compose with the existing parent/child collapse rather
  than replacing it, so a child still beats its own ancestor whatever z the two
  report. Without either, the hit list's own order decides, as before.

  `useSceneTextEdit` supplies `setStyle`. Clearing a style flag that the _node_
  sets is the one edit the additive run algebra can't express, and `useTextEdit`
  declines it without a writer — so every scene-wired consumer silently refused
  that toggle. Override the projection with `setStyle(data, style)` for a
  non-default data shape.

  The slops debug overlay draws handle halos at the real hit radius. Affordance
  regions moved to screen-pixel radii, but this layer still scaled its circles by
  the view, so at 4x zoom it drew a 32px halo over an 8px target — the one thing
  a hit-test overlay must not do. Anchor slops now read the anchor radius rather
  than the handle radius.

- 24daa08: Five unrelated backlog fixes.

  The specificity tuple's `phase` dimension is graded rather than binary: an
  atom scores 2 when both its channel and its lifecycle state are concrete, 1
  when one axis is wildcarded, and 0 for `*:*`, which matches everything an
  undeclared phase would have matched. An atom list takes the minimum, since
  `matchPhase` is a union. No existing binding reorders — the four ambient
  actions hold at 1, and the polygon and star tools' `phase: 'engaged'` wheel
  bindings rise to 2, widening a gap they already won.

  The loupe's pixel mode no longer drops the end of a fast drag: a readback
  requested while `createImageBitmap` is in flight is remembered and re-run when
  that one settles, instead of being discarded.

  SVG unpack applies the fit-clamp to text on both axes. `fontSize` now scales
  with the file, and a text node's box width is estimated from its longest line
  instead of inheriting the parser's unbounded-width wrap sentinel — which,
  folded into the union AABB, had been clamping any external SVG containing
  text down to a speck. That sentinel is now the exported `UNBOUNDED_TEXT_WIDTH`
  rather than a bare `99999`, so a consumer reading `SvgTextNode.width` can tell
  a measurement from a placeholder.

  The debug overlay takes per-feature line widths and dashes through
  `DebugConfig.strokes`, alongside the colors `DebugConfig.theme` already
  carried. Defaults are unchanged.

  A `.dfont` face declines the outline tier by name. Datafork TrueType holds its
  sfnt tables inside a Macintosh resource map, which is still not unpacked, but
  it is now recognized before parsing and reported as itself rather than dying
  on an unrecognized-signature message that never says which format it saw.

- Updated dependencies [28710f2]
- Updated dependencies [2e3fea2]
- Updated dependencies [75ba7b1]
- Updated dependencies [e4a6ec4]
- Updated dependencies [d2a9049]
- Updated dependencies [5f05431]
- Updated dependencies [5fea43d]
- Updated dependencies [443d74e]
- Updated dependencies [7decec1]
- Updated dependencies [24daa08]
- Updated dependencies [f79e4b2]
  - @weasel-js/core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [d6c2eff]
- Updated dependencies [d62dc17]
- Updated dependencies [2604ce2]
- Updated dependencies [24ae9f4]
- Updated dependencies [c2ebfdf]
- Updated dependencies [dce3306]
- Updated dependencies [69395b0]
- Updated dependencies [3d93f2e]
- Updated dependencies [e367165]
- Updated dependencies [52e9c57]
- Updated dependencies [d68e734]
- Updated dependencies [ca9673a]
- Updated dependencies [fa1ed05]
- Updated dependencies [0a40c29]
  - @weasel-js/core@1.0.1

## 1.0.0

### Minor Changes

- 22eafe6: Pattern fills tile, persist, and round-trip through SVG.

  The `pattern` variant of `FillStyle` never tiled. `drawPathFillPattern`
  borrowed the `imageFill` program while binding the path fill mesh VAO, which
  enables `a_position` only — `a_uv` was never bound, so `v_uv` was the constant
  `(0, 0)` and every fragment sampled texel (0, 0) of the tile. Textures also
  uploaded with `CLAMP_TO_EDGE`, so correct UVs alone would have smeared rather
  than repeated. The variant had no visual consumer, which is why it went
  unnoticed.

  `patternFill` is now its own program, taking `gradFill`'s vertex stage:
  paint-space coordinates come from the screen position through `u_worldInv`
  rather than a UV attribute, so the path mesh keeps its position-only layout.
  `GLTextureCache.upload` takes a wrap argument and pattern textures bind
  `REPEAT`.

  Patterns pick up `units` alongside gradients. For a pattern it names the space
  the tile's **origin and scale** live in — not geometry, which a pattern hasn't
  got. `'bounds'` anchors the tile to the painted node's box, so dragging the
  node carries the pattern and resizing reveals more tiles instead of stretching
  them; `fillInPoseFrame` rebases it by translation only.

  `TilePatternSpec` is the serializable payload — plain data naming a built-in
  tile (`hatch`, `crosshatch`, `dots`, `chunks`) plus its parameters:

  ```ts
  { fill: 'pattern', pattern: { tile: 'hatch', color: '#0fb5a8', size: 8 }, units: 'bounds' }
  ```

  `resolvePatternSpec` turns one into a `TextureHandle` at paint time, memoized
  on the spec's values so identical specs share a texture. The built-in painters
  resolve it alongside `fillInPoseFrame`; a consumer emitting its own draw
  commands resolves it at the same place it calls that one. A `TextureHandle`
  payload still works untouched, but cannot be persisted or exported — prefer
  the spec.

  `@weasel-js/svg` serializes a tile spec as a `<pattern patternUnits=
"userSpaceOnUse">` whose children come from the same tile description that
  rasterizes the texture, so the vector and raster forms cannot drift. The spec
  rides along on `data-weasel-tile` for lossless re-import; a hand-authored
  `<pattern>` without it is dropped with a warning rather than guessed at.
  `SerializeOptions.onWarn` is new, and reports paint that SVG cannot express —
  a conic gradient, or a pattern carrying a `TextureHandle`.

  `tilePreviewSvg` / `tilePreviewCssUrl` render a single tile as a standalone
  `<svg>`, for pickers that need to show a tile outside a document.

### Patch Changes

- Updated dependencies [ffd9713]
- Updated dependencies [8853e73]
- Updated dependencies [43482ce]
- Updated dependencies [9ed1139]
- Updated dependencies [6aaa469]
- Updated dependencies [40dd97d]
- Updated dependencies [531150f]
- Updated dependencies [596253e]
- Updated dependencies [22eafe6]
- Updated dependencies [cd23624]
  - @weasel-js/core@1.0.0

## 0.8.0

### Minor Changes

- e264d62: Stroked text.

  `TextStyle.stroke` and `StyledRun.stroke` carry a real `Stroke`, and the
  outline tier paints it as a second batched draw call over the group's merged
  geometry — so a glyph above `textOutlineMinScreenSize` gets real joins, caps
  and miters in any paint, because by then it is an ordinary `PolygonPath`.
  Width stays a world measure: it crosses into the cached em-space tessellation
  by dividing by the glyph's scale, so it does not grow with `fontSize`. Below
  the threshold a glyph is a sampled distance field with no geometry to stroke,
  and renders unstroked rather than approximated.

  `kit:text` also reads the kit-native `data.stroke` / `data.strokeWidth` leaf
  fields that `kit:shape` already honors, so one pair of stroke controls means
  the same thing on a text node as on a rect.

  `@weasel-js/svg` round-trips all of it — node-level and per-`<tspan>` — where
  it previously parsed a text stroke into a warning and dropped it.

  Two older bugs fell out of building it, both invisible to fills and both
  fixed: `extractPolylines` kept a closed contour's duplicate final point
  (zero-length closing segment, dropped wrap-around join), and glyph path data
  whose contours carried no `Z` stroked as open polylines — a missing closing
  edge with a cap at each loose end. A fill closes a contour implicitly; only a
  stroke reads the difference.

### Patch Changes

- Updated dependencies [bdcdfe5]
- Updated dependencies [e0ab60e]
- Updated dependencies [3d693c7]
- Updated dependencies [e264d62]
  - @weasel-js/core@0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

- Updated dependencies [8bc719a]
- Updated dependencies [a19124d]
  - @weasel-js/core@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [a3af158]
- Updated dependencies [a3af158]
- Updated dependencies [6af4806]
- Updated dependencies [a3af158]
- Updated dependencies [2003597]
  - @weasel-js/core@0.7.1

## 0.7.0

### Minor Changes

- e7d71c9: Text properties: node-level typography through the schema-driven panel, and
  caret-range styling through a new tool options bar.

  `TextStyle` and `StyledRun` gain `letterSpacing`, `underline`, and
  `strikethrough`, with GL rendering, DOM-overlay, and SVG round-trips for all
  three. `styleAtRange` / `applyStyleToRange` expose the run algebra publicly,
  and `useTextEdit` gains `selection`, `rangeStyle`, and
  `applyStyleToSelection`. Text nodes get Character and Paragraph schema
  groups. New `ToolOptionsBar` component; `ToggleBar` renders indeterminate
  segments via `mixedValues`.

  Behavior changes worth knowing about:

  - **`SelectionPanel` reads and writes node paths of any depth** (two or more
    segments). It previously split at the first dot and read exactly one level,
    so `data.style.fontSize` resolved to `data['style.fontSize']`.
  - **The default `kit:text` painter paints a node's `runs`** when it has them,
    instead of re-flattening `data.text`. Run styling was previously invisible
    to anything drawn by the default scene layer.
  - **`useTextEdit` no longer commits when focus moves into editing chrome**
    (`isEditorChrome`), and commits on a pointerdown outside both the overlay
    and that chrome. Its published `selection` survives focus leaving the
    overlay — it clears on `startEdit` and when the edit ends. Without this a
    character bar could not exist: clicking its controls ended the edit they
    were there to change.
  - **The edit overlay can scale with the view** (`TextEditScreenPose.zoom`),
    keeping every metric on it — including run-level `fontSize` and
    `letterSpacing` — in world units. Omitting `zoom` keeps the old
    screen-pixel contract.
  - **The canvas-2D measurement path counts tracking**, as the GL path already
    did, so wrap points, `caretIndexAt`, and `fitTextPose` agree on tracked
    text. This moves wrap points on any text with a non-zero `letterSpacing`.
  - **The text tool enters edit on the box it inserts.**

  Breaking-ish, in packages that have not been published with these paths:

  - `splitNodePath` is removed from `@weasel-js/ui`'s public API — it was dead
    and encoded the superseded one-level path model. `nodeValueAt` and
    `setAtPath` are exported in its place.
  - A text node's color leaf is now `data.style.fill` of the new `paint` kind
    rather than `data.style.fill.color` of the `color` kind. `TextStyle.fill`
    is a tagged union, so the old leaf read `undefined` off a gradient and
    wrote a hybrid the renderer painted flat solid.

### Patch Changes

- Updated dependencies [d3e5597]
- Updated dependencies [a925117]
- Updated dependencies [eeae450]
- Updated dependencies [e7d71c9]
  - @weasel-js/core@0.7.0

## 0.6.0

### Patch Changes

- @weasel-js/core@0.6.0

## 0.5.1

### Patch Changes

- @weasel-js/core@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [7e1982f]
  - @weasel-js/core@0.5.0
