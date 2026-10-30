# @weasel-js/react

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- 34a364e: Removes public API: `useFrameClock` and its `FrameClock` and `FrameClockOptions` types are gone from `@weasel-js/react`, and from their re-export in `@weasel-js/core`. Use a `@weasel-js/clock` clock in their place: `createClock({ rate: 1 })` for a clock that runs, `createClockRegistry` and `useClockLoop` from `@weasel-js/clock/react` to drive it, `handle.onFrame` as a render layer's `subscribe`, and `handle.clock.elapsed / 1000` for seconds. Rate 0 pauses it. The loop leaves out time with the tab hidden, as `useFrameClock` did, and skips a clock registered with a target while that element is out of the viewport; unlike `useFrameClock`, a running clock is synced whether or not anything subscribes to its frames.
- 4f68c3a: `@weasel-js/react` exports `useNearViewport(ref, margin, initial?)`, which says whether an element lies within a CSS margin of the viewport, and keeps following it as it scrolls away and back. It goes by where the element is, so content an `overflow` ancestor clips away still counts as near. forge's story frames use it from here; forge now depends on `@weasel-js/react`.
- @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 91a1d84: `useVisibleRaf`, `defaultStorage` and the deprecated `cornerPoint` now carry a description, which
  editors show on hover and the package pages show beside the name.
- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- e30f4df: `DiagramView` can hold DOM against its nodes, groups and edges, report what the pointer is over, and let a group's members be dragged into a new order. All three are additive.
  
  - `overlays` places each `DiagramOverlay` against its target after every paint: centered on it, or beside it through geom's `placeRect`, flipping inside the view. An edge's place is the midpoint along its route. The view now renders a box around its canvas to hold them, and `className` goes on that box rather than on the canvas.
  - `onHover` reports the node, group or edge under the pointer; `pickEdges` lets a click or a hover land on an edge whatever editing callbacks are set. `rectOf(id)` and `subscribeFrame` on the ref give a target's client rect and when to read it again.
  - A `DataGroup` with `reorder: 'x' | 'y'` lets `onReorder` drag any member along that axis, carrying everything inside a member that is a group, or step the picked one with Alt and an arrow key. It reports `{ group, order }` and moves nothing. `layered` keeps such a group's members in the order given across every rank instead of sorting them by crossings. `createReorderAction`, `createStepReorderAction`, `reorderBindings` and `reorderContribution` are exported for use outside `DiagramView`.
  
  `SceneCanvas` takes `onHover`, called when the topmost pickable node under the pointer changes. `@weasel-js/react` exports `adoptCss`, `adoptCssOnce` and `styleRootOf`, the stylesheet adoption core's canvas and `KitSettingsFromPrefs` now share.
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
- c6a0a52: Kit settings for gestures, targets, the camera, orbit and the loupe. Under a `<KitSettingsProvider>` a consumer can now set `gestures.doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx` and `dragPx` (read by the dispatcher, the move action and `useDragHandle`; an explicit `longPress` prop or `dragThresholdPx` param still wins); core's `targets` leaves `handlePx`, `anchorHitPx` and `rotationDistancePx` (the base that device scaling multiplies, under an explicit `handleHitRadius`), `segmentHitPx`, `anchorClickPx`, `pickTolerancePx` (under `geometry.pickTolerancePx`), and the pen, bone, weight and slice overlay dot radii; `view.animationMs` (under a move's own `ms`); `orbit3d.orbitRate` and `dollyRate` in kernel3d; and `loupe.wheelRate` in labkit. `coreKitSettingsSchema`, `kernel3dKitSettingsSchema` and `labkitKitSettingsSchema` describe these as prefs groups whose paths are the settings' paths, each default being the existing constant. Underneath: `createPointerRecognizer` takes `doubleClickMs`, `doubleClickPx`, `tapPx` and `dragPx` thunks; `<SceneCanvas>` publishes the provider's store as the `kitSettings` dep; `targetSizesPx` and `mergeLayersWithDefaults` take optional base sizes; `createPenPreviewLayer`, `createBoneOverlay` and `createWeightOverlay` take optional size readers; `@weasel-js/react` declares `KitTargetSettings`, the shared `targets` area. Additive.
- ad0b069: Add kit settings: a `KitSettings` interface each package augments with its own area, a
  `<KitSettingsProvider>` that sets values for a subtree (nested providers merge), `useKitSetting(path)`
  for components, which re-renders only when that path changes, and `useKitSettings()` for code outside
  React to read at the moment it needs a value.
- d32cb70: `@weasel-js/ui`'s components read their timings and target sizes from `<KitSettingsProvider>`, each falling back to its existing default where no provider sets it. A consumer can now set `numberField.repeatDelayMs` / `repeatEveryMs` (a held stepper), `tree.typeaheadMs` / `hoverExpandMs` / `tipRestMs`, `help.focusDelayMs` (a row's help on keyboard focus), `toast.ttlMs` (a toast that sets no `ttlMs` of its own, read by the `ToastRegion` showing it), `history.coalesceMs` (the schema editor's undo window, read when the editor mounts), and `params.form` / `params.panel` / `params.lab`, each with `textWaitMs` and `settles.{number,slider,string,color}` — which controls in a `PrefsForm`, a `SelectionPanel` or `Bar` write only the value an edit settles on. `targets` gains `curveKeyHitPx`, `curveHandleHitPx`, `curveHitPx`, `curveAnchorSnapPx`, `functionCurveHitPx`, `sliderStopSnapPx` and `snapRadiusPx`, read by the curve editor's layers, `Slider`, `BandEditor` and `Timeline`; a keyframe layer's own `snapRadiusPx` still wins.
  
  `uiKitSettingsSchema` describes all of these as a prefs group whose paths are their `KitSettings` paths, with units, ranges and the components' defaults. `useParamsPolicy(surface)` answers a surface's resolved `textWaitMs` and `settles`; `prefFieldProps`, `withCommitPolicy` and `withDrafts` take an optional `settles` in place of the surface's defaults. A curve layer's `LayerCtx` carries the editor's `kitSettings` store. `@weasel-js/react` adds `KitTargetSettings`, the interface packages augment to add keys to the shared `targets` area. Additive.
- 398d71e: A camera animation that names no duration of its own now takes 0ms while the reader's `prefers-reduced-motion` is `reduce`, in place of the `view.animationMs` kit setting or its default, and follows the preference as it changes. `@weasel-js/react` exports `prefersReducedMotion()` and a `usePrefersReducedMotion()` hook that re-renders when the preference changes; the long-press ring and `@weasel-js/ui`'s components now read the preference through it.
- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0

## 1.10.1

### Patch Changes

- b8bfb2d: History and its journals, `createSelectionStore`, a record cache's `subscribe` and `onOverruled`, `createPaintedCursorState`, and `useFrameClock` notify through `createEmitter()` from `@weasel-js/registry`, as every other store in the kit does. Each of these packages now depends on `@weasel-js/registry`.
  
  What changes for a consumer: a listener that throws no longer throws into whatever caused the notify, such as `applyOps`, `setSelection`, `set`, or a frame of the clock. The error goes to `console.error`, and the listeners after it still run. A notify also walks the listeners held when it began, so one added during a pass waits for the next.
- 35c4879: One answer to "is a pointer held on this canvas". `heldPointers(element)` is new in `@weasel-js/gestures` (additive): it counts the pointers pressed on an element with any button and not yet released, and every reader of one element shares its listeners. The dispatcher's `hover` gesture and hover cursor, a layer's `onUncapturedMove`, and the `pointer` dep's published position all read it, where each used to track a press its own way.
  
  What changes: a move with a secondary or middle button held is no longer a `hover`; `onUncapturedMove` stays off until the last of several pointers is released, and through a `pointerleave` mid-press; and the `pointer` dep no longer reports a position for a drag that began outside the canvas and passed over the page.
  
  `giveKeys` (`@weasel-js/react/testing/giveKeys`) releases the middle-button press it makes.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 10c5d41: `useVisibleRaf` passes the loop's own handle to the frame callback as a second argument, so a continuous loop re-requests through it: `useVisibleRaf((time, loop) => { …; loop.request(); })`. Reaching for the returned handle from inside its own callback still works. The change is additive.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 3bacb3e: Adds API: `useFrameClock(options?)` in `@weasel-js/react`, re-exported from `@weasel-js/core`. It returns a stable `{ seconds(), subscribe }` driven by `useVisibleRaf`: each frame notifies the subscribers and sets no React state, so a shader uniform or a procedural layer animates without its owner re-rendering. It has `subscribe`, so a `RenderLayer` names it as its redraw source (`subscribe: clock.subscribe`) and reads `clock.seconds()` in `draw`. The clock runs only while it has a subscriber, and leaves out time spent hidden or `paused`; `start` sets what it reads before the first frame. Added on an agent's judgment, to take the hand-written elapsed-time loop out of the custom shader demo.
- 1d34f51: react: `useCanvasFocus` lives here now, with `UseCanvasFocusOptions` and `CanvasFocusReturn`. `@weasel-js/core` still exports all three.
- 80b29f6: react: `useVisibleRaf` lives here now, with its `VisibleRaf`, `VisibleRafOptions`, and `VisibleRafTarget` types, so a package below core can run a frame loop behind the visibility gate. `@weasel-js/core` still exports all four.

## 1.9.4

### Patch Changes

- c527f50: A key or a paste that reaches the page now goes to the canvas the user last pressed or scrolled in, across every provider on the page, and to no canvas before the first such interaction. A lone canvas used to take every key from the moment it mounted, so a read-only canvas in a side panel took Space from the page around it. This changes behavior for every canvas: its shortcuts do nothing until it is pressed or scrolled in. An app whose canvas is the page passes the new `<SceneCanvas claimKeys>` (`claimKeys` on `useGestureDispatcher`) to take the keys on mount. A press gives a canvas the keys with any button and whichever channels are on; a dispatcher with no canvas element still follows the active input scope. `ActionsRegistry` gains `holdsKeys()` and `dropKeys()`, which a hand-built registry must now supply. For tests, `@weasel-js/react/testing/giveKeys` exports `giveKeys(canvas)` and `renderWithKeys`.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

### Patch Changes

- dc5bcfc: `@weasel-js/react` exports `assignRef(ref, value)`, which writes a value into a ref prop whether it is a callback ref or an object ref. `<DrawCanvas>`, `<SceneViewCanvas>`, `<MinimapCanvas>`, `<SceneCanvas>` and `ItemList` forward their refs through it.
  
  A callback ref passed as `<SceneViewCanvas canvasRef>` or `<MinimapCanvas canvasRef>` is now called only when the canvas attaches or detaches, or when the ref itself changes. It used to be called with `null` and then the element again on every render.

## 1.8.1

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- d175c0c: New package `@weasel-js/react`: generic React hooks with no weasel domain in
  them, at the bottom of the package stack so every React-using package can reach
  them. It holds `useLatest` and `useStableByContent` (with its `sameList`
  comparator), which keeps one identity for a value rebuilt equal every render,
  compared only against what last committed.
  
  `@weasel-js/routing/react` no longer exports `useLatest`; import it from
  `@weasel-js/react`, or from `@weasel-js/core` as before. No released version of
  routing carried it, so nothing published breaks. `react` is an optional peer
  of `@weasel-js/react`, as it is of routing and theme, so installing routing for
  its React-free main entry still brings no React.
- 4cef954: New `useLatest(value)` (`@weasel-js/react`, re-exported by
  `@weasel-js/core`): a ref holding the value of the last committed render, for
  event handlers and frame loops that must not re-subscribe when it changes.
  Unlike writing `ref.current = value` in the render body, a render React throws
  away never lands, and the value is in place before any layout effect of the
  commit runs. List the returned ref in dependency arrays; `exhaustive-deps` only
  treats `useRef` as stable.
