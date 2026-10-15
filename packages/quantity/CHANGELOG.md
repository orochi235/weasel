# @weasel-js/quantity

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
