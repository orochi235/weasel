# @weasel-js/icons-plugin

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
