# @weasel-js/hud

## 1.12.0

### Patch Changes

- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- Updated dependencies [dbd6711]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [e9304f4]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [1a72259]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/menu@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/gestures@1.12.0
  - @weasel-js/theme@1.12.0
  - @weasel-js/loupe@1.12.0
  - @weasel-js/font@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- c2dfd4e: A menu can hold a line of text edited in place: `MenuTextEntry` (`kind: 'text'`), with the controller's `textValue` and `setText` holding what was typed while the menu stays open. A string leaf in a schema drawn as a menu becomes one when something writes it, and stays a read-only `Name: value` row when it is a `readout` or nothing does. The DOM menu draws a text field that Enter on the row focuses; Enter or blur writes the text and Escape puts it back. The HUD menu has no text entry, so it draws the row's value read-only.
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
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [c497405]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [23dbaff]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
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
  - @weasel-js/gestures@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/theme@1.11.1
  - @weasel-js/menu@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/loupe@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- c96f8a0: `attachMenuHost(hud, host, …)` draws the open context menu as a HUD widget, from the same model the DOM menu uses: keyboard, typeahead, submenus and on-canvas placement. It takes focus while open, swallows every key pressed while it has focus, and closes when a press lands anywhere else. It does not yet draw icons, shortcut chips or check marks, and screen readers get only its name.
  
  A widget can now set `focusRing: false` to keep the HUD from drawing its focus ring around it; the menu does, since its highlighted row already shows where focus is. Menu labels are measured from the advances of the font the HUD draws in, and `measureLabel` is exported for a `measure` override to build on.
- ac503c9: A widget can declare an `accessibleTree`: a tree of ARIA roles, states, and labels, with the node the keyboard is on marked `active`. While the widget holds focus, the hud mirrors it as visually hidden DOM beside the canvas, which owns the mirror through `aria-owns` and points at the active node through `aria-activedescendant`; a change of highlight alone moves that pointer and leaves the elements in place. The WebGL context menu declares one, so a screen reader sees its rows as `menuitem` and `menuitemcheckbox` elements with their checked and disabled states, an open submenu as a nested `menu`, and the highlighted row as it moves.
- 4a44657: The WebGL context menu reads its shadow as the DOM panel does, `var(--wzl-bevel-raised, 0 8px 24px var(--wzl-shadow))`, so a theme's bevel reaches it: outer layers draw beneath the panel, `inset` layers over its face inside the border. Inset layers draw hard-edged whatever their blur. `boxShadowCommands` in hud draws any `box-shadow` list around a rounded box.
  
  theme adds `expandVars`, which substitutes the `var()` references a resolved theme's values can still hold, fallbacks included, and `parseBoxShadow`, which reads a `box-shadow` value into its layers.
- 914ff3d: The WebGL context menu closes on a wheel outside its panels, when the window loses focus and on resize, as the DOM menu does. Closing it with Escape, a chosen item or any of those gives HUD focus back to the widget that held it when the menu opened, with its focus ring if it had one; a press that moves focus elsewhere keeps that focus.
- 58e558d: The WebGL context menu draws each row's icon in the icon column, at 16px and in the row's color, as the DOM row does; a checked row draws its check there instead. `attachMenuHost` and `createMenuWidget` take `icons`, an icon registry or anything with its `get` and `getVersion`, and a menu without one draws no icons.
  
  `glyphCommands` draws an icon glyph as draw commands, placed in a square and colored wherever it says `currentColor`. It reads the elements the icon tables use, their presentation attributes and transforms, and a nested `svg` as a clip; a `clip-path` pointing into `defs` does not clip.
- b14dec1: The WebGL context menu draws each row's shortcut at the row's end, in the muted color and formatted as the DOM menu formats it, and a check mark in the icon column for a row whose action is on, so a toggle's state shows. A panel widens to fit a label and its shortcut. Panels are rounded by `--wzl-radius-md` and cast the DOM panel's default shadow in `--wzl-shadow`. Icons are not drawn yet.
- 90851d1: A schema drawn as a menu keeps its number, color, and string leaves. `resolveSchemaMenu` turns a number leaf into a new `number` menu entry, in the units the leaf shows, and a color leaf into a new `color` entry; a string reads as a disabled `Name: value` row. Both are new `MenuEntry` kinds, so code that switches over every kind needs a case for each.
  
  A number row edits in place and the menu stays open. The DOM menu holds a field in the row: Enter on the highlighted row moves focus into it, the arrow keys step it there, and Enter or Escape hands focus back to the menu. The HUD menu draws a minus and a plus chip either side of the value. In both, `+` and `-` step the highlighted row. The menu controller's new `numberValue`, `setNumber`, and `spin` hold what was set while the menu is open, and `menuNumberText` prints a value as a renderer with no field does.
  
  A color row shows a swatch and the hex and is read-only in both menus.
  
  `clampToBounds`, `snapToStep`, and `spinKey` move from `@weasel-js/ui`'s internals to `@weasel-js/quantity`, where the menu model steps with them too.
- 797bf34: A number row in a menu drawn from a schema now honors the leaf's `endless` and `infinity`. An endless end sits one step past its bound, as it does on an endless slider, so stepping up from the bound reaches infinity, and an infinity stored there shows as the leaf's word for it, with no unit after it. This holds in the DOM menu and the HUD menu alike. The DOM menu's field also reads typed units now, in any unit the leaf's `unit` accepts.
  
  `clampToBounds` and `spinKey` in `@weasel-js/quantity` take an `endless` bound. `endlessAllows`, `endlessAt`, `endlessTrack`, and the `Endless` type have moved there from `@weasel-js/ui`, which still re-exports `Endless`. `UnitField` takes `endless` as well, so a property row's plain number field keeps an infinity typed at an endless end where it used to clamp it to the bound. `prefUnitAccepts` is now exported from `@weasel-js/prefs`, which ui and routing both use. `prefDisplayBounds` returns the leaf's `endless`, with its ends swapped under a unit that runs backward. `MenuNumberEntry` gains `endless`, `infinity`, and `accepts`. `menuNumberText` now takes the entry in place of a suffix and a display.
- 57725cc: Menus hang under a rect and register commands from callbacks. `placeMenuUnder` in `@weasel-js/menu` is new public API: it places a menu under a rect, flips it above, and right-aligns it at the right edge. `MenuOpenRequest.under` is an additive field, honored by the DOM and WebGL menu renderers, and `BarMenu` passes its button's rect. `BarMenu` takes an additive `defaultOpen` prop: it opens the menu once on mount, without taking focus, retrying as commands register until the menu has rows. `useCommand(id, label, run, options?)` is new public API in `@weasel-js/routing/react` and `@weasel-js/core`; its `icon` option takes an `IconRef`. The asset editor files menu roots under a "Menus" heading and previews them open.
- 2f51085: Menus take access letters and links. `access` on `PrefBase`, `PrefGroup` and `PrefSection` names a menu item's letter; the resolver carries it, and an alias's own letter wins over its target's. `@weasel-js/menu` gains `accessMatch` (finds the item a typed letter selects), `withLinks` (runs a link row's `href` through a navigator the host passes), and `href` and `current` on items. `onEdge` is new on the menu controller, called when Left or Right is pressed at a boundary. Link rows now navigate in the WebGL host. `KeyEffect` gained an `edge` variant, and `keyStep` now returns it for Left and Right at a boundary, which breaks a consumer that switches exhaustively over the effect: add a case for it.
- f34b290: A `<CanvasView>` can nest in another through `parent`: its `bounds` are measured from that view's
  rect, a thunked `bounds` or `view` receives that view's camera and size, it paints cut to that view
  and only the layers that view paints, and input inside it lands in its world before that view's.
  `SceneCanvasApi.viewAt` names the innermost view under a canvas point. An interactive or
  view-backed loupe now magnifies the camera of the view under its aim, so over a panel it shows and
  edits the panel's world. `createViewportLayer` and `ResolvableView` take an optional `clip`.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
- Updated dependencies [6f839dd]
- Updated dependencies [95d22f1]
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
- Updated dependencies [4a44657]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [d86f89e]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [fe20dc4]
- Updated dependencies [e901a2b]
- Updated dependencies [da45b33]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
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
- Updated dependencies [1be2ea9]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [e562d4b]
- Updated dependencies [7947fdf]
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
  - @weasel-js/registry@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/gestures@1.11.0
  - @weasel-js/theme@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/menu@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/font@1.11.0
  - @weasel-js/loupe@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [88b8840]
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
- Updated dependencies [c56fc4a]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1
  - @weasel-js/theme@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/registry@1.10.1
  - @weasel-js/loupe@1.10.1

## 1.10.0

### Patch Changes

- 18547a3: Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
  
  Adds API: `@weasel-js/theme` resolves a paint `ColorSource` under a theme. `colorSourceCss(source, ctx?)` writes one as a CSS color and `colorSourceLiteral(source, ctx?)` resolves one to a literal for a surface with no cascade; `useColorCss()` in `@weasel-js/theme/react` is the first against the provider in force. A `ColorRef` names, in order: an entry of the palette on the context; `tone` (`TONE_REF`) with an index into the tone list, wrapping; a theme token by its name without the `--wzl-` prefix (`{ ref: 'accent' }`); a ramp by name with the index of a step (`{ ref: 'swatch', index: 3 }`); or a custom property spelled out (`{ ref: '--my-color' }`), which need not be the theme's. A ref the theme answers is written to CSS as its custom property, so it follows a mode change without a re-render; a palette entry or a function is written as the literal it resolves to in the provider's selection.
  
  Adds API: `<ThemeProvider palette>` takes a paint `Palette` whose names a `ColorRef` in that subtree resolves before the theme's own, and `ThemeContextValue` carries it as `palette`. These rules for what a ref names were chosen on an agent's judgment.
  
  Breaking: a `tone` is `number | ColorSource`, no longer `number | string`. That is `StanceProps.tone` in `@weasel-js/ui`, so every stanced surface (`Badge`, `Button`, `Callout`, `Code`, `Dialog`, `LayerList` items, `MotifFrame`, `Powerline` segments, `PropertyGroup`, `PropertyPanel`, `Subpanel`), labkit's `ControlPanel`, `ControlMatrix`, and sidebar sections, and forge's `Library.tone`. An index is unchanged. A CSS string no longer typechecks: write a color as `cssColorLiteral('#2b6cb0')`, a theme token as `{ ref: 'accent' }`, and anything only CSS can say as a custom property of your own, `{ ref: '--my-tone' }`. A tone nothing answers now draws as no tone. `@weasel-js/ui` now depends on `@weasel-js/paint`.
  
  Breaking: the other colors `@weasel-js/ui` takes are `ColorSource` too, each written through `useColorCss`: `Plot2D`'s `grid.color` and `axes.color`, `CurveField`'s mark `color`, the `color` of a curve `fill` (`FillSettings`, on `CurveEditor` and `createFunctionLayer`), and the Badge effects' `outline.color`, `sunbeams.color`, `metal.accent`, and `aqua.accent`. Each one's default draws as before.
  
  Breaking: `@weasel-js/hud` names colors the same way. A window's `tone` (`WindowOptions.tone`, `setTone`) is `number | ColorSource`, and the draw contexts (`HudDrawCtx`, `HudContentCtx`) carry `color(source)`, a source resolved to a hex, in place of `toneAt(i)`; a widget that called `ctx.toneAt(2)` calls `ctx.color({ ref: 'tone', index: 2 })`. `AttachHudOptions.tones` is a `ColorSourceContext`, so its tone list is optional and it may carry a palette.
- 3bda2ef: A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in a canvas source's `subscribeFrame` and a HUD's `subscribeFocus` and `subscribeFrame`. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. Both packages now depend on `@weasel-js/registry`.
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
- 70bd9b9: Adds API: the rect and image widgets take a `claims` option and a `setClaims(claims)` setter, so one that is decoration in one mode can consume presses in another without being swapped out. The default is still `[]`. A rect that claims `pointer` is a scrim: a press on it no longer reaches the widgets or the scene beneath.
  
  `Widget.claims` was already read at every hit-test, so a hand-written widget can declare it as a getter; its doc now says so and a test holds it.
- f55435d: Fixes: a pixel-mode loupe whose aim held still kept showing the old picture, and `loupe.color` the old color, after an undo or a nudge changed what was under it. The lens now reads the framebuffer and the color again on the frame that lands after the content version or the camera moves. Its own redraw moves neither, so the new picture does not ask for another.
  
  Adds API: `createLoupe` takes `contentVersion`, the version of what the canvas paints; pass `CanvasExtensionApi.getPaintedVersion`. A lens given `views` reads it from there with no option. `LoupeHandle.refresh()` asks for a paint and re-reads on the frame that lands, for a change no version reports, such as a drag preview that has not committed. Without a version and without `refresh()`, an edit under a parked aim still shows only in vector mode.
- 54b013c: Removes what was left of tools running their own gestures. A tool declares bindings to actions, and nothing called these any more.
  
  Breaking, for code that used them:
  
  - `ToolCtx` is gone from `@weasel-js/routing` and `@weasel-js/core`. An action reads its `InvocationCtx`.
  - A function passed as `Tool.cursor` or `ToolDef.cursor` takes no argument: the type is `CursorSpec | (() => CursorSpec)`. A cursor that depends on the tool's state closes over that state. Before, the function was handed a context whose pointer position was always `0, 0` and whose modifiers were always up.
  - `Tool.previewPose`, `Tool.previewBounds`, and `Tool.previewIds` are gone, and a canvas no longer asks its tools for a preview. An in-flight preview comes from the action's `OngoingHandle` (`previewIds`, `previewPose`, `previewData`), which is where the kit's actions publish theirs. `CanvasHelpers.getPreviewSources()` returns those handles alone.
  - `Tool.initScratch` and `ToolDef.initScratch` are gone, and so is `ToolLifecycleCtx`. `onActivate` and `onDeactivate` take no argument; before, they were handed `{ scratch }`, the value `initScratch()` returned. A tool that keeps state between gestures holds it itself and closes over it, as the pen does.
  - `Tool`, `ToolDef`, and `defineTool` lose their scratch type parameter. In `@weasel-js/core` none of them takes a type argument: `Tool<null>` becomes `Tool`, and `defineTool<null>({ … })` becomes `defineTool({ … })`. In `@weasel-js/routing` the one parameter left is the overlay type: `Tool<TOverlay>`, `ToolDef<TOverlay>`, `defineTool<TOverlay>`.
  - `AnyToolOf<TOverlay>` is gone from `@weasel-js/routing`; `Tool<TOverlay>` is the same type.
  - `ToolPresentation` takes no type parameter, and a function passed as `presentation.icon` takes no argument. The palette only ever called it with `undefined`.
  
  Adds API: `CanvasExtensionApi.clientToWorld(clientX, clientY)` converts a client point to the canvas's world the way the canvas itself does, through the `clientToWorld` prop when one was given. Fixes a `<Canvas>` given that prop disagreeing with itself: hover used the override, and the test for whether a registered layer covers a point inside a `<CanvasView>` did not.
- Updated dependencies [dfc0dda]
- Updated dependencies [7d16908]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [7140b5a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [4244046]
- Updated dependencies [88e3c8e]
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
- Updated dependencies [d675fed]
- Updated dependencies [497ddce]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [dc1f09c]
- Updated dependencies [fb3aa02]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [b3d45d9]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [06003a5]
- Updated dependencies [3bda2ef]
- Updated dependencies [da0335e]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [87dd1ad]
- Updated dependencies [3bacb3e]
- Updated dependencies [6b03b7e]
- Updated dependencies [b260415]
- Updated dependencies [c6bf78b]
- Updated dependencies [66d5455]
- Updated dependencies [a03f0ce]
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
- Updated dependencies [5ef28a0]
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
- Updated dependencies [ee08fa5]
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
- Updated dependencies [5b97be1]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [bbb538e]
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
- Updated dependencies [c9aaa07]
- Updated dependencies [0719af9]
- Updated dependencies [6073365]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [ef3d83c]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/theme@1.10.0
  - @weasel-js/geom@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/loupe@1.10.0
  - @weasel-js/registry@1.10.0

## 1.9.4

### Patch Changes

- 8a98a12: `useHud(ref, { font: { metricsUrl, atlasUrl } })` with the font object written inline detached and re-attached the HUD on every render of the component: the frame cache was dropped and a hovered widget got a `hoverleave` with the pointer still on it. `useHudContribution` handed `<SceneCanvas ambient>` a new entry each render for the same reason. Both now compare the font by its URLs.
- 1ccaf86: The hud loupe reported `#000000` as the color under the aim over a transparent pixel, where `@weasel-js/loupe`'s canvas source reports no color. `loupe.color`, `onColorChange`, and `pick` now answer `null` there.
- fc4676d: `@weasel-js/core/renderer` exports `releaseImageSource(source)`, which frees the texture every live renderer holds for an image source at once. Call it when replacing a bitmap that will not be drawn again, such as a video frame or a canvas snapshot; drawing the source later uploads it again. The pixel loupe now calls it on each refresh and on dispose, where it used to leave each replaced bitmap's texture for the garbage collector.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
- 8d56051: A `kindOf` target predicate must now declare whether it reads the affordance hit: `TargetPredicate.readsAffordance` is required, and the exclusive-claim filter reads it and no longer guesses. Build one with the new `hitPredicate((hit, bodyTarget) => …)` or `bodyPredicate((bodyTarget) => …)`, exported from `@weasel-js/gestures` and `@weasel-js/core`. This is a breaking change: a bare function as `kindOf` is a type error, and one passed from untyped code counts as not reading the hit, so an exclusive claim bars its binding.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [4c4aa40]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [7b1da16]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [9d54d0a]
- Updated dependencies [d99eb26]
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
- Updated dependencies [a07e769]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [8f23c57]
- Updated dependencies [a7c9133]
- Updated dependencies [c289df7]
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
- Updated dependencies [a8d8efb]
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
- Updated dependencies [2010b82]
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
- Updated dependencies [747e03e]
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
- Updated dependencies [e30e47c]
- Updated dependencies [12a42f0]
- Updated dependencies [732f5c3]
- Updated dependencies [44e1258]
- Updated dependencies [40533db]
- Updated dependencies [d71fc46]
- Updated dependencies [4334f6d]
- Updated dependencies [bb28e63]
- Updated dependencies [3dff419]
- Updated dependencies [8411fa2]
- Updated dependencies [611573e]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/core@1.9.4
  - @weasel-js/theme@1.9.4
  - @weasel-js/font@1.9.4
  - @weasel-js/paint@1.9.4
  - @weasel-js/geom@1.9.4
  - @weasel-js/loupe@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/font@1.9.3
  - @weasel-js/core@1.9.3
  - @weasel-js/theme@1.9.3
  - @weasel-js/loupe@1.9.3
  - @weasel-js/geom@1.9.3
  - @weasel-js/paint@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
- Updated dependencies [6e302e9]
  - @weasel-js/core@1.9.2
  - @weasel-js/theme@1.9.2
  - @weasel-js/loupe@1.9.2
  - @weasel-js/font@1.9.2
  - @weasel-js/geom@1.9.2
  - @weasel-js/paint@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/loupe@1.9.1
  - @weasel-js/font@1.9.1
  - @weasel-js/geom@1.9.1
  - @weasel-js/paint@1.9.1
  - @weasel-js/theme@1.9.1

## 1.9.0

### Patch Changes

- c06cc26: Read action deps at their declared `DepSchema` types instead of casting them.
- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
- Updated dependencies [3088756]
  - @weasel-js/core@1.9.0
  - @weasel-js/paint@1.9.0
  - @weasel-js/loupe@1.9.0
  - @weasel-js/theme@1.9.0
  - @weasel-js/font@1.9.0
  - @weasel-js/geom@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies [75dd38d]
- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [7e72192]
- Updated dependencies [bf522cf]
- Updated dependencies [f9ebc47]
- Updated dependencies [06e5299]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/theme@1.8.1
  - @weasel-js/core@1.8.1
  - @weasel-js/geom@1.8.1
  - @weasel-js/loupe@1.8.1
  - @weasel-js/font@1.8.1
  - @weasel-js/paint@1.8.1

## 1.8.0

### Patch Changes

- b68a0e7: `--wzl-fg-muted` and `--wzl-fg-subtle` are now a step down from the text color in effect rather than fixed grays: `rgb(from currentColor r g b / 0.7)` and `/ 0.54` in dark mode, `/ 0.78` and `/ 0.64` in light. Muted text on an accent fill, a raised row, or a sunken rail follows the text beside it instead of landing on a gray picked for the default surface, and muted text nested in muted text no longer compounds. Under `--wzl-fg` both steps clear WCAG 4.5:1 on every neutral surface in both modes; dark-mode subtle text previously did not.
  
  In a property other than `color` the step is taken from the element's own `color`. `Checkbox`, `SwatchGrid`, `PatternPicker`, and `Disclosure` now inherit their text color so their hover edges and disabled fill step down from it, and `Slider`'s thumb fills from `--wzl-fg` directly. Nested entries in the `PrefsDialog` rail are drawn a step down from the entry they sit under again. labkit's `interstellar` theme drops its fixed-gray pins for both tokens and takes the same rule.
  
  The resolved theme record carries these tokens as CSS, since a canvas has no `currentColor`. New `resolveCurrentColor(value, current)` flattens one to a concrete color; the HUD window's title uses it.
- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
- Updated dependencies [b68a0e7]
  - @weasel-js/core@1.8.0
  - @weasel-js/theme@1.8.0
  - @weasel-js/loupe@1.8.0
  - @weasel-js/font@1.8.0
  - @weasel-js/geom@1.8.0
  - @weasel-js/paint@1.8.0

## 1.7.3

### Patch Changes

- Updated dependencies [b258798]
  - @weasel-js/theme@1.7.3
  - @weasel-js/core@1.7.3
  - @weasel-js/font@1.7.3
  - @weasel-js/geom@1.7.3
  - @weasel-js/loupe@1.7.3
  - @weasel-js/paint@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [a6d6ebc]
- Updated dependencies [b18ef4a]
- Updated dependencies [bbf4d3d]
- Updated dependencies [7671813]
  - @weasel-js/core@1.7.2
  - @weasel-js/theme@1.7.2
  - @weasel-js/loupe@1.7.2
  - @weasel-js/font@1.7.2
  - @weasel-js/geom@1.7.2
  - @weasel-js/paint@1.7.2

## 1.7.1

### Patch Changes

- 8635031: Every text tier now places its baseline from the ascent and descent a browser
  sets the face with, and centers the face in its line the way CSS does: half
  the leading above the ascent. A face taller than its line box, such as Papyrus
  at `lineHeight: 1.2`, gets negative leading and overflows the box, which keeps
  its height. Before, a line hung its baseline one ascent below the line top
  with no leading, so glyphs sat half the leading away from where CSS puts
  them: high in a roomy line, low in a tight one, where a tall face overflowed
  only at the bottom.
  
  The ascent rule is `verticalMetricsFromTables` (new, additive, in
  `@weasel-js/font`): `OS/2` typo metrics when the font sets
  `USE_TYPO_METRICS`, otherwise `hhea`. Firefox and every Linux engine follow it;
  Chromium and WebKit on macOS read `hhea` regardless, and the edit overlay's
  measured correction covers the difference there. `gen-font` bakes the result
  into the atlas's `faceMetrics` block as `ascent` / `descent`, the outline
  parser reads the same values (and reports them as `OutlineFace.ascender`), and
  the canvas tier records the browser's own, measured at a 1000px em rather than
  at the 48px bake size. An atlas or custom parser that states no ascent and
  descent keeps the previous placement.
  
  Rendering changes: text in the bundled Inter at `lineHeight: 1.2` moves up by
  0.005 em. Canvas-tier faces move down by half their leading: Georgia by 1.3px
  and Arial by 1.7px at 40px. The committed Inter atlases are rebaked; the PNG is
  byte-identical.
- 40a418d: A bare HUD window whose interior passes (`titlebar: false, interior: 'pass'`) can be moved again: it grows a dotted grip strip across its top, sized by the new `metrics.grip` (14 CSS px by default), and dragging it translates the window. The interior still passes input, and the content rect now starts below the strip.
- 3ba513c: A HUD button's label now sits centered in the button. It used to be placed as though the text's `y` were a baseline, but a text command's `y` is the top of the line, so the label hung from just below center and its descenders reached the bottom edge. The button now centers the laid-out line box in its height, the way a window's title bar already did.
- bfc4b21: `attachHud` reuses a widget's draw commands across repaints until something
  it draws from changes, instead of asking every widget for fresh commands on
  every repaint. A static 10-glyph text widget used to rebuild its command, and so
  re-lay out its glyphs, on every frame.
  
  Additive. A widget opts in with the new `Widget.deps(ctx)`, which works like
  `RenderLayer.deps`: the HUD reuses the previous commands while every entry is
  `Object.is`-equal to the last call's, and also rebuilds when the widget's
  bounds, the theme, the default font, the canvas size or the widget's focus
  change. Every kit widget declares it, invalidated by its own setters and
  pointer state. A hand-written widget without `deps` is drawn on every repaint,
  as before; a widget declaring it must treat the commands it returned as
  immutable. A window's `content` painter is still called on every repaint.
  A text widget that only moved keeps its runs array, so its layout stays cached.
  
  `@weasel-js/core` exports `depsUnchanged`, the comparison `RenderLayer.deps`
  uses.
- bef8aec: HUD widgets take keyboard focus. Additive: a `Hud` now holds one focused
  widget (`focused`, `focus()`, `moveFocus()`, `tabOrder()`, `subscribeFocus()`),
  and a widget opts in with `focusable`, orders itself with `tabOrder`, names
  itself with `accessibleName`, and receives keys through `onKey`, returning
  whether it handled each one. A press on a focusable widget focuses it, a press
  anywhere else blurs, and Tab / Shift+Tab walk the focusable widgets while the
  canvas holds DOM focus. A key the focused widget handles never reaches the
  canvas's key bindings; one it declines falls through to them. Keyboard focus
  paints a ring in `--wzl-focus-ring`, and a polite live region announces the
  focused widget's name. Buttons are focusable by default and press on Enter or
  Space; pass `focusable: false` to opt one out.
- 6fe0a4d: The README now says when HUD text is cheaper than a DOM overlay and when it is not, from a new benchmark (`tests/perf/hud-vs-dom.spec.ts`). Documentation only; no API change.
- 3c1def2: `registerFont` takes a fifth argument, `{ lazy: true }`, which fetches nothing
  until text first lays out in that family — so a scene with no text never
  downloads the atlas. Until the atlas lands, a run set in the family lays out as
  nothing rather than in a fallback face's metrics, and `<SceneCanvas>` repaints
  it when the atlas arrives. The returned promise settles with that load, so it
  never settles for a face no text uses; don't `await` it at startup. New type:
  `RegisterFontOptions`.
  
  A family whose atlas is still fetching, eagerly or lazily, now outranks the
  outline tier and the `'substitute'` fallback while it loads: text waits for the
  real face instead of laying out in another one and reflowing when it arrives.
  The same holds for a registered-but-unloaded exact variant, which is no longer
  faked from a sibling weight in the meantime. `listFonts` and `listFontWeights`
  report lazily registered faces before they load.
  
  `@weasel-js/hud` registers its bundled Inter lazily, so attaching a HUD whose
  widgets draw no text no longer downloads it. `registerDefaultFont`'s promise now
  settles when a widget first lays out text.
- 9cad63b: The text edit overlay now sets its glyphs in the face the canvas draws. A family
  the canvas draws from a baked atlas or from outlines — `sans-serif` registered
  to Inter, say — used to reach the overlay as a bare CSS name, which the browser
  resolved to its own face (Helvetica on macOS), so "Hxgd" at 72px ended 12px
  short of the canvas. New `cssFontFamily(family, variant)` answers the CSS
  `font-family` for whatever the canvas draws: a private `FontFace` built from the
  family's `registerFontOutlines` file, with the family name as fallback. A family
  drawn through the browser (`registerCanvasFont`) comes back unchanged. An atlas
  with no font file cannot give the DOM its face, and says so once in the console;
  register the file it was baked from with `registerFontOutlines`.
  `OutlineFontOptions.cssSrc` names the `@font-face` source where the bytes won't
  do, and `enableLocalFontOutlines` sets it to `local(<PostScript name>)`.
  
  The bundled Inter atlas carries the font's own advances and kerning. It used to
  lay out on whole-pixel advances at its 32px bake size with no kerning at all, so
  "Hxgd" at 72px set 182.25px wide against the 179.44px every browser gives the
  same face, and "AVATAR" 22px wide of it. `gen:font` now writes advances at full
  precision and kerning pairs read from the font's GPOS table, and the atlas is
  rebaked from `inter.ttf`. Text set in it changes width slightly.
  
  Outline faces kern like a browser too. opentype.js skips GPOS extension
  lookups, which is where Inter keeps nearly all its kerning; the outline tier now
  reads pair kerning from GPOS itself.
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
- Updated dependencies [e54ff4f]
- Updated dependencies [1291788]
- Updated dependencies [27bcf57]
- Updated dependencies [a7f2103]
- Updated dependencies [edabd62]
- Updated dependencies [7be3713]
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
- Updated dependencies [e775a12]
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
  - @weasel-js/font@1.7.1
  - @weasel-js/theme@1.7.1
  - @weasel-js/paint@1.7.1
  - @weasel-js/loupe@1.7.1

## 1.7.0

### Patch Changes

- ca2f45f: Every click-versus-drag decision in the kit now reads one threshold, `DRAG_THRESHOLD_PX` (4 CSS pixels), through `pastDragThreshold`. Both now live in `@weasel-js/gestures`; `@weasel-js/routing` and `@weasel-js/core` re-export them as before. `useDragHandle` starts a drag at 4px instead of past 5px, labkit's `FloatingPanel` and the hud window's content click at 4px instead of 3px, and `startThresholdDrag`, `useReorderDragList` and `Select` default to the constant rather than their own literal 4.
  
  The move action's `dragThresholdPx` option works again: set as `selectTool.move.dragThresholdPx` on `<SceneCanvas>`, it holds the selection in place until the pointer has travelled that far on screen. It has been ignored since the `useMove` hook was removed. It cannot lower the threshold below the dispatcher's.
- Updated dependencies [05da5a4]
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
- Updated dependencies [1eac15b]
- Updated dependencies [52078c5]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [fc3de06]
- Updated dependencies [b8f2007]
- Updated dependencies [6357f14]
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
  - @weasel-js/theme@1.7.0
  - @weasel-js/core@1.7.0
  - @weasel-js/geom@1.7.0
  - @weasel-js/paint@1.7.0
  - @weasel-js/font@1.7.0
  - @weasel-js/loupe@1.7.0

## 1.6.1

### Patch Changes

- b209a8e: A feature installs from one entry. `SurfaceContribution` extends `Contribution` with `views` and `attach(api, deps)`, and `Contribution` gains `deps`; `<SceneCanvas ambient>` installs every role an entry declares and removes them with it. `mergeContributions` throws on a duplicate dep name or view id as well as a duplicate entry id.
  
  Bindings can be scoped to views with `opts.views`; a binding that names the view an input landed in outranks bindings that do not. `InvocationCtx.viewId` and `RuleCtx.viewId` carry that view, layer `data.viewId` names the view a draw is for, and the `rootView` dep answers the surface camera from inside a view.
  
  `createMinimapContribution` puts a minimap inside a canvas, with a linked crosshair, and `createLinkedCursorContribution` draws the crosshair alone. `<MinimapCanvas>` now runs on a dispatcher, publishes its pointer, and takes an `id`.
  
  Breaking: `PointerContextValue` is a store — `get`, `set`, `subscribe`, `getVersion` — in place of `pointerRef`, and `PointerWorldPos` carries `viewId`. `usePointerPosition()` follows it. `useHud`'s ref is optional; `useHudContribution(hud, options)` attaches the HUD as well as routing its input.
- Updated dependencies [b209a8e]
- Updated dependencies [7683659]
  - @weasel-js/core@1.6.1
  - @weasel-js/loupe@1.6.1
  - @weasel-js/font@1.6.1
  - @weasel-js/geom@1.6.1
  - @weasel-js/paint@1.6.1
  - @weasel-js/theme@1.6.1

## 1.6.0

### Patch Changes

- b1c30bc: The hud `window` takes a `stance` and a `tone`, like the kit's DOM panels, with `setStance` / `setTone` to change them. It draws them in WebGL from the resolved theme: the stance's `--wzl-stance-<stance>-<slot>` values restyle its fill, border and title, and the tone mixes into the fill in oklab. A numeric tone indexes the theme's tone list through the new `HudDrawCtx.toneAt`, which `attachHud` builds from its new `tones` option and `useHud` fills from the app's `<ThemeProvider>`. A widget drawn by hand, as in a test, now needs a `toneAt` in its draw context.
  
  `@weasel-js/theme` adds `resolveStanceSlots`, the stance lookup for a surface drawn without the cascade. `@weasel-js/paint` adds `mixOklab`, which matches CSS `color-mix(in oklab, …)`, alpha included.
- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [90a2d9b]
- Updated dependencies [04ff89b]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [1589afd]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [07b106f]
- Updated dependencies [f04faf6]
- Updated dependencies [0cf6a0d]
- Updated dependencies [a564aea]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [b1c30bc]
- Updated dependencies [5345efb]
- Updated dependencies [9e77264]
- Updated dependencies [497727a]
- Updated dependencies [5c6072f]
- Updated dependencies [87fd8a8]
- Updated dependencies [9aa63a1]
- Updated dependencies [f3d9d92]
- Updated dependencies [c24d2c7]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [5ad1478]
- Updated dependencies [08b80b8]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [6ce2bcb]
- Updated dependencies [959e5e5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [96a5302]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/theme@1.6.0
  - @weasel-js/paint@1.6.0
  - @weasel-js/loupe@1.6.0
  - @weasel-js/font@1.6.0
  - @weasel-js/geom@1.6.0

## 1.5.2

### Patch Changes

- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
- Updated dependencies [8081a6b]
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2
  - @weasel-js/font@1.5.2
  - @weasel-js/theme@1.5.2
  - @weasel-js/loupe@1.5.2

## 1.5.1

### Patch Changes

- a39a885: Themes are now authored as layered definitions and built by an engine, published as `@weasel-js/theme/engine`: seeds, generated ramps and scales, semantic rules (a step, an offset from another semantic, the first step that clears a contrast target, a reference), components and pins, any of which can vary by axis. `derive` produces a theme's tokens for one selection with provenance and validation issues, and `bake` folds every selection into a runtime `Theme`. weasel's own theme is `themes/weasel.json`, every value pinned, and emits the same CSS declarations as before. `toDTCG` in `@weasel-js/theme/engine` writes a theme back out as a DTCG document, with aliases written as paths through their type group (`{color.gray-800}`) so DTCG tools resolve them. A pin or component whose whole value is `{seeds.name}` takes that seed's value. labkit's interstellar theme is now `interstellar.theme.json`, a definition extending weasel.
  
  **Breaking.** A theme varies by *axes* rather than modes, and `mode` is one axis:
  
  - `resolveTheme(theme, selection?)` and `applyTheme(el, theme, selection?)` take `{ mode: 'light' }` instead of `'light'`; a missing axis takes its default. `applyTheme` stamps one `data-wzl-<axis>` attribute per axis.
  - `<ThemeProvider selection={{ mode }}>` replaces `mode`, and `useTheme()` returns `selection` instead of `mode`.
  - `Theme` holds `axes` and `tokens` (each token plain or `{ by: 'mode', dark, light }`) instead of `defaultMode`, `tokens` and `modes`. Read an axis default with `themeAxes(theme).mode.default`.
  - `defineTheme` takes `{ name, extends?, axes?, components?, pins? }`, where a pin or component is a value or `{ value, type, alpha, description }` and references are written `{token}` (not `{color.token}`). It throws on a definition with rules; bake those with the engine. `extends` is a `Theme`: passing a definition's name (`'weasel'`) throws and says to pass the `Theme`.
  - A theme that redeclares an axis its parent declares keeps the parent's values: the child's entries for a shared value and the child's default win, and a value only the parent has still resolves through the parent. A DTCG document with only a `dark` mode now resolves `light` from the theme it extends.
  - `THEMES.<name>.modes.<mode>` is now `THEMES.<name>.selections['mode=<mode>']`. `THEME_SOURCES` holds definitions, `BAKED_THEMES` is new, and `TokenInput` and `ThemeSource` are removed.
  - `GeneratedTheme.defaultMode` is replaced by `axes`.
  - `tokens.css`'s `:root` declarations and `TOKEN_MANIFEST`'s rows are in layer order — ramps, scales, semantics, components, then other pins. The values are unchanged, but token browsers list them in the new order.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
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
- Updated dependencies [dda4172]
- Updated dependencies [a39a885]
- Updated dependencies [55b5524]
- Updated dependencies [045998f]
- Updated dependencies [56cad3a]
- Updated dependencies [f9f41e2]
- Updated dependencies [fa56d1e]
- Updated dependencies [272ab0d]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [e0799cb]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1
  - @weasel-js/theme@1.5.1
  - @weasel-js/loupe@1.5.1
  - @weasel-js/font@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Patch Changes

- efaf707: A loupe can now be edited through. `createLoupe({ views: api, interactive: true })` makes the lens a view on the canvas: a press inside it selects the node it magnifies, and a drag moves that node by the pointer travel divided by the magnification. With `views` alone the lens paints the canvas's own stack but keeps its clicks as an eyedropper; with `source` alone it is the picture it was. A lens given `views` reads back from its canvas's `getSurfaceRect()`, so over a `paintInto` pane it samples that pane without a `region`.
  
  Views gained what that needed. `SceneCanvasApi.addView` declares a `<CanvasView>` from outside React, and its `paint: false` hands the drawing to a host such as a HUD window. `<CanvasView view>` accepts a thunk for a camera derived from the canvas's, and `interactive={false}` makes a view paint-only. A registered layer painted over a view — a HUD window over a panel — now takes presses there instead of the view beneath, and a view no longer hit-tests registered layers it does not paint.
  
  `hud.window({ interior: 'pass' })` gives the interior's input to what it shows while the frame stays chrome.
- c758b4d: The loupe reads the pixels it is aimed at. Two fixes:
  
  - **Its color comes off the frame after the aim.** `loupe.color` and `onColorChange` were read at aim time, which returns the frame before the aim. They now settle on the next frame to land. `pick()` still answers immediately, and now returns `null` if no frame has landed yet. On `@weasel-js/loupe`, a `LoupeSurface` that offers `subscribeFrame` gets this deferred sampling; a surface without it is sampled at aim time, as before.
  - **It works over a pane of a shared canvas.** `CanvasExtensionApi.getSurfaceRect()` returns the rect of `surface` the canvas paints into: the pane's rect under `paintInto`, otherwise the whole canvas. Pass it as `createLoupe`'s new `region` option. The readback then offsets the aim by the pane's origin and stays inside the pane. Before, the loupe over a `paintInto` pane magnified whatever sat at the same offset from the shared canvas's corner.
  
  Anything that implements `CanvasExtensionApi` by hand now has to supply `getSurfaceRect`.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [35e36b1]
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
  - @weasel-js/theme@1.5.0
  - @weasel-js/geom@1.5.0
  - @weasel-js/loupe@1.5.0
  - @weasel-js/font@1.5.0

## 1.4.4

### Patch Changes

- Updated dependencies [9ce6f00]
- Updated dependencies [d80a7eb]
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
  - @weasel-js/theme@1.4.4
  - @weasel-js/font@1.4.4
  - @weasel-js/loupe@1.4.4
  - @weasel-js/geom@1.4.4

## 1.4.3

### Patch Changes

- 4e5fd95: A HUD can draw with a family the host already registered, instead of fetching
  its own copy of the same atlas.
  
  Every weasel app registers Inter for its own text; `@weasel-js/hud` registered a
  byte-identical second copy for its widgets. Measured on the demo site: 152,162
  wasted transfer bytes, two wasted requests and a second `createImageBitmap` over
  bytes already in memory.
  
  `attachHud` and `useHud` take `font`:
  
  - a family name — that family, already registered by the host. Nothing is
    fetched.
  - a `{ metricsUrl, atlasUrl }` pair — the HUD's own family, registered from the
    host's copy of the atlas.
  
  Unset, the bundled atlas is fetched as before. The demos and WeaselDraw pass
  `font: 'sans-serif'`; their HUD canvases render pixel-identically with the atlas
  fetch gone.
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
  - @weasel-js/loupe@1.4.3
  - @weasel-js/font@1.4.3
  - @weasel-js/geom@1.4.3
  - @weasel-js/theme@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies [bfb0595]
- Updated dependencies [3b07b13]
- Updated dependencies [8e9eb1d]
  - @weasel-js/core@1.4.2
  - @weasel-js/loupe@1.4.2
  - @weasel-js/font@1.4.2
  - @weasel-js/geom@1.4.2
  - @weasel-js/theme@1.4.2

## 1.4.1

### Patch Changes

- 88401f7: Read the loupe's magnified pixels on the frame that painted them.
  
  Pixel mode called `gl.readPixels` straight off an aim change. Since the frame loop landed that is a moment with no paint behind it, so the lens showed the scene as it was one frame earlier — visible as a magnifier that lags whatever is being dragged under it.
  
  The readback now happens from a frame subscription instead: an aim marks the lens dirty, and the next landed paint takes the sample. Coalescing is unchanged in effect — a refresh wanted while a bitmap is in flight survives until a frame finds it settled, so a fast drag still reads the aim it ends on.
  
  Breaking for anyone building a `HudHost` by hand: it now requires `subscribeFrame(fn): () => void`, the same contract `CanvasExtensionApi` already exposes. `attachHud` passes the canvas's straight through, so consumers going through `useHud` / `attachHud` need no change. `Hud` gained a `subscribeFrame` of its own, which survives bind and unbind: a subscription taken before the HUD is bound starts firing when it is.
- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [47c75ca]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1
  - @weasel-js/theme@1.4.1
  - @weasel-js/loupe@1.4.1
  - @weasel-js/font@1.4.1
  - @weasel-js/geom@1.4.1

## 1.4.0

### Patch Changes

- 1214ff5: Split a canvas's paint target from its input target.
  
  `<SceneCanvas paintInto={{ canvas, x, y }} inputElement={el}>` paints into a
  rect of a canvas you own and takes pointer input from an element you own, so N
  canvases share one GL context and one buffer. Each needs its own
  `<WeaselProvider isolate>`.
  
  The ref handle names both elements: `element` is where input, focus and the
  cursor live, and is now typed `HTMLElement` because detached it is not a canvas;
  `surface` is where pixels land. Attached, they are the same `<canvas>` and
  `element` keeps working as before. The HUDs render when detached too, anchored
  to the input box rather than to the shared surface every pane sits in.
  
  Breaking, narrowly: `createLoupe`'s `element` option is now `canvas`, with an
  optional `input` for the element aim is measured against.
  `CanvasExtensionApi.element` no longer satisfies an `HTMLCanvasElement` — read
  `surface` for pixels. And `clientToWorld`'s first parameter widens to
  `HTMLElement`, which stops compiling for a consumer who annotated that parameter
  as `HTMLCanvasElement`; one who let it infer is unaffected.
  
  <!-- bump-approved: minor: Mike — the labkit annotations arcs 1-4 (a shared drawing surface, a mark store, the overlay, and capture/export) plus this split of a canvas's paint target from its input target, on top of ~30 patch changesets carrying new public surface across core, ui and labkit; called explicitly in conversation on 2026-09-03: "we were going to cut a 1.4.0-pre release" -->
- 0d0c885: Split the loupe's model out of its painter
  
  The loupe was a WebGL widget all the way down: `createLoupe` held both the
  state a magnifier has — where it is aimed, how far it magnifies, whether it is
  showing a re-render or actual pixels, what colour it is over — and the code
  that draws that into a HUD window. None of the first half is about GL, and a
  surface that is not a WebGL canvas could not have any of it.
  
  `@weasel-js/loupe` is the model on its own. It asks a `LoupeSurface` five
  questions — where is the lens, does it cover this point, what colour is here,
  can anyone still see it, and please repaint — and answers with aim, factor,
  mode, colour and picking, including the freeze rule that keeps a stationary
  lens' own borders reachable and the refusal to report a lens' chrome as
  artwork. The pure geometry (`loupeInnerView`, `loupeSourcePoint`) moved with
  it.
  
  `createLoupe`'s API is unchanged; it is now a painter over that model, and
  `@weasel-js/hud` re-exports `loupeInnerView` from its new home. A painter for
  a surface that is not a WebGL canvas no longer has to reimplement a magnifier
  to exist.
- a7fa697: Add an anchored-placement solver and keep HUD windows on their host.
  
  `@weasel-js/geom` gains `placeRect` and `clampRectWithin`. `placeRect` resolves an
  overlay against an anchor: it picks a side, flips to the opposite one when the
  preferred side has no room, and slides along the alignment axis to stay inside a
  boundary. `clampRectWithin` is the containment half on its own — move a rect the
  shortest distance that puts it inside a boundary, keeping its size. Both are pure
  and take an explicit boundary rect, so a boundary that does not start at the
  origin resolves correctly.
  
  A HUD window could previously be dragged fully off its host with no way to
  recover it: `createWindow` clamped size but never position. Move drags and
  `setBounds` now keep the window on the host. Resize drags are deliberately left
  alone, so pulling an edge past the host does not fight the gesture.
  
  `@weasel-js/core` gains `hostAnchorRect`, `hostAnchorCss` and `useHostAnchor`,
  which hold a fixed-position panel against a host element's corner and keep it
  inside the viewport. The corner is an alignment per axis rather than a fixed
  one, and `useHostAnchor` takes a function that resolves the host, so a host held
  in a ref and one found by selector work the same way.
  
  `hostAnchorCss` pins whichever edges the alignment names. That is not cosmetic:
  a panel whose width tracks its content holds the anchored edge still and grows
  away from it, so pinning the wrong edge makes the anchored corner drift on every
  content change.
  
  Four places were carrying their own copy of that anchor math and now share this
  one — `CursorCoordsHud`, `PickHud`, `ModalityHud`, and WeaselDraw's
  `DispatchTracePanel`, which anchors the opposite corner. None of the four
  clamped, so a panel could hang off the edge when the host was scrolled or the
  panel was tall.
- Updated dependencies [eb16573]
- Updated dependencies [72b30cc]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [36b6ee7]
- Updated dependencies [7a0c568]
- Updated dependencies [0d0c885]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [53ffca9]
- Updated dependencies [8ddec11]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0
  - @weasel-js/theme@1.4.0
  - @weasel-js/loupe@1.4.0
  - @weasel-js/geom@1.4.0
  - @weasel-js/font@1.4.0

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
- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.
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
- Updated dependencies [9977908]
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
- Updated dependencies [0769eea]
- Updated dependencies [c534ff5]
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
  - @weasel-js/font@1.3.0
  - @weasel-js/core@1.3.0
  - @weasel-js/theme@1.3.0

## 1.2.0

### Patch Changes

- daa5ce6: Add a source rect and flip to `ImageDrawCommand`, so one bitmap can be drawn as
  many frames.

  `source` is a sub-rectangle in bitmap pixels; `flipX` / `flipY` mirror the
  sampled region within the destination rect without moving the quad. Both are
  additive and optional — a command that sets neither draws exactly as before.
  Until now a sprite sheet needed a custom `ShaderDrawCommand` to do what is
  arithmetic on the quad's four UV pairs.

  `source` is not range-checked: a rect past the bitmap edge samples outside
  `[0..1]`, which `CLAMP_TO_EDGE` smears. With `sampling: 'linear'` the filter
  also reaches half a texel beyond `source`, so an atlas whose frames touch will
  bleed at the seams — pad frames with a gutter or use `'nearest'`. The renderer
  deliberately does not inset for this, which would make an exact 1:1 blit soft.

  New `frameRect(sheet, index)` and the `SpriteSheet` type turn a uniform grid
  (`frameWidth`, `frameHeight`, `columns`, optional `margin` and `spacing`,
  following the Tiled / Aseprite convention) into that source rect. It is
  row-major from 0 and does not wrap past the last cell — wrapping belongs to the
  animation, since a sheet does not know how many of its cells are filled.

  `@weasel-js/hud`'s image widget takes `source`, `flipX` and `flipY` as options
  and gains `setSource` and `setFlip` to change them in place. `setFlip` merges,
  leaving an omitted axis alone. Without the setters a sprite animation would
  have to dispose and rebuild the widget every frame.

- bab8191: Pick a color by clicking inside the loupe, and stop pixel mode from leaving a
  hole while it waits for its first readback.

  `createLoupe` gains `onPick` and `LoupeHandle.pick(p?)`: the color the lens is
  showing at a point, read off the framebuffer the same way the aim-point readout
  is. It maps the lens point back through the magnification — `loupeSourcePoint`
  inverts `loupeInnerView` — so picking near the edge of a 16× lens picks the
  pixel it draws there, not the one under the click. Where the color goes is the
  consumer's; WeaselDraw sends it to the focused swatch and the selection.

  A pick declines when the mapped point lands under the window itself, which can
  happen with the aim close alongside the frame: the framebuffer holds the window
  too, and reading there would report chrome as artwork.

  Telling that click from the drag is `WindowOptions.onContentClick`, new on the
  window widget — a press and release in the interior that never travelled more
  than a few pixels. A bare window's interior is also its move handle, so the two
  had to be separable before the loupe could take clicks at all.

  Pixel mode now paints the backdrop in every frame rather than only once a
  bitmap exists. Before the first readback settles — and whenever one comes back
  transparent — the lens had been painting nothing at all, which reads on screen
  as a window with the unmagnified canvas showing through it.

  - @weasel-js/font@1.2.0
  - @weasel-js/theme@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [2d30a32]
  - @weasel-js/theme@1.1.0
  - @weasel-js/font@1.1.0

## 1.0.4

### Patch Changes

- 27b8e69: Correctness and keyboard fixes across `@weasel-js/ui` and `@weasel-js/hud`

  `Select` and `ComboBox` converted a controlled `selectedKey={null}` to
  `undefined`, which is React Aria's signal for _uncontrolled_. Clearing a
  selection therefore left the old value on screen and logged a
  controlled-to-uncontrolled warning. `SelectionPanel` hits this on every mixed
  enum property. Both now pass `null` through.

  `DataGrid`'s reorder hook measured rows against the wrapper `<div>`, whose only
  child is the `<table>`, so every drop reported the same index. The ref moves to
  `<tbody>`. Sortable headers become real buttons carrying `aria-sort`, and the
  drop indicator is a class on the target row rather than a hard-coded 28px
  offset.

  `useReorderDragList` treated the first locked row as a ceiling for the whole
  list, so a row _below_ a locked one could be dropped above it. A drop is now
  clamped to the run between the nearest locked rows either side of the grabbed
  row, and a multi-selection drops the members that sit past the wall.

  `Slider` ignored `constraint: 'ordered'` on the keyboard path — End sent a
  thumb straight past its neighbor. It also left its `document` listeners
  attached after `pointercancel` and after unmounting mid-drag, so a thumb kept
  tracking a released pointer, and a press did not focus the thumb the arrow keys
  are bound to.

  `BandEditor` had the same drag-teardown gap. Its `x` / `Delete` merge fired
  from anything inside a band — including typing `x` in a consumer's input and
  pressing Cmd+X — and its seams ignored Home/End.

  `GradientHandles` committed the mount-time handle position when a handle was
  clicked without moving, and committed the abandoned position on
  `pointercancel`. A press that never moves now writes nothing, a cancel restores
  the live preview, and the handles respond to the arrow keys. Their `role`
  drops from `slider`, which requires an `aria-valuenow` a 2-D position does not
  have, to `button`.

  `CurveEditor`'s `endpoints="pinned-both"` snapped an endpoint to the range
  corner on the first drag instead of holding it still.

  Every overlay the package renders into a portal — `ComboBox`, `Callout`,
  `Tooltip`, `Dialog`, alongside the `Select` popover that already did — carries
  `data-weasel-overlay`, the marker consumers use to ask whether focus left their
  component.

  In `@weasel-js/hud`: detaching left the hovered widget believing the pointer
  was still over it, and `hovermove` fired only on entry, so its `x`/`y` froze
  for the rest of the hover. The six widget factories ignored the detached-HUD
  guard `add()` enforces. `Widget` gains an optional `disposed` flag, which lets
  a loupe whose window is removed through the HUD stop reading pixels back and
  release its listener; `aimAt` after `dispose` is now a no-op.

- Updated dependencies [d36953e]
  - @weasel-js/font@1.0.4
  - @weasel-js/theme@1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [5d25a40]
- Updated dependencies [514c34a]
  - @weasel-js/font@1.0.3
  - @weasel-js/theme@1.0.3

## 1.0.2

### Patch Changes

- 5fea43d: Five unrelated small fixes.

  A tapered stroke with `align: 'inner'` or `'outer'` on a polygon path painted
  at half its requested widths. That alignment renders by tessellating at twice
  the width and stencilling half away, and the doubling reached `stroke.width`
  but not `vertexWidths`. The doubled array is memoized per source array, since
  the ribbon cache compares it by reference.

  An image insert previews the decoded bitmap inside the drag bounds instead of
  committing on release with no preview at all. It falls back to the bare
  outline until the image decodes, and `useImageTool({ preview: 'outline' })`
  opts out of the bitmap entirely.

  A HUD widget that claims the pointer reports a `'pointer'` cursor without
  implementing anything — hovering one while a drawing tool was active used to
  keep showing that tool's cursor. The rule is keyed on the `claims` every
  widget already declares, so it covers consumer-authored widgets too;
  decoration claims nothing and the hit walk descends past it. A widget's own
  `cursorAt` still wins, and `button` takes a `cursor` option that feeds it.

  `composeAffordanceLayer`'s `hitTest` returns a `LayerHit`, carrying the hit
  region's declared cursor and claim instead of dropping them. `AffordanceRegion`
  gains optional `strength` / `claimedKinds` to declare that claim.

  `ToolPalette` uses the shared `useRovingTabIndex` rather than its own container
  handler, so arrow keys skip tools that are ineligible in the current mode and
  the tab stop no longer sits on one. `ToolButton` takes an `onKeyDown`.

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

- Updated dependencies [24daa08]
  - @weasel-js/font@1.0.2
  - @weasel-js/theme@1.0.2

## 1.0.1

### Patch Changes

- @weasel-js/font@1.0.1
- @weasel-js/theme@1.0.1

## 1.0.0

### Major Changes

- 43482ce: A registry entry declares what it contributes and when it is eligible.

  `Contribution` is the entry type: `bindings`, `actions`, an `overlay`, a
  `presentation`, each optional and independent. `Tool<TScratch>` is now the
  **focus-declaring case** of one — it keeps only what a mode the user switches
  into needs (`initScratch`, the lifecycle hooks, the preview hooks, a `cursor`
  closing over its own scratch). An entry that only routes input declares only
  bindings and actions, which is what `@weasel-js/hud` always was.

  `Eligibility` is a set of conditions rather than one value, because one entry
  holds several: the hand tool is palette-selectable _and_ space-held. `focus`,
  `offhand: HotkeyTrigger`, `always`, `claimed`, plus `capabilities` as a modality
  filter — `@weasel-js/modes` now reads its tags from there. The scope tier a
  binding matches at is derived from whichever condition is live, ordered to match
  the dispatcher's existing hotkey > active > ambient walk. Nothing about that
  walk changed; what changed is that an entry lands in a tier because of what it
  declares about itself rather than which argument a consumer passed it in.

  `useContributions` is the assembly point, and `useTools` is a shim over it with
  its shape unchanged.

  **Breaking — `@weasel-js/hud`:** `createHudTool` / `useHudTool` are now
  `createHudContribution` / `useHudContribution`, with no alias. The old names were
  half of the same misstatement as the `as unknown as Tool<null>` cast they
  required; keeping them would preserve exactly what this corrects.

  **Breaking — `DispatcherContext.ambientToolIds` is removed.** A host driving the
  dispatcher directly declares `eligibility: { always: true }` on always-on entries
  instead. `useTools` consumers are unaffected; the shim sets it.

  **Behavior — a declared held-key trigger now wires itself.** `ToolDef.hotkey` was
  read by the inspector and wired nothing; the engagement lived in a host-side
  registration keyed by tool id (`BUILTIN_OFFHAND_ACTIONS`, now gone). Assembly
  registers the consolidated `tool.offhand` action from the declarations, so a tool
  that wants space declares it — `useHandTool` does. A host that also registered
  `tool.offhand` by hand should stop.

  **Behavior — `useTools` returns shallow copies** for ambient entries and
  `hotkey`-declaring tools, since it adds the declaration they were missing.
  Registry tools from `defineTool` are returned unchanged.

  **Behavior — route-conflict reporting now also sees action `defaultBinding`s.**
  The dispatcher always matched against them; the reporter never saw them, so a
  tool binding colliding with an action default went unreported. It no longer does.
  Dispatch is unchanged.

  Also added: `mergeContributions(...bundles)`, which concatenates and throws on a
  duplicate id rather than silently dropping one — the recorded plugin/bundling v1,
  whose deferral condition was "≥2 plugin-shaped features in flight."

  **Not done, so the seam is stated rather than implied:**
  `EligibilityState.heldTriggers` exists and `liveScope` honors it, but nothing
  populates it. `tool.offhand`'s invoker still reports engagement by pushing a tool
  _id_, which `engagedIds` reads, so the declaration registers the binding while
  the id carries the tier. Retiring that means changing `tool.offhand`'s contract.

### Minor Changes

- 8853e73: Affordance hits are claims, and an exclusive claim outranks the scope tier.

  `AffordanceHit` gains `strength`, and `owner` naming what produced the hit. Kit
  chrome claims `'shared'`, which is what it always did: compete on scope and
  specificity. Registered layers, whose hits previously flattened to a bare kind
  string and a payload, now return a `LayerHit` that can also carry `cursor` and
  `strength`, so a consumer's own chrome says the things kit chrome already said
  through `AffordanceRegion`. `owner` is groundwork — nothing binds on it yet, and
  today only diagnostics read it; target it with `kindOf` or `affordance:<kind>`.

  **Behavior change.** When a press carries an exclusive claim, only bindings
  whose `target` consults the affordance — a `kindOf` predicate, or the
  `affordance:<kind>` string form — are candidates. Scope ordering applies within
  that filtered set, unchanged. Body-class targets (`'empty'`, `'selected-body'`,
  `'unselected-body'`) and `kind:` targets resolve from the body classification
  and never see the affordance, so they no longer win presses on chrome floating
  over the body they name.

  This is the dispatcher rule the previous release's changeset said was the real
  fix. `select`'s marquee no longer needs its hand-written predicate declining
  chrome affordances, and it is deleted; `rect`, `ellipse`, `polygon`, `star`,
  `hand`, `pen` and `lasso` keep their bare `{ kind: 'drag' }` bindings and stop
  swallowing drags on HUD chrome anyway, which is the point — seven copies of a
  predicate was the alternative. (`select`'s _click_ binding keeps a predicate of
  its own, for an unrelated reason: resize and rotate bind only drag, so a click
  exactly on a handle would otherwise clear the selection.)

  The filter is hard: if an exclusive claim leaves nothing eligible, the press
  does nothing. A dev-only warning names the owner the first time that happens for
  each owner, because the failure is otherwise silent.

  **What a claim does not reach.** Only gestures that carry an affordance are
  filtered, and keyboard events never do. Which pointer-family gestures carry one
  is settled by the per-kind claim work later in this release — see "A widget
  declares which gestures it consumes." The filter outranks hotkey scope as well
  as active scope, so holding space to pan no longer pans while the pointer is
  over HUD chrome.

  `@weasel-js/hud` claims exclusively, and `Widget` gains `cursorAt(x, y)`, which
  resolves a cursor per point rather than from hover state; `hud.window()`
  implements it, so hovering a resize band shows `nwse-resize` instead of the
  active tool's cursor. A widget can also stay transparent to input — `rect`,
  `text`, `label` and `image` are decoration — so a backdrop widget no longer
  eats presses meant for the canvas or for widgets beneath it. That occlusion
  predates this release, but an exclusive claim would have widened it from "HUD
  elements occlude each other" to "HUD elements kill every tool underneath."

  `WindowWidget.cursor` is removed. Nothing read it; `cursorAt` replaces it.

- 40dd97d: A widget declares which gestures it consumes, and a claim bars only those.

  A HUD widget could be pressed, dragged and hovered and nothing else. The gap
  was in the dispatcher: `affordanceAt` ran on `pointerdown` and hover only, so
  `doubleclick`, `contextmenu` and `wheel` carried no affordance and no binding
  could gate on one. All four now do — `doubleclick` replays it from its press,
  `contextmenu` classifies its own position (a secondary button never reaches
  `onPointerDown`, so there is nothing to replay from) and gains world
  coordinates it never carried, and `wheel` classifies the point under the
  cursor. The immediate-invoker param bag, which forwarded position for `click`
  and `pointerdown` only, now covers `contextmenu`, `longpress` and the
  affordance on all four.

  **Behavior change, and the reason for the rest of this entry.** An exclusive
  claim previously meant _this pixel is mine_. Under that rule, giving `wheel` an
  affordance would have killed scroll-to-zoom over every floating panel. It now
  means _these gestures are mine_: `LayerHit` and `AffordanceHit` gain
  `claimedKinds`, a set over the new `ClaimableGesture` union (`'pointer'` —
  covering `pointerDown` / `click` / `drag`, one press protocol — plus
  `'doubleClick'`, `'contextMenu'`, `'longPress'`, `'wheel'`). Omitting it bars
  everything, which is what an exclusive claim did before.

  `Widget.claims` is that set. Absent means every kind but `wheel`, so
  right-clicking or double-clicking HUD chrome stops acting on the scene
  underneath while scroll-to-zoom over a panel is unchanged; a widget that wants
  the wheel asks for it. `claims: []` is decoration and replaces `claimsPointer`,
  which is removed. `HudPointerEvent` gains `doubleclick`, `contextmenu`,
  `longpress` and `wheel` arms.

  `PointerClaim` and `onPointer`'s return type are removed. The return was
  discarded at every call site, and it cannot be made live: the claim filter runs
  at match time, before any widget is consulted, so there is no later moment at
  which returning `'pass'` could restore a binding the filter already dropped.

  **Two matcher fixes this depends on.** `doubleClick` and `contextMenu` passed
  the DOM target to `matchTarget` where `click`, `drag` and `longPress` pass the
  affordance; a `kindOf` predicate on either kind therefore received an element
  no predicate in the kit expects. They now match the others. And the kit's body
  predicates — `isBody`, `isSelectedBody`, `isUnselectedBody`, `isEmpty` — carry
  `readsAffordance: false`, which `targetConsultsAffordance` honors. Each has a
  `kindOf` but reads only `bodyTarget`, so the filter inferred that they consult
  the hit and let them survive a claim; with `doubleclick` now carrying one,
  `enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit mode
  on a double-click over chrome.

  `WheelSpec` gains `target`, and `wheel` gains a route-grammar target slot —
  a wheel binding could not gate on anything at all before.

- 531150f: A loupe, and the window primitive it needed.

  `hud.window()` is a draggable, resizable frame drawn in WebGL over the canvas —
  titlebar, eight resize bands, close box. It paints no interior. Interiors come
  from a new optional `content` painter on `Widget`, which `attachHud` draws
  beneath every widget frame in the same layer, clipped to `contentRect`. That
  painter receives `HudContentCtx`, carrying the scene data and view the hud layer
  was already handed; `HudDrawCtx` stays data-free, so widgets remain renderable
  headlessly. Painter commands are in absolute canvas coordinates — the group
  carries a clip, not a transform.

  `createLoupe()` is the first consumer: a window whose interior shows either the
  scene re-rendered through a magnified inner view, or the actual framebuffer read
  back and magnified 1:1. Both modes exist because neither answers both questions
  honestly — a re-render is crisp at any magnification but its antialiased edge
  colors are not the colors on screen, so the hex readout samples the framebuffer
  in either mode. The frame stays parked and the pointer aims it; content freezes
  while the pointer is over the window, which is what keeps the borders reachable.
  Aiming uses its own `pointermove` listener rather than hud hover, because hud
  hover comes from the layer's `onUncapturedMove` and stops during a captured drag
  — exactly when a magnifier is most wanted.

  Also fixed in the HUD: `hud.drag` pumped **world** coordinates into widgets
  while `hud.press` sent screen coordinates, because the dispatcher builds
  move/end contexts with an empty dep bag and the `view` lookup silently fell
  through. Invisible at zoom 1, and a window that jumped and tracked backwards at
  any other zoom. The drag action now captures its deps at gesture start.

  `ImageDrawCommand` gains `sampling: 'linear' | 'nearest'`, applied per draw at
  bind time rather than at upload, since `GLImageCache` keys textures by bitmap
  identity. Without `nearest`, magnifying a framebuffer readback comes back
  blurred, which defeats the readback.

  **Behavior change in `@weasel-js/core`:** the select tool's area-select drag now
  declines presses that a registered layer's hit-test claimed. It bound
  `{ kind: 'drag', target: 'empty' }`, and the string form of `target` resolves
  from the body only — chrome floating over empty canvas read as empty canvas, so
  area-select swallowed drags on HUD widgets. The adjacent `clearSelection` click
  binding already had the correct shape. Other tools that bind a bare
  `{ kind: 'drag' }` still have this hole.

- 6855465: Themes are values you can define, extend, and apply.

  `defineTheme` / `resolveTheme` / `applyTheme` / `loadDTCG`, plus a React
  binding at `@weasel-js/theme/react`. A theme extends the built-in one by
  default, so a partial theme can't be incomplete; overriding a primitive
  rebases every alias that references it. `applyTheme` stamps data attributes
  and adopts a rule block rather than writing inline properties, so the cascade
  still does the work and per-subtree overrides are just a different theme name.

  The WebGL HUD no longer reads CSS custom properties through
  `getComputedStyle`. It receives the same resolved record the stylesheet was
  built from, which also makes headless rendering themeable for the first time.
  `readTokens` and `ResolvedTokens` are gone from `@weasel-js/hud`; use
  `ResolvedTheme` and pass a theme to `attach`.

  The sixteen deprecated `--wzl-*` aliases are removed (264 call sites migrated).
  Three were never aliases and became real semantics: `--wzl-fg-inverse`,
  `--wzl-surface-hover`, `--wzl-surface-pressed`.

### Patch Changes

- Updated dependencies [5debfac]
- Updated dependencies [6855465]
  - @weasel-js/theme@1.0.0
  - @weasel-js/font@1.0.0

## 0.8.0

### Patch Changes

- Updated dependencies [0d5cdc4]
- Updated dependencies [e264d62]
  - @weasel-js/theme@0.8.0
  - @weasel-js/font@0.8.0

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
  - @weasel-js/font@0.7.2
  - @weasel-js/theme@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [6af4806]
- Updated dependencies [a3af158]
  - @weasel-js/font@0.7.1
  - @weasel-js/theme@0.7.1

## 0.7.0

### Minor Changes

- d3e5597: Extract the MSDF glyph tier into a new `@weasel-js/font` package: font
  registry, atlas parsing, glyph layout, runtime rasterization, and the SDF
  text shader source. `@weasel-js/core` depends on it; `registerFont` is still
  re-exported from `@weasel-js/core/renderer`, so existing call sites keep
  working.

  Unregistered font families now render in the default family with a one-time
  warning instead of rendering nothing. Configure with
  `setFontFallbackPolicy('substitute' | 'canvas' | 'none')` — `'none'`
  restores the previous hard-miss behavior, and `'canvas'` rasterizes the real
  typeface at runtime when the browser has it. A family the `'canvas'` policy
  enrolled for itself stops being canvas-served once the policy changes; one
  you name with `registerCanvasFont` is served under every policy, and
  `isCanvasFont` reports that distinction — it answers "will the dynamic tier
  serve this family right now", so an auto-enrolled family reads `false` under
  `'substitute'` and `'none'`. The default
  family may be a canvas-registered family, and when it cannot serve the
  request either, the resulting blank text is reported with its own warning
  naming the default family rather than failing silently. Requesting the
  default family itself also warns — whether it is registered at a variant it
  can't serve, or `setDefaultFontFamily` named a family that was never
  registered at all; either way there is nothing left to fall back to. An app
  that has registered no fonts and set no default stays silent, since that is
  not a misconfiguration.

  `ResolveResult.substituted` reports the substitution structurally, and
  `ResolveResult.resolved` now
  carries the matched `family` alongside `weight` and `style` — the full atlas
  identity to pass to `getFont` / `textureCacheKey`.

  Adds `listFonts()` for enumerating registered families.

### Patch Changes

- Updated dependencies [d3e5597]
- Updated dependencies [a925117]
- Updated dependencies [eeae450]
  - @weasel-js/font@0.7.0
  - @weasel-js/theme@0.7.0

## 0.6.0

### Patch Changes

- @weasel-js/theme@0.6.0

## 0.5.1

### Patch Changes

- 5a741be: Ship the TypeScript declarations that `ui` and `hud` already advertised.

  `@weasel-js/ui@0.5.0` and `@weasel-js/hud@0.5.0` were published with no `.d.ts`
  files at all, while their `exports` maps pointed `types` at `./dist/index.d.ts`.
  Consumers got an implicitly-`any` module.

  Both packages build as `vite build && tsc -p tsconfig.build.json`. Vite's
  `emptyOutDir` deletes the declarations the previous run emitted, but tsc's
  `--incremental` state (inherited from the repo root) still recorded them as
  emitted, and plain `--incremental` compares input signatures without checking
  whether the outputs are still on disk. So every build after the first emitted
  nothing and exited 0. A cold CI checkout only ever builds once, which is why
  this never went red. Their declaration builds are no longer incremental.

  Two gates now cover the class rather than the instance: `npm run check:manifests`
  refuses to publish a package whose `exports`/`types` map names a file that
  `npm pack` would not include, and the consumer smoke test type-imports both
  packages so a missing declaration surfaces as TS7016.

  - @weasel-js/theme@0.5.1

## 0.5.0

### Patch Changes

- @weasel-js/theme@0.5.0
