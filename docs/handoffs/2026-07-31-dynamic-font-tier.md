# Dynamic font tier: metrics offset, magnification wobble, text picking

**Date:** 2026-07-31
**Branches:** `text-tier-and-picking` (§1, §3 — merged), `text-outline-tier` (§0/§2)
**Status:** all three defects fixed. §1 and §3 landed on `main` (`292a4a4a`…
`d0adfb5e`); §2 is fixed by the outline tier described below. What is left is
follow-on work, not this handoff's defects — see "Still open" at the end.

Three defects surfaced after WeaselDraw started offering machine fonts through
the kit's dynamic canvas-SDF tier (`packages/font/src/dynamic/`).

## 0. Outline tier — SHIPPED

The plan was a second, larger SDF bake tier. The better move was to stop
rasterizing for large text at all: parse the font, take the glyph outlines,
push them through the path pipeline the kit already has. That is what shipped.

**Where it lives.**

| piece | file |
|---|---|
| registry, fallback ladder, warn-once | `packages/font/src/outline/outlineRegistry.ts` |
| the parsed-face seam, em-space contract | `packages/font/src/outline/OutlineFace.ts` |
| opentype.js behind a dynamic import | `packages/font/src/outline/opentypeParser.ts` |
| `.ttc` collection unpacking | `packages/font/src/outline/sfnt.ts` |
| `queryLocalFonts` → registrations | `packages/font/src/outline/localFonts.ts` |
| shared "a glyph can paint now" signal | `packages/font/src/glyphReady.ts` |
| per-glyph tier decision, `'outline'` groups | `features/text/atlas/layoutRuns.ts` |
| em-space tessellation cache | `renderer/cache/outlineMeshCache.ts` |
| batching, placement, threshold | `renderer/draw.ts` (`drawTextOutlineGroup`, `OUTLINE_MIN_SCREEN_PX`) |

**Public API.** `registerFontOutlines(family, variant, source)` — source is a
URL, `ArrayBuffer`, `Blob`, or a thunk returning one, so a `queryLocalFonts`
result can be registered eagerly and read lazily. Plus
`unregisterFontOutlines`, `hasFontOutlines`, `outlineStatus`,
`listFontOutlines`, `enableLocalFontOutlines`, `canQueryLocalFonts`, and
`WeaselRendererOptions.textOutlineMinScreenSize`.

### The one design decision worth carrying forward

**The tier replaces glyph *painting*, never layout.** Advances, kerning,
wrapping and baselines keep coming from whichever SDF tier resolved the run;
only the glyph's shape comes from the outline. The original plan had layout
metrics coming from the font bytes, which would have meant text **reflowing
the moment zoom crossed the threshold** — a line rewrapping under the reader's
cursor. Metric neutrality is what makes a zoom-dependent threshold safe, and
it also means `measureTextBounds` / `textLineBoxes` needed no changes at all.

Pinned by `layoutRuns.test.ts` ("is metric-neutral: bounds, lines and advances
are identical either way").

### Decisions taken, and how they turned out

- **Subset Inter shipped** at `assets/fonts/inter/inter.ttf` (+ `LICENSE.txt`,
  `README.md` recording the exact `pyftsubset` command). 411 kB → **27 kB**,
  cut to the atlas's own charset (U+0020–00FF) so the two tiers cover exactly
  the same characters. Its `hhea.ascender / unitsPerEm` is 0.96875, which is
  *exactly* the atlas's `base 31 / size 32` — the default face's two tiers
  agree on metrics by construction, not by luck.
- **opentype.js** (2.0.0), as planned — but **behind a dynamic import**. It is
  ~49 kB gzipped and this package's only runtime dependency; the tier is async
  anyway, so the import rides the load that was already happening and bundlers
  split it into a chunk nobody fetches until large text appears. Types come
  from `@types/opentype.js` (1.3.10 — the surface used here is unchanged in
  2.0). `glyph.getPath(0, 0, 1)` already emits em space, y-down, baseline at
  origin, so no transform is applied.
- **Glyphs cross the package boundary as SVG `d`.** `@weasel-js/font` is a
  Tier A leaf and cannot name core's `PolygonPath`; the alternative was
  re-declaring core's opcodes in a second package. `d` is the kit's documented
  language for geometry crossing a boundary and `pathFromD` already existed.
- **opentype.js does not support `.ttc`**, which was not anticipated and
  matters: most macOS system families (Helvetica, Times, Courier, Menlo) ship
  as collections. `sfnt.ts` unpacks a member into a standalone sfnt by copying
  its tables and rewriting the directory offsets — no re-encoding, so the
  original checksums stay valid — selected by PostScript name via a minimal
  `name`-table read.

### Deliberate limits

- **Synthetic bold declines the tier** and stays on the SDF. Emboldening
  geometry means offsetting the outline (the same unsolved problem as
  stroke-to-fill), and painting the real weight instead would make text get
  *lighter* as you zoom past the threshold. Synthetic italic does not decline —
  a shear is exact on geometry, and `drawTextOutlineGroup` applies the same
  12° the SDF vertex shader does (shared `SYNTHETIC_ITALIC_RADIANS`).
- **Small text stays on the atlas.** Outlines have no hinting and no stem
  darkening; `glyphRasterizer.ts` measured why. The threshold is on-screen
  size (`fontSize × view scale`, from `ctx.state.transform`), so a 12px label
  at 8× zoom does get outlines.
- **One draw call per group.** Cached em-space triangles are transformed on
  the CPU into one shared buffer rather than given a model matrix each, which
  would have traded away the batching the atlas tier gets for free.

### Two things that came along for free

- **Gradient and pattern fills on text.** `drawTextOutlineGroup` goes through
  `drawPathFillByKind`, and those programs shade in world space — so
  non-solid text fills already render above the threshold, with nothing
  further to build. The TODO entry is now app-side only.
- **Stroked text is much cheaper**, though not done. A glyph above the
  threshold is a `PolygonPath`, so `tessellateStroke` gives real joins, caps
  and miters at any width, instead of the SDF second-threshold trick with its
  rounded corners and distance-range ceiling. See the rewritten TODO entry.

## 1. Text is displaced from its pose box — FIXED

**Root cause: not the font tier, and not `layoutRuns`.** `TEXT_PAINTER` in
`packages/core/src/canvas/NodeShape.ts` passed `pose.y + fontSize` as the draw
command's `y`. That is the canvas-2D `fillText` convention (y = baseline), but
`TextDrawCommand.y` is the **top of the first line box**.

Consequences, all reproducible with a single family and no dynamic tier:

- the baseline landed ~1.97 em below the box top instead of ~0.97, so a
  one-line node at `lineHeight: 1.2` had its baseline at the box's *bottom*
  edge and its descenders outside the pose entirely;
- the box handed to `verticalAlign` was one em down from the node's own, so
  `'center'` / `'bottom'` were wrong by construction;
- it disagreed with `createTextLayer` and with the DOM editing overlay, which
  is why text jumped a line the moment an edit was committed.

**Fix.** `const y = p.y;`. Tests that encoded the old convention were
rewritten; two new ones pin the pose-box anchor.

**Why nothing caught it.** No visual baseline renders text through `kit:text`
— `TextDemo` uses `createTextLayer`, `RenderToPixelsDemo` builds its command
by hand. The painter was the only caller with the wrong anchor and the only
one with no pixel coverage.

**Rig note.** `tests/visual/playwright.config.ts` wanted port 5174, which
`dev:draw` owns; with `reuseExistingServer: !CI` a local run silently attached
to WeaselDraw and failed all 25 baselines against the wrong application.
Visual now runs on 5177. Ports: 5173 smoke / 5174 dev:draw / 5175 e2e /
5176 perf + draw e2e / 5177 visual.

**The ~84px family-relative figure in the original draft does not
reproduce.** Measured by calling `layoutRuns` in the running app at
`fontSize: 48`: Inter (atlas) baseline 46.5, Impact (canvas) 48.0, Georgia
(canvas) 44.0. Impact vs Inter is 1.5px at a 48px em — 3% of the em, exactly
what the ascender table predicts. The real defect was the one-em displacement
above, which is family-independent.

## 2. Glyph contours wobble under magnification — FIXED by §0

The tier is TinySDF: `fillText` once at `BAKE_SIZE = 48`, Euclidean distance
transform, single channel. Contour accuracy is bounded by that 48px raster, so
at ~8× it becomes ±2–3px of visible wobble with bumps one bake-texel apart.

The superseded plan was a second, larger bake tier. A larger bake buys a
bounded improvement — the wobble gets finer, it does not go away, because the
field is still reconstructed from a raster. Outlines are exact at every zoom
and paid for two other open items on the same trip.

Verified in the running app: the `text-outlines` demo (`apps/site/demos/
TextOutlinesDemo.tsx`) loads the subset Inter *twice* — as a CSS `FontFace` so
the canvas tier can rasterize it, and as outline bytes for the same family —
so the toggle is a controlled experiment on one typeface rather than a font
swap. At 4× the difference is unmistakable: the bowl of the `R` ripples on the
SDF side and is a clean curve on the outline side.

**Found while writing the visual spec, and worth knowing:** the two tiers
disagree about where a glyph's *ink edge* falls, by up to one bake texel. The
dynamic tier stores glyph rects as integers off a 48px raster
(`yoffset = base - raster.top`), and that quantization scales up with
everything else — 8 device px for a 96px line at 4×. It is the SDF tier's
rounding, not a placement error, and it is why `text-outlines.spec.ts`
compares ink bounding boxes with a bake-texel tolerance while
`layoutRuns.test.ts` pins pen positions to the float.

## 3. Picking hits blank space inside a text box — FIXED

For `"Away"` in a 600-unit-wide box most of the box is empty, and clicking any
of it selected the node — and swallowed the click.

**Not `pointInTextPose`** — that is only used by double-click-to-edit. The
default body-pick is `useSceneSelectTool`'s `wiredHitBody`, which was
`poseContainsRotated` and nothing else. (Note `useSelectTool`'s own default
`pickEvery` is dead code under `<SceneCanvas>`.)

**Fixed as the general case.** Container nodes already consulted
`findShapeSilhouette`; leaves never did, and that asymmetry *was* the
"geometry-accurate picking" TODO. So: `shapeCoversPoint(node, pose, x, y)` as
one predicate used by both pick paths; `geometry.picking: 'pose' | 'shape'` on
`<SceneCanvas>` and `leafPicking` on `useSelectTool`, both off by default;
`kit:text` gained a silhouette (union of its line boxes, `null` when blank so
an empty node stays selectable); `textLineBoxes` (`features/text/lineBoxes.ts`)
derives those from `layoutRuns` rather than a second measurement.
`apps/draw` opts in.

**Fixed alongside: blank lines collapsed.** `layoutRuns` only raised a line's
height when an entry was pushed, so `"a\n\nb"` painted `b` one line up. The
newline's own run now supplies the blank line's height.

## Still open

Not defects from this handoff — follow-on work, all recorded in `docs/TODO.md`:

1. **The two tiers read different ascender tables.** Chrome reports Inter at
   0.896 em (`sTypoAscender`) where the atlas baked 0.969 (`hhea.ascender`),
   and no browser API recovers the hhea value. Papyrus's ascent+descent of
   1.54 em cannot fit a 1.2 line box under any convention and needs its own
   rule. The outline tier makes this easier, not harder — font bytes give
   access to both tables directly.
2. **Stroked text**, now a path-stroking job rather than a shader job.
3. **Non-solid text fills**, now app-side only.
4. **"Create Outlines"** as a destructive command — a one-liner against
   `glyphOutline` + `pathFromD`, whenever it is wanted.
5. **A visual baseline that paints a text node through the default drawer.**
   §1 shipped with no pixel coverage on the painter that was broken.

## Already fixed (on `main`, `292a4a4a`)

Empty text nodes are discarded on commit — they were invisible full-size pick
targets. A document created before that fix can still contain them;
`kit-text-1` / `kit-text-2` in the dev localStorage scene are examples, left
in place rather than silently mutating the document on load.
