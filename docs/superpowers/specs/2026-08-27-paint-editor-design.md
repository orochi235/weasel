# A paint editor in the kit

For whoever picks up one of the three arcs below. Assumes the paint model in
`docs/proposals/2026-08-26-node-stroke-union.md` — `data.fill` is a `FillStyle`,
`data.stroke` a `Stroke`, alpha lives in `opacity`. Read that first if those are
new.

It answers: what the kit needs so a node's paint can be edited as a paint
rather than as a color, and in what order to build it.

## The gap

`FillStyle` has five variants. The kit's panel edits one.

`SelectionPanel`'s `paint` leaf shows a gradient as the indeterminate chip and
writes `{ fill: 'solid', color }` over it on first touch
(`SelectionPanel.tsx:392-411`). `@weasel-js/ui` already exports `GradientEditor`
and `GradientHandles`; no kit panel uses either. WeaselDraw builds the whole
editor through the `renderers` escape hatch — five-way kind bar, per-kind
seeding, pattern picker, pattern recolour, on-canvas handles — and roughly 600
of those 770 lines are written entirely against kit exports.

Underneath it, `setStroke` takes only `{ color }` where `setFill` takes
`{ color?, paint? }`. Its one merge path runs through `paintWithColor`, which
supersedes a non-solid paint with a solid one. So a gradient stroke is not
merely uneditable: the first color pick destroys everything but its alpha.
`setStrokeOpacity` writes `paint.opacity` directly, so alpha alone is reachable
— a gradient stroke can be scrubbed but not touched.

The app did not work around this. `App.tsx:377-379` records the capitulation:
*"Stroke keeps the plain color renderer — the renderer requires a solid stroke
paint."*

## Arc 1 — the write path

Pure core. No UI. Unblocks both other arcs.

### 1a. Collapse the four paint actions onto one factory

`setFill`, `setStroke`, `setFillOpacity` and `setStrokeOpacity` are four copies
of one ongoing-action body: dep resolution, empty guards, start snapshot,
preview refresh, cancel branch, re-read-then-build ops, `applyOps`-else-
`applyBatch` routing, `previewIds`/`previewData`, `enabled`. Roughly 400 of 660
lines are invariant, and their test harnesses duplicate another ~72 lines four
times.

The seam is **not** `{ dataKey, readPaint, writePaint, label }`. Gesture state
is a per-action reducer, not a paint: the opacity pair carries a scalar
`alpha01`, `setStroke` a color string, `setFill` a `{ color, paint }` pair with
a precedence rule *and* a rule that a later bare `color` clears an earlier
`paint`. One `readPaint` cannot express that. `writePaint` earns nothing —
all four write `{ ...from, [dataKey]: value }`.

```ts
createPaintAction<TState, TValue, K extends string>({
  id, label, dataKey: K,
  initialState: (params) => TState,
  readParams: (params) => Partial<TState>,
  merge: (prev: TValue | null | undefined, state: TState) => TValue,
})
```

`merge` carries each action's seed, which differs per action and is not
derivable from `dataKey`. The scene cast becomes
`Scene<{ [P in K]?: TValue | null }, string, unknown>`.

This is a refactor with no behavior change. The four existing test suites stay
as they are and must stay green; the shared harness collapses with the actions.

### 1b. `setStroke` takes a paint

Add `paint?: FillStyle`, mirroring `setFill`: the precedence, the supersede
rule, and a merge that nests under `.paint` rather than replacing outright.

Core has no `Stroke` constructor from a whole paint — `strokeOf(color, width = 1)`
is the only one. Add its sibling rather than writing `{ paint, width }` at each
call site:

```ts
export function strokeWith(paint: FillStyle, width = 1): Stroke
```

The target behavior is already written down: `setFill.test.ts:200-262` covers
the `paint` param in six cases — verbatim write, preview without write,
mid-gesture edit, single batch, and both supersede directions. Mirror that block
against `setStroke`.

### 1c. Two defects found while reading, each its own commit

- **`setFill` defaults to black.** `setFill.ts:118` reads
  `?? DEFAULT_STROKE_COLOR`. It should read `DEFAULT_FILL_COLOR`, which is what
  `setFillOpacity` seeds from. Nothing invokes `setFill` bare, which is why it
  survived.
- **`gradientForBounds`'s doc comment contradicts its body.** It claims
  corner-to-corner; `gradient.ts:143-151` builds a horizontal left-edge→
  right-edge segment through the vertical center. Fix the comment, not the code
  — the behavior is the one every caller depends on.

Also fold `@weasel-js/ui`'s `strokeWithColor` (`paintValue.ts:27`) onto core's.
They share a name and disagree: core's keeps the paint's opacity, ui's drops it.

## Arc 2 — `PaintInput` in `@weasel-js/ui`

One control that edits a whole `FillStyle`.

```ts
interface PaintInputProps {
  value: FillStyle | undefined;
  mixed?: boolean;
  unset?: boolean;
  /** Which variants the kind bar offers. Default: all five. */
  kinds?: readonly PaintKind[];
  onInput?: (next: FillStyle) => void;
  onChange: (next: FillStyle) => void;
}
```

It owns the kind bar over all five variants, and per kind: `ColorField` for
solid, `GradientEditor` with `kindSwitch={false}` for the three gradients, and
a promoted `PatternPicker`. `SelectionPanel`'s `paint` leaf renders it in place
of the degrading chip.

`PaintKind` does not exist yet. Core has `GradientKind` (`paint-types.ts:110`)
and the app has a local `type FillKind = 'solid' | GradientKind | 'pattern'`
(`PropertiesPanel.tsx:365`). Add the discriminant to `paint-types.ts` beside
`GradientKind` — it is a property of the union, not of the control:

```ts
export type PaintKind = 'solid' | GradientKind | 'pattern';
```

`GradientEditor` keeps its own three-way switch for standalone use; the app
passes `kindSwitch={false}` today precisely because it built a wider bar around
it, and `PaintInput` is where that wider bar belongs.

### The kind switch remembers

Switching kinds is lossy today and every switch is a committed undo entry.
`withGradientKind` carries what it can — stops, units, opacity and the center
always — but a round trip through radial flattens the angle, through conic
resets segment length, and through solid discards the stops outright.

`PaintInput` holds a per-kind memory for the control's lifetime, so
linear → solid → linear restores the stops. Precedence on switch:

1. the remembered paint for that kind, if this control has seen one;
2. else `withGradientKind(current, kind)` when both are gradients;
3. else seed fresh.

Nothing changes in the committed data — the node still holds exactly one paint.
The memory is a ref, not state, and it does not survive selection change.

### `unset` on a paint leaf

The remainder the placeholder pass deferred here.

The established vocabulary is: absence is nothing lit and nothing typed, an
em-dash where a control has a text slot, and a 0.55-opacity wrapper with
`title="Not set"` where a control has no third state (`Switch`). Unset never
gets louder than mixed.

`ColorField` has no third state either, so it takes the `Switch` treatment: the
panel wraps the collapsed swatch, exactly as it wraps `Switch` today. No `unset`
prop on `ColorField`.

The swatch **shows the resolved fallback** rather than blanking, because unlike
an unlit Cap segment the fallback is what is actually on the canvas — true, but
not chosen, which is what the dimming says. The wrapper applies to the collapsed
swatch only; once the editor is open the next edit makes the value set anyway.

This also disambiguates the checkerboard chip, which currently means both "mixed
selection" and "structurally not a solid" (`SelectionPanel.tsx:395-404`). Once
`PaintInput` previews a gradient as a gradient, the checkerboard means mixed and
nothing else.

### `PatternPicker` moves as-is

It is written entirely against `TilePatternSpec` and `tilePreviewCssUrl`, both
kit exports. Moving it declares a new `ui → svg` dependency; `svg` depends only
on `core`, so there is no cycle, and `npm run check:manifests` is the check that
catches the missing declaration.

Rebuilding a second preview path over core's `OffscreenCanvas` tile rasterizer
to avoid that edge would be two things where one exists.

The picker's `style={{ backgroundImage }}` should become a custom property set
inline and consumed by a static rule, matching what `InlineRange` does with
`--slider-fill`. The value is a per-swatch data URI, so something must be inline;
which property is inline is the choice.

## Arc 3 — the geometry overlay

`GradientEditor` refuses geometry on purpose; `GradientHandles` is where it
lives, and it is already frame-agnostic — it takes `toScreen`/`toLocal` and a
pixel size, and never sees a view or a node.

### It stays DOM, and the affordance route is rejected

The kit's affordance system is open — `Affordance` + `composeAffordanceLayer` +
`registerLayer`, with registered layers getting first refusal on a hit ahead of
kit chrome (`SceneCanvas.tsx:2257-2281`), and `ChromeId` is `(string & {})` for
exactly this. `@weasel-js/hud` is the worked example.

It is also canvas-drawn, which means no DOM node, no `tabIndex`, no `role`, no
key handler anywhere in `packages/core/src/affordances/`. `GradientHandles` has
all four, plus arrow-key nudge and a focus ring. Moving it onto the affordance
system would delete working accessibility to buy tidiness.

Recorded because it is the obvious thing to re-propose. The answer changes if
canvas chrome ever grows a keyboard story.

### What the kit is missing is the frame, not the handles

Nothing in `packages/core` exports an overlay helper, so the app hand-rolls one:
its own `ResizeObserver` (ignoring the existing `useCanvasSize`), and a
`toLocal` built by projecting two points.

The ingredients are all public and one of them names this use case outright —
`subscribeView`'s docstring says *"chrome that mirrors the camera — a zoom
readout, a minimap, DOM pinned to world coordinates."* `useSceneTextEdit`
already does this projection, baked into the text feature. Arc 3 generalizes it:

```ts
useNodeOverlayFrame(nodeId): {
  toScreen: (p: Point) => Point;
  toLocal: (p: Point) => Point;
  width: number;
  height: number;
} | null
```

### The rotation bug, fixed rather than relocated

The app's `toLocal` is a translate-and-scale inverse from two projected points,
and `fillInPoseFrame` takes an axis-aligned `FillPoseBox`. `pose.rotation` is
ignored end to end, so handles on a rotated node do not sit on the paint.

`fillInPoseFrame` does not change. A gradient's geometry is stored in the node's
bounds frame, which is pre-rotation by definition; rotation belongs in the
pose→world leg, which is the frame hook's job. Moving this code into the kit
without fixing it would bless the defect.

### Both slots get handles

With Arc 1b landed, a gradient stroke is writable, so the overlay targets
`{ nodeId, slot: 'fill' | 'stroke' }` and dispatches `setFill` or `setStroke`
accordingly. Today `SelectedGradientHandles` reads only `data.fill`.

`slot` is an explicit prop. The kit does not grow a "which paint am I editing"
state: WeaselDraw already has one (`ColorContext.focused`, which `LoupeControls`
routes on), and a second consumer could reasonably model it differently.

## Order and what each arc deletes

1a → 1b → 2 → 3. Arc 1 unblocks the others; 2 and 3 are independent of each
other after it.

Arc 2 removes `PropertyFillInput`, `PatternPicker`, `seedGradient`,
`seedPattern`, `firstStopColor`, `patternColor` and the app's shadowing
`solidColorOf` from `PropertiesPanel.tsx`. Arc 3 removes
`SelectedGradientHandles` and `gradientOf` from `App.tsx`. What should remain in
WeaselDraw is the palette data, the `WD_RENDERERS` path→action-id table, and the
`ColorContext` wiring — roughly 170 lines of the current 770.

## Testing

None of the 770 lines has any coverage today. `grep` for `PropertyFillInput|
SelectedGradientHandles|PatternPicker|seedGradient|wdFillRenderer` hits only the
two source files and one spec.

- **Arc 1b** mirrors `setFill.test.ts:200-262` against `setStroke`, plus one
  case the fill side cannot have: a paint written onto a node with no stroke
  seeds width and keeps the paint.
- **Arc 2** unit-tests the switch precedence directly — that
  linear → solid → linear restores stops, and that a first-time switch to a kind
  never seen seeds instead.
- **Arc 3** tests the frame hook on a rotated pose and a rotated view, which is
  the regression the current code fails.

Screenshot the panel story for Arc 2 and the overlay for Arc 3 — the panel
pass's defects were all found that way, with every test green.

## Deferred

- **The paint-leaf `alpha` control.** `alpha: true` has no effect on a `paint`
  leaf; the app routes opacity through `setFillOpacity` separately. `PaintInput`
  should eventually own it, since `opacity` is the one alpha slot every variant
  shares — but it is a fourth thing in an already-large Arc 2.
- **`dash` still has no control.** A `number[]` has no leaf kind. Unchanged
  here.
- **Conic gradients still export as nothing.** `gradientXml` returns `''` and
  warns through `SerializeOptions.onWarn`. A paint editor that can author them
  makes this louder without causing it.
