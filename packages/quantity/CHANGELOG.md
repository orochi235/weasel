# @weasel-js/quantity

## 1.13.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- 86f67ad: `fraction` and `ratio` displays give a value above 1 proportionally fewer denominators to choose from, so a large value reads as a whole number or a simple fraction: 749.81 shows `750` rather than `15746/21`. Values under 1 are unchanged.

## 1.13.0-rc.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- 86f67ad: `fraction` and `ratio` displays give a value above 1 proportionally fewer denominators to choose from, so a large value reads as a whole number or a simple fraction: 749.81 shows `750` rather than `15746/21`. Values under 1 are unchanged.

## 1.12.0

No changes in this release.

## 1.11.1

### Patch Changes

- 433540d: A container's unit scope (`ContainerNode.units`) now reaches grid snapping and node property
  fields. A scope converts what is shown, typed and snapped to; every pose is still stored in world
  units, and pose composition does not scale by it.
  
  - `gridSnapSource({ scopes: { root, spacing? } })` snaps the subject on the pitch of the unit
    scope its nodes share, so a node inside a millimeter sub-assembly snaps on millimeter spacing.
    `spacing` is read in that scope's units unless `scopes.spacing` gives a pitch per scope.
    `scopedGridPitch` answers the pitch for a chain of scopes.
  - A snap source is told the gesture's subject: `SnapCollect.ids`.
  - `sceneSharedUnitScopes(scene, ids, root)` is the run of unit scopes every node of `ids` sits in.
  - A number leaf takes `measure: 'length'` for a length stored in world units.
    `prefLeafInScopes(leaf, scopes)` gives such a leaf the unit of the scopes it is shown in, built by
    `scopedPrefUnit(scopes)`: shown in the innermost scope's base unit, with every unit of its system
    accepted as typed text. The kit's node schemas mark X, Y, W, H and text padding as lengths.
  - `SelectionPanel` takes `units`, the scene's outermost scope; given it, a length field shows the
    selected nodes' shared scope.

## 1.11.0

### Patch Changes

- 90851d1: A schema drawn as a menu keeps its number, color, and string leaves. `resolveSchemaMenu` turns a number leaf into a new `number` menu entry, in the units the leaf shows, and a color leaf into a new `color` entry; a string reads as a disabled `Name: value` row. Both are new `MenuEntry` kinds, so code that switches over every kind needs a case for each.
  
  A number row edits in place and the menu stays open. The DOM menu holds a field in the row: Enter on the highlighted row moves focus into it, the arrow keys step it there, and Enter or Escape hands focus back to the menu. The HUD menu draws a minus and a plus chip either side of the value. In both, `+` and `-` step the highlighted row. The menu controller's new `numberValue`, `setNumber`, and `spin` hold what was set while the menu is open, and `menuNumberText` prints a value as a renderer with no field does.
  
  A color row shows a swatch and the hex and is read-only in both menus.
  
  `clampToBounds`, `snapToStep`, and `spinKey` move from `@weasel-js/ui`'s internals to `@weasel-js/quantity`, where the menu model steps with them too.
- 797bf34: A number row in a menu drawn from a schema now honors the leaf's `endless` and `infinity`. An endless end sits one step past its bound, as it does on an endless slider, so stepping up from the bound reaches infinity, and an infinity stored there shows as the leaf's word for it, with no unit after it. This holds in the DOM menu and the HUD menu alike. The DOM menu's field also reads typed units now, in any unit the leaf's `unit` accepts.
  
  `clampToBounds` and `spinKey` in `@weasel-js/quantity` take an `endless` bound. `endlessAllows`, `endlessAt`, `endlessTrack`, and the `Endless` type have moved there from `@weasel-js/ui`, which still re-exports `Endless`. `UnitField` takes `endless` as well, so a property row's plain number field keeps an infinity typed at an endless end where it used to clamp it to the bound. `prefUnitAccepts` is now exported from `@weasel-js/prefs`, which ui and routing both use. `prefDisplayBounds` returns the leaf's `endless`, with its ends swapped under a unit that runs backward. `MenuNumberEntry` gains `endless`, `infinity`, and `accepts`. `menuNumberText` now takes the entry in place of a suffix and a display.
- 59b5936: A fraction display takes a third form, `fraction({ form: 'stacked' })`. It writes the same text and HTML that `inline` does. `present` marks its result `stacked: true` next to the `mathml` form, so a renderer that draws MathML draws the numerator over the denominator. `QuantityText` now does that: it draws the MathML inside the value's `<data value>` and puts the text form, hidden, beside it, so copying the value gives `1/2` and not the bare digits. A screen reader still hears the spoken form. Fractions in `inline` and `diagonal` form draw exactly as before.

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.

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
- 21b6db7: Adds API: a plane's axes can carry different units. `resolveAxes(value, units)` in `@weasel-js/quantity` resolves one value for both axes, or `{ x, y }`, against one `UnitSystem` or one per axis (`PlaneUnits`), and `formatAxes` writes a base-unit point back out with each axis in its own display unit. `axisUnits`, `PerAxis`, `PlaneUnits`, and `PlaneValue` are exported beside them, and all are re-exported from `@weasel-js/core`.
  
  `gridSnapStrategy`, `pointToGridCell`, `createGridLayer`, `createCellHighlightLayer`, and `useGridCellHover` take a per-axis `spacing` and `unitSystem`, so a grid can be 1s wide and 5mV tall. A single value still means a square grid.
- 1ee5335: Adds API: a range and a vector of quantities have a presentation of their own. `presentRange(from, to, fallback?)` gives `1/64–1/2` as text, spoken text (`1 over 64 to 1 over 2`), and HTML, and `presentVector(members, fallback?, { labels })` gives `x 3, y −4`. `rangeParts` and `vectorParts` return the same as one run of parts. Each member shows under its own display, else the fallback.
  
  In the HTML form a composite is a `<span data-composite="range">` or `"vector"` holding one `<data value>` per member, with a `separator` part between and a `label` part before a labeled member.
  
  Decided on an agent's judgment: a unit or percent sign both ends of a range share is written once, after the second (`2–5ft`, `25–50%`); the en dash is spaced when either end is negative (`−5 – −2`); and a composite has no MathML form.
- 38fd203: Adds API: arithmetic across units. `resolveUnitExpr('50% + 2ft', { unitSystem, percentOf })` returns base units, and `parseUnitExpr` returns the expression as plain data (`UnitExpr`), so a stored one resolves again when the length its percentage is measured against changes. It reads `+ - * /`, parentheses, and adjacent terms as one compound value (`5ft 3in`). Both are re-exported from `@weasel-js/core`.
  
  Decided on an agent's judgment: a bare number beside `+` or `-` is base units and beside `*` or `/` a scalar; a measure over a measure is a scalar; a product of two measures, a scalar over a measure, and a unit with an offset (degC) anywhere inside arithmetic all throw; `%` resolves against `percentOf` unless the unit system defines a `%` unit of its own.
- 9ad34e0: Adds API: a unit system nested in another. A `UnitScope` is a `UnitSystem` plus the `scale` one of its base units is worth in the scope around it, so a sub-assembly drawn in millimeters can sit in a scene measured in inches. `resolveScoped(value, scopes)` reads a value against the innermost scope and returns the outermost scope's base units, converting at each boundary; `toRoot` and `fromRoot` convert a bare measure each way; `formatScoped` writes a root measure in an inner unit; and `scopesOf(id, root, tree)` collects the chain for a node from a `parentOf` and a `scopeOf`. All are re-exported from `@weasel-js/core`.
  
  Decided on an agent's judgment: a value is resolved only against the innermost scope's units, so `ft` inside a metric scope throws; and a node's own scope covers its children, not the node, unless `scopesOf` is asked to be `inclusive`.

## 1.9.4

### Patch Changes

- 7905beb: The `fraction` kind wrote a custom constant's `symbol` into its MathML unescaped, so a symbol holding `<` or `&` produced malformed markup. It is escaped like the HTML form.
- afbc295: A small negative value that rounds to zero showed as `−0`: a readout of −0.0004 at two places, `formatUnit(-0.001, 'in', IMPERIAL_INCHES)` as `-0in`, −0.1% as `−0%`. `formatNumber`, `formatCompact`, `formatUnit`, and every display kind now show the zero without a sign.
- 9a6f7a5: Several display kinds could not read back the text they show. `currency` failed in any locale whose currency abbreviation ends in a period (`12,50 kr.` in `da-DK`, `12,50 лв.` in `bg-BG`) and in `ar-EG`, and dropped a typed magnitude suffix, so `$5k` read as 5. `percent` failed where the sign is `٪`, is wrapped in bidi marks (`ar`, `ar-EG`, `fa-IR`), or sits inside the minus (`−%50` in `tr-TR`). `multiplier({ symbol })` could not read its own symbol. `parseAs` now reads all of these.
- 7908e8f: `formatCompact` and the `bytes` kind chose a magnitude before rounding, so a value just under one printed at the wrong width: `formatCompact(999.6)` gave `1000` instead of `1.00K`, and 999,999 bytes showed `1,000 kB` instead of `1 MB`. Both now choose from the rounded value.
  
  `parseNumber` read `0x10` as 16, `0b11` as 3, `0xb` as 233, and `1e400` as Infinity. Text that is not a decimal number, or is too large to be one, now reads as NaN.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

No changes in this release.

## 1.8.0

### Patch Changes

- 2432ce3: Quantities can be infinite. Every display shows ±Infinity as `∞`, spoken "infinity", and reads `∞`, `inf` and `infinity` back; `endless(display, 'never')` gives a display its own word, shown without a unit beside it and read back when typed. A zoom display used to print `Infinity` here.
  
  A slider can make an end stand for infinity. `Slider` and `PropertyField` take `endless: 'max' | 'min' | 'both'`: the end stop reports ±Infinity, a value of ±Infinity sits there, and the readout shows the display's word. A number pref leaf takes `endless` and `infinity` (its word), and labkit's number builder takes `.endless('never')`, so `f.number(Infinity).range(0, 5000).suffix('ms').endless('never')` reads "never" at the top of its track instead of "5000 ms".

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- 51eb721: `parseNumber` and the display parsers now read the digits a locale writes in, so `١٬٢٣٤` typed in `ar-EG` is 1234 rather than NaN. A duration typed on the clock takes the locale's decimal mark before its fraction of a second, so `4:05,5` reads as 245.5 in `de-DE`.

## 1.7.0

### Patch Changes

- f257369: `fraction()` gains two options. `form: 'diagonal'` writes the fraction as superscript digits, the fraction slash and subscript digits (`¹⁄₁₂`), so it stays diagonal wherever the text is drawn, and every fraction display reads that form back. `of` counts in a named constant: `fraction({ of: 'π' })` shows `3π/4`, speaks `3 pi over 4` and reads `3pi/4` back; `π`, `τ` and `e` are built in as `CONSTANTS`, and any `{ symbol, value, spoken }` works. `of` cannot be combined with `mixed`.
  
  Unit fields that accept `in` or `ft` now also accept `"` and `'`, the primes, and the curly quotes a keyboard substitutes for them, and the reverse; `unit('"')` shows inches with the mark and speaks them as inches.
- 408ce25: Typed text reads in the display's locale. `parseNumber` takes a locale, and every display kind passes its own, so what a display shows in `de-DE` (`1.234,5`), `fr-FR` (`1 234,5`), `de-CH` (`1'234.5`) or `en-IN` (`12,34,567`) parses back to the same value. A locale that groups with a space accepts any space there, and `'` and `’` stand in for each other. Where the locale's reading fails the `en-US` one is tried, so `1.5` is still one and a half in `de-DE`; where both succeed, the locale's wins.
  
  A compound unit value reads a grouped number in any term: `1,500ft 3in` is 18,003 inches, where it used to be NaN.
- 455e4bc: New package, `@weasel-js/quantity`: a number anywhere the engine takes one can be bare or tagged (`{ value, unit?, display? }`), and a tagged value keeps its unit and display through JSON, history and every edit (`retag`). A display is plain data — `fraction()`, `ratio()`, `percent()`, `unit('mm')`, `currency('USD')`, `duration()`, `bytes()`, `roman()`, `ordinal()`, `multiplier()`, `zoom()`, `compact()`, `decimal()`, `integer()` — and `qty(value, display)` gives its text, spoken text, unstyled HTML and, for fractions, MathML. `registerDisplayKind` adds a kind or replaces a built-in one.
  
  Breaking: the unit system (`UnitSystem`, `resolveUnit`, `formatUnit`, …) now lives in `@weasel-js/quantity`; core still re-exports the same names. `formatNumber`, `formatCompact`, `parseNumber`, `parseSignedNumber` and `MINUS_SIGN` are no longer exported from `@weasel-js/ui` — import them from `@weasel-js/quantity`. `formatZoom` is gone: use `qty(z, zoom()).text`. A pref's `format: 'plain' | 'compact'` is now `display: Display` (`ToolPrefNumberFormat` and `PrefNumberFormat` are removed), `PropertyField`'s `notation` is now `display`, and labkit's `f.number().format('compact')` is `.display(compact())`.
  
  `PropertyField`, `UnitField`, `Slider` and `BandEditor` take a `display`, which drives what they show, what they read back when typed, and their `aria-valuetext`. A `BandEditor` seam at 1/12 with `display={fraction()}` announces "1 over 12" rather than `0.08333333333333333`, and a band whose `from` is tagged stays tagged through drags, splits and merges. The Timeline rate slider now speaks "4 times" rather than "4x".
