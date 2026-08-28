# A paint editor in the kit

For whoever picks up one of the five arcs below. Assumes the paint model in
`docs/proposals/2026-08-26-node-stroke-union.md` — `data.fill` is a `FillStyle`,
`data.stroke` a `Stroke`, alpha lives in `opacity`. Read that first if those are
new.

It answers: what the kit needs so a node's paint can be edited as a paint rather
than as a color, and in what order to build it.

## The gap

`FillStyle` has five variants. The kit's panel edits one, and the renderer
refuses one of them outright on a stroke.

**The editor.** `SelectionPanel`'s `paint` leaf shows a gradient as the
indeterminate chip and writes `{ fill: 'solid', color }` over it on first touch
(`SelectionPanel.tsx:392-411`). `@weasel-js/ui` already exports `GradientEditor`
and `GradientHandles`; no kit panel uses either. WeaselDraw builds the whole
editor through the `renderers` escape hatch — five-way kind bar, per-kind
seeding, pattern picker, pattern recolour, on-canvas handles — and roughly 600
of those 770 lines are written entirely against kit exports.

**The write path.** `setStroke` takes only `{ color }` where `setFill` takes
`{ color?, paint? }`. Its one merge path runs through `paintWithColor`, which
supersedes a non-solid paint with a solid one. `setStrokeOpacity` writes
`paint.opacity` directly, so a gradient stroke's alpha is reachable while
nothing else about it is.

**The renderer, which is the one that bites now.** `drawPathStroke`
(`draw.ts:1031`) throws on any non-solid stroke paint:

```
weasel step 2: stroke.paint must be solid; gradient/pattern arrives in step 5+
```

Nothing upstream guards it. `strokeDataFromSvg` (`unpack.ts:113`) puts a
paint-server stroke straight onto `data.stroke.paint` — deliberately, and with a
test asserting it (`unpack.test.ts:210`) — and `strokeInPoseFrame`
(`NodeShape.ts:480`) bakes any paint through to the renderer. **So importing an
SVG whose shape carries `stroke="url(#grad)"` produces a scene that throws on the
next frame.** The import side is tested into producing exactly the value the
render side refuses; no test covers the two together, which is why it survives.

Gradient-stroked *text* works, because outline text routes through
`drawPathFillByKind` (`draw.ts:1317`) rather than the solid casts at `:1047` and
`:1117`. The fix therefore has a worked precedent eleven lines away in the same
file.

The app did not work around any of this. `App.tsx:377-379` records the
capitulation: *"Stroke keeps the plain color renderer — the renderer requires a
solid stroke paint."*

## Arc 1 — the renderer paints a non-solid stroke

Fixes a live crash and unblocks everything after it. Nothing may accept a
gradient stroke until the renderer can draw one.

`drawPathStroke` builds a ribbon mesh and paints it solid. Route that ribbon
through `drawPathFillByKind` — the same call `drawTextOutlineGroup` already
makes at `draw.ts:1317` — and delete the throw. The stenciled path
(`drawPathStrokeStenciled`, reached for a non-center-aligned polygon) needs the
same treatment; both currently cast `stroke.paint as { color, opacity }`.

The first test to write is the one nobody wrote: import the fixture at
`packages/svg/src/__fixtures__/fixtures.ts` with a gradient stroke on a shape,
render it, and assert no throw. That test fails on `main` today.

**Also here, because it is the same gap one severity down:** `draw.ts:983`
renders a non-solid even-odd stencil fill as black with a `console.warn`. It
degrades rather than throwing, so it is not urgent, but it is the same missing
route.

## Arc 2 — the write path

Pure core, no UI. Order inside the arc is **2c → 2b → 2a**, which is not the
order they are written below.

The two defect fixes are isolated and one lands in a line the factory would
otherwise inherit wrong. The paint param comes before the factory because it
makes the factory's job clearer: today `setStroke` carries a bare color string
and `setFill` a `{ color, paint }` pair, so the four actions look like three
different state shapes. After 2b they are two pairs — two `{ color, paint }` and
two `{ alpha01 }` — and `TState` has two instantiations instead of three.
Collapsing first would mean designing the abstraction against a shape that is
about to change, then writing `setStroke`'s paint path into it anyway.

### 2a. Collapse the four paint actions onto one factory

`setFill`, `setStroke`, `setFillOpacity` and `setStrokeOpacity` are four copies
of one ongoing-action body: dep resolution, empty guards, start snapshot,
preview refresh, cancel branch, re-read-then-build ops, `applyOps`-else-
`applyBatch` routing, `previewIds`/`previewData`, `enabled`. Roughly 400 of 660
lines are invariant, and their test harnesses duplicate another ~72 lines four
times.

The seam is **not** `{ dataKey, readPaint, writePaint, label }`. Gesture state
is a per-action reducer, not a paint. `writePaint` earns nothing — all four
write `{ ...from, [dataKey]: value }`.

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

No behavior change. The four existing suites stay as they are and must stay
green; the shared harness collapses with the actions.

### 2b. `setStroke` takes a paint

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
against `setStroke`, plus one the fill side cannot have: a paint written onto a
node with no stroke seeds a width and keeps the paint.

### 2c. Two defects, each its own commit

- **`setFill` defaults to black.** `setFill.ts:118` reads
  `?? DEFAULT_STROKE_COLOR`. It should read `DEFAULT_FILL_COLOR`, which is what
  `setFillOpacity` seeds from. Nothing invokes `setFill` bare, which is why it
  survived.
- **`gradientForBounds`'s doc comment contradicts its body.** It claims
  corner-to-corner; `gradient.ts:143-151` builds a horizontal left-edge→
  right-edge segment through the vertical center. Fix the comment, not the code.

Also delete `@weasel-js/ui`'s `strokeWithColor` (`paintValue.ts:27`). It shares
a name with core's and disagrees — core's keeps the paint's opacity, ui's drops
it — and it has no callers, so this is a deletion, not a migration.

## Arc 3 — the paint-kind registry

Makes `FillStyle` open: a consumer adds a sixth kind that renders, converts
frames and serializes, with one registration and no kit edits.

### Shape

Module-global `Map` plus a disposer-returning `register*`, matching
`registerNodeShape` (`NodeShape.ts:147`) and `registerContentHandler`
(`contentHandlers.ts:84`) — the newest of the three conventions in the repo.
Not React context: `concepts.md:562` notes Actions is the only registry backed
by one. Not built on a shared primitive either — `concepts.md:572` states the
kit *deliberately* does not unify its 13 registries, and `createReflectable`
does not exist outside prose.

```ts
export function registerPaintKind(entry: PaintKindEntry): () => void
export function _resetPaintKindsForTests(): void
```

Every module-global registry in the repo ships the `_reset*ForTests` helper
(`registerProgram.ts:53`, `registerTexture.ts:24`, `registerFont.ts:49`); match
that.

`PaintKind` opens on the discriminant, the way `ChromeId` already does:

```ts
export type PaintKind = 'solid' | GradientKind | 'pattern' | (string & {});
```

### The entry

```ts
interface PaintKindEntry {
  id: string;
  label: string;
  /** Editor slots — Arc 4 consumes these. */
  seed(fromColor: string): FillStyle;
  colorOf(paint: FillStyle): string | undefined;
  Editor?: ComponentType<PaintKindEditorProps>;
  /** Render slot. */
  draw(ctx: PaintDrawContext, fill: FillStyle, handle: GLMeshHandle): void;
  /** Geometry slots — both directions, or neither. */
  inPoseFrame?(fill: FillStyle, box: FillPoseBox): FillStyle;
  toBoundsFrame?(fill: FillStyle, box: FillPoseBox): FillStyle;
  /** Serialization. */
  toSvg?(id: string, fill: FillStyle): string;
}
```

The five built-ins register with today's functions, which turns the switch sites
below into lookups without rewriting any of their bodies.

### Programs

A registered kind's shader hangs off `ctx.programRegistry` — already a
`Map<string, ShaderProgram>` on `DrawContext` (`draw.ts:53`) — looked up by id.
**Not a new named field.** `pathFill`, `gradFill`, `patternFill` and the rest are
each edited in five places (the `DrawContext` interface, the ctor at
`WeaselRenderer.ts:234`, the context-restore block at `:334`, the dispose loop at
`:400`, and the per-frame literal at `:439`), none of them consumer-reachable.

The one piece of plumbing needed: `WeaselRenderer.registerProgram(handle)` is a
manual per-renderer call, so the registry needs a hook that compiles registered
kinds into every renderer at construction *and* in the context-restore loop at
`:351-359`.

Two things a new kind gets for free, both worth documenting on the entry:

- **`gradientSpaceInverse` (`draw.ts:802`) is generic**, not gradient-specific.
  `u_worldInv` plus a `v_world` varying is *the* paint-space convention — the
  pattern path calls the same function.
- **A gradient-shaped kind need not bring a program at all.** `GRAD_FRAG_SRC`
  branches on a `u_gradKind` int that is uniform across the draw call
  (`gradFill.ts:4-6`), so a fourth gradient is `u_gradKind == 3` plus an entry in
  `GRAD_FILL_UNIFORMS`.

Shader output is premultiplied — `outColor = vec4(rgb * a, a)`
(`registerProgram.ts:71-77`).

### The migration surface

24 structural sites switch on `fill.fill` across core and svg. Five are
load-bearing; the rest are pass-throughs that already degrade, or gradient-
internal and typed to `GradientFill` so a new kind never reaches them.

| Site | What it does today |
|---|---|
| `draw.ts:720` | The dispatch. Its `else` is an unguarded cast to the gradient union — a sixth kind reads `fill.stops` off a paint with none. |
| `draw.ts:1031` | Throws on a non-solid stroke paint. Arc 1 removes this. |
| `fillInPoseFrame.ts:35` | Bounds→local. Returns the fill untouched on an unknown kind, so a new kind silently paints in screen space on a node that moves. **The largest correctness gap for a new kind.** |
| `fillInPoseFrame.ts:69` | The inverse, same failure. |
| `gradients.ts:215`, `:232` | The `<defs>` emit. `gradientXml` falls off the end returning `''`, so a new kind gets a `url(#gradN)` reference with no definition behind it — which is also how conic gradients are dropped today. |

`paintWithColor`, `paintWithAlpha`, `resolveNodeFill` and `resolveNodeStroke`
do **not** switch on kind — they are kind-blind by construction, and a new kind
inherits `paintWithColor`'s "a non-solid is superseded, not recolored" behavior
for free.

The SVG *import* side needs no changes at all: `fillFromPaint` (`unpack.ts:94`)
probes `'units' in g` structurally and delegates the rest, and `parse.ts:79-80`
already merges gradients and patterns into one `url(#id)` table. For a kind SVG
cannot express natively, copy the pattern path's `data-weasel-tile` round-trip
attribute (`patterns.ts:33`).

**The hazard to design around:** `registerNodeShape` bumps a memo generation
because the painter set is ambient state its memo cannot see change
(`NodeShape.ts:152-153`). A paint-kind registry feeding `NodeShape`'s paint slot
has exactly that shape and needs the same bump.

## Arc 4 — `PaintInput` in `@weasel-js/ui`

One control that edits a whole `FillStyle`, with its kind bar and per-kind body
driven by the Arc 3 registry rather than a hardcoded list.

```ts
interface PaintInputProps {
  value: FillStyle | undefined;
  mixed?: boolean;
  unset?: boolean;
  /** Restrict the kind bar. Default: every registered kind. */
  kinds?: readonly PaintKind[];
  onInput?: (next: FillStyle) => void;
  onChange: (next: FillStyle) => void;
}
```

Per kind it renders the registry entry's `Editor`, with the built-ins supplying
`ColorField` for solid, `GradientEditor` with `kindSwitch={false}` for the three
gradients, and a promoted `PatternPicker`. `SelectionPanel`'s `paint` leaf
renders it in place of the degrading chip.

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
3. else the registry entry's `seed(color)`.

Nothing changes in the committed data — the node still holds exactly one paint.
The memory is a ref, not state, and does not survive selection change.

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
on `core`, so there is no cycle, and `npm run check:manifests` catches the
missing declaration. Rebuilding a second preview path over core's
`OffscreenCanvas` tile rasterizer to avoid that edge would be two things where
one exists.

Its `style={{ backgroundImage }}` should become a custom property set inline and
consumed by a static rule, matching what `InlineRange` does with `--slider-fill`.
The value is a per-swatch data URI, so something must be inline; which property
is inline is the choice.

## Arc 5 — the geometry overlay

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
its own `ResizeObserver` (ignoring the existing `useCanvasSize`), and a `toLocal`
built by projecting two points.

The ingredients are public and one names this use case outright —
`subscribeView`'s docstring says *"chrome that mirrors the camera — a zoom
readout, a minimap, DOM pinned to world coordinates."* `useSceneTextEdit` already
does this projection, baked into the text feature. Arc 5 generalizes it:

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

With Arc 2b landed, a gradient stroke is writable, so the overlay targets
`{ nodeId, slot: 'fill' | 'stroke' }` and dispatches `setFill` or `setStroke`
accordingly. Today `SelectedGradientHandles` reads only `data.fill`.

`slot` is an explicit prop. The kit does not grow a "which paint am I editing"
state: WeaselDraw already has one (`ColorContext.focused`, which `LoupeControls`
routes on), and a second consumer could reasonably model it differently.

## Order and what each arc deletes

1 → 2 → 3 → 4 → 5. Arc 1 is a live bug fix and gates Arc 2b. Arc 3 gates Arc 4,
which would otherwise have its kind bar written twice. Arc 5 is independent of
3 and 4 and can move earlier if the overlay matters more than extensibility.

Arc 4 removes `PropertyFillInput`, `PatternPicker`, `seedGradient`,
`seedPattern`, `firstStopColor`, `patternColor` and the app's shadowing
`solidColorOf` from `PropertiesPanel.tsx`. Arc 5 removes
`SelectedGradientHandles` and `gradientOf` from `App.tsx`. What should remain in
WeaselDraw is the palette data, the `WD_RENDERERS` path→action-id table, and the
`ColorContext` wiring — roughly 170 lines of the current 770.

## Testing

None of the app's 770 paint lines has any coverage today, and neither does the
gradient-stroke render path.

- **Arc 1** — import a gradient-stroked shape and render it. Fails on `main`.
- **Arc 2b** — mirror `setFill.test.ts:200-262` against `setStroke`, plus the
  seeds-a-width case.
- **Arc 3** — register a sixth kind in a test and assert it draws, converts both
  frame directions, and serializes. That test is the actual contract.
- **Arc 4** — the switch precedence: linear → solid → linear restores stops, and
  a first-time switch to an unseen kind seeds instead.
- **Arc 5** — the frame hook on a rotated pose and a rotated view, which is the
  regression the current code fails.

Screenshot the panel story for Arc 4 and the overlay for Arc 5 — the panel
pass's defects were all found that way, with every test green.

## Deferred

- **The paint-leaf `alpha` control.** `alpha: true` has no effect on a `paint`
  leaf; the app routes opacity through `setFillOpacity` separately. `PaintInput`
  should eventually own it, since `opacity` is the one alpha slot every variant
  shares — but it is a fourth thing in an already-large Arc 4.
- **Conic gradients still export as nothing.** `gradientXml` returns `''` and
  warns through `SerializeOptions.onWarn`. Arc 3 makes the hole a registry slot
  rather than closing it.
- **Stroke style (dash).** A separate arc on a separate field — `Stroke.dash`,
  not `FillStyle`. Tracked outside this spec.
