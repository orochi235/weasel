# @weasel-js/ui

## 1.3.0

### Patch Changes

- ce82f4a: An enum leaf can ask for a segmented control, and `pair` works inside an object

  `ToolPrefEnumControl` gains `'toggle'`: a three-option enum shows all three at
  once instead of hiding two behind a select. Options carry an optional `short`
  label — a capital or two — for the width a property row has; the full `label`
  stays the accessible name, so the abbreviation never becomes the only thing
  naming the option. A mixed selection selects no segment rather than picking a
  winner.

  `pair` now merges fields inside an object leaf, as it already did for section
  rows — a hint shouldn't mean something different for being a field of a value
  rather than a sibling of one. It merges _adjacent_ leaves in both places, so
  the schema orders family, size, weight: size and weight pair, and family (which
  sat between them) moves ahead of the pair rather than splitting it.

  A stroke's cap, join and align share one row; property rows wrap rather than
  overflow when the controls in them don't fit.

- ccd51cc: Add a 43-glyph monochrome icon set to `@weasel-js/ui`.

  One register: a 20x20 viewBox drawn in `currentColor` at stroke-width 1.5 with
  round caps and joins, hairline weight reserved for structure, and filled
  regions only where an action has a subject. Covers transport, history, view,
  trial lifecycle, collection, state, instrument and status vocabulary. Import a
  named component (`CloneIcon`), or `Icon` when the glyph is chosen at runtime.

  `@weasel-js/ui` also re-exports the tool glyphs that live in `@weasel-js/core`,
  so consumers have one import site for the whole set. `ImageIcon` was reachable
  from core's icons folder but missing from its public barrel; it is exported
  now.

  Glyph geometry is generated (`npm run gen:icons`) from `packages/ui/scripts/icons/`
  rather than hand-placed, because arrowheads and joins that miss their terminus
  are invisible at chrome size.

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

- 1a0bea3: `useNodeOverlayFrame`: the coordinate frame a DOM overlay pinned to a node needs

  Nothing in the kit exported one, so consumers hand-rolled it — their own
  `ResizeObserver` next to the existing `useCanvasSize`, and a translate-and-scale
  inverse built by projecting two points. That inverse silently drops
  `pose.rotation`, which is why on-canvas gradient handles on a rotated node sat
  beside the paint instead of on it.

  ```ts
  useNodeOverlayFrame(scene, containerRef, nodeId, { view });
  // → { box, toScreen, toLocal, width, height } | null
  ```

  `box` is the node's composed world box, unrotated — the frame `toScreen` maps
  from, and the box to hand `fillInPoseFrame` / `fillToBoundsFrame`. Rotation
  lives in the pose→world leg, where it belongs: a node's stored geometry and its
  bounds-frame paint are pre-rotation by definition, so neither of those two
  changes.

  `@weasel-js/ui` gains `SceneGradientHandles`, the scene-aware half of
  `GradientHandles`: it reads the gradient out of a node's `fill` **or** its
  `stroke` — `slot` is a prop — and commits each drag through `setFill` or
  `setStroke` as one undo entry. `GradientHandles` itself stays frame-agnostic.

  Also: `isGradientFill` narrows a `FillStyle` to its three gradient members, and
  `useCanvasSize` accepts any `HTMLElement` rather than only a `div`.

- 5f6c28e: An object leaf's fields can be organised into groups

  `ToolPrefObject.children` takes a `ToolPrefGroup` as well as a leaf. A group
  heads its fields under a label and contributes nothing to the path — the same
  rule group keys follow at the top level of a schema, so a field inside one is
  still addressed as a field of the object.

  Without it, a value with many fields renders as one undifferentiated list. A
  `TextStyle` is the case that needs it: its character and paragraph fields are
  one value but read as two lists.

- 3cd1ee8: A schema leaf can hold an object, with its fields hanging off it

  A compound value — a stroke, a shadow, a pattern spec — could be described as
  sibling leaves addressing into it (`data.stroke.width`, `data.stroke.cap`).
  It shouldn't be: each control then writes one field of a value it can only
  half see, and writing a field into something that isn't an object yet corrupts
  it outright.

  `ToolPrefObject` describes the value instead. Its `children` are ordinary
  leaves whose paths are relative to the object, and every child edit commits
  the parent object whole. A field that is itself a union declares the kind that
  edits that union — a stroke's `paint` is a `paint` leaf. `fromScalar` lifts a
  value still held in a scalar form before a child edit lands on it, which is
  how a stroke stored as a bare colour string gains a width.

  `defaultNodeProperties` describes `data.stroke` this way, so the panel shows
  Color, Width, Cap, Join and Align under one Stroke block, and the separate
  `data.strokeWidth` leaf is gone. `SelectionPanel` now honours `block`, which
  `PrefsForm` already did. The one-off `stroke` pref kind added days ago is
  replaced by this general one.

  `dash` has no leaf: it is a `number[]` and no kind edits one. It survives
  import, export and rendering untouched.

- 0114abf: Add `PaintInput`, a control that edits a whole `FillStyle`.

  A kind bar over a per-kind body, driven by the paint-kind registry rather than
  a fixed list, so a consumer's registered kind appears in the bar and renders
  that entry's `Editor`. `SelectionPanel`'s `paint` leaf renders it in place of
  the chip that showed a gradient as indeterminate and wrote a solid over it on
  first touch — so the checkerboard now means a mixed selection and nothing else,
  and a gradient stroke is editable rather than merely paintable.

  Switching kinds keeps a per-kind memory for the control's lifetime, so
  linear -> solid -> linear comes back with its stops instead of the ramp
  `withGradientKind` cannot carry.

  `PatternPicker` moves from WeaselDraw into `@weasel-js/ui`, which now depends
  on `@weasel-js/svg` for its tile previews.

  The bar offers **None**: "what kind of paint is this?" takes no-paint as an
  answer. `setFill` and `setStroke` accept `paint: null` to write it — a fill
  becomes `null`, and a stroke goes away entirely rather than keeping a width
  that draws no ink. `PaintKindEntry` gains an optional `icon`, and the five
  built-in kinds carry glyphs so six segments fit a property row.

  `FILL` and `STROKE` are now peer sections: the `appearance` group goes headless
  and `data.fill` becomes a block leaf. The stroke's paint is no longer paired
  with its width — a whole paint editor cannot share a row with a slider.

- 6a06f6d: Node paint is an object: `data.fill` is a `FillStyle`, `data.stroke` a `Stroke`

  Each concept now has exactly one shape. `data.fill` holds a `FillStyle`,
  `data.stroke` a whole `Stroke`, and `null` on either is an explicit "no paint"
  where `undefined` takes the painter's fallback. Two new authoring helpers keep
  hand-written node data short:

  ```ts
  data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
  ```

  **Breaking, with no compatibility path.** A document written against the old
  shapes renders wrong rather than failing, which is accepted:

  - `NodeFill = string | FillStyle` and `NodeStroke = string | Stroke` are gone,
    and so are the string branches of `resolveNodeFill` / `resolveNodeStroke`.
    A node holding `fill: '#f00'` now paints the default grey.
  - `data.strokeWidth` is deleted. A stroke's width is `Stroke.width`.
  - `data.color` — the legacy alias `kit:path` and the rect fallback read — is
    deleted. The fallback painter reads `data.fill` like everything else.
  - `fill: 'none'` is now `fill: null`; `stroke: 'none'` is `stroke: null`.
  - `NodeInkResult` is gone: a painter's `ink` returns `NodeInk` and nothing
    else. A painter returning `{ filled, strokeWidth }` no longer type-checks
    and its reach is read as zero.
  - `@weasel-js/ui` drops `isStrokeObject`, which existed only to discriminate
    the union; `strokeColorOf` and `strokeWithColor` lose their string branches.
  - `@weasel-js/svg`'s `strokeDataFromSvg` returns `Stroke | undefined` instead
    of a `{ stroke, strokeWidth }` pair, and stops flattening a plain solid
    stroke into a color. SVG's `fill="none"` imports as `fill: null`.

  **A paint's alpha lives in `opacity`, one slot for every paint kind.** That is
  the only slot a gradient or a pattern has, so it is the slot all of them use,
  and the renderer multiplies a hex alpha by it — the two would fight if both
  carried the value. `solid()` therefore moves an alpha channel out of the hex:
  `solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.

  The four setter actions follow: `setFillOpacity` / `setStrokeOpacity` write
  `opacity` rather than splicing hex, so they now work on a gradient fill, which
  they used to leave untouched. `setFill` / `setStroke` given a `color` recolor
  the node's existing paint through the new `paintWithColor`, keeping its opacity
  unless the picked color states an alpha of its own — and `setStroke` keeps the
  stroke's width, cap, join and dash instead of replacing the whole value.

  New exports: `solid`, `strokeOf`, `paintAlpha`, `paintWithAlpha`,
  `paintWithColor`, `DEFAULT_SHAPE_FILL`.

  `defaultNodeProperties` moves `data.fill` from a `color` leaf to a `paint` one
  — a color control pointed at a `FillStyle` reads `undefined` off a gradient and
  writes a bare string over it — and the `data.stroke` object leaf drops its
  `fromScalar`, which had nothing left to lift.

- a37ee0b: Separate a text node's content from its typography, and draw depth only where a label marks it

  The text schema put `data.text` in a group named Text, so the section read
  TEXT and the row inside it read Text — one word nested in itself — and the
  style groups below it read as fields of the content string rather than as its
  siblings. Content is its own section now, with the field full-width because
  the section already names it.

  A group with an empty `name` renders no heading. That already worked for
  sections and is now documented on `ToolPrefGroup`, since it is how a schema
  says "this group organises, it doesn't name": `Character` and `Paragraph`
  carry the labels, and a `Typography` heading over them named nothing new.
  It stays opt-in rather than a rule that rolls up any all-group parent —
  a `Border` over `Top` / `Right` / `Bottom` needs its name.

  Rows under a suppressed heading no longer indent. Depth drawn without a
  visible parent put `Character` a level deeper than `Content` while being its
  peer, which is the panel's own tree discipline broken by its own hand.

- f918a87: A property renderer can read the rest of the node, not just its own leaf

  `PropertyRenderContext` carried one leaf's aggregated value, so a control whose
  subject spans several fields had no way to see the others. `valueAt(path)`
  returns the same `{ value, mixed }` aggregation for any node path across the
  same selection: a value when every selected node agrees, `mixed` when they
  don't, and an undefined value when nothing carries the path.

  WeaselDraw's font picker is the case that asked for it. Its substitution label
  names the variant a family will actually paint in, and it was probing at a
  nominal 400/normal because the node's own `fontWeight` and `fontStyle` were out
  of reach; it now probes at the node's real ones.

- 7a746df: A stroke's dash is edited as a style, not as an array

  `Stroke.dash` already rendered, imported and exported; it had no control,
  because a `number[]` has no leaf kind. It doesn't need one — the thing a person
  chooses is a style, and the array is how it is stored. The stroke block gains a
  Solid / Dashed / Dotted / Custom bar under cap, join and align.

  `ToolPrefEnum` gains `encoding`: `read`/`write` between the stored value and
  the option string, the counterpart of the `unit` a number leaf already has for
  a value stored in a canonical unit. Both directions are handed the object the
  leaf is a field of, because a dash pattern is meaningless without the width it
  scales by — SVG dash lengths are absolute, so a fixed `[6, 3]` is dots on a
  hairline and a railroad on a 20px stroke. `dashForStrokeStyle` /
  `strokeDashStyleOf` are the mapping, exported: **dashed is 3× the width on and
  2× off, dotted 1× on and 2× off**. An array matching neither reads as `custom`,
  a new `disabled` option — one a control reports but refuses to author, since
  there is no array behind it. `solid` is stored as no dash at all, and an object
  leaf's field written as `undefined` is now removed rather than left holding it.

- 4f19274: Cap, join and align are chosen by glyph, and the stroke block drops its labels

  Nine option glyphs and four category glyphs join the icon set. The option
  glyphs are filled silhouettes — the glyph is the ink, so a choice reads as a
  shape rather than as a diagram of one. `align` is a circle zoomed until the
  ink band's far edge leaves the box: `inner` closes into a disc, `outer` into
  the box's complement of it, and `center` is the annulus straddling the path,
  so the three are one band at three offsets. The categories are the bare path
  each row treats, drawn in the outlined register.

  A schema carries a glyph _id_, not a component: `ToolPrefEnum`'s options gain
  `icon`, and every leaf gains one for rows whose own label is spent on a
  `pair`. Core ships no icon set and cannot depend on one, so the field is a
  plain string; weasel-ui resolves it against `ICON_PATHS` and falls back to
  `short` where it names no glyph.

  `SelectionPanel` now honours `block` inside an object leaf, not only at the
  section level. A row whose fields are all `block` drops the 64px label column
  and spans the block. The default stroke schema uses both: paint and width
  share one label-less row, and cap/join/align share the next.

  `align`'s options run inner, center, outer — the order the ink moves outward.

- 07fd2de: `setStroke` takes a whole paint, so a gradient or pattern stroke is writable.

  It accepted `{ color }` only, and merged through `paintWithColor`, which
  supersedes a non-solid paint with a solid one — a gradient stroke was
  unreachable even though `setStrokeOpacity` could already reach its alpha.
  `paint` now wins over `color`, a color arriving later in the gesture supersedes
  an earlier paint, and the stroke's width, cap, join, dash and align survive
  either. New `strokeWith(paint, width?)` is `strokeOf`'s sibling for a paint
  that has no color to pass.

  Two fixes alongside it: `setFill` started with no `color` and no `paint` seeded
  from `DEFAULT_STROKE_COLOR`, painting the selection black where
  `setFillOpacity` seeds the same slot from `DEFAULT_FILL_COLOR`; and
  `gradientForBounds`'s doc comment claimed a corner-to-corner linear gradient
  where the body builds a left-edge-to-right-edge one.

  `@weasel-js/ui` no longer exports `strokeWithColor`. It shared a name with
  core's and disagreed with it — core's keeps the paint's opacity, ui's dropped
  it — and nothing imported it.

- 81213fc: Edit a node's stroke as the union it is

  `data.stroke` holds `string | Stroke`, and the schema described it with a
  `color` leaf — which reads `undefined` off the object form, shows its own
  default, and writes a bare hex back over the stroke's width, cap, join and
  dash on the first edit. The same trap `ToolPrefPaint` was introduced to avoid
  for `FillStyle`.

  A `stroke` pref kind now describes it, and `defaultNodeProperties` uses it.
  Its control shows whichever color the value has — the string itself, or a
  solid paint's color — gives a gradient stroke the indeterminate chip rather
  than claiming a color it doesn't have, and preserves the form on write.

  `PrefsForm` gained the `stroke` case and the `paint` case it never had; a
  `paint` leaf used to render as the literal text `(paint: no renderer)`.
  `solidColorOf`, `strokeColorOf`, `strokeWithColor` and `isStrokeObject` are
  exported from `@weasel-js/ui` for consumers writing their own property
  renderers against either union.

  Cap, join and dash are not editable from a panel yet, and `data.strokeWidth`
  remains its own leaf — see `docs/proposals/2026-08-26-node-stroke-union.md`
  for why that waits on the SVG mapping.

- 2b86e00: A text node's style is one value, not ten sibling paths

  `data.style.fontSize`, `.fontWeight`, `.align` and the rest addressed into one
  `TextStyle` from ten independent leaves, each control writing a field of a
  value it could only half see. `data.style` is an object leaf now, with
  Character and Paragraph as groups inside it — groups head their fields and
  contribute nothing to the path, so a field is still a field of the style and
  one commit writes the whole thing.

  An object leaf whose fields are entirely grouped no longer prints its own
  heading, which would stack straight onto the first group's, and a group's
  fields sit under a rule so the nesting reads. WeaselDraw's inspector descends
  into an object leaf when listing what a kind exposes — the fields are the
  editable surface; the leaf is the container.

  `SelectionPanel` has a story now, which is how the two layout defects above
  were found.

- Updated dependencies [50bc909]
- Updated dependencies [6a06f6d]
- Updated dependencies [20097e6]
- Updated dependencies [2b2d971]
- Updated dependencies [c1b8511]
  - @weasel-js/svg@1.3.0
  - @weasel-js/modes@1.3.0

## 1.2.0

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

  - @weasel-js/modes@1.2.0

## 1.1.0

### Patch Changes

- a19cf56: `Slider` gains `stops`: detents a drag catches on.

  `stops?: number[]` are attractors, not quantization. A drag that comes within
  8 track pixels of a stop lands on it; the arrow keys move stop to stop
  (shift-arrow and Page jump ten), and a thumb added by clicking the track snaps
  the same way. `step` is unchanged and still quantizes the values between
  stops, so the two compose. Home and End keep going to the bounds, and per-thumb
  `bounds` still clamps a snapped value.

  Stops outside `[min, max]` are ignored rather than clamped inward — a stop that
  cannot be reached is a mistake worth leaving visible in the value, not one to
  paper over at an endpoint.

  - @weasel-js/modes@1.1.0

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

  - @weasel-js/modes@1.0.4

## 1.0.3

### Patch Changes

- 3641641: New component: `BandEditor` divides a numeric axis into contiguous bands and
  lets you drag the seams between them. Each band carries a payload the consumer
  supplies and renders through `renderBand`, so the control never learns what a
  band means.

  The axis is always fully covered — N bands, N−1 interior seams, no gaps and no
  overlaps — which makes editing a partition the same thing as editing a sorted
  seam list. Seams clamp at their neighbours instead of crossing, so no drag can
  destroy a band: removal is only ever the explicit merge (`x` / `Delete`, into
  the left neighbour, whose payload survives). The first band's left edge is
  `min` and does not move, and it has no left neighbour to merge into, so a
  partition always keeps at least one part.

  `scale` takes `'linear'`, `'log'` or a `BandScale` of your own, and defaults to
  `'log'` because the interesting part of a width axis is usually its narrow end.
  A log scale needs `min > 0`; given anything else the component falls back to
  linear and warns once in development rather than positioning every seam at
  `NaN`.

  `onInput` fires live during a drag and `onChange` once per committed gesture,
  following `GradientHandles`. `Slider` uses the opposite sense (`onChange` live,
  `onCommit` committed) — a known inconsistency in this package that this change
  deliberately leaves alone.

  Nothing existing changed. The added exports are `BandEditor`, `BandEditorProps`,
  `Band`, `BandScale`, `linearScale` and `logScale`.

- 51aae33: Document every public export of `@weasel-js/ui` with a JSDoc string at its
  definition site, so editor hover and the generated API reference say what each
  component, prop bag and helper is for.

  No behavior, names or exports changed. Where a component's live-versus-committed
  callback pair is spelled differently from its neighbors' — `Slider`'s
  `onChange`/`onCommit` against `GradientEditor`'s `onInput`/`onChange` — the
  docstring records which sense that component uses rather than smoothing it over.

- 917359a: `@weasel-js/ui` now spells the live/committed callback pair one way, on every
  control that has both: **`onInput` fires continuously through a gesture, and
  `onChange` fires once when it commits.**

  Four components move to it. `ColorField`, `GradientEditor` and
  `GradientHandles` already used this sense and are unchanged.

  | Component      | was (live / committed)        | now                    |
  | -------------- | ----------------------------- | ---------------------- |
  | `Slider`       | `onChange` / `onCommit`       | `onInput` / `onChange` |
  | `ResizeHandle` | `onChange` / `onChangeEnd`    | `onInput` / `onChange` |
  | `CurveEditor`  | `onChange` / `onChangeCommit` | `onInput` / `onChange` |
  | `PointPlotter` | `onChange` / `onChangeCommit` | `onInput` / `onChange` |

  Four spellings had grown up, and two of them disagreed about what `onChange`
  meant — so a reader who learned `Slider` guessed `ColorField` backwards. The
  surviving pair is the DOM's own: `input` fires while you type or drag, `change`
  when the edit is done. It also means a single-callback control like `ToggleBar`
  keeps `onChange` with commit semantics intact.

  **Migrating is a rename, but `onChange` still compiles while meaning something
  new, so read this before running a codemod.** On the four components above,
  `onChange` used to be the live callback and is now the committed one. Passing a
  live handler to `onChange` type-checks and then only fires on release. The
  committed names (`onCommit`, `onChangeEnd`, `onChangeCommit`) are gone, so those
  fail loudly; the live rename is the one to do by hand.

  Behavior is unchanged, including which callback is required: these four are
  fully controlled, so `onInput` is required (without it the control freezes
  mid-drag) and `onChange` is optional. `ColorField` and `GradientEditor` buffer
  internally and keep the opposite. Required-ness follows the control's state
  model, not the naming.

  `CurveEditor`'s layer-gesture `onCommit(state, ctx)` is a different protocol and
  is untouched.

- Updated dependencies [514c34a]
  - @weasel-js/modes@1.0.3

## 1.0.2

### Patch Changes

- 9639d92: `ActionsBar` and `OptionsBar` now share one stylesheet,
  `components/segmentedControl.module.css`, instead of keeping byte-identical
  188-line copies each. The two look the same and differ only in what a segment
  does, so the styles had two places to stay in sync and no mechanism keeping
  them there.

  No visual or API change: same rules, same class names, same generated output.
  The merged stylesheet is the same size either way — identical content already
  collapsed to a single scoped hash — so this buys maintainability, not payload.

  `ToggleBar` keeps its own copy. It carries the same base plus a `segmentMixed`
  third state and a deliberately different `variant_minimal`, and folding those
  together needs a decision about whether the three bars are one component.

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

  - @weasel-js/modes@1.0.2

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

  - @weasel-js/modes@1.0.1

## 1.0.0

### Minor Changes

- 9ed1139: Gradient fills that stay attached to their shape, and an editor for them.

  Gradient geometry was interpreted in screen space: `draw.ts` set the shader's
  `u_worldInv` to the identity matrix, with a comment saying a later step would
  wire the real view inverse. Nothing did. Every gradient therefore slid across
  its own geometry under pan and zoom, which is why the gradient demo shipped
  with pan and zoom disabled. Fine for a viewport-fixed wash, useless for a
  paint on a shape.

  Gradient paints now carry `units`, mirroring SVG's `gradientUnits`:

  - `'bounds'` — fractions of the painted node's box, `0..1` per axis (SVG
    `objectBoundingBox`). Resolved by the node painter, so the paint follows the
    node through moves, resizes and rotation.
  - `'local'` — the frame the geometry was handed to the renderer in.
  - `'world'` — scene coordinates; the paint holds still while geometry moves
    through it (SVG `userSpaceOnUse`).
  - `'screen'` — surface pixels, and the default, so every existing gradient
    keeps the behavior it had. WeaselDraw's workspace tint wants exactly this.

  `WeaselRenderer.render` takes an optional view matrix for `'world'`, and falls
  back to screen space without one. `fillInPoseFrame` resolves `'bounds'` against
  a box and `fillToBoundsFrame` inverts it; `mat3.invert` is new alongside them.
  Supporting helpers: `sampleGradientStops`, `withGradientKind`,
  `gradientGeometry`, `gradientForBounds`.

  `setFill` takes a whole `paint` as well as a `color`, so a gradient edit is one
  undo entry like any color edit. A `color` no longer tries to inherit alpha from
  a fill that is a gradient.

  New in `@weasel-js/ui`: `<GradientEditor>` (kind switch, stop strip, per-stop
  color) and `<GradientHandles>` (on-canvas endpoint / center / radius / angle
  handles, positioned through consumer-supplied `toScreen` / `toLocal` so it
  needs no view or scene of its own). Both split live `onInput` from committed
  `onChange`.

  Converting between kinds is lossy in ways the data makes unavoidable: a radial
  gradient stores no angle, so a round trip through one leaves the segment
  horizontal, and a conic stores no radius, so a round trip through one resets
  the segment's length.

  `'bounds'` is not a frame you can do polar math in: `x` and `y` are fractions
  of two different lengths, so a circle in it is an ellipse on screen.
  `<GradientHandles>` therefore takes a gradient already resolved by
  `fillInPoseFrame`, and consumers convert edits back with `fillToBoundsFrame`.

### Patch Changes

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

- Updated dependencies [43482ce]
  - @weasel-js/modes@1.0.0

## 0.8.0

### Patch Changes

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

- Updated dependencies [8bc719a]
  - @weasel-js/modes@0.7.2

## 0.7.1

### Patch Changes

- d22624c: `Select` rows now carry a `textValue`, derived from a string label or the
  new per-option `textValue` for labels built from elements. Every row draws a
  check mark beside its label, so React Aria could never read a string off the
  children — it warned once per row on every open, and type-to-select did
  nothing.
- 6af4806: `@weasel-js/font` gains `listCanvasFonts()`, the enumeration companion to
  `isCanvasFont`. Families served by the dynamic canvas-SDF tier could only be
  queried one at a time, so a font picker had no way to offer them without
  hard-coding a list beside the `registerCanvasFont` calls. Reports service
  rather than membership, matching `isCanvasFont`: an auto-enrolled family
  appears only while the `'canvas'` fallback policy is in force.

  `@weasel-js/ui`'s `Select` marks its portalled popover with
  `data-weasel-overlay`. A consumer asking "did focus leave my component?" via
  `closest()` gets the wrong answer for portalled DOM — a text editor whose
  font menu is a `Select` ended its edit session the moment the menu was
  clicked, discarding the style patch that click was making.

- 6df0f1e: Add `StatusBar` (with `StatusBarItem` / `StatusBarSpacer`) and `ResizeHandle`
  — the two pieces of editor shell that every app was otherwise rebuilding.
  `ResizeHandle` is the window-splitter pattern: pointer drag or arrow keys,
  `role="separator"` with a live value range, snapping to a `step` grid so
  fractional pointer coordinates don't leak into persisted layouts. Both are
  layout-agnostic; the consumer still owns the shell.
  - @weasel-js/modes@0.7.1

## 0.7.0

### Minor Changes

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

- @weasel-js/modes@0.7.0

## 0.6.0

### Minor Changes

- Add `./components/*` subpath exports, so a consumer can import one component
  instead of the whole barrel:

  ```ts
  import { ToolPalette } from "@weasel-js/ui/components/ToolPalette";
  import { ToastRegion, toast } from "@weasel-js/ui/components/Toast";
  ```

  This needed a build change, not just an `exports` entry: the package built as a
  single `dist/index.js`, so there was nothing for a subpath to point at. The Vite
  build now emits one entry per component directory, keyed to mirror the source
  tree — which is also where `tsc --emitDeclarationOnly` already put the matching
  `index.d.ts`, so a single `*` wildcard lines up the JS and the types, and a
  component added later is reachable with no further change.

  Code shared between entries is hoisted into `dist/chunks/` rather than copied
  into each, so module-level state stays single: importing the barrel and a
  subpath in the same app yields one `defaultToastQueue`, not two.

### Patch Changes

- @weasel-js/modes@0.6.0

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

  - @weasel-js/modes@0.5.1

## 0.5.0

### Patch Changes

- @weasel-js/modes@0.5.0
