# @weasel-js/icons-plugin

## 1.19.0

### Patch Changes

- ea921e3: An app build refuses an icon ref such as `core:toString` that names an `Object.prototype` member its table does not hold.
  
  <!-- entry: rank=-5 fix -->
- ad30c8b: An app build writes the same `virtual:weasel-icons` bytes from the same modules, whatever order its transforms ran in.
  
  It reads icon tables in module id order, so two tables of one namespace that disagree on a glyph settle on the same one every build.
  
  <!-- entry: fix -->
- f1bba9d: An app build fills in a `virtual:weasel-icons/<name>` module whose variant or namespace name holds a quote, a backslash, or a lone surrogate.
  
  <!-- entry: rank=-5 fix -->
- 5d67043: A library build re-annotates an icon ref that a chunk spells with escapes, as ASCII-only output does. An `icon()` name holding a lone surrogate is written escaped, so it reaches the output unchanged.
  
  <!-- entry: fix -->
- Updated dependencies [3b3289a]
- Updated dependencies [fbb67d5]
- Updated dependencies [68383ed]
  - @weasel-js/icons@1.19.0

## 1.18.2

### Patch Changes

- 7a7a239: `icon()` calls through a parameter or local declaration that shadows the imported `icon` (or its alias) are no longer rewritten as icon refs; only calls that resolve to the import are.
- @weasel-js/icons@1.18.2

## 1.18.1

### Patch Changes

- 39bac06: Fixes from bug-audit round nine in the devtools panel and the icons build plugin.
  
  - `weaselIcons` now follows an `icons.gen` import written through a path alias or any other specifier the bundler resolves. Before, such an `icon()` call was never rewritten, so an app build collected none of its names and trimmed their glyphs.
  - `weaselIcons` warns when a module imports `icon` from an `icons.gen` it cannot read a namespace from, instead of silently leaving its calls unrewritten.
  - `weaselIcons` reads custom variants by their own keys: an icon namespace named `constructor` is no longer refused as a clash, and `virtual:weasel-icons/toString` fails rather than serving every table.
  - A `DevtoolsClient` that closes now reports no roots and no kit version, rather than the last ones its closed connection saw.
  - The Scene tab clears the canvas highlight when it unmounts with a row hovered, as when switching tabs from the keyboard.
- Updated dependencies [112f6bb]
  - @weasel-js/icons@1.18.1

## 1.18.0

### Patch Changes

- b93c1dd: Fixes from an audit of ui-logic, editor and the icon packages, and one definition each for decisions several packages answered separately:
  
  - The icons plugin reads the namespace of an `icons.gen` compiled to JavaScript, so its `icon()` calls are rewritten as a TypeScript one's are.
  - Releasing an icon table a second time no longer bumps the registry's version and notifies its subscribers.
  - `envPx` reads a token set to a bare `0` as 0px, as CSS does, instead of using its fallback or throwing.
  - New in geom: `trimNumber(n, places = 6)`, which pathToD, svg and the renderer's mesh writer now share. The mesh writer kept four decimal places where its comment said it matched svg's six; it now writes six.
  - New in geom: `rectBetween(ax, ay, bx, by)`, the rect two corners span, used by core's drag rect, marquee, area select, anchor marquee, insert extent, measurement and parallax, and by diagram's segment boxes.
  - New in registry: `freshId(base, taken, opts)`, the first free numbered id, used by core's `nextPageId`, diagram's stage, wire, group and sequence ids, and labkit's snapshot names.
  - paint exports `byteHex` and `lerpHueDeg`. core's `withAlpha01` and p-touch's lbx colors write hex through the first. theme's ramps blend hues through the second, so two anchors exactly opposite now blend the positive way round, as CSS's `shorter` does, where before they went the negative way.
  - gestures' `matchKey` takes a readonly key list, and routing's key bindings match through it.
  - ui-logic's `clampTo` is now geom's `clamp` under another name, and is deprecated.
- Updated dependencies [b93c1dd]
  - @weasel-js/icons@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/icons@1.17.3

## 1.17.2

### Patch Changes

- @weasel-js/icons@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/icons@1.17.1

## 1.17.0

### Patch Changes

- 5968910: `icon()` imported as `from './icons.gen.js'`, the way a TypeScript module written for Node's ESM resolution names its `.ts` neighbor, was left unrewritten with no warning: the plugin looked for `icons.gen.js` itself and never found the `.ts` source. Its glyphs could then be missing from a trimmed `virtual:weasel-icons`. A `.js`, `.mjs`, `.cjs`, or `.jsx` specifier now also finds its TypeScript source.
- @weasel-js/icons@1.17.0

## 1.16.2

### Patch Changes

- f44d35d: Depends on `oxc-parser` 0.157.0, up from 0.156.0. The parser now rejects some TypeScript-only syntax in plain JavaScript files, such as an optional class member or a TypeScript default export; the plugin parses `.ts` and `.tsx` files as TypeScript, as before.
- @weasel-js/icons@1.16.2

## 1.16.1

### Patch Changes

- @weasel-js/icons@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/icons@1.16.0

## 1.15.2

### Patch Changes

- @weasel-js/icons@1.15.2

## 1.15.1

### Patch Changes

- 2992b55: Dependency updates: `@msb235/blits` 0.16.1 (core, animator, clock, labkit), `earcut` 3.2.4 (core, geom's peer
  range, labkit), `react-aria` 3.53.1 and `react-aria-components` 1.22.1 (ui), and `magic-string` 1.4.5, `oxc-parser`
  0.156.0 and `unplugin` 3.7.0 (icons-plugin). geom's `earcut` peer is an exact pin, so a consumer installing geom
  beside its own `earcut` needs 3.2.4.
- @weasel-js/icons@1.15.1

## 1.15.0

### Patch Changes

- c41c917: Path edit's tools are ordinary tools, and a mode can name the tool it starts on.
  
  **Breaking:** the `pathEditTool.*` toggle actions (`pathEditToolAction`, `exitPathEditToolAction`,
  `pathEditToolActive`, `simplifyBrushToolAction`, `lengthenToolAction`, `SIMPLIFY_BRUSH_TOOL`, `LENGTHEN_TOOL`) are
  removed, as are the `editAnchors` dep's `tool` and `setTool`, `PathEditHost`'s `tool` and `setTool`, and
  `AnchorState.tool`. The `simplifyBrush` and `lengthenPath` actions no longer bind a drag themselves: mount
  `useSimplifyBrushTool` and `useLengthenTool` (or `usePathEditTools`, named by `PATH_EDIT_TOOLS`; `usePathToolsTools`
  includes them), each carrying `edits-anchors`. Their bindings sit at the active tier, so they outrank anchor
  editing's ambient drags; a Lengthen drag on an anchor that is no open end falls through to moving it.
  
  `ModeDefinition.defaultTool` names the tool a mode starts on: entering the mode activates it, leaving restores the
  tool active at entry, and Escape with another tool on returns to it before a second Escape leaves: a mode shortcut's
  `exit` and `cancel` and core's `exitPathEdit` each call `returnToModeDefault` first, reading the new `modeDefaultTool`
  dep `<SceneCanvas>` sources. `PATH_EDIT` names core's new `anchors` tool (key A, glyph `core:anchors`), which the
  `pathEdit` preset mounts and `ANCHOR_TOOLS` names; it binds nothing and holds path edit's active slot. The pointer
  cursor over an anchor or handle is now `editAnchors`' own `cursor`, so a path-edit tool's cursor shows there.
  
  A `chromeRules` dep, which `<SceneCanvas>` sources, reads and sets chrome-visibility rules at run time. The toggles
  `pathEdit.show.direction`, `.comb`, `.balance`, and `.corners` (group `pathOverlays`) use it to flip each overlay
  between `always` and `never`, and come with the preset that draws it.
  
  `ToolPalette` takes `ineligible: 'dim' | 'hide'`, default `dim`; `hide` leaves out every tool the current mode does
  not allow. The Girth tool's palette group is now `path`, beside Trim, Extend, and the Smudge brush.
  
  In the dev server and under vitest, `weaselIcons` in app mode stops looking for tables at the nearest workspace root
  above the app, and reads that workspace's packages' source tables. It used to walk on into an enclosing checkout's
  `node_modules` (a git worktree sits inside its main checkout), so a worktree served that checkout's glyphs: a glyph
  added on the branch drew as "?", and one redrawn there drew as before.
- @weasel-js/icons@1.15.0

## 1.14.2

### Patch Changes

- @weasel-js/icons@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/icons@1.14.1

## 1.14.0

### Patch Changes

- 572e537: In dev and vitest, a linked workspace package's glyphs now come from its source table rather than its built one, so a glyph added to a package shows up without rebuilding that package first.
- @weasel-js/icons@1.14.0

## 1.13.0

### Patch Changes

- @weasel-js/icons@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/icons@1.13.0-rc.0

## 1.12.0

### Patch Changes

- fb09495: `engines.node` now reads `>=22.12.0`, the floor its `oxc-parser` dependency declares. Node 22
  releases before 22.12 were never supported; the manifest said they were.
- @weasel-js/icons@1.12.0

## 1.11.1

### Patch Changes

- ecd8f59: Walk the parsed module with the plugin's own walker over oxc-parser's `visitorKeys` instead of
  oxc-parser's `Visitor`, which loads its walker with `require()` of an ES module. That load failed
  under vitest's vm pools on Node 22, so any test importing the plugin's collector or rewriter
  there threw `SyntaxError: Unexpected token 'export'`.
- f819e61: Breaking for anyone naming ui's shape glyphs: the plain shapes move out of `@weasel-js/ui` into `@weasel-js/icons`, under a namespace of their own, so `ui:shapeHexagon` is now `shape:hexagon`, and every package may name them without depending on ui. Their table is `@weasel-js/icons/shapes`, and ui's `kitIcons` includes it. There is one new glyph, `shape:trapezoidSide`, a trapezoid on its side with its narrow end west.
  
  `ToolPalette` takes `columns`, which lays each group out as a grid that many buttons across, and `onToolDragStart`, which makes each button a drag source. `ToolGroup` takes `columns`, and `ToolButton` takes `onDragStart`.
  
  A `DiagramStencil` takes an `icon`, its tool's palette glyph, and each of `FLOWCHART_STENCILS` has one.
  
  `@weasel-js/icons-plugin` reads a workspace package's source table when the table its manifest declares is not built yet.
- Updated dependencies [f819e61]
  - @weasel-js/icons@1.11.1

## 1.11.0

### Patch Changes

- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- 34f8b09: The plugin's source writes the `.ts` extension on every relative import, so vite's native config loader can load a config that imports it from source. The published bundle is unchanged.
- 285b0e7: Under `vite build --watch`, each rebuild now ships the glyphs its own modules name and reads every table afresh, instead of keeping every name and table an earlier build saw. A name deleted from the source no longer ships, and deleting one from both the source and its table no longer fails the rebuild.
  
  Library mode annotates a recorded icon name in whichever chunk its literal lands, so a constant the bundler inlined into another chunk keeps its `@icon` annotation. The build now fails when any such literal has lost its annotation, not only when every one has, and names the ones that did.
  
  A namespace import, a default import, or a re-export of `icon` from an `icons.gen` module now warns: the plugin does not follow those, so their calls go unrewritten.
  
  The dev server finds a table in a directory named `fixtures`, which it used to skip, and a package that ships a `dist/package.json` with no `name` is read from its real root, so its declared table is found.
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
  - @weasel-js/icons@1.11.0
