# @weasel-js/text-dom

## 1.15.0

### Patch Changes

- Updated dependencies [3f13a49]
- Updated dependencies [d40f593]
- Updated dependencies [e05ddd3]
- Updated dependencies [d25ad30]
  - @weasel-js/font@1.15.0
  - @weasel-js/text@1.15.0
  - @weasel-js/headless@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/react@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [56f9771]
- Updated dependencies [3c3e00b]
- Updated dependencies [9b0c6ee]
- Updated dependencies [c5cba19]
- Updated dependencies [dec74a9]
  - @weasel-js/font@1.14.2
  - @weasel-js/text@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/headless@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/font@1.14.1
  - @weasel-js/headless@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/text@1.14.1

## 1.14.0

### Patch Changes

- ba998f9: `@weasel-js/headless` adds `editEnd`, the one rule for how a text field's edit ends: Enter and blur commit, Escape cancels, with options for an Escape that commits and for a multiline field that leaves Shift+Enter alone. hud's menu text rows, ui's `MenuTextValue` and `RenameField`, and text-dom's `useTextEdit` now read it; none of them behaves differently. `@weasel-js/text-dom` now depends on `@weasel-js/headless`.
- 6cb0cf6: `@weasel-js/headless` adds `imeKey(e)`, whether a keydown belongs to an input method mid-composition: `isComposing`, or `keyCode` 229, which Safari sends for the Enter that ends a composition, or a `Process` or `Dead` key. This adds API. The hud's hidden text input, text-dom's `useTextEdit` and ui's `ComboBox` now use it in place of their own checks; `ComboBox` no longer commits typed text on Safari's composition-ending Enter, and `useTextEdit` also leaves `Process` and `Dead` keys alone.
  
  A context menu's text row and `PageTabs`' rename field leave Enter and Escape to an input method. Before, confirming a Japanese or Chinese candidate with Enter committed the half-typed text.
- 6c31588: The in-place text editor keeps a run's `stroke` and `rotate` through an edit. Before, its overlay had no place for either, so committing an edit dropped them from every run. The overlay does not draw them: a run's stroke and turn ride on its span as `data-stroke` and `data-rotate`. A `data-fill` or `data-stroke` that pasted markup carries and that is not JSON is now ignored rather than throwing.
- 1fb8193: A text's `lang` now reaches more than the shaper. `textTransform` and synthesized small caps map case in the run's language, so `i` uppercases to `İ` under `tr`; `transformRunTexts` takes the languages as an optional third argument, `smallCapsText` as a third and `isSmallCapsLetter` as a second, and a tag `Intl` rejects maps as no language. The edit overlay sets the `lang` attribute from the node's style, and each run span from its run, and reads a pasted span's `lang` back as the run's. SVG export writes `xml:lang` on `<text>` and `<tspan>`; import reads `xml:lang` or `lang`, inherited from any ancestor onto the node and a `<tspan>`'s own onto its run. This adds API.
- Updated dependencies [79357fc]
- Updated dependencies [38bb299]
- Updated dependencies [e1bbdcd]
- Updated dependencies [b142892]
- Updated dependencies [ec07e24]
- Updated dependencies [2f3d924]
- Updated dependencies [2692828]
- Updated dependencies [1c046e3]
- Updated dependencies [11e2b7d]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [b0a55a6]
- Updated dependencies [6cb0cf6]
- Updated dependencies [e7fca17]
- Updated dependencies [64d4e97]
- Updated dependencies [d7d29f9]
- Updated dependencies [5af16a6]
- Updated dependencies [966c37f]
- Updated dependencies [34a364e]
- Updated dependencies [d68c4f8]
- Updated dependencies [230a206]
- Updated dependencies [4f68c3a]
- Updated dependencies [78213f7]
- Updated dependencies [058fcdf]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [32889fc]
- Updated dependencies [1fb8193]
- Updated dependencies [ab41dea]
- Updated dependencies [f645651]
- Updated dependencies [5399b45]
- Updated dependencies [55375c0]
- Updated dependencies [486ff61]
- Updated dependencies [23dcddf]
- Updated dependencies [f2acefd]
- Updated dependencies [95eb9d3]
- Updated dependencies [ff3c2ad]
- Updated dependencies [b0d5f18]
- Updated dependencies [7507e13]
- Updated dependencies [d5c4ee6]
  - @weasel-js/font@1.14.0
  - @weasel-js/text@1.14.0
  - @weasel-js/paint@1.14.0
  - @weasel-js/headless@1.14.0
  - @weasel-js/react@1.14.0

## 1.13.0

### Patch Changes

- 352502d: `useTextEdit`'s `onDraft` now fires when a restyle changes the overlay, as well as on each keystroke, so a style change mid-edit — Cmd-B over a selection, or a character panel's change — reaches a text-along curve at once instead of at the next keystroke. A draft carries `style` when the edit rewrote the node's own style, as a commit would. A draft is sent only when what the overlay holds changed, so styling armed at a collapsed caret, or a restyle that changes nothing, sends none.
  
  `TextEditDraft` is now another name for `TextEditCommit`, since a draft is what a commit would write: its `runs` is a plain `StyledRun[]`.
- Updated dependencies [9a76fb5]
  - @weasel-js/text@1.13.0
  - @weasel-js/font@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 352502d: `useTextEdit`'s `onDraft` now fires when a restyle changes the overlay, as well as on each keystroke, so a style change mid-edit — Cmd-B over a selection, or a character panel's change — reaches a text-along curve at once instead of at the next keystroke. A draft carries `style` when the edit rewrote the node's own style, as a commit would. A draft is sent only when what the overlay holds changed, so styling armed at a collapsed caret, or a restyle that changes nothing, sends none.
  
  `TextEditDraft` is now another name for `TextEditCommit`, since a draft is what a commit would write: its `runs` is a plain `StyledRun[]`.
- @weasel-js/text@1.13.0-rc.0
  - @weasel-js/font@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0

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
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [24f2495]
- Updated dependencies [3bf5edb]
- Updated dependencies [91a1d84]
  - @weasel-js/paint@1.12.0
  - @weasel-js/text@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/font@1.12.0

## 1.11.1

### Patch Changes

- Updated dependencies [e30f4df]
- Updated dependencies [c29ac84]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [f148f50]
  - @weasel-js/react@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/text@1.11.1
  - @weasel-js/paint@1.11.1

## 1.11.0

### Patch Changes

- 3eb2abc: A text node can cut its text at its box: `data.overflow: 'clip'` draws the glyphs in a group clipped to the pose box, picks only the lines inside it, cuts the editing overlay to the same box (`TextEditScreenPose.clip`, read through `useSceneTextEdit`'s new `getOverflow`), and exports as an SVG group clipped to the box. Properties offers it as a Clip switch. A node can also carry a minimum size, `data.minSize` (`MinSize`, `minSizeOf`): a resize stops at it whatever the resize policy's constraints, a multi-selection stops where its first member reaches its own, and a scale replayed through transform-again holds to it. An insert or place binding's `minSize` param grows a smaller drag or click to it and is kept on the node. Sticky notes now clip their text and keep a 48 × 48 minimum, both set through `toolOptions.sticky` (`overflow`, `minSize`). An SVG import reads a clipped note back as a clipped group around its text, not as a text node that clips.
- Updated dependencies [63b310c]
- Updated dependencies [c6a0a52]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [66c7bde]
- Updated dependencies [974682d]
- Updated dependencies [36eca7a]
- Updated dependencies [1be2ea9]
- Updated dependencies [e562d4b]
- Updated dependencies [7a31f9d]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
  - @weasel-js/react@1.11.0
  - @weasel-js/text@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/font@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 9e84e5d: Additive: `useTextEdit` and `useSceneTextEdit` take `onStart(id)` and `onEnd(id)`. `onStart` is called as an edit opens, whichever way it was started (`startEdit`, a double-click, the `textEdit` dep). `onEnd` is called as it closes, however it does: a commit, a cancel, Escape, a click away, or another edit opening over it, and after any commit has been written. Both are called from the call that changes the edit, not from an effect, so state that follows the edit is never a render behind it. Neither is called when the hook unmounts with an edit open.
- Updated dependencies [cbd5b4d]
- Updated dependencies [924edc4]
- Updated dependencies [b8bfb2d]
- Updated dependencies [35c4879]
- Updated dependencies [886380f]
- Updated dependencies [f5870a4]
- Updated dependencies [10c5d41]
  - @weasel-js/text@1.10.1
  - @weasel-js/react@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/paint@1.10.1

## 1.10.0

### Patch Changes

- b3dec78: Adds API: `CharacterOptions` in `@weasel-js/ui`, the strip of character controls for a text edit in progress. It draws the options the text tool declares (`useTextTool.options`) from a `RangeStyle`, shows a control's mixed state where the range disagrees, and reports each edit as a `RunStylePatch`. `isCharacterChrome` is the matching `isEditorChrome` for `useTextEdit`: it claims the strip and any kit popover one of its controls opens, so using the strip does not end the edit.
  
  Adds API: `useTextEdit` and `useSceneTextEdit` return `effectiveStyle`, what a styling control shows during an edit — the node's style and paint, the range's styling over it, and the styling armed for the next character last. It is `null` outside an edit. A strip is wired with `<CharacterOptions style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />`.
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
- 9fa373d: text-dom: a new package holding in-place text editing, moved out of core. `useTextEdit` mounts a contenteditable overlay over a box on screen and commits styled runs; `runsToDom`, `domToRuns`, `charOffsetToDomPosition`, and `domPositionToCharOffset` convert between runs and the overlay's DOM. The types `TextEditScreenPose`, `TextEditClipRect`, `TextEditCommit`, `TextEditSelection`, `StartEditOptions`, `UseTextEditOptions`, `UseTextEditReturn`, and `StyleToggle` come with it, as does `TEXT_EDIT_FONT_HOLD`. It depends on `@weasel-js/text`, `@weasel-js/font`, `@weasel-js/paint`, and `@weasel-js/react`, needs React, and has no scene.
  
  The `text-dom@1.9.4` seeded on npm exports `overlayTop` and `baselineDrop`, which are internal; this release takes them off the entry. `@weasel-js/core` still exports every name it did before, and `useSceneTextEdit` stays in core.
- ded9e52: Fixes: editing text that ends in a line break dropped that break. `useTextEdit` removes one trailing newline when it reads the overlay back, since a browser adds one to hold the caret on an empty last line, and it removed the node's own the same way: `"abc\n"` became `"xabc"` when an `x` was typed at its start, and a styling change alone did the same. Chromium adds no second newline to text that already ends in one, so a break the text opened with now stays until an edit removes it.
- 28f1f55: Changes: `useTextEdit` leaves a typed character to the browser. It used to cancel every `insertText` and insert the character itself, so no `input` event followed a keystroke, typing was not on the browser's undo stack (both measured in headless Chromium), and input naming a range of its own, such as the double-space period or a text replacement, would have landed at the caret instead. It now inserts by hand in two cases only: under an armed style, which has to open a run of its own, and at a caret between two run spans, where a browser would type into the run before it.
  
  Fixes: a center- or bottom-aligned overlay is re-placed in the same task as a keystroke that changes its line count, as it already was for a paste or a delete.
  
  Behavior change: a character typed with the caret past a trailing line break now goes where the browser draws that caret, at the end of the line before the break. The hand insertion put it after the break, on a line the caret was not shown on.
- b2a1c61: Changes: `useTextEdit` reads a paste or a drop into runs and writes it through them, where the browser used to insert the clipboard's markup into the overlay. Measured in headless Chromium, a paragraph, a list, and a table copied from a page landed as `<span>`, `<ul>`, and `<table>` elements carrying the page's face, size, and color, and the list and the table read back with no line breaks between their items. Now a block opens and closes a line, a table cell follows the one before it after a tab, white space collapses as the source drew it, and the overlay holds only run spans afterward. A paste with no markup goes in as its plain text, a CRLF as one line feed.
  
  Behavior change, made on an agent's judgment where the TODO entry left it open between plain text only and keeping the markup's styling: pasted text keeps its emphasis (bold, italic, underline, strikethrough, overline, super- and subscript) and takes face, size, color, and spacing from the run it lands in, with any armed style applied. A browser writes each copied element's computed face, size, and color into the clipboard, the source page's defaults included, so those cannot be told apart from styling someone chose. This also means copying a colored run out of the overlay and pasting it back keeps its emphasis and loses the color, which the browser's own insertion kept.
  
  An engine whose `beforeinput` carries no `dataTransfer` still inserts for itself. The paste rewrites the overlay's spans, as a styling change does, so the browser's own undo is not expected to step back over it; that was not measured.
- ad10f82: Fixes: editing a text node whose pose is turned or carries a `transform` put the edit overlay on the node's unturned, unskewed box, and a double-click opened the editor from that box where no text is drawn. `useSceneTextEdit` hands the overlay the frame the node is drawn in, and takes a double-click back through it before testing it against the text.
  
  Adds API: `TextEditScreenPose.frame`, the linear part `[a, b, c, d]` of the frame a text box is drawn in, applied about the box's center. `useTextEdit` writes it into the overlay's CSS transform with the `zoom`.
- Updated dependencies [a86d79f]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [b1f7521]
- Updated dependencies [d675fed]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [06003a5]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [3bacb3e]
- Updated dependencies [a428b54]
- Updated dependencies [27b827e]
- Updated dependencies [bbb538e]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [6073365]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
  - @weasel-js/text@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/react@1.10.0
