# @weasel-js/labkit

## 1.4.0-pre.1

### Patch Changes

- f046dfe: Let a host read and set which marks are selected.
  
  This adds API. `AnnotationsApi` grows `selection()` and `setSelection(ids)`,
  in the same `<target>/<node>` ids the rest of the surface uses, merged across
  every target — the question "which mark did the user just click?" had no public
  answer, so a host could draw marks and query them but could not respond to one.
  
  There was nothing to build: the overlay's `<SceneCanvas>` per target already
  runs weasel's own selection, and weasel keeps a canvas's selection on the scene
  rather than in React. The store already holds those scenes, so it reads and
  writes selection directly and the overlay is untouched. Click, marquee, handles
  and undo's selection restore all come along for free.
  
  A selection change already reached `subscribe` for the same reason — a scene
  notifies its listeners on `setSelection`. Its doc comment now says so.
  
  An id naming a target or a mark that is not there is dropped, matching how
  `update`, `setMeta` and `remove` ignore one.
- fa58247: Export `usePanZoom` from `@weasel-js/labkit` and `@weasel-js/labkit/canvas`,
  alongside `UsePanZoomOptions` and `PanZoomHandlers`.
  
  The 2D camera was reachable only by adopting `CanvasStack`, which owns its own
  `<canvas>` elements and layer scheduler — exactly what a lab hosting a foreign
  renderer through `surface` has opted out of. Its 3D peer `useOrbit` was already
  exported standalone, so such a lab got the orbit camera from labkit and had to
  reimplement the pan/zoom one, cursor-anchored wheel zoom and reachable-opening-
  zoom clamp included.
  
  `useOrbit` now also rides the `/canvas` subpath, where the two cameras sit
  together.
- 719c0fe: Rewrite labkit's public documentation. Docs only — no code changes.
  
  The README is the landing page of the published docs site, and it described a
  package that no longer exists: v0.x, the lab/trial/instrument runtime "arriving
  in later plans", and an Installation section telling readers to clone two repos
  side by side and depend on `file:../labkit`. labkit is on the public registry
  and is a workspace package in this monorepo, so both halves sent an adopter
  somewhere that could not work.
  
  It now installs from npm, states the React 19 peer dependency, and covers the
  surfaces it never mentioned: the capability list an instrument declares from,
  annotations, chrome regions and undocking, the `f(...)` config schema, and all
  fifteen subpath exports. The Usage example uses `<Lab>` rather than a shell
  around bare `<div>`s, and the Development section lists the scripts the package
  actually has — `npm run storybook` was not one of them.
  
  Four dead documentation links pointed at `orochi235.github.io/labkit/` and at a
  standalone `orochi235/labkit` repo. The docs site is under
  `orochi235.github.io/weasel/labkit/`, Storybook under
  `orochi235.github.io/weasel/docs/ui/storybook/`, and the design spec is in this
  repo.
  
  RECIPES gains annotations coverage — declaring targets, reading the store,
  export, and keeping marks in your own storage — plus chrome contributions and
  panel undocking. AGENTS gains source maps for both, and its stale rows are
  fixed: it named seven files that had moved or been deleted, and told readers
  design tokens are `--lk-*` when no such property is ever declared.
- Updated dependencies [36b6ee7]
  - @weasel-js/core@1.4.0-pre.1
  - @weasel-js/loupe@1.4.0-pre.1
  - @weasel-js/svg@1.4.0-pre.1
  - @weasel-js/ui@1.4.0-pre.1
  - @weasel-js/theme@1.4.0-pre.1

## 1.4.0-pre.0

### Patch Changes

- d2f80b1: Give every trial a trial-id scope, and mount a shared drawing surface.
  
  `useTrialState()` threw inside any instrument hosted by a `<Lab>`:
  `<TrialIdProvider>` had one production mount, in `SingletonExperiment`, so the
  documented trial-scoped hook pattern was unreachable from an instrument's
  `render`. `<Trial>` now provides it, outside `<TrialChrome>`, so contributions
  can read trial state too.
  
  `useTiledSurface` had no production provider, so `useSurfaceOptional()` always
  answered null and a registered tile reached nothing — including `Workspace`'s
  own rect invalidation on grid moves, which was written against a surface
  nothing supplied. `<Lab>` mounts one, anchored to `.lk-lab__body`, and defers
  to a surface its host already owns rather than opening a second GL tenancy.
- 1595a52: An instrument can declare regions that accept marks.
  
  `annotations: { targets, meaning? }` on an `Instrument` names the regions and,
  optionally, the vocabulary a mark's status may use. `createAnnotationStore`
  answers everything about the marks on those regions — `query`, `hitTest`,
  `within`, `isStale` — over a weasel scene it treats as the truth rather than a
  copy it keeps in step.
  
  Positions cross the store boundary as fractions of a target's content box, so a
  mark stays on the same feature when the render resolution changes.
  `positionDependsOn` names the config keys a target's positions depend on;
  labkit snapshots them beside each mark and compares them later without knowing
  what any of them mean.
  
  Snapshots from `toJSON()` are JSON-safe and carry their own version, because
  labkit stringifies `record.state` raw and its document migrations never reach
  into a trial's state.
  
  The overlay that renders marks and the tools that draw them are not in this
  release: the store is reachable and testable on its own.
- 5295c34: Draw on a lab's instrument: the `annotations` capability gets its overlay.
  
  An instrument that declares `annotations` now gets a drawing surface on every
  target it names — weasel tools, weasel selection, marks that pan and zoom with
  what they mark — plus a palette (select, freehand, line, arrow, rectangle,
  ellipse, text) and its own tool slot. `useAnnotations()` reaches the store from
  the instrument's render or from a chrome contribution, and re-renders its
  caller as marks change.
  
  The lab's shared surface grew the buffer that makes this possible: one
  `<canvas>` over `.lk-lab__body`, and `SurfaceHandle.registerPainter`, which is
  how a resize of that buffer reaches every tile rather than the one that moved.
  `getContainer()` names the element tile rects are measured against.
  
  A mark is a weasel scene node in a scene of its own per target — a pane's
  hit-test, marquee and paint walk the whole scene they are handed, so one shared
  scene would put a neighbour's marks under the pointer. An annotation's id is
  therefore `<target>/<node>`, and `createAnnotationStore` takes `targets` alone
  plus an optional `restore`; `SerializedAnnotations` carries `scenes`, keyed by
  target. Marks still do not survive a reload — the storage slot is the next arc.
  
  Core adds `ArrowIcon` to the built-in tool glyphs.
- 73052a9: Marks persist, undo takes them back, and a mark can say what it means. Closes
  the `annotations` capability.
  
  `TrialRecord.annotations` is where a trial's marks are kept — written on a
  trailing debounce and flushed on unmount, so the last mark before a close is
  not lost. The field is optional and additive: a document written before this
  change lacks it and needs no migration. An instrument that would rather own its
  marks declares `annotations.storage` with a `load`/`save` pair, and labkit
  never touches its own slot.
  
  Undo is routed to weasel history rather than reimplemented. Each target's marks
  live in their own scene with its own stack, so `AnnotationsApi` grows
  `undo` / `redo` / `canUndo` / `canRedo`, which take back the most recent change
  wherever it was made. Declaring `annotations` now earns the trial's undo and
  redo buttons whether or not the instrument also declares `undo`; a trial
  declaring both takes the marks first.
  
  A `Marks` sidebar panel (`<MarkList>`) lists every mark with its kind, its
  target, an editable title, a status picker and a staleness badge.
  `AnnotationStatus` gains a `color`, which the mark on the canvas follows; a
  mark whose target's declared config keys have moved draws dashed rather than
  hidden, because it still describes something.
- 25f6ee3: Export a lab's picture with its marks on it — new API, and new chrome.
  
  A target declares `base()`, handing over the picture underneath its marks as
  SVG markup, an image `src` or a canvas. labkit cannot rasterize that itself: it
  is the consumer's DOM. A target declaring no base still exports, its marks on
  transparency.
  
  `AnnotationsApi` grows `capture(target, { format, scale })`, resolving to a
  Blob plus its dimensions, and `targets()`, which reports the declared targets.
  The route depends on the base: an SVG one nests beside the marks in a single
  document that rasterizes once at the end, which also makes `format: 'svg'` a
  real vector export. Anything else stacks rasters, the marks drawn offscreen at
  export scale by `renderSceneToPixels` rather than read back off the live
  surface — so a capture neither depends on nor disturbs what is on screen.
  Export resolution follows the target's content box and the scale, not the size
  the pane happens to be on screen.
  
  Declaring `annotations` now earns an Export button in the trial toolbar, opening
  a panel that picks a target, PNG or SVG, and a scale, and then downloads or
  copies. `AnnotationsCapability.onCapture` fires after every export, labkit's own
  chrome included, for a host that wants to file the blob somewhere of its own.
  
  Two smaller additions come with it: `createMarkDrawOne` / `resolveMarkStyle`,
  the single place a mark's colour and stale dash are resolved for both the
  screen and an export, and `markSvgNodes`, which translates a mark's own draw
  commands into `SvgNode`s rather than switching over the mark kinds a second
  time.
  
  labkit gains a dependency on `@weasel-js/svg`. Its build already inlined that
  package by way of `@weasel-js/ui`, so nothing about what ships changes; the
  declaration is what the manifest audit reads.
  
  One caveat for anyone using React Aria overlays inside a lab: they portal to
  `document.body` by default, which is outside the element labkit paints its
  theme tokens onto, and they render unthemed there. The export panel passes the
  lab root as its portal container. Nothing else in labkit does yet.
- 28894b9: `FloatingPanel` no longer swallows a click on a control that is not a native
  element.
  
  It captured the pointer on pointerdown to drag itself. Capture retargets
  mouseup, so the browser synthesizes no `click` on the child under the cursor —
  and the guard exempting children was an element-name allowlist (`input`,
  `button`, `a`, `select`, `textarea`, `[data-no-drag]`). Anything else in a panel
  was therefore dead to a real mouse while a programmatic `.click()` still worked,
  which is how it hid. A `role="button"` span, a component library's control that
  renders a div, and a canvas were all affected.
  
  The panel now arms on pointerdown and captures only once the pointer has moved
  3px, so a press that does not move is never a drag. The allowlist stays, so
  dragging _from_ a native control still does nothing.
  
  Also documents the styling contract this came in alongside — see "Styling
  labkit from your own stylesheet" in the recipes: classes are `lk-*`, tokens are
  `--wzl-*`, and `var(--lk-…)` silently takes its fallback.
- 4dc5cad: A loupe any lab can turn on
  
  `loupe` joins `canvas`, `layers`, `dragDrop` and `undo` as an instrument
  capability, so declaring one is what gives a trial the magnifier and its
  toolbar switch — suppressible by id like every other built-in.
  
  Two painters, chosen by what the instrument's content is. `loupe: true` on an
  instrument that draws gets the canvas painter: the lens re-runs that
  instrument's own layers through a camera zoomed about the aimed point, so a
  hairline is still a hairline at 30×, and `mode: 'pixel'` enlarges the pixels
  the stack presented instead. `loupe: { render }` gets the DOM painter, for an
  instrument whose content is markup: handed a camera, it draws itself again
  inside a circular clip. Either way the lens takes no pointer events, so the
  pan, the wheel and anything underneath keep working while it is up. A function
  form — `loupe: (config) => …` — is re-read as the config changes, so a setting
  can drive the lens.
  
  The lens follows the pointer while it is on, appears for as long as `Alt` is
  held while it is off, and takes the wheel from pan/zoom to resize its
  magnification. Those are plain listeners for now; `docs/TODO.md` records why,
  and what replaces them.
  
  Supporting surface: `zoomAt` and `centerOn` are exported from
  `@weasel-js/labkit` — the fixed-point zoom `usePanZoom` already ran, and the
  camera that centres a world point in a viewport — so nothing composing a camera
  has to re-derive one. `CanvasStackContext` now also carries the stack's
  `surface`: its element, measured box, layers and presented canvases, which is
  what an overlay needs to re-draw or read back what the stack painted.
  `ToolbarItem` takes `pressed`, rendering `aria-pressed` and a held-down state,
  and `@weasel-js/ui` gains a `loupe` glyph.
- 3101f60: `PaletteRegion` and `ViewportRegion` claimed `role="toolbar"` without the
  keyboard contract that role promises — no roving tabindex, every button in the
  tab order. Both now use `useRovingTabIndex`, which takes an orientation: the
  vertical palette walks ArrowUp/ArrowDown and leaves the cross-axis arrows to the
  page, per APG.
- 55b73ab: The Save snapshot button moves from a trial's toolbar to the end of its title
  bar, beside clone and reset. The three are one group of trial-level actions and
  now read as one. `Mod+S` is unchanged — the handler is on the trial element, not
  the region. The Load snapshot picker stays in the toolbar; it is a select, not
  an icon button.
- aaf8bfc: A sidebar section can be torn out into the workspace, and put back.
  
  Every `sidebar` contribution now carries a tear-out control. Undocking moves
  the section out of its trial's sidebar and into the workspace as either a tile
  — a peer of the trials in the same grid, resizable and reorderable like one —
  or a floating panel above the grid. The section says which it wants with
  `undockAs: 'tile' | 'floating'` (default `'tile'`), and a section that only
  makes sense beside its trial opts out with `undockable: false`.
  
  `Workspace` registers windease's `floatingStrategy` alongside `gridStrategy` to
  carry the second target, and takes `panels: readonly PanelDescriptor[]`.
  
  The panel's content is **portalled** out of the trial rather than re-rendered
  beside it: the workspace owns the frame and the host element, the trial owns
  what goes in it. So a torn-out section keeps its place in the trial's React
  tree — its context, its subscriptions and its own component state all survive
  an undock and a dock, and an instrument does not have to make its panels
  free-standing to allow it.
  
  `TrialChromeContext` gains `undockedPanels`, `undockPanel(sectionId, as?)` and
  `dockPanel(sectionId)`, so a consumer can drive this from its own chrome
  instead of the built-in control.
  
  Which panels are out is persisted with the rest of the lab, so it survives a
  reload. That moves the document to **version 3**; `migrateV2toV3` starts the
  field empty and touches nothing else. Closing a trial docks everything it
  owned.
  
  `Workspace`'s node-id list is now kept in a ref keyed on the joined ids rather
  than a `useMemo` over a stand-in key, which drops the two lint suppressions
  that arrangement needed.
- 6f0ba17: Let a labkit instrument declare its own coordinate system for the canvas.
  
  `CanvasCapability.worldSpec` takes an `origin` — a fraction of the viewport, so
  `{x: 0.5, y: 0.5}` means "centred" without knowing the canvas size — and
  `yAxis: 'up' | 'down'`. Omitting it keeps the convention labkit has always had:
  world (0,0) at the element's top-left, y running down.
  
  The spec is resolved against the measured viewport into a `WorldFrame`, and
  every path between world and screen now reads it: `worldToScreen`,
  `screenToWorld`, the new `applyCamera`, `usePanZoom`'s wheel anchor, and the
  drop position in `DragDropRuntime`. This is a bug fix as much as an addition —
  an instrument whose world was not y-down-from-the-top-left previously had to
  layer its own transform on top, and the wheel then anchored on the wrong point
  and drifted by `(1 - ratio) * originPx` every step, with no error.
  
  `CanvasCapability.initialView` also accepts a function of the viewport size.
  The trial's view stays `null` until the canvas is first measured and
  `CanvasStack`'s new `onResize` places it, so an instrument that frames content
  against the viewport no longer needs its own "have I placed this yet" flag.
  
  `RenderContext.trial.visibleLayers` lists the canvas layers currently shown, in
  declaration order — labkit skips a hidden layer's `draw`, so this was
  previously only discoverable by instrumenting every layer.
  
  Clone and Reset move from the trial toolbar to the right edge of the trial
  title bar, beside Close.
  
  `CanvasStackContextValue` gains a required `frame`, and
  `CanvasLayerDescriptor.render` takes it as a third argument.
- a6faf75: Pack property rows two-up, and size their fields to their content
  
  A property panel spent a full row on every leaf and stretched each field to
  whatever width the row had, so a 38-flag lab sidebar scrolled for two screens
  to show four dozen digits. The grid was already there — `PropertyList` and
  `PropertyGroup` have taken `pack="pairs"` since they were written — but only
  `PropertyRow` could opt out of it, so nothing that rendered a schema could use
  it: `ControlPanel` hardcoded `pack="auto-color"`, which spans everything but a
  colour.
  
  `ControlPanel` now takes `pack` and `layout`. It defaults to `pack="pairs"`
  (two controls per row), with `'auto'` for the middle ground — text, sliders and
  segmented toggles keep the full width, everything else pairs — and `'one-up'`
  for what it used to do. A custom `controls` renderer places itself like any
  built-in row and opts out the same way, with `<PropertyRow span>`.
  
  `span` is now on every typed row (`NumberRow`, `TextRow`, `SelectRow`,
  `ToggleRow`, `CheckboxRow`, `ColorRow`, `SliderRow`), not just on the
  `PropertyRow` they are built from.
  
  Fields size to their content rather than to their cell: a number gets 9ch and a
  string 16ch, both capped at the column so a narrow sidebar still fills. Fields
  also state a height (`--wzl-prop-field-height`, 20px) rather than padding to
  one — the display face's line box is half again its font size, so a padded field
  stood 27px tall around 13px of text and trimming the padding could not fix it.
  The row and group gutters came in to match.
  
  Widths, heights and gutters are all overridable:
  `--wzl-prop-number-width`, `--wzl-prop-text-width`, `--wzl-prop-field-height`.
  
  A lab's trial sidebar states its width (`--lk-trial-sidebar-w`, 20rem) instead
  of deriving it from content: an auto-width sidebar is as wide as its widest
  label, so one verbose config key was setting the width of the lab. An inline row
  puts its label on the left edge and its field on the right, so fields of
  different widths still read as one rail down the column, and it keeps its one
  line in a column narrower than it wants: the field yields width to the label
  down to a four-character floor, and the label — which may be a single
  unbreakable name — never yields.
  
  Every property panel is visibly denser for this — WeaselDraw's inspector as
  much as a lab's controls.
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [5c3e571]
- Updated dependencies [e1838ff]
- Updated dependencies [7a0c568]
- Updated dependencies [1b42b19]
- Updated dependencies [4dc5cad]
- Updated dependencies [0d0c885]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [a6faf75]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [1b9575f]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [53ffca9]
- Updated dependencies [8ddec11]
- Updated dependencies [6e5f821]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0-pre.0
  - @weasel-js/ui@1.4.0-pre.0
  - @weasel-js/loupe@1.4.0-pre.0
  - @weasel-js/svg@1.4.0-pre.0
  - @weasel-js/theme@1.4.0-pre.0

## 1.3.0

### Patch Changes

- a6140e4: Export the drag-and-drop runtime from `@weasel-js/labkit/dragdrop`
  
  The subpath re-exported three types and no values, so the built
  `dist/dragdrop/index.js` was empty and the working runtime sitting beside it was
  published from nowhere. It now also exports `useDragDrop`, `DragOverlay`,
  `Palette` and `DragGhost`, with their prop and result types: `UseDragDropArgs`,
  `UseDragDropResult`, `DragState`, `DragOverlayProps`, `PaletteProps` and
  `DragGhostProps`.
  
  A consumer can now drive a palette-to-canvas drag against its own
  `DragDropCapability` with the same hook and ghost overlay labkit's instruments
  use, instead of reimplementing them. `DragDropCapability`, `DragFeedback` and
  `PaletteItem` still export as before, and the root barrel is untouched — the
  subpath remains the one place this runtime is published.
- 245fbaf: Add `span` to `PropertyRow` for a full-width row
  
  Making a row take the whole width of a `pack="pairs"` list or a `<Subpanel>`
  meant typing the private class name `lk-property-list__span` into `className`
  and hoping it stayed spelled that way. `<PropertyRow span>` now does it.
- 245fbaf: Show a config leaf's description as a tooltip on its control row
  
  A schema leaf could carry `describe('…')` text, but nothing in labkit rendered
  it: `ControlPanel` read only the leaf's name, so the help a lab wrote never
  reached the person using the lab. Every described leaf now gets an ⓘ beside its
  label, and hovering or keyboard-focusing it shows the description in a tooltip.
  Leaves with no description stay bare.
  
  `PropertyRow` takes the same text directly as `description`, as do the typed
  rows built on it (`SliderRow`, `NumberRow`, `CheckboxRow`, `TextRow`,
  `SelectRow`, `ToggleRow`, `ColorRow`), so a hand-built panel gets the same
  affordance without going through a schema.
- c1e567f: Move `LayerStack` from `@weasel-js/labkit` to `@weasel-js/ui`. It is a generic
  drag-reorderable stack of expandable cards — it reads nothing from labkit's
  instrument, config, state, trial or lab layers — and a consumer who wanted it
  had to take labkit and the lab frame it assumes.
  
  It can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**, from both the package root and
  `@weasel-js/labkit/ui/layers`: labkit re-exports it, and it bundles weasel-ui
  into its own dist, so this is a re-export rather than a new dependency.
  
  `DragHandleGlyph`, the grip both `LayerStack` and labkit's `LayerList` draw,
  moves with it and is now public from `@weasel-js/ui`.
  
  `LayerStack` also takes a `className` now, appended to its root — the
  supported way to reach it from a consumer stylesheet, since its own class
  names are hashed.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to a CSS module, matching the package it joined, so
  `lk-layer-stack`, `lk-layer-card` and their neighbours no longer exist as
  targetable selectors, and `--lk-layer-card-accent` is now
  `--wzl-layer-stack-accent`, set for you by the `accent` prop on an item. The
  card's `data-testid` drops the `lk-` prefix: `layer-card-<id>`.
  
  Two of the old rules were prefixed with `.lk-root` to outrank labkit's bare
  `button` defaults. Those defaults now sit at zero specificity, so the module's
  own class wins on its own; the stack no longer depends on a labkit ancestor,
  and it restates the border-box reset and the button font and height that
  `.lk-root` used to supply.
- 555f84c: Move the property-panel components from `@weasel-js/labkit` to
  `@weasel-js/ui`. `PropertyPanel`, `PropertyList`, `PropertyRow`, `SliderRow`,
  `NumberRow`, `TextRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow`,
  `Subpanel`, `PropertyGroup`, `CurveField` and `EffectCard` imported nothing
  from labkit's instrument, config, state, trial or lab layers — they are
  generic form UI, and a consumer who wanted them had to take labkit and its
  lab frame to get them.
  
  They can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**: labkit re-exports the whole set,
  and it bundles weasel-ui into its own dist, so this is a re-export rather
  than a new dependency.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to CSS modules, matching the package it joined, so
  `lk-property-panel`, `lk-property-list__span` and their neighbours no longer
  exist as targetable selectors. Code reaching them from its own stylesheet
  should pass `className` instead — `PropertyPanel`, `PropertyList` and
  `PropertyRow` all accept one. For full grid width, a row takes `PropertyRow`'s
  `span` prop, and anything that is not a row goes in `<PropertySpan>`.
  
  `formatNumber` and its helpers consolidated onto weasel-ui's existing
  `format/number`; labkit's duplicate is gone.
- a6140e4: Export `TrialLayout`
  
  `Workspace` types its `layout` and `onLayoutChange` props as `TrialLayout`, but
  the type itself reached no barrel. Persisting a workspace layout and handing it
  back meant recovering the type structurally, as
  `NonNullable<ComponentProps<typeof Workspace>['layout']>`. It is now a named
  type export from the package root.
- 1f67cad: Draw labkit's chrome and the ui components from one type, weight and shape
  scale. Sizes fold onto six ranks, so a 12px label now renders at 11 and a 14px
  one at 13; corners fold onto four radii. `Button`'s `sm` and `md` text sizes
  converge as part of that fold — the two still differ in height and padding.
  
  Three components that were exported but rendered nowhere now appear in the
  default chrome: `FpsMeter` and `ScaleIndicator` in the status bar,
  `ZoomControl` in the viewport controls, replacing the plain zoom readout.
  `StatusBar.Section` takes `end` to push a readout to the far side, mirroring
  `Toolbar.Group`.
  
  The trial's box-shadow no longer derives from the foreground color, so
  elevation reads as elevation rather than as a halo on dark themes, and its
  border clears 3:1 against the workspace in both modes.
  
  `<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
  one button in the tab order, arrows moving focus within, Home and End jumping
  to the ends. It takes an `aria-label`.
  
  Two colors were wrong rather than merely untokenized. The selected toggle in
  `PropertyPanel` drew near-black text on an accent fill at 1.49:1 in dark mode;
  it now uses `--wzl-fg-on-accent`. `LayerList`'s checkbox had no `accent-color`
  and rendered in the OS blue.
- c534ff5: Give every control one height, and stop labkit styling weasel-ui by load order
  
  `--wzl-control-h` described itself as the height of a button, input or select
  and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
  hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
  apart unnoticed. The four controls read the token now and the token is 24px,
  which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
  onto `--wzl-control-h` — a segmented control is a control, not the strip a row
  of them sits in — and its `height` prop writes a private variable so setting it
  cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
  that *contains* controls, and 24px there would clip the focus ring of a 24px
  control inside it.
  
  In labkit, a class handed to a weasel-ui component through `className` landed
  beside that component's CSS-module class at equal specificity, so whichever
  stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
  so a component always paints its own controls, and deliberate overrides carry a
  `.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
  had stretched over its own buttons, hiding the leading "10" of "100%".
  
  Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
  never been visible; a trial's config panel was crushed to 60px of a 270px panel
  by its sidebar extras; and the lab header wrapped to three lines because a
  `Select` swallowed the row's slack while the mode toggle compressed past its own
  labels.
  
  `LabProps` gains `footer`, which had no route short of building `LabShell`
  yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
  bare string, so a layer can carry a label distinct from its canvas id and be
  marked `alwaysOn` — both already honoured by the layer list, neither
  expressible. Existing `string[]` declarations still typecheck. `Instrument`
  gains a third type parameter for a job's item type, which had been pinned to
  `never`; TypeScript infers all three or none, so a `defineInstrument` call that
  names state and config must name the item type too.
- fca9bcf: Assemble a trial's chrome from what its instrument declares. A contribution is
  data keyed to a region — `toolbar`, `palette`, `sidebar`, `viewport`, `status` —
  and the regions render whatever the assembled list puts in them. Bundles
  concatenate built-ins, then the instrument's, then the lab's, and a duplicate id
  throws. A lab adds its own with `chrome` and drops a built-in with `suppress`.
  
  An instrument declaring `tools` gets a palette region and its own tool slot; one
  declaring none reads the lab's, which `<Lab tools>` fills. The resolved tool
  reaches the instrument on `RenderContext.trial.activeToolId`.
  
  Breaking: `detectCapabilities`, `CapabilityFlags`, `ToolbarSlot`, `SidebarSlot`,
  `StatusBarSlot`, the matching `Trial*Context` types, `DefaultToolbar`,
  `DefaultSidebar`, `DefaultStatusBar` and `TrialChrome`'s `sidebarExtras` are
  removed. Zoom moves from the trial toolbar to the new viewport region.
- 4f5d111: Declare an instrument's config once, with `f.schema`
  
  An instrument used to declare its config twice: `defaultConfig(): TC` for the
  values and their types, and `configSchema(): ConfigField[]` repeating every key
  as a control with a label, bounds and a second default. Nothing held the two to
  one answer, and `validateConfigSchema` could not catch the drift because it only
  ever saw the schema.
  
  `f.schema` replaces both. It infers `TC`, supplies the defaults, and says how
  each value is edited:
  
  ```ts
  const config = f.schema({
    showGrid: f.boolean(true),
    cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  })
  
  defineInstrument({ config, ... })   // defaultConfig is synthesized
  type Config = ConfigOf<typeof config>
  ```
  
  This is additive. An instrument written with `defaultConfig` + `configSchema`
  keeps working, and both paths now resolve to one renderer.
  
  **Built on weasel-ui's `PrefLeaf`, not on `ConfigField`.** That vocabulary — the
  one `PrefsForm` renders, and the one core's structurally-identical `ToolPrefLeaf`
  feeds `SelectionPanel` — already carried kinds, bounds, options, labels, groups
  and an open leaf kind. `ConfigField` was a third dialect of it, so it is now
  adapted into `PrefLeaf` rather than extended.
  
  Four ways in, for a lab that needs something the built-in controls do not give:
  
  - `ControlPanel` takes `renderers`, keyed by config path (checked first) or leaf
    kind, matching `PrefsForm.renderers` and `SelectionPanel.renderers`. A path key
    overrides one field; a kind key supplies a control labkit does not ship.
  - `.render()` on a builder node is the colocated form of the same thing.
  - `<Lab configRules>` runs rules over every leaf before labkit's own inference,
    so a lab states a convention once instead of annotating each field. labkit's
    own inference ships as rules in that same vocabulary.
  - `.showIf()` hides a row while the value stays in config, and `.section()`
    groups rows under a heading.
  
  `validateConfigSchema` no longer rejects an unrecognized field type: a lab
  supplies controls for its own kinds through `renderers`, which validation cannot
  see. Key, label and per-kind constraint checks are unchanged. Relatedly,
  `ControlPanel` now renders a labeled placeholder for a kind with no control
  instead of dropping the row silently.
- 3e40669: Rebuild what a lab gets by default.
  
  `ControlPanel` is built on the property rows instead of hand-rolled native
  inputs, so an instrument's config panel is themed and aligned rather than
  showing OS-blue checkboxes against the parchment theme. Same props, same
  schema.
  
  `<Lab>` renders a header: add a trial, and choose the color mode. Both drove
  `LabContext` with no UI at all, so every consumer rebuilt them.
  
  `JobProgress` replaces the ad-hoc job markup in the trial chrome — a real
  progress element that stays indeterminate until the job reports a total,
  with failures and errors distinguished.
  
  A trial paints a raised surface, so it reads as a panel against the workspace
  instead of being separated from it by a hairline.
  
  **`@weasel-js/core` and `@weasel-js/ui` are now declared dependencies.** Both
  were re-exported from published subpaths (`/weasel-canvas`, `/weasel-ui`)
  while sitting in `devDependencies`, so a clean install could not resolve
  them. The consumer smoke test grew a manifest audit that catches this class of
  break for every package, and labkit is now packed and imported by it.
- 511a547: Add `<FloatingPanel>` to `@weasel-js/labkit` — a draggable box that floats over
  its offset parent and snaps to that parent's corners.
  
  Drag it from anywhere that is not a control: `input`, `button`, `a`, `select`,
  `textarea` and any `[data-no-drag]` element pass their pointer through, and a
  drag that does start stops the event reaching a pan/zoom surface underneath.
  `anchor` picks the resting corner, `snapCorners` limits which corners may
  capture it, `inset` sets how far in it sits, and `storageKey` remembers where it
  was left across reloads.
  
  It drives windease's `floatingStrategy` — `layout()` and `reduce()` called as
  pure functions — rather than mounting a windease container, because a lab
  overlay has one item and no zone tree. This raises labkit's `windease` floor to
  `^1.3.0`.
  
  Parent it to the canvas stack's overlay: it positions against its offset parent,
  so nesting it inside another absolutely-positioned overlay child measures that
  child's box instead of the canvas.
- 69ca8c6: `LayerList` and `LayerStack` now draw the same grip. `DragHandleGlyph` moves to
  `primitives/` and is used by both, replacing the `⋮⋮` text `LayerList` carried.
  It stays out of `@weasel-js/ui`'s icon register on purpose: that register is
  outline strokes at a fixed weight, and a grip is filled dots.
  
  The grip's grab target is padded and the padding cancelled by an equal negative
  margin, so it is comfortable to hit without drawing anything larger than the
  dots or widening the row.
  
  A small `Button`'s label drops to `--wzl-font-size-sm`. It had converged with
  medium's at 13px, which sat top-heavy against a small button's 12px icon and
  20px box.
- 8abb451: Add `<Legend>` to `@weasel-js/labkit` — a color key for labeling what a lab
  draws on its canvas.
  
  An entry is `{ key, label, color, mark? }`. `mark` picks the swatch shape so the
  key looks like the thing it names: `line` (default), `dash`, `dot` or `band`.
  The color rides a `--lk-legend-ink` custom property, which lets one rule set
  paint all four shapes from the same value.
  
  Presentational only — no handlers, no state, no hover behavior. Swatches are
  `aria-hidden`, leaving the label to carry the meaning.
- 9c84cdf: Add a `titlebar` region, and move the trial's close button into it. The close
  button stays a suppressible contribution rather than becoming markup baked into
  the title bar, so `suppress: ['close']` still works and a consumer can put its
  own control up there. `TitleBarRegion` is exported alongside the other five.
  
  Panels no longer inset themselves. `.lk-sidebar-section__body` was insetting a
  panel and then `.lk-control-panel` and `.lk-layer-list` each inset it again,
  which put the first control 16px into a 161px-wide sidebar. The section body is
  now the only gutter, and it is tighter.
  
  The layer list's drag grip was inheriting the `:where(button)` element default,
  so a glyph rendered in a 37×24 box with a border, an elevated fill and a
  backdrop blur. It is now the glyph.
  
  The trial title bar's bottom border moves from `--wzl-line-subtle` to
  `--wzl-border`, matching the toolbar directly below it — at the subtle value it
  was effectively invisible in light mode.
  
  Save-snapshot moves from the trial group to the history group, beside undo and
  redo.
- d9f110e: Stop every frame loop while nothing can see it
  
  New public hook `useVisibleRaf` in `@weasel-js/core` owns the question of
  whether a frame may run: nothing runs while `document.hidden`, and a loop that
  names an element also stops while that element is outside the viewport. A
  request made while suspended is held rather than dropped and re-armed on
  resume, so a loop never polls visibility or needs restarting by hand.
  
  Ten loops now run behind it — `useFrameLoop`, `useAnimator`, `useSimulation`,
  `useDecayLoop`, `useTextEdit`'s overlay follow, `CursorCoordsHud`'s FPS
  counter, `Badge`'s crawl, and labkit's `FpsMeter`, `useTiledSurface` and
  `useLayerScheduler`. Only `useFrameLoop` consulted `document.hidden` before;
  the rest ran on any page left open. `useLayerScheduler` looked safe and wasn't:
  it paints only dirty layers, but a hidden tab still commits React updates and
  its view/size effect marks every layer dirty.
  
  Loops measuring elapsed time rebase their clock through the new `onResume`
  option, so an hour spent hidden does not arrive as one hour-long frame — an FPS
  meter reporting a rate nobody achieved, a tween jumping to its end value on
  return. `dangerouslyRunWhenHidden` opts a loop out for offscreen recording or
  export; nothing in the tree sets it.
  
  `npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
  in kit source, and runs in CI.
- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.
- c2d3906: Never clamp a canvas's opening zoom out of reach
  
  An instrument declaring `initialView.zoom` far outside `usePanZoom`'s default
  `[0.1, 32]` range collapsed on the first wheel event and could not zoom back:
  the clamp rewrote the opening zoom to whichever bound it crossed, and pan was
  rescaled by the same ratio, so the canvas appeared to go blank on one twitch.
  
  `usePanZoom` now widens its effective range to always admit the zoom the
  canvas opened at, for the life of that canvas — an explicit `maxZoom` below
  the opening zoom no longer wins. `CanvasStack` and `CanvasCapability` (an
  instrument's `canvas` config) both gain optional `minZoom` / `maxZoom` props
  so an instrument can also widen the range up front instead of relying on the
  invariant to save it.
- Updated dependencies [c1e567f]
- Updated dependencies [555f84c]
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
- Updated dependencies [1f67cad]
- Updated dependencies [0769eea]
- Updated dependencies [c534ff5]
- Updated dependencies [69ca8c6]
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
- Updated dependencies [f918a87]
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
  - @weasel-js/ui@1.3.0
  - @weasel-js/core@1.3.0
  - @weasel-js/theme@1.3.0

## 2.0.0-pre.0

### Patch Changes

- 1f67cad: Draw labkit's chrome and the ui components from one type, weight and shape
  scale. Sizes fold onto six ranks, so a 12px label now renders at 11 and a 14px
  one at 13; corners fold onto four radii. `Button`'s `sm` and `md` text sizes
  converge as part of that fold — the two still differ in height and padding.

  Three components that were exported but rendered nowhere now appear in the
  default chrome: `FpsMeter` and `ScaleIndicator` in the status bar,
  `ZoomControl` in the viewport controls, replacing the plain zoom readout.
  `StatusBar.Section` takes `end` to push a readout to the far side, mirroring
  `Toolbar.Group`.

  The trial's box-shadow no longer derives from the foreground color, so
  elevation reads as elevation rather than as a halo on dark themes, and its
  border clears 3:1 against the workspace in both modes.

  `<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
  one button in the tab order, arrows moving focus within, Home and End jumping
  to the ends. It takes an `aria-label`.

  Two colors were wrong rather than merely untokenized. The selected toggle in
  `PropertyPanel` drew near-black text on an accent fill at 1.49:1 in dark mode;
  it now uses `--wzl-fg-on-accent`. `LayerList`'s checkbox had no `accent-color`
  and rendered in the OS blue.

- c534ff5: Give every control one height, and stop labkit styling weasel-ui by load order

  `--wzl-control-h` described itself as the height of a button, input or select
  and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
  hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
  apart unnoticed. The four controls read the token now and the token is 24px,
  which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
  onto `--wzl-control-h` — a segmented control is a control, not the strip a row
  of them sits in — and its `height` prop writes a private variable so setting it
  cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
  that _contains_ controls, and 24px there would clip the focus ring of a 24px
  control inside it.

  In labkit, a class handed to a weasel-ui component through `className` landed
  beside that component's CSS-module class at equal specificity, so whichever
  stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
  so a component always paints its own controls, and deliberate overrides carry a
  `.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
  had stretched over its own buttons, hiding the leading "10" of "100%".

  Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
  never been visible; a trial's config panel was crushed to 60px of a 270px panel
  by its sidebar extras; and the lab header wrapped to three lines because a
  `Select` swallowed the row's slack while the mode toggle compressed past its own
  labels.

  `LabProps` gains `footer`, which had no route short of building `LabShell`
  yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
  bare string, so a layer can carry a label distinct from its canvas id and be
  marked `alwaysOn` — both already honoured by the layer list, neither
  expressible. Existing `string[]` declarations still typecheck. `Instrument`
  gains a third type parameter for a job's item type, which had been pinned to
  `never`; TypeScript infers all three or none, so a `defineInstrument` call that
  names state and config must name the item type too.

- fca9bcf: Assemble a trial's chrome from what its instrument declares. A contribution is
  data keyed to a region — `toolbar`, `palette`, `sidebar`, `viewport`, `status` —
  and the regions render whatever the assembled list puts in them. Bundles
  concatenate built-ins, then the instrument's, then the lab's, and a duplicate id
  throws. A lab adds its own with `chrome` and drops a built-in with `suppress`.

  An instrument declaring `tools` gets a palette region and its own tool slot; one
  declaring none reads the lab's, which `<Lab tools>` fills. The resolved tool
  reaches the instrument on `RenderContext.trial.activeToolId`.

  Breaking: `detectCapabilities`, `CapabilityFlags`, `ToolbarSlot`, `SidebarSlot`,
  `StatusBarSlot`, the matching `Trial*Context` types, `DefaultToolbar`,
  `DefaultSidebar`, `DefaultStatusBar` and `TrialChrome`'s `sidebarExtras` are
  removed. Zoom moves from the trial toolbar to the new viewport region.

- 4f5d111: Declare an instrument's config once, with `f.schema`

  An instrument used to declare its config twice: `defaultConfig(): TC` for the
  values and their types, and `configSchema(): ConfigField[]` repeating every key
  as a control with a label, bounds and a second default. Nothing held the two to
  one answer, and `validateConfigSchema` could not catch the drift because it only
  ever saw the schema.

  `f.schema` replaces both. It infers `TC`, supplies the defaults, and says how
  each value is edited:

  ```ts
  const config = f.schema({
    showGrid: f.boolean(true),
    cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  })

  defineInstrument({ config, ... })   // defaultConfig is synthesized
  type Config = ConfigOf<typeof config>
  ```

  This is additive. An instrument written with `defaultConfig` + `configSchema`
  keeps working, and both paths now resolve to one renderer.

  **Built on weasel-ui's `PrefLeaf`, not on `ConfigField`.** That vocabulary — the
  one `PrefsForm` renders, and the one core's structurally-identical `ToolPrefLeaf`
  feeds `SelectionPanel` — already carried kinds, bounds, options, labels, groups
  and an open leaf kind. `ConfigField` was a third dialect of it, so it is now
  adapted into `PrefLeaf` rather than extended.

  Four ways in, for a lab that needs something the built-in controls do not give:

  - `ControlPanel` takes `renderers`, keyed by config path (checked first) or leaf
    kind, matching `PrefsForm.renderers` and `SelectionPanel.renderers`. A path key
    overrides one field; a kind key supplies a control labkit does not ship.
  - `.render()` on a builder node is the colocated form of the same thing.
  - `<Lab configRules>` runs rules over every leaf before labkit's own inference,
    so a lab states a convention once instead of annotating each field. labkit's
    own inference ships as rules in that same vocabulary.
  - `.showIf()` hides a row while the value stays in config, and `.section()`
    groups rows under a heading.

  `validateConfigSchema` no longer rejects an unrecognized field type: a lab
  supplies controls for its own kinds through `renderers`, which validation cannot
  see. Key, label and per-kind constraint checks are unchanged. Relatedly,
  `ControlPanel` now renders a labeled placeholder for a kind with no control
  instead of dropping the row silently.

- 3e40669: Rebuild what a lab gets by default.

  `ControlPanel` is built on the property rows instead of hand-rolled native
  inputs, so an instrument's config panel is themed and aligned rather than
  showing OS-blue checkboxes against the parchment theme. Same props, same
  schema.

  `<Lab>` renders a header: add a trial, and choose the color mode. Both drove
  `LabContext` with no UI at all, so every consumer rebuilt them.

  `JobProgress` replaces the ad-hoc job markup in the trial chrome — a real
  progress element that stays indeterminate until the job reports a total,
  with failures and errors distinguished.

  A trial paints a raised surface, so it reads as a panel against the workspace
  instead of being separated from it by a hairline.

  **`@weasel-js/core` and `@weasel-js/ui` are now declared dependencies.** Both
  were re-exported from published subpaths (`/weasel-canvas`, `/weasel-ui`)
  while sitting in `devDependencies`, so a clean install could not resolve
  them. The consumer smoke test grew a manifest audit that catches this class of
  break for every package, and labkit is now packed and imported by it.

- 511a547: Add `<FloatingPanel>` to `@weasel-js/labkit` — a draggable box that floats over
  its offset parent and snaps to that parent's corners.

  Drag it from anywhere that is not a control: `input`, `button`, `a`, `select`,
  `textarea` and any `[data-no-drag]` element pass their pointer through, and a
  drag that does start stops the event reaching a pan/zoom surface underneath.
  `anchor` picks the resting corner, `snapCorners` limits which corners may
  capture it, `inset` sets how far in it sits, and `storageKey` remembers where it
  was left across reloads.

  It drives windease's `floatingStrategy` — `layout()` and `reduce()` called as
  pure functions — rather than mounting a windease container, because a lab
  overlay has one item and no zone tree. This raises labkit's `windease` floor to
  `^1.3.0`.

  Parent it to the canvas stack's overlay: it positions against its offset parent,
  so nesting it inside another absolutely-positioned overlay child measures that
  child's box instead of the canvas.

- 69ca8c6: `LayerList` and `LayerStack` now draw the same grip. `DragHandleGlyph` moves to
  `primitives/` and is used by both, replacing the `⋮⋮` text `LayerList` carried.
  It stays out of `@weasel-js/ui`'s icon register on purpose: that register is
  outline strokes at a fixed weight, and a grip is filled dots.

  The grip's grab target is padded and the padding cancelled by an equal negative
  margin, so it is comfortable to hit without drawing anything larger than the
  dots or widening the row.

  A small `Button`'s label drops to `--wzl-font-size-sm`. It had converged with
  medium's at 13px, which sat top-heavy against a small button's 12px icon and
  20px box.

- 8abb451: Add `<Legend>` to `@weasel-js/labkit` — a color key for labeling what a lab
  draws on its canvas.

  An entry is `{ key, label, color, mark? }`. `mark` picks the swatch shape so the
  key looks like the thing it names: `line` (default), `dash`, `dot` or `band`.
  The color rides a `--lk-legend-ink` custom property, which lets one rule set
  paint all four shapes from the same value.

  Presentational only — no handlers, no state, no hover behavior. Swatches are
  `aria-hidden`, leaving the label to carry the meaning.

- 9c84cdf: Add a `titlebar` region, and move the trial's close button into it. The close
  button stays a suppressible contribution rather than becoming markup baked into
  the title bar, so `suppress: ['close']` still works and a consumer can put its
  own control up there. `TitleBarRegion` is exported alongside the other five.

  Panels no longer inset themselves. `.lk-sidebar-section__body` was insetting a
  panel and then `.lk-control-panel` and `.lk-layer-list` each inset it again,
  which put the first control 16px into a 161px-wide sidebar. The section body is
  now the only gutter, and it is tighter.

  The layer list's drag grip was inheriting the `:where(button)` element default,
  so a glyph rendered in a 37×24 box with a border, an elevated fill and a
  backdrop blur. It is now the glyph.

  The trial title bar's bottom border moves from `--wzl-line-subtle` to
  `--wzl-border`, matching the toolbar directly below it — at the subtle value it
  was effectively invisible in light mode.

  Save-snapshot moves from the trial group to the history group, beside undo and
  redo.

- d9f110e: Stop every frame loop while nothing can see it

  New public hook `useVisibleRaf` in `@weasel-js/core` owns the question of
  whether a frame may run: nothing runs while `document.hidden`, and a loop that
  names an element also stops while that element is outside the viewport. A
  request made while suspended is held rather than dropped and re-armed on
  resume, so a loop never polls visibility or needs restarting by hand.

  Ten loops now run behind it — `useFrameLoop`, `useAnimator`, `useSimulation`,
  `useDecayLoop`, `useTextEdit`'s overlay follow, `CursorCoordsHud`'s FPS
  counter, `Badge`'s crawl, and labkit's `FpsMeter`, `useTiledSurface` and
  `useLayerScheduler`. Only `useFrameLoop` consulted `document.hidden` before;
  the rest ran on any page left open. `useLayerScheduler` looked safe and wasn't:
  it paints only dirty layers, but a hidden tab still commits React updates and
  its view/size effect marks every layer dirty.

  Loops measuring elapsed time rebase their clock through the new `onResume`
  option, so an hour spent hidden does not arrive as one hour-long frame — an FPS
  meter reporting a rate nobody achieved, a tween jumping to its end value on
  return. `dangerouslyRunWhenHidden` opts a loop out for offscreen recording or
  export; nothing in the tree sets it.

  `npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
  in kit source, and runs in CI.

- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.

  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.

- c2d3906: Never clamp a canvas's opening zoom out of reach

  An instrument declaring `initialView.zoom` far outside `usePanZoom`'s default
  `[0.1, 32]` range collapsed on the first wheel event and could not zoom back:
  the clamp rewrote the opening zoom to whichever bound it crossed, and pan was
  rescaled by the same ratio, so the canvas appeared to go blank on one twitch.

  `usePanZoom` now widens its effective range to always admit the zoom the
  canvas opened at, for the life of that canvas — an explicit `maxZoom` below
  the opening zoom no longer wins. `CanvasStack` and `CanvasCapability` (an
  instrument's `canvas` config) both gain optional `minZoom` / `maxZoom` props
  so an instrument can also widen the range up front instead of relying on the
  invariant to save it.

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
- Updated dependencies [1f67cad]
- Updated dependencies [0769eea]
- Updated dependencies [c534ff5]
- Updated dependencies [69ca8c6]
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
- Updated dependencies [f918a87]
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
  - @weasel-js/core@2.0.0-pre.0
  - @weasel-js/ui@2.0.0-pre.0
  - @weasel-js/theme@2.0.0-pre.0

## 1.2.0

### Minor Changes

- 659f8b2: A lab can drive a renderer labkit does not own

  `CanvasStack` paints into a 2D context and schedules its own layers, so a
  three.js viewer — which brings its own `WebGLRenderer`, its own context and its
  own render loop — had nowhere to go. Five additions, each of which two separate
  labs had already hand-written.

  **`useTiledSurface`** publishes every tile's rect, marks tiles dirty, delivers
  DPR and container size, and coalesces a burst of invalidations into one
  `onFrame`. The consumer keeps the GL: `preserveDrawingBuffer`, the scissor loop
  and the scene graph stay outside the package, because a scheduler that knew about
  them would stop working for a shared 2D surface. `onFrame` carries every tile's
  rect rather than only the dirty ones, since a scissored draw has to know where it
  is drawing relative to a surface that may have resized under it.

  The registry's unit is a **rect**, not a trial. A trial holding a drawn pane
  beside an undrawn one registers one; a trial with nothing to draw registers none.

  **A tile that only moves reports nothing to a `ResizeObserver`**, so `Workspace`
  now invalidates rects off the grid's own `node.placementChanged`. Only labkit can
  see that a tile moved, which left hosts polling until the rects held still.

  **`toDeviceRect`** flips a DOM rect to a GL viewport's bottom-left origin and
  snaps both edges to the device-pixel grid. Unsnapped, a tile and its neighbour
  round apart and strand a hairline column between them.

  **A trial's `view` is now opaque to labkit.** It was `{ zoom, pan }`, and it is
  the only camera state labkit persists, restores on Reset and shows in the
  sidebar — so a 3D lab kept a parallel view in a ref and forfeited all three.
  `TrialRecord` takes a view type parameter, and labkit persists the value without
  reading into it. Nothing written against the 2D view changes; `as2DView` narrows
  for the parts that are inherently 2D, and `RenderContext.trial` gains `view` and
  `setView` beside the existing `zoom` / `setZoom`.

  **`TrialStatusBarContext.zoom` is now `number | null`.** The default status bar
  omits the zoom section rather than reporting 100% for a view that has no zoom.
  A custom `statusBar` slot reading `ctx.zoom` must handle null.

  **`useOrbit`** is the 3D peer of `usePanZoom`: drag to turn, wheel or pinch to
  dolly, double-click to go home. Trigonometry only — it imports no renderer, and
  produces a trial view rather than a matrix.

  **A `job` capability** for work too slow to do during a render. The runtime
  starts it, aborts on unmount and on a `key` change, discards results from a
  superseded run, counts progress, and renders a readout and a cancel control into
  the trial chrome. Per-item failure is a first-class event rather than a thrown
  error, because a run with two failed items is a partial success and its other
  items are worth showing.

  Two new subpaths: `@weasel-js/labkit/surface` and `@weasel-js/labkit/job`.

  <!-- bump-approved: minor: Mike — new public API in labkit (useTiledSurface, useOrbit, the job capability, and the surface/ and job/ subpaths), plus a nullable TrialStatusBarContext.zoom; called explicitly in conversation on 2026-08-23: "next version will be 1.2" -->

### Patch Changes

- 2627cde: Fix a hook-order defect in the Badge effects and several stale-closure bugs,
  found by turning on a correctness lint baseline.

  Six Badge effects (`Aqua`, `Bevel`, `Bevel2`, `Metal`, `Sheen`, `Woodgrain`)
  called `useId` after an early return keyed on `variant`. Changing a `<Badge>`'s
  variant to one those effects don't render, and back, remounted the component
  and issued fresh ids — so the `<clipPath>` and gradient ids their `url(#…)`
  references point at changed identity mid-life.

  Also fixed: `Canvas.tsx`'s paint effect read a stale `helpersForLayers` through
  its closure rather than the ref the file maintains, and `useDeviceProfile`
  ignored a `targetScale` supplied by a provider.

  `composeOrderedLayers` is now generic over the `LayersMap` it receives instead
  of taking `any`; inference at existing call sites is unchanged.

  - @weasel-js/theme@1.2.0

## 1.1.0

### Patch Changes

- e2a2013: A drawing instrument can show a readout, and its layers can follow the camera

  Three gaps that together made a canvas instrument hard to build.

  **`render` is an overlay, not an alternative.** `Workspace` rendered the canvas
  _or_ the instrument's DOM, so anything that drew lost the ability to put numbers
  beside its drawing — for a measuring instrument, most of the point. The
  workaround was painting the readout onto a layer as text, giving up selection,
  theming, wrapping and layout. `instrument.render(ctx)` is now passed to
  `CanvasStack` as children and lands in `.lk-canvas-stack__overlay`. An
  instrument returning `null` behaves exactly as before.

  **Layers now draw in world coordinates.** The instrument-level adapter passed
  `zoom` but dropped `pan`, so panning was inert for every instrument-declared
  layer: the gesture moved the view, the layer redrew, and nothing moved. A layer
  could not implement panning itself either, because the value never arrived.
  `Workspace` now applies the camera to the context before calling `draw`, so a
  layer places world geometry directly. `zoom` is still in the args for what must
  not scale — `ctx.lineWidth = 1 / zoom`. **A layer that already mapped
  coordinates by hand will now double-apply and must drop its own mapping.** The
  lower-level `CanvasLayerDescriptor.render(ctx, view)` is unchanged and still
  gets an untransformed context, which is what screen-space chrome wants.

  **Typed instruments no longer need a cast.** `defineInstrument<TS, TC>` returns
  `Instrument<TS, TC>`, which parameter contravariance kept out of
  `LabProps.instruments`, so every consumer wrote `as unknown as Instrument` at
  the point the types were supposed to pay off. The prop is now `InstrumentList`
  (`readonly Instrument<any, any>[]`), newly exported; the `any` is contained to
  that alias.

- 3cfb1b4: `<Lab>` sizes itself correctly on a page that has not been reset for it

  `.lk-lab` is `height: 100%`, which resolves against its containing block, so
  the component only filled the window when the host had already given every
  ancestor a height and zeroed the body margin. Every example in this repo
  hand-writes `html, body, #root { margin: 0; height: 100% }` to make that true,
  and a consumer who supplies the height but not the margin reset got a page
  taller than the viewport — one wheel notch of scroll, which reads as a stuck
  canvas rather than as overflow. Supplying neither collapsed the lab to zero
  height and rendered a blank page.

  `styles.css` now carries the reset the component's own sizing assumes, scoped
  with `:has` so a page that mounts no lab is untouched. It reaches the lab's
  own parent and stops there, so a lab embedded in a sized box still fills that
  box and cannot resize its host's layout.

- 11efb43: Rename a lab's tile from workspace to trial, and the area they sit in to workspace.

  `Workspace` named two different things: one tile, and the grid the tiles were
  laid out in. A tile is now a **trial** — `<Trial>`, `TrialRecord`,
  `TrialChrome`, `TrialIdProvider` / `useTrialId`, `addTrial` /
  `updateTrialState` / … — and the grid takes the freed word, so `WorkspaceGrid`
  is now `<Workspace>`. `useExperimentState` is `useTrialState`: it was always
  per-tile, which is the conflation this removes. `Experiment` keeps its meaning
  as one `storageKey`'s worth of state — what the lab document holds — so
  `<SingletonExperimentProvider>` is unchanged.

  This is a breaking rename of most of the lab runtime's public surface. Every
  `Workspace*` symbol that meant a tile is gone; there are no aliases.

  CSS classes move with it: `.lk-workspace` (the tile chrome) is `.lk-trial`,
  `.lk-workspace-tile` is `.lk-trial-tile`, and `.lk-workspace-grid` is
  `.lk-workspace`.

  A saved lab opens unchanged. The document format goes to version 2 and its
  migration renames `workspaces` to `trials`; a version-1 document, and a
  pre-document lab still on the four legacy keys, both fold forward on load.

- 77f3d9b: Zoom past 2x reads as a multiplier

  The workspace toolbar and status bar showed zoom as a percentage at every
  scale, so a lab zoomed deep into its geometry read `1600%`. Above 2x they now
  show `16x` instead; at 2x and below the percentage is unchanged.

  Both surfaces went through the same `Math.round(zoom * 100)` expression
  written twice. They now share `formatZoom`, alongside the other display
  helpers in `ui/format`.

- 9a7d4ba: Zoom readout stays legible past 100x

  `formatZoom` switched from a percentage to a multiplier above 2x but kept one
  decimal place at every magnitude, so a trial zoomed to 1009.74 read
  `1009.7x` — a tenth of a multiple is below anything a reader can act on, and
  the digits crowd out the toolbar and status bar. Past 100x the decimal is
  dropped and thousands are grouped, so the same view reads `1,010x`.

  Note that the toolbar's `+` / `−` buttons still bypass the 0.1–32 clamp that
  `usePanZoom` applies to wheel zoom (`TrialChrome` multiplies the current
  zoom and calls `setZoom` directly), which is how a trial reaches four
  digits at all. That inconsistency is unchanged here.

- 23ceef3: Persist a lab as one versioned document rather than four loose keys.

  `lk:<storageKey>:doc` now holds `{version, trials, saves, layout, mode}` and
  hydration runs a migration chain over it. A lab saved under the previous four
  keys is folded into the document on first load; the old keys are removed only
  after the new document is read back and confirmed, so a storage write that
  fails silently leaves the original data intact. A document written by a newer
  labkit than the one reading it is left alone and that store stops persisting,
  rather than being overwritten. A document that fails to parse or migrate is set
  aside under `lk:<storageKey>:quarantine`.

  `serializeTrials` and `deserializeTrials` now take and return records
  rather than a JSON string. Both are internal to the state runtime.

- Updated dependencies [2d30a32]
  - @weasel-js/theme@1.1.0

## 1.0.4

### Patch Changes

- 7bd1817: Tile workspaces with windease instead of CSS grid

  `WorkspaceGrid` now renders a `windease` grid zone. The arrangement is
  unchanged — windease's `gridStrategy` auto-balances to `ceil(sqrt(n))`
  columns, which is what labkit's own `gridDims` computed, verified identical
  for 1–16 tiles — but tiles are absolutely positioned at strategy-computed
  rects rather than laid out by CSS, and `resizable` gives them draggable,
  keyboard-operable seams.

  Two breaking bits for anyone importing them: `gridDims` and its `GridDims`
  type are gone, and `.lk-workspace-grid` no longer sets the
  `--lk-grid-cols` / `--lk-grid-rows` custom properties.

  New `WorkspaceGrid` props: `ids` (stable identity per tile — supply it
  whenever a tile can be closed from the middle, or panes inherit each other's
  dragged extents), `resizable`, `gap`, `padding`, and `viewport` for
  environments where nothing measures.

  `dist/styles.css` gains windease's baseline stylesheet as a layer. Consumers
  import nothing new; the tiles depend on those rules to position at all.

- a542198: Reorderable workspaces, and tile extents that survive a reload

  `WorkspaceGrid` gains four props. `reorderable` (off by default) renders a
  drag handle per tile and reports the order a drop would produce through
  `onReorder` — the grid never reorders `children` itself, so the caller stays
  the owner of the list. `layout` / `onLayoutChange` carry per-tile extents:
  hand the last value back as `layout` and a dragged seam survives a reload.
  Both key off `ids`, and neither does anything without it.

  `<Lab>` wires all four. Workspace order and tile extents now persist
  alongside workspaces, snapshots, and theme, under a new `layout` storage key.

  Also new: `reorderWorkspaces(workspaces, ids)` in the workspace ops, and
  `reorderWorkspaces` on the lab context.

  - @weasel-js/theme@1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [514c34a]
  - @weasel-js/theme@1.0.3

## 1.0.2

### Patch Changes

- f322c78: `@weasel-js/labkit/styles.css` now carries styles for the components labkit
  passes through. It previously held only labkit's own `.lk-*` chrome, so anything
  reached via `@weasel-js/labkit/weasel-ui` arrived with class names matching no
  rule — a `Slider` rendered as a zero-height track with unpositioned thumbs — and
  nothing errored anywhere. The import path is unchanged; a consumer already
  importing it gets the fix by upgrading.

  The stylesheet is now three layers: `@weasel-js/theme` tokens (the `--wzl-*`
  custom properties weasel-ui's rules read), weasel-ui's compiled CSS modules, then
  labkit's chrome last so it overrides what it wraps. Layer two is taken from the
  same `@weasel-js/ui` build tsup bundles the JS out of, since CSS-module class
  names are minted per build and the two have to match.

  The consumer smoke test holds this: every scoped class name in the shipped
  bundle must have its module's rules present in the shipped stylesheet.

  - @weasel-js/theme@1.0.2

## 1.0.1

### Patch Changes

- 75e15ca: `useRovingTabIndex` — the arrow-key focus behavior `ActionsBar`, `OptionsBar`,
  and `ToggleBar` each implemented separately, now one hook they share (and one
  `@weasel-js/ui` exports, re-exported through `@weasel-js/labkit/weasel-ui`).
  It handles the tab stop, arrow/Home/End navigation with disabled items skipped
  and wrap-around at both ends, and optional selection-follows-focus for
  radiogroup-style bars. Its docs say when a bar should _not_ use it: a
  container of arbitrary compound controls has to leave the arrow keys to those
  controls, which is why `ToolOptionsBar` still doesn't have one.

  No keyboard behavior changed in any of the three bars.

  - @weasel-js/theme@1.0.1

## 1.0.0

### Major Changes

- 5debfac: labkit's theming collapses into the shared system.

  **Breaking.** `@weasel-js/labkit/theme-light.css` and
  `/theme-interstellar.css` are gone, and so are the 42 `--lk-*` custom
  properties — component styles read `--wzl-*` now. `<Lab>` and `<LabShell>`
  take `mode` (`"auto" | "light" | "dark"`) instead of `theme`
  (`"auto" | "light" | "interstellar"`); a stored `"interstellar"` preference
  hydrates as `"dark"`. `LabTheme` is now `LabMode`, and the store's `setTheme`
  is `setMode`.

  `interstellar` is exported as a `Theme` value — authored as a DTCG document,
  loaded through `loadDTCG`, extending the built-in theme. It overrides values
  only: labkit's font weights, radius and glass blur differ from weasel's, and
  `extends` rebases everything else.

  Fixes three sets of references that had no definition and silently fell back
  to hardcoded light-mode values or to nothing, which is why `LayerList`,
  `Palette`, `DragGhost`, `ControlPanel` and `CanvasStack` did not follow the
  theme.

  `@weasel-js/theme` gains the token groups labkit contributed: a four-step
  spacing scale, three z-layer constants, a ten-color categorical swatch set,
  `--wzl-backdrop`, `--wzl-control-h`, `--wzl-glass-blur`, `--wzl-radius-lg`,
  `--wzl-font-size`, `--wzl-font-size-sm` and `--wzl-font-weight-medium`.
  `ThemeProvider` accepts `className` and `style`, so its wrapper can be the
  consumer's own layout element instead of an extra div inside it.

### Patch Changes

- Updated dependencies [5debfac]
- Updated dependencies [6855465]
  - @weasel-js/theme@1.0.0

## 0.8.0

### Patch Changes

- 0d5cdc4: Design tokens are generated from a DTCG source.

  `packages/theme/tokens/` is now the only hand-edited token artifact. One
  generator emits `tokens.css`, the TS theme objects, the `TokenName` union, and
  the Storybook token manifest, replacing a hand-written stylesheet, a
  hand-mirrored `DEFAULT_TOKENS` object, and two separate regex parsers that each
  re-derived the token list from CSS on disk. A determinism test fails if the
  committed output drifts from the source.

  The `color-mix()` tokens (`--wzl-line*`, the button hover/pressed fills) are now
  computed exactly on the JS side instead of being, per the old file's own header,
  "plausible hex approximations". CSS output still emits `color-mix()` so a
  downstream override of the referenced token keeps tinting.

  Modes are selected with `data-wzl-mode` (was `data-theme`), and are declared
  per-theme in the DTCG source rather than as hand-restated selector blocks.

  Oswald and Inter now ship with the package under OFL 1.1 and load via a new
  opt-in `@weasel-js/theme/fonts.css` entry; `tokens.css` no longer `@import`s a
  stylesheet from `fonts.googleapis.com`. labkit consumes the same font files
  instead of its own copy — which it had been publishing with no license file,
  no `OFL.txt`, and no attribution — and gains the `LICENSE` it was missing. Its
  `@font-face` also no longer declares a `100 900` weight axis; Oswald's real
  range is `200 700`.

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

## 0.7.1

## 0.1.0

### Minor Changes

- ec64b15: First public release of @weasel-js/labkit — React widgets for building self-contained interactive lab pages (primitives, controls, layers, drag-and-drop, property panels, undo, canvas helpers). Ships as a self-contained bundle with no `@weasel-js/*` runtime dependencies.
