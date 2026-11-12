# @weasel-js/icons

## 1.19.0

### Patch Changes

- 3b3289a: The icon registry no longer notifies subscribers when `add` gets an empty list or `provideVariants` names only variants it already knows. `entries()` keeps its array, and a `useSyncExternalStore` reader does not re-render.
  
  <!-- entry: rank=-5 fix perf -->
- fbb67d5: The icon registry's `add` throws a `TypeError` for a batch holding a malformed table, before registering any of it.
  
  A table needs a string namespace, a string owner, and an object of icons.
  
  <!-- entry: fix -->
- 68383ed: A subscriber that retries a failed icon variant from the registry's failure notice starts a fresh load.
  
  <!-- entry: fix -->
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [b188aea]
  - @weasel-js/registry@1.18.2

## 1.18.1

### Patch Changes

- 112f6bb: Name an icon with a mark in data
  
  - Every field that names an icon takes an `IconSpec`: a ref, or `{ name, mark }` for a subject with a mark set in its corner. That covers an action's and a variant's `icon`, a tool's `presentation.icon`, `useCommand`'s, a pref's and a group's, labkit's chrome, tool and builder items, path-tools' stroke-click tools, diagram stencils and types, forge globals, paint kinds, `SelectionPanel` sections, and `Bar`'s and `ActionBar`'s icons. A bare ref still works everywhere one did.
  - `@weasel-js/icons` exports `IconSpec`, `iconParts`, `iconSpecRefs` and `toIconSpec`, which reads a spec from JSON. It also exports `markLayers`, `ICON_SLOTS`, `ICON_FRAME` and `ICON_STROKE`, the slot geometry `<Icon mark>` used to keep in ui, so every renderer sets a mark the same way.
  - `<Icon name>` takes a spec, and its `mark` prop replaces the spec's. `resolveIcon` and `actionIcon` draw a spec's mark.
  - hud's canvas menus draw a row's mark, cutting the subject around it. `iconCommands(icons, spec, at)` is exported beside `glyphCommands`.
  - The schema editor's icon field picks a mark from the `Marks` group and writes `{ name, mark }`.
  - Code reading a field that was `IconRef` and is now `IconSpec` should read its refs with `iconSpecRefs` rather than assume a string. The devtools snapshot writes a spec's icon as `name + mark`.
  - The boolean crop glyph no longer uses a `clipPath`, which hud's canvas renderer skipped, drawing the whole disc filled.
- @weasel-js/registry@1.18.1

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
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [25a1ff7]
  - @weasel-js/registry@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [f1906a8]
  - @weasel-js/registry@1.15.2

## 1.15.1

### Patch Changes

- @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- f819e61: Breaking for anyone naming ui's shape glyphs: the plain shapes move out of `@weasel-js/ui` into `@weasel-js/icons`, under a namespace of their own, so `ui:shapeHexagon` is now `shape:hexagon`, and every package may name them without depending on ui. Their table is `@weasel-js/icons/shapes`, and ui's `kitIcons` includes it. There is one new glyph, `shape:trapezoidSide`, a trapezoid on its side with its narrow end west.
  
  `ToolPalette` takes `columns`, which lays each group out as a grid that many buttons across, and `onToolDragStart`, which makes each button a drag source. `ToolGroup` takes `columns`, and `ToolButton` takes `onDragStart`.
  
  A `DiagramStencil` takes an `icon`, its tool's palette glyph, and each of `FLOWCHART_STENCILS` has one.
  
  `@weasel-js/icons-plugin` reads a workspace package's source table when the table its manifest declares is not built yet.
- @weasel-js/registry@1.11.1

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
- b36ceac: A variant whose loader rejects or throws logs the error with `console.error` in development, naming the variant, before it is marked `failed`. Production stays quiet.
- 34f8b09: The plugin's source writes the `.ts` extension on every relative import, so vite's native config loader can load a config that imports it from source. The published bundle is unchanged.
- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0
