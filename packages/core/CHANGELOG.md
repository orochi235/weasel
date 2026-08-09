# Changelog

## 0.8.0

### Minor Changes

- bdcdfe5: Clipboard keyboard actions, and two bugs the wiring flushed out.

  `clipboard.copy` (Cmd/Ctrl+C) and `clipboard.cut` (Cmd/Ctrl+X) are kit-standard
  descriptors. Publish the imperative surface `useClipboardOps` returns as the new
  `clipboard` dep and both work; the buttons a consumer already has and the
  shortcut then route through one implementation instead of two. Cut is copy plus
  the same batched delete `deleteAction` performs — one undo entry.

  There is deliberately no `clipboard.paste`. Cmd/Ctrl+V already arrives as a DOM
  `paste` event, which the dispatcher routes to `ingest` and the content-handler
  registry — the path that reaches the OS payload. A key binding would fire
  alongside it and paste twice.

  Two older bugs, both found by actually pressing the keys:

  - **Deleting a container together with its children threw mid-batch.**
    `removeNode` cascades the subtree, so a group's op already takes its members
    with it and the members' own ops then hit `unknown node id`. Selecting a group
    and its contents at once — what Cmd+A does — was enough. `deleteAction` and
    `clipboard.cut` now share one op builder that skips any id with a selected
    ancestor.
  - **Cmd+D did nothing at all.** Two faults stacked. `duplicate` threw before
    its `enabled` gate could answer, because the gate reads `deps.selection` and
    the descriptor never declared it — an undeclared read the dev-build deps
    Proxy treats as an error. Declared now, with a sweep test over every
    `requiresSelection`-gated descriptor so the next one can't ship the same way.
    And underneath that, the invoker was a stub whose body was `void params`,
    deferring to a "legacy bridge" that no longer exists. `duplicateAction` now
    really duplicates: each selected node with its whole subtree (so a duplicated
    group comes out populated, not empty), offset by the same 12 units a paste
    gets, as one undoable batch, with the copies selected afterward. Descendants
    are offset only for absolute-pose scenes — with a `poseComposition`
    registered, poses are relative and moving the root already carries them.

  `polygonHitTestRect` moved from `features/paths/` to `core/geometry/`: it is
  pure geometry, `core/adapters/arrayAdapter.ts` needs it, and core may not import
  from features. Same exports from the package barrel.

- e0ab60e: Device profile: the kit stops assuming a mouse.

  `DeviceProfile` is one object holding pointer coarseness, hover capability and
  pixel density, resolved once per `<SceneCanvas>` and published to its subtree.
  Two things read it. The chrome-caps rule layer gains `coarsePointer:` and
  `canHover:` selectors (plus matching fluent atoms), so consumers can gate
  chrome on the device. And every handle size and hit radius — six independent
  literal `8`s and one `24` before this — now derives from one base module times
  `DeviceProfile.targetScale`, so a coarse pointer gets 14px handles and a 42px
  rotation distance without paint and hit-test ever drifting apart. The public
  `DEFAULT_HANDLE_SIZE` / `DEFAULT_ROTATION_HANDLE_DISTANCE` constants keep
  their unscaled values.

  `longPress` is a real gesture kind: spec, event, matcher, and route grammar.
  The dispatcher synthesizes it for touch and pen presses held 500ms without
  crossing the drag threshold — never for a mouse, and cancelled by movement,
  release, cancel, or a second finger landing. An unmatched long-press
  re-dispatches as `contextmenu`, so existing `contextMenu` bindings become
  reachable by touch with no consumer change.

  Also fixes a density bug: `useCanvasSize` read `devicePixelRatio` only inside
  its `ResizeObserver` callback, so moving a window to a different-density
  display without resizing it left the snapshot stale. Density now comes from
  the profile, which watches a re-armed resolution media query.

  Override any of it with the new `<SceneCanvas device={{ coarsePointer: true }}>`
  prop — for tests, for demos that want touch-sized chrome on a desktop, and for
  hybrid devices where the media query guesses wrong.

- 3d693c7: Underline and strikethrough shortcuts, and the core boundary goes strict.

  Cmd/Ctrl+U toggles underline and Cmd/Ctrl+Shift+X toggles strikethrough, both
  through `toggleFlagInRange` like bold and italic — so they toggle _off_, a mixed
  range turns fully on, and a collapsed caret gets a pending style that styles the
  next character only. `rangeStyle.ts` had listed both flags all along; only
  `useTextEdit`'s `StyleFlag` and its keydown switch were narrower.

  Underline in particular had to be intercepted rather than merely supported.
  Left alone, the browser ran its own `formatUnderline` and `domToRuns`' `<u>`
  flattening made that look like it had worked while bypassing the run algebra
  entirely. The flattening stays — it's what lets pasted decoration survive — but
  it was never the mechanism. Bare Cmd+X is deliberately left to the browser so
  cutting text mid-edit still works; only Cmd+Shift+X is claimed.

  The `core/` ← `features/`/`interactions/` lint rule no longer exempts type
  imports. Three types core named across the boundary moved down to where core
  can own them — `Path` to `core/geometry/path.ts`, `RectPose` to
  `core/scene/types.ts` (whose doc comment already claimed it lived in core), and
  `ModifierState` to `core/modifierState.ts` — each with a re-export left at its
  old address, so no importer changes.

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

- Updated dependencies [e0ab60e]
- Updated dependencies [e264d62]
  - @weasel-js/gestures@0.8.0
  - @weasel-js/font@0.8.0
  - @weasel-js/geom@0.8.0
  - @weasel-js/history@0.8.0
  - @weasel-js/modes@0.8.0

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

- a19124d: `VERSION` reports the right number again. `@weasel-js/core@0.7.1` was published
  from a working tree whose `dist/` predated the version bump, so the constant
  baked into that tarball reads `0.7.0` while the package it ships in is `0.7.1` —
  the one export whose entire job is to say what you are running, saying the wrong
  thing. Nothing else in 0.7.1 is affected: the value is stamped at build time by
  `tsup`'s `define`, so only a stale build can desync it, and only `core` bakes it.

  npm tarballs are immutable, so 0.7.1 cannot be corrected in place. Anything
  pinned there should move to this release; `0.7.1` is deprecated on npm pointing
  here.

- Updated dependencies [8bc719a]
  - @weasel-js/font@0.7.2
  - @weasel-js/geom@0.7.2
  - @weasel-js/gestures@0.7.2
  - @weasel-js/history@0.7.2
  - @weasel-js/modes@0.7.2

## 0.7.1

### Patch Changes

- a3af158: Gestures are now keyed per pointer. `gestureIdFor` returned the literal string
  `pointer-mouse` with nothing interpolated — despite its own docs promising
  `pointer-<pointerId>` — so every pointer shared one in-flight handle slot and
  two pointer gestures could not coexist. Pointer events carry `pointerId` now
  and the id interpolates; events without one (synthetic probes, most tests)
  still key to `pointer-mouse`.

  That removes an accident the pinch path was relying on, so the multitouch
  policy is stated rather than implied: when a second pointer lands, the
  multitouch channel claims every pointer that hasn't already committed to a
  gesture, suppressing both drags and taps from those pointers. A drag already in
  flight keeps running — yanking a gesture away from someone who rested a palm is
  worse than letting it finish.

  `useTools` also reports routing conflicts now. `findConflicts` had been
  written, tested, and never called, so the kit could detect its one class of
  genuine routing ambiguity and never looked. It runs at registry assembly under
  a dev guard and warns each conflict in the grammar the route was written in. It
  warns and never throws: a consumer tool colliding with a kit tool can be
  deliberate, since the loser may still take the gesture by declining through
  `enabled()`.

- a3af158: Scenes with many shapes or much text draw far less work per frame. Two caches
  the kit already had were missing on essentially every node of every frame,
  because the values they key on were rebuilt each time.

  The tessellation cache (`WeakMap<Path, Mesh>`) keys on `Path` identity, but
  `kit:shape` allocated a fresh path for every ellipse, polygon and star on every
  draw. Painters now memoize `paint` against the node, so the same path comes
  back and the cache does its job: 1000 shape nodes went from 6.69 to 0.20
  ms/frame through paint and tessellation.

  Text layout is the larger one. `layoutRuns` — which walks every codepoint,
  resolves a face per run, measures, wraps and places each glyph — ran per text
  command per frame. It is now cached in the renderer, keyed on the resolved
  runs. 200 wrapped paragraphs went from 31.8 to 0.06 ms/frame, 1000 short
  labels from 12.5 to 0.42. The cache drops itself when a font becomes
  available, so text still reflows the moment the real face lands.

  Two contracts follow from this, for anyone writing a custom painter or calling
  these directly:

  - The array a painter's `paint` returns belongs to the painter. Treat it as
    immutable and copy before appending — `defaultDrawOne` now does, for its
    label overlay.
  - `registerFont` now notifies `subscribeGlyphReady` when a family finishes
    registering, so a font loaded mid-session repaints without waiting for an
    unrelated redraw. `glyphGeneration()` is a new pull-based companion to that
    signal, for caches that can't hold a subscription.

- 6af4806: Reorder: `Cmd/Ctrl+Shift+]` and `Cmd/Ctrl+Shift+[` now bring-to-front and
  send-to-back. The shortcut every drawing app uses could never fire — modifier
  matching is strict, so a binding without `shift` in its spec cannot match a
  keystroke that holds it, which also made the shifted `'}'` / `'{'` characters
  in those key lists unreachable. `Cmd+Alt+]` / `Cmd+Alt+[` remain as the
  fallback for browsers that reserve `Cmd+Shift+[`/`]` for tab switching.

  `BUNDLE_TOOLS.standard` no longer includes `pencil`. Freehand is a specialist
  instrument rather than part of the everyday shape-drawing set; it is still in
  `exhaustive`. Consumers wanting it back can pass `tools={{ pencil: true }}`
  alongside the bundle.

- a3af158: Clicks now land on the shape a node actually paints, not on its bounding box.
  The pose rect is the wrong answer for anything that isn't a rectangle: a click
  in a star's notch, in the corner outside an ellipse, or in the blank half of a
  text box went to the node that merely bounds that point, burying whatever was
  really underneath. `picking: 'shape'` had been available since it shipped and
  was opt-in only because flipping it changes what a click selects.

  Ink counts too, not just the boundary. A shape whose interior isn't filled —
  an outlined rect, a pencil stroke, a bare line — is now grabbable along its
  outline and not through its empty middle, which is the opposite of what a fill
  test alone answers. Painters declare this through the new `NodeShapeEntry.ink`;
  one that declares none is treated as filled, the previous behavior.

  Pass `geometry={{ picking: 'pose' }}` to `SceneCanvas` for the old rect
  behavior. Painters with no silhouette are unaffected either way, so nothing
  becomes unreachable.

- 2003597: Export `VERSION` — the kit version a build was compiled from, baked in at
  build time. Apps can pair it with their own compile timestamp to report what
  they're running (WeaselDraw now shows `0.7.0 · Jul 30` in its status bar).
- Updated dependencies [6af4806]
- Updated dependencies [a3af158]
  - @weasel-js/font@0.7.1
  - @weasel-js/geom@0.7.1
  - @weasel-js/gestures@0.7.1
  - @weasel-js/history@0.7.1
  - @weasel-js/modes@0.7.1

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

- a925117: Text antialiasing is derived from the screen-space derivative instead of a
  constant.

  Both SDF text shaders computed their smoothstep band from a fixed `u_aaWidth`
  (0.05, set once per draw). A constant band cannot be correct at more than one
  scale: at 16px it collapsed to well under a screen pixel, so glyph coverage
  quantized to all-or-nothing and edges rendered as hard stair-steps; at display
  sizes the same constant read mushy. `TEXT_FRAG_SRC` and `TEXT_FRAG_R8_SRC` now
  take the band from `fwidth(sdfVal)`, which folds in font size, zoom, and DPR
  together, with a small floor so a degenerate derivative can't reproduce the
  aliased behavior.

  This changes how all GL-rendered text looks — most visibly at UI sizes, where
  it is the difference between binary and antialiased edges.

  Breaking, for anyone driving the shaders directly:

  - `u_aaWidth` is gone from both fragment sources and from `TEXT_SDF_UNIFORMS`.
    There is no CPU-side AA knob to set; the shader derives it. Setting the
    uniform was never useful — the kit only ever wrote 0.05 to it.

- eeae450: A codepoint the atlas never baked now falls back to a real glyph instead of a
  literal `?`.

  Font fallback resolved at family granularity: `resolveFontVariant` picks one
  tier for a whole run. But a baked MSDF atlas covers a fixed charset, so a run
  served by a perfectly good atlas can still contain a character that atlas has
  no glyph for — an em dash, a curly quote, anything outside the subset. Those
  drew codepoint 63. That fabricates a character the author never wrote and is
  indistinguishable from one they did; the committed text baseline read "Themed
  editing ? magenta caret" for a full commit without anyone noticing.

  `layoutRuns` now escalates the individual codepoint to the dynamic canvas
  tier, which rasterizes from installed fonts and can usually serve it for real.
  The escalated glyph gets its own draw group (different texture and shader) and
  is scaled by its own atlas's bake size. When escalation isn't available the
  character is skipped with a warning naming it, rather than substituted —
  `.notdef` is what a text stack should draw here, and the BmFont format has no
  such glyph.

  New in `@weasel-js/font`:

  - `resolveGlyphFallback(family, weight, style)` returns a canvas-tier
    `ResolveResult` for per-codepoint escalation, or `null` when it isn't
    available. Declines under the `'none'` fallback policy, which documents a
    miss as a hard miss, and when there is no canvas to rasterize into (SSR)
    rather than throwing into the layout pass.

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
  - @weasel-js/font@0.7.0
  - @weasel-js/geom@0.7.0
  - @weasel-js/gestures@0.7.0
  - @weasel-js/history@0.7.0
  - @weasel-js/modes@0.7.0

## 0.6.0

### Patch Changes

- @weasel-js/geom@0.6.0
- @weasel-js/gestures@0.6.0
- @weasel-js/history@0.6.0
- @weasel-js/modes@0.6.0

## 0.5.1

### Patch Changes

- @weasel-js/geom@0.5.1
- @weasel-js/gestures@0.5.1
- @weasel-js/history@0.5.1
- @weasel-js/modes@0.5.1

## 0.5.0

### Minor Changes

- 7e1982f: Publish the sub-packages. `@weasel-js/geom`, `/gestures`, `/history`, `/modes`,
  `/svg`, `/d3`, `/theme`, `/ui`, and `/hud` are now real published packages
  rather than source inlined into `@weasel-js/core`'s bundle.

  For consumers of `@weasel-js/core` this is close to transparent — the public
  API is unchanged and the sub-packages install as dependencies. It matters if
  you were using any of those packages' types indirectly, or if you want to
  depend on one alone: the geometry kernel (`@weasel-js/geom`) and the headless
  undo engine (`@weasel-js/history`) are dependency-free and usable without the
  React canvas.

  The change also removes a latent duplicate-module hazard: while the packages
  were inlined, a consumer holding both `@weasel-js/core` and one of them would
  have gotten two copies of it.

  `@weasel-js/ui` ships its styles as one bundled stylesheet — import
  `@weasel-js/ui/style.css`. `@weasel-js/theme` exposes its tokens at
  `@weasel-js/theme/tokens.css`.

### Patch Changes

- @weasel-js/geom@0.5.0
- @weasel-js/gestures@0.5.0
- @weasel-js/history@0.5.0
- @weasel-js/modes@0.5.0

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 0.4.0 — 2026-06-15

### Breaking changes

- **npm scope migrated `@orochi235/*` → `@weasel-js/*`.** The root package is
  now `@weasel-js/core` (was `@orochi235/weasel`); the `weasel-` prefix was
  dropped from the workspace sub-packages and their directories renamed. The
  orochi235 GitHub URLs and author field are intentionally retained — this is
  an npm-only move.
- **Membership-group apparatus removed.** The old `Group` record / `GroupAdapter`
  are gone. `group` / `ungroup` now create and dissolve a structural
  `ContainerNode` (`kind: 'container'`) and reparent the selection under it; the
  container persists in the scene tree and round-trips to SVG `<g>`. A _saved
  selection_ is just a consumer-held `string[]` passed to `selection.set` — it is
  no longer a scene entity. See `docs/taxonomy.md` ("Group vs Selection").
- **`LayoutStrategy` renames:** `getChildPositions` → `childPoses`,
  `reflowFor` → `reflowPoses`. Update implementations and call sites.

### Added

- **Move behavior pipeline.** `useMove` runs an ordered `opts.behaviors`
  pipeline over a scene-backed gesture adapter, so consumers can compose
  move-time effects (snap, layout reflow, …) instead of forking the tool.
  Threaded through the select binding via `move.behaviors`.
- **Drag-time layout reflow.** A move into a layout container now runs a
  reflow pass that folds sibling poses into the preview channel during the
  drag, and commits via the strategy's `commitDrop` plus source-reflow ops.
- **`Scene.loadState`** — in-place restore of a serialized snapshot (extracted
  `applyConstructionSpecs` / `specsFromSerialized` for reuse).
- **`measureTextBounds`** — atlas-based text measurement against the MSDF font
  registry.
- **labkit absorbed into the monorepo** as the `packages/labkit` workspace
  package (published as `@lab-kit/react`), with its own CI wiring, smoke test,
  and Storybook/Pages docs unification.
- Dispatcher dev tooling: a live dispatch-trace widget in ToolkitBuilder, and
  `enableKeybindings` now also gates the dispatcher key channel.
- New `MoveSnapDemo` exercising container-snap + snap-back.

### Build / tooling

- `.d.ts` emission via `rollup-plugin-dts` with the alias pipeline; tsup code
  splitting enabled so entry points share a single font registry; the
  `@weasel-js/*` sub-packages are bundled into `dist` for publish.
- CI actions bumped off Node 20 (checkout v6 / setup-node v6 / pages v5);
  residual React `act()` warnings cleaned up at their call sites; visual
  baselines re-captured from `ubuntu-22.04`.

### Deprecated

- `Canvas` is now marked `@internal` / `@deprecated` and dropped from the
  README. Use `<SceneCanvas>` over a `useScene()` tree instead. The export
  is retained for this minor version and will be removed in the next.
  Bare `<Canvas>` has no scene-mutation signal, so high-frequency repaints
  must force React re-renders, which can wedge the tools machinery.

## 0.3.0 — 2026-05-09

### Added

- `Canvas` / `SceneCanvas` `shaders?: ShaderProgramHandle[]` prop — registers
  custom shader programs on the underlying renderer at init time and on
  prop change. Pairs with the experimental `registerProgram` /
  `ShaderDrawCommand` API. Pass a stable (e.g. module-scope) array
  reference; the prop is keyed by the joined handle ids so an inline literal
  won't trigger recompiles each render.

### Fixed

- `extractUniformNames` (the helper that pre-populates uniform locations for
  custom shader programs) now expands array uniform declarations into per-slot
  names. A shader declaring `uniform vec3 u_ripples[8];` previously produced
  no entries — neither `u_ripples` nor `u_ripples[0]`...`u_ripples[7]`.
  Consumer-side `ShaderDrawCommand.uniforms` keyed `'u_ripples[i]'` would
  silently fail to bind. Array uniforms now resolve correctly per slot.

## 0.2.0 — 2026-05-09

### Breaking changes (final WebGL swap — Step 10)

- **2D backend removed.** `<Canvas>` and `<SceneCanvas>` no longer accept `backend?: '2d' | 'gl'`. WebGL2 is the only backend. The kit's existing `background`, `view`, `scene`, etc. props are unchanged; just the `backend` switch is gone.
- **`@weasel-js/gl` deleted as a separate package.** All renderer source folded into `@weasel-js/core`:
  - GL machinery → `src/renderer/` (`WeaselRenderer`, `draw`, `state/`, `math/`, `cache/`, `shaders/`, `textures/`)
  - Font atlasing → `src/features/text/atlas/` (`FontAtlas`, `GlyphLayout`, `registerFont`)
  - Path tessellation → `src/features/paths/tessellate/` (`tessellate`, `polyline`, `stroke`)
  - Font assets → `assets/fonts/inter/`
- **`RenderLayer` interface simplified** to a single required `draw(view, ...): DrawCommand[]`. The 2D `draw(ctx, ...)` and GL-suffixed `drawGL(...)` are gone.
- **Pair renames** for the same reason: `SceneSlotConfig.drawOneGL` → `drawOne`, `*Tool.drawGhostGL` → `drawGhost`, `createChildrenLayer.drawChildGL` → `drawChild`. The 2D originals are deleted.
- **`drawLayersGL` renamed to `drawLayers`** (Phase-B coda), and the 6 debug-overlay `emit*GL` helpers dropped their `GL` suffixes (file-private).
- **Deleted exports:** `applyPaint`, `applyStroke`, `renderFilledRegion`, `RenderFilledRegionOptions`, `setupCanvasDpr`, `useFixedPixelRatio`, `SetupCanvasDprOptions`, `LayerRenderer` (abstract base class), `traceToContext`, `dragGhost` (`createDragGhost`).
- **Pattern API rebuilt on `TextureHandle`.** `createTilePattern(opts)` now takes `{ size, draw }` (no `ctx`), renders the tile to an `OffscreenCanvas` internally, and returns a `TextureHandle | null` via `registerTexture`. Each built-in (`hatch`, `crosshatch`, `dots`, `chunks`) drops its `ctx` parameter and returns a `TextureHandle | null`. The `Paint` `'pattern'` variant's payload is now `TextureHandle` (not `CanvasPattern`).
- **`Paint`, `Stroke`, `Region`, `StrokeAlign`, `GradStop` types preserved.** They moved to `src/core/paint-types.ts` (the implementation file `paint.ts` is gone). Public surface re-exports are unchanged.
- **`PixelDensityDemo` retired.** Its only purpose was demonstrating the deleted DPR helpers.

### Build / tooling

- `tsup.config.ts` `patterns-builtin` entry restored (after the C3 deletion + port).
- `package.json` `./patterns-builtin` export block restored.
- Vite `publicDir` updated to `assets/fonts`.
- Dropped weasel-gl-specific scripts: `test:smoke:step1`, `gen:font`, `bundlesize:weasel-gl`.

### Migration notes (in-repo)

Demos and `apps/draw` were updated in this release. No external consumers exist. The TypeScript types and re-export paths above tell the whole story; no migration guide ships.

### Added

#### `<SelectionContextProvider>` (`@experimental`)

- Ambient context publishing the active selection (`readonly string[]`) and an optional parallel `kinds` array so non-canvas UI (palette, status bar) can render type-aware copy ("3 paths selected"). `SceneCanvas` auto-publishes; consumers can override per-id labels via a `describeKind?: (node) => string` prop.
- New exports: `SelectionContextProvider`, `useSelectionContext`, `usePublishSelection`, `SelectionContextValue`.

#### Command palette extracted to `@weasel-js/ui`

- The demo's `<CommandPalette>` is now part of `packages/ui/` (alongside `<PropertiesPanel>`). Hooks (`useActionsRegistry`, `useAction`, `evaluateEnabled`, `ActionDisabledReason`) stay in the kit.
- The palette renders a kind-aware header ("1 path selected", "3 objects selected", "No selection") when `<SelectionContextProvider>` is in scope.

#### WebGL2 backend (carried over from the 0.1.x soak)

These items shipped as the `@experimental` GL backend during Steps 1–9; in 0.2.0 they're the only backend.

- New workspace package `@weasel-js/gl` housing the GL2 renderer.
- `WeaselRenderer` with WebGL2 context lifecycle, DPR-aware resize, and
  context-loss/restore handling.
- `<Canvas>` / `<SceneCanvas>` accept `backend?: '2d' | 'gl'` (default `'2d'`).
  Warn-once on post-mount backend change. The `background` prop is honored under
  `backend='gl'`.
- Path tessellation via earcut for `nonzero` fills; stencil two-pass for
  `evenodd`. WeakMap path-mesh cache; rect fast-path with shared VBO.
- Strokes: ribbon-mesh expansion with bevel/miter/round joins, butt/square/round
  caps, miter limits, dash patterns, and full `StrokeAlign` (`center`/`inner`/
  `outer`) — inner/outer via stencil clip on `PolygonPath` and
  `alignedStrokeRect` on `RectPath`. New exports: `tessellateStroke`,
  `extractPolylines`, `StrokeAlign`, `alignedStrokeRect`.
- Text via MSDF atlases. `registerFont(family, atlasUrl)` public API. Prebuilt
  Inter v4 atlas ships with `weasel-gl/fonts/`. `pnpm gen:font` script wraps
  `msdf-bmfont-xml` for custom atlases.
- Image, pattern, and gradient paints. New `Paint` variants:
  `linear-gradient`, `radial-gradient`, `conic-gradient` with `GradStop[]`.
  `GLImageCache` (WeakMap-keyed) and `GradientRampCache` (1×256 textures).
- Per-vertex colors: `vertexColors?: number[]` on `kind: 'path'` `DrawCommand`.
- Color matrix: `colorMatrix?` (4×5 row-major) on `kind: 'group'`. Composes
  through nested groups via `compose4x5`. `IDENTITY_COLOR_MATRIX` export.
- Custom shader API (`@experimental`): `registerProgram(id, vert, frag)`,
  `registerTexture(image)`, opaque `ShaderProgramHandle` / `TextureHandle`,
  `kind: 'shader'` `DrawCommand` with uniform map (`number`, `vec2..4`, `mat3`,
  `mat4`, `texture`). Auto-quad geometry over `bounds`; vertex prelude exposes
  `v_uv` / `v_screen` / `v_world` varyings.
- `RenderLayer` gained additive `drawGL?` and `Dims`. `viewToMat3` helper for
  layers translating `View` to GL transform. Eight built-in layers ported:
  `createPathLayer`, `createTextLayer`, `createGridLayer`,
  `createSelectionOverlayLayer`, `createCellHighlightLayer`,
  `createChildrenLayer`, `createPenPreviewLayer`, `createDebugOverlayLayer`.
- `SceneSlotConfig.drawOneGL` to render scene content under `backend='gl'`.
- Tool overlays render under GL: `useSelectTool` / `useCloneTool` gained
  `drawGhostGL` and `drawOneGL` options; drag-insert overlay renders under GL.
- Visual-regression rig (Playwright + pixelmatch) with per-pixel
  `threshold: 0.1` and `< 2%` pass criterion. Per-demo specs (~24 demos);
  pinned to `ubuntu-22.04`. Dedicated CI workflow (manual trigger). Demo
  supports `?backend=` query string via `BackendContext`.
- Bundle-size CI gate fails on `weasel-gl` prod-bundle delta > 50 KB.

#### Actions registry (`@experimental`)

- `<ActionsProvider>` mounts a single keydown listener and dispatches to a
  central registry. `useActionsRegistry()` and `useAction(action)` hooks.
- Default action factories: `defaultSelectAllAction`, `defaultEscapeAction`,
  `defaultDuplicateAction`, `defaultNudgeActions` (8 bindings),
  `defaultReorderActions` (2 bindings).
- `<SceneCanvas>` auto-mounts a provider when none exists upstream and
  auto-registers the default action set, derived from `scene` / `selection` /
  `adapter`. New `actions` prop accepts `null` (disable all), partial override
  by id, or full `Action` descriptors for new ids.
- `useStandardActions(adapter, scene, selection)` registers the same default
  set for bare-`<Canvas>` consumers.
- Public types: `Action`, `ActionEntry`, `ActionsProp`, `ActionsRegistry`,
  `KeyBinding`.

#### Rotated resize

- `useResize` operates in the leaf's local frame when the pose carries
  rotation. The drag delta is projected through `R(−θ)`, anchor math runs
  in local frame, and the diagonally opposite world-space corner is pinned.
  Bit-identical for unrotated leaves (rotation = 0 short-circuits to today's
  path).
- New `ROTATED_POSE_DESCRIPTOR: PoseDescriptor<RotatedPose>` for the standard
  rotated-rect case. `PoseDescriptor` gains optional `getRotation?(pose):
number` so consumer pose types can opt into the rotation-aware path.
- New `fixedCornerOf(bounds, anchor): {x, y}` helper exposed via the
  `/resize` subpath barrel.
- Hit-test rotates handle positions to match the overlay's drawn handles —
  pointer events on visible handles register correctly on rotated objects.
- Group resize with rotated children remains unsupported; dev-mode
  `console.warn` fires once per gesture when any leaf has rotation ≠ 0.
- New demo: `demo/demos/RotatedResizeMathDemo.tsx` — three-panel math
  explainer with two counterexample descriptors (no projection, no position
  correction) plus live anchor-invariant ledger captions.

#### Other

- Plain scroll wheel zoom in `SceneCanvas.viewport`; trackpad pinch fix.
- `useHandTool` moved into the tool registry; `useKeybindings` wired through
  `SceneCanvas`.
- Momentum animation gained bounds + stop-on-edge policy.
- `ViewportDemo` and animation-stress visual harness (100 drag cycles under
  `backend='gl'`).
- Demo sidebar shows the weasel logo (transparent variant).
- npm scripts `test:changed` and `test:related` for fast inner loops.

### Changed

- `RenderLayer` interface gained an additive `drawGL?` method (no breaking
  change to the existing `draw`). Through step 9 both signatures coexist; the
  step-10 final swap collapses to a single `draw` and removes the 2D path.
- `<SceneCanvas>` now auto-wires viewport tools and the default actions set
  internally. Demos using `useSelectAll` / `useEscape` / `useDuplicate` /
  `useNudge` / `useReorder` directly under `<SceneCanvas>` are now redundant
  (the standalone hooks still work — they register into the auto-provider —
  but can be deleted).
- Standalone action hooks (`useSelectAll`, etc.) register into the parent
  `ActionsProvider` when present and fall back to direct `useKeybinding` when
  not. Bare-`<Canvas>` behavior is unchanged.
- `SceneCanvas.tsx` split into focused submodules.
- 2D `applyPaint` / `applyStroke` handle the new gradient `Paint` variants by
  falling back to opaque black; gradients render only under `backend='gl'`
  in v1.
- `weasel-gl` tessellator now handles compound paths with multiple positive
  contours; orphan opposite-wound contours are promoted to independent
  positives. Uses first-contour winding as the reference, not signed-area sign.
- Rect-path GL caching keyed on dimensions, not `Path` identity, so equivalent
  rects share meshes across nodes.

### Fixed

- `useAnimator` now cleans up on unmount; tripwire test guards regressions.
- `animateOnSetPose` short-circuits when a tween is already in flight and
  detects re-entry from any animator tick.
- WebGL: stop register-thrash with a `FinalizationRegistry` cleanup pass,
  later disabled (use-after-free risk) in favor of transient + deferred-delete
  pools that prevent GL buffer leaks.
- WebGL: rect fast-path uses a shared VBO to eliminate per-frame allocations.
- WebGL: premultiplied-alpha output paired with matching `blendFunc`; request
  stencil buffer at context creation; canvas CSS size set on resize.
- WebGL: miter join now emits both apex extension and inner bevel half;
  `splitForDash` honors closed polylines.
- Canvas action key dispatch test coverage added; tool-overrides-default and
  same-id-collision semantics covered.
- BezierEditDemo: `pickEvery` uses AABB+slop so clicks hit the curve;
  `applyOps` added to adapter so area-select wires; `hitTestArea` added so
  drag-marquee selection works.
- Three TS errors blocking `prepublishOnly` resolved.
- `circle`-approximation command-stream lengths corrected in `layers`.
- Visual CI gates on manual trigger only (not every PR/push), avoiding noisy
  cross-platform pixel diffs.

### Deprecated

- The `backend='2d'` codepath is on a deprecation runway. Once the visual
  soak completes, the default flips to `'gl'`; in a follow-up major release
  the 2D path (`paint.ts`, `setupCanvasDpr`, `useFixedPixelRatio`, the
  `RenderLayer.draw(ctx, …)` 2D signature) is removed and `weasel-gl` folds
  back into `weasel`.

## [Pre-Unreleased] — viewport, debug overlays, layout strategies

The following entries predate the WebGL transition but were never tagged.

### Breaking

- `createReparentOp` arg names changed: `from` → `fromParentId`,
  `to` → `toParentId`. Update call sites accordingly.
- `View` now includes `scale: number` (default 1). `viewToTransform` now
  produces `{ panX: -view.x*scale, panY: -view.y*scale, zoom: scale }`.
- `RenderLayer.draw` signature is `(ctx, data, view) => void`. `runLayers`
  accepts an optional `view` (defaults to identity) and wraps world-space
  layers with `setTransform(scale, 0, 0, scale, -x*scale, -y*scale)`;
  screen-space layers get an identity transform.
- `SceneSlotConfig.drawOne` (and `DefaultLayersScene.drawOne`) signature is
  `(ctx, obj, pose, view) => void`.
- `handleHitRadius` is now interpreted in **screen pixels**: divided by
  `view.scale` at each hit-test site so the hit area matches the rendered
  handle size under zoom.
- `usePan` is removed. Use `useHandTool` for drag-pan and `useWheelPanTool`
  for wheel-pan.

### Added

- `LayoutStrategy<TPose>.contains?(containerPose, point)`: optional non-AABB
  containment predicate. `useMove`'s layout-pass hit-test consults it when
  present, falling back to an AABB check on the container's pose.
- `createReparentOp` defaults `coalesceKey` to `reparent:${id}` so successive
  reparents of the same id batch-merge cleanly. Default `label` is
  `'Reparent'`. Layout strategies can return reparent ops from `commitDrop`.
- `tileGrid({ cellToPose })`: optional callback to map a cell rect + the
  dragged pose to the new pose. Default spreads `{x,y,width,height}` over
  the dragged pose. The `tileGrid<TPose>` signature is no longer constrained
  to `RectPose` — pass `cellToPose` whenever TPose doesn't carry rect fields.
- `useMove` layout-pass picks the top-most container in z-order when the
  adapter implements `OrderedAdapter.getChildren`.
- Debug overlay subsystem: `?debug=…` URL gating + `<Canvas debug={...}>`
  prop. Six features ship: `hitboxes`, `handles`, `bounds`, `origins`, `snap`,
  `layers`. Sink threaded through `usePointerGestures`, `useResize`,
  `useRotate`, `useAreaSelect`, `useEditAnchors`, `useSelectTool`, and
  `gridSnapStrategy`.
- New exports: `parseDebugFlags`, `createDebugSink`,
  `createDebugOverlayLayer`, `DEFAULT_DEBUG_THEME`; types `DebugConfig`,
  `DebugSink`, `DebugFeature`, `DebugTheme`, `HitShape`, `HandleKind`.
- `zoomAt(view, anchor, factor, opts?)` pure primitive shared by every zoom
  path.
- `useWheelZoomTool` (alwaysOn, claims wheel when `ctrlKey`/meta is held;
  anchors zoom at cursor).
- `useWheelPanTool` (alwaysOn, claims plain wheel; translates view by
  `delta / scale`).
- `useKeyboardZoomTool` (alwaysOn; `Cmd+=` / `Cmd+-` / `Cmd+0`; anchors at
  canvas center).
- Selection overlays, insert overlay, and area-select overlay run in
  `space: 'screen'` so chrome stays at fixed pixel size under zoom.
- `ZoomDemo` showcases the new tools and screen- vs world-pinned strokes.

## [0.1.0] — 2026-05-03 — Pre-Scene milestone

Pinned ahead of the `useScene` redesign (see `docs/proposals/useScene.md`)
so the pre-Scene state is diffable. Highlights of the surface at this point:

- `<Canvas>` with explicit `adapter` prop, plus inline-props shorthand
  (`items`/`setItems`/`toPose`/`fromPose`/`createDefault`/...) that synthesizes
  an `arrayAdapter` for flat-list scenes.
- Move, resize, insert, area-select, rotate, clone, group (virtual + nested),
  text-edit, and selection-driven action hooks (escape, select-all, duplicate,
  nudge, delete, reorder, clipboard, undo/redo).
- Path poses as a first-class alternative to rect poses (`pathPoseDescriptor`,
  `composePath`, `polygonFromPoints`, `PathBuilder`, `pointInPath`,
  `traceToContext`).
- Text rendering with caret/selection theming, contenteditable in-place edit,
  glyph-position hit testing, `fitTextPose` autosize helper.
- `RotatedPose` extension and `useRotate` gesture; rotation handle on selection
  overlay.
- `UnitSystem` / `UnitValue` for customizable units.
- Grid overlay with cell-hover hook + highlight layer.
- Quadtree demo, compound-paths demo, bezier control-point editing demo.

Extracted from [garden](https://github.com/orochi235/garden)
(`src/canvas-kit/`) as a standalone package on 2026-05-01.
