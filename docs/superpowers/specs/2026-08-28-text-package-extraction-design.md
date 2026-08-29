# `@weasel-js/text` — extracting the typography layer

Moves the run model, style resolution, glyph layout, wrap and measurement out
of `@weasel-js/core` into a Tier A leaf, so a consumer can lay out text
without taking the scene graph and a React peer dependency with it.

For anyone working in this repo. Sequenced in two arcs; arc 1 is a move plus
one new public export, arc 2 is the behavior change that finishes the story.

## 1. Why the current boundary is wrong

`docs/superpowers/specs/2026-07-28-font-package-extraction-design.md` put the
package boundary at **glyphs, not typography**, and left everything above the
atlas in core. That reads correctly from inside weasel and badly from outside
it: typography is the reusable half — a run model, kerned advances, wrap, line
boxes — and the scene graph is the specific half. Today the reusable half is
reachable only through `@weasel-js/core`, which peer-depends on React and
depends on geom, gestures, history, modes and font; and `layoutRuns`, the only
glyph walk in the kit, is not exported at all. Anything that wants weasel's
text layout and not weasel's renderer reimplements it.

That same doc named the blocker and deferred it: `layoutRuns` imports
`FillStyle` from `core/paint-types`, which imports `TextureHandle` from the
renderer, "so moving it would drag `paint-types` down into a new `paint`
leaf. That extraction may be worth doing someday." Verified still true against
the tree; this is that someday.

## 2. Two new leaves

The rule is unchanged — **a subpackage must not import core** — and both new
packages obey it.

| Package | Holds | Depends on |
| --- | --- | --- |
| `@weasel-js/paint` | `FillStyle`, `Stroke`, gradients, dashes, `Region`, `TextureHandle` | nothing |
| `@weasel-js/text` | run model, style resolution, layout, measurement, metrics seam | `paint`, `font`, `geom` |

`core` gains both as dependencies and re-exports their public surface, so
`@weasel-js/core`'s API does not change. By name, not `export *`: a star
re-export of an external package leaves no binding in core's bundle, and a
downstream bundler fails to resolve one. `npm run test:smoke:consumer` is the
only gate that catches it.

`paint` is its own package rather than a module inside `text` because a
gradient editor importing `FillStyle` from a package named "text" is a naming
lie. They are separately meaningful vocabularies that happen to have moved
together.

`TextureHandle` (`{ readonly id: string }`) moves to `paint`; the texture
*registry* stays in the renderer and imports the handle type back, which is
the normal direction. `Rect` (`{ x, y, width, height }`) moves from
`core/geometry/polygonHitTestRect` to `@weasel-js/geom`, where the object-form
rect belongs beside `Box`.

## 3. What moves

| From `packages/core/src/features/text/` | To `packages/text/src/` |
| --- | --- |
| `runs.ts` | `runs.ts` |
| `textStyle.ts` | `textStyle.ts` |
| `runs/resolveRuns.ts` | `runs/resolveRuns.ts` |
| `atlas/layoutRuns.ts` | `layout/layoutRuns.ts` |
| `measureText.ts` | `measure/measureText.ts` |
| `measureTextBounds.ts` | `measure/measureTextBounds.ts` |
| `lineBoxes.ts` | `measure/lineBoxes.ts` |
| `verticalAlign.ts` | `measure/verticalAlign.ts` |
| `markdownText.ts` | `markdownText.ts` |
| `TextPose` (from `textLayer.ts`) | `pose.ts` |
| `TextRenderer` (from `renderLabel.ts`) | `markdownText.ts` |

`TextPose` is plain data — box, text, runs, style, paint, vertical align — and
every type it names moves with it, so it moves too. `createTextLayer`, which
needs the layer and scene types, does not.

`layoutRuns` becomes a **public export** rather than the internal it is today.
It is the only glyph walk in the kit and the whole reason a consumer would
reach for this package.

## 4. What stays in core, and why

Editing, painting and the scene:

| Stays | Because |
| --- | --- |
| `textLayer.ts`, `textCommand.ts` | emit `DrawCommand`s — renderer surface |
| `hitTest.ts`, `fitTextPose.ts` | operate on scene poses and picking |
| `useTextEdit.ts`, `useSceneTextEdit.ts` | React |
| `domRuns.ts` | the contenteditable bridge, which serves those hooks |
| `renderLabel.ts` | chrome pill, unrelated to scene text |
| `runs/rangeStyle.ts`, `runs/flagRange.ts` | caret-range patch algebra: editor surface, and the only thing needing core's `MIXED` sentinel |

Keeping `rangeStyle` in core is what keeps `core/mixed.ts` where it is. It
imports `StyledRun` from the leaf, which is the legal direction.

## 5. The metrics seam (arc 2)

Arc 1 makes the layout borrowable; it does not make it usable from a font file
alone. `layoutRuns` reads every advance, kern and line metric off a `BmFont` —
the baked MSDF atlas produced offline by `packages/font/scripts/gen-font.ts`.
The outline tier is deliberately metric-neutral (it changes what a glyph looks
like, never where it sits), so registering outlines buys geometry and no
metrics. A consumer holding a `.ttf` and nothing else cannot lay anything out.

This does not relax the outline tier's metric neutrality. That invariant
governs a family that *has* an atlas — swapping geometry at the size threshold
must never reflow text, and it still must not. What follows adds a rung to the
bottom of the ladder for a family that has no atlas at all, which today cannot
resolve and renders nothing.

Two changes fix that.

**Faces report metrics.** `OutlineFace` gains two members beside `glyphD`,
in the same em space:

```ts
export interface OutlineFace {
  unitsPerEm: number;
  glyphD(cp: number): string | null;
  /** Advance for `cp` in em units, or null when the face has no glyph. */
  advanceOf(cp: number): number | null;
  /** Kerning adjustment between two codepoints, in em units. 0 when none. */
  kernOf(left: number, right: number): number;
}
```

opentype.js has both (`glyph.advanceWidth`, `font.getKerningValue`), so the
default parser implements them by dividing by `unitsPerEm`. This is a breaking
change for a consumer-supplied `OutlineParser`; there is no version of "a
parsed face that cannot report an advance" worth branching on.

**Layout reads a source, not an atlas.** The entry walk takes its advances,
kerning and line metrics through one interface that the atlas and an
outline-only face both satisfy:

```ts
interface MetricsSource {
  /** Units per em of whatever the three below are measured in. */
  size: number;
  /** Line top to baseline, in those units. */
  base: number;
  advanceOf(cp: number): number | null;
  kernOf(left: number, right: number): number;
}
```

`size` rather than a world-unit conversion per call: an atlas measures in its
bake size and a parsed face in ems, and one divisor (`fontSize / size`)
reconciles them at every site that already had one. It stays internal — a
consumer supplies metrics by registering a font, not by implementing this.

The quad channel still requires an atlas — UVs come from nowhere else — so an
outline-only source emits `glyphs` and never `quads`, which is already how an
outline group behaves. Nothing about the atlas path's output changes; the
existing text baselines are the regression test.

## 6. What a consumer gets

With both arcs, a package that owns its own renderer — klieg, which extrudes
3D type over a page and today reimplements load, kern, wrap and contour
extraction against opentype.js — registers a font's bytes and reads placed
outlines back:

```ts
await registerFontOutlines('Inter', { weight: 700 }, bytes);
const { glyphs, lines, bounds } = layoutRuns(
  resolveRuns(toRuns('HELLO'), resolveTextStyle({ fontFamily: 'Inter', fontSize: 64 })),
  { maxWidth: 900, lineHeight: 1.1, align: 'center', outlineMinSize: 0 },
).groups.flatMap(...);
```

Each `LaidOutOutlineGlyph` carries em-space path data plus the pen position,
baseline and scale to place it — which is what its own tessellator wants, and
is already the shape `@weasel-js/font` chose for crossing a package boundary.

## 7. Arcs

1. **The move.** Two leaves, `Rect` to geom, core re-exports, `layoutRuns`
   public. No behavior change; the existing suite is the proof. **Landed** —
   commit `extract the typography layer into @weasel-js/text`.
2. **The metrics seam.** `OutlineFace` metrics, `GlyphSource` in the layout
   walk, outline-only registration. Ends with a test that lays out a string
   from font bytes with no atlas registered at all.
