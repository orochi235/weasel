# In flight: forge stories in the workshop document — branch `worktree-forge-in-document`

Worktree `.claude/worktrees/forge-in-document`, five commits on top of `main`,
not merged. Spec: `docs/superpowers/specs/2026-09-25-forge-in-document-stories-design.md`.
The changeset `.changeset/forge-in-document-stories.md` says what landed.

**Next:** merge to `main`, then delete the branch and worktree.

## Decisions made in conversation that the code does not explain

**Isolation is allowed indefinitely.** The frame path is frozen and
`check:forge-isolate` refuses an increase, but a story may stay isolated for
as long as it takes; deleting the frame side is a condition on the count
reaching zero, not a milestone. Two stories are isolated today, Toast and the
Select edge story, each with its reason in the source.

**A URL goes into the focused trial.** Typed, linked or pasted, a story's hash
swaps into the focused trial the way a tree click does; only a lab with no
trial gets a new one, and Shift-click is what opens another. The earlier
"a typed hash opens a trial of its own" is gone on purpose.

**The wake dev plugin reloads a tab that hot-updated in place.** Its stamp
moves on every JS update and its client treats a tab still on the old stamp
as stale, so with wake loaded a story edit applies in place and the page
reloads a few seconds later anyway. Noted in `~/src/wake/TODO.md`; run the
forge dev server with `WAKE_PATH=/nonexistent` to see the in-place reload.

**`packages/labkit/src/config/entry.test.ts` fails on `main` too**
("loads nothing from @weasel-js/ui at runtime"); it is the P2 filed in
`e5d134438`, not this branch.

---

# Retained from the CSS Vars scale editor — merged into `main`

**A sparse canvas absorbs a real regression at the default baseline
tolerance.** `assertMatchesBaseline` allows 2% of pixels to differ; on the
diagram demos a node moving 10px is half a percent, and the baseline passed
with the node moved. `tests/visual/diagram.spec.ts` runs at 0.4%. Check any new
baseline by breaking the demo and watching it fail.

---

# Retained from the gradient arc — merged into `main`

The branch and its worktree are gone; `git log` carries what landed. What is kept
here is the part the tree does not explain on its own.

## Decisions made in conversation that the code does not explain

**A gradient carrying `interpolate` keeps its native SVG element and takes no
paint fallback.** A conic gradient has no SVG form at all, so it needs the
fallback; an OKLCh linear gradient has one, and a renderer that ignores the
attribute paints the same gradient with a moved midpoint. A fallback there would
trade a shifted midpoint for a flat color, which is worse.

**The mesh kind went in through the public registry slots on purpose.** It could
have been a sixth branch in `draw.ts` beside patterns. Registering it is the proof
that `registerPaintKind` can carry a paint this rich — its one concession is living
in core, because that is where the shader registry is.

**The mesh renders as a bake, not as geometry.** A patch maps `(u,v)` to a
position; a paint has to answer the inverse. Rather than invert a bicubic per
fragment, the kind rasterizes forward into a 256-texel bitmap the shader samples,
which also makes it compose with clipping like any other texture paint.

**Corner colors blend as three lerps, not four weights.** OKLCh hue is an arc, and
an arc is defined by two endpoints — there is no meaningful four-way mix.

## Traps this work hit

**The tensor patch's interior control points sit at transposed indices** from the
obvious reading of PDF's boundary walk. `surface.test.ts`'s "agrees with the tensor
form" case is the one that catches it; it failed first with a 0.01 error, which is
small enough to look like rounding and is not.

**A rasterizer that tests pixel centers drops the outermost row** when the paint's
box maps to texel *edges*. `bake.ts` maps it to texel centers and the shader
undoes the half texel; the coverage test is what found it.

**`MeshGradientFill` is not a member of `FillStyle`.** The union stays closed over
the built-in kinds, so a registered kind's shape only travels through `asPaint`.
Every editor callback for one emits `FillStyle`, not its own type.

**`eslint-disable` for a rule this repo does not configure fails the lint run.**
`react/no-array-index-key` is not installed here.


# Retained from completed work — the theme editor and palette lab

Both phases of `docs/superpowers/specs/2026-09-10-theme-engine-and-editor-design.md` are merged.
These notes are kept because nothing else records them. Do not read them as open work.

## Traps from phase 1

**Parallel implementers in one worktree collided.** Two agents committing at
once swept each other's staged files into the wrong commit, and one reset
undid another's commit. Run one implementer at a time; reviewers can run
alongside, read-only.

**`tests/visual` loads engine source through Node's own type stripping**, which
rejects TypeScript parameter properties (`constructor(private readonly x)`),
enums and namespaces. `tsc` and vitest accept them, so only the Playwright run
fails, with a `SyntaxError` naming no file you'd suspect.

**chrome-devtools MCP screenshots must be saved inside the workspace.** A path
under the job's tmp directory is refused; `node_modules/.cache/` works and is
ignored.

## The palette lab — the arc before phase 1, kept for its traps

The palette lab at `apps/theme-editor`, `#/palette`, generates a categorical
color set from constraints. Its generator now lives in the engine,
`packages/theme/src/engine/color/generate.ts`; the named crayons stay in the app.

Run it with `npm run dev:theme-editor` (port 4713). Tests are in the `draw`
vitest project: `npx vitest run --project=draw apps/theme-editor`.

The generator is `src/palette/generate.ts`. It takes a count, a hue-gap floor,
a WCAG contrast floor against a named surface, two perceptual-distance floors, a
lightness law, a chroma fraction, an equalize amount, and any number of pinned
hues; it searches hue positions in two phases (repair the gates, then maximize
chroma) and returns the set plus its measurements.

## Decisions made in conversation that the code does not explain

**The theme package becomes a generic engine; weasel becomes one theme in it.**
That was the answer to "how far should this stop being about weasel" — configurable
prefix, a universal semantic vocabulary, and weasel's component tokens
(`tb-height`, `slider-thumb-mix`, `prop-*`) as a separate layer another project
omits. The portable artifact is the *emitted CSS*, not a runtime dependency,
which is what keeps the engine in-scope. The `components` layer is built; the
configurable prefix is not, and the spec names it as the next arc.

**Derivation fills in what you have not decided; it does not replace authoring.**
Mike's read — that full derivation is aspirational — is correct and the design
follows it. Zero seeds and 101 pins is today's `interstellar`, unchanged. The one
piece that genuinely earns its keep is assigning semantics *by ramp index* rather
than by hex, because that is what makes one definition produce both modes.

**Equalizing chroma was tried and rejected: the spread is the gamut, not a
defect.** `equalize` stays at 0 by default. Raising it buys the weak hues' chroma
by moving their *lightness* — teal goes to L 0.896 and becomes the second
brightest thing in the set — so it relocates the inequality rather than removing
it. Cyan, teal and amber cannot reach the set mean at *any* lightness.

**Why a palette sorted by hue oscillates in chroma.** The even hue spacing is
selection pressure; the oscillation is sRGB's shape traced. Tailwind's 500 row
sits at a mean **97%** of the most chroma available at each of its hues, so its
chroma curve *is* the gamut curve — lumpy because the cube's six corners are
neither evenly spaced (gaps 33°–81°) nor equally strong (cyan 0.155, magenta
0.322). Flattening it means dropping everyone to ~0.13. Chart:
`~/colors/oscillation.html`.

**Perceptual distance here is chroma-weighted, and the weight is load-bearing.**
`CHROMA_WEIGHT = 3` in `src/palette/oklch.ts`. Plain OKLab distance ranks a pale
gray as further from white than a pale blue, which is backwards from CIELAB and
from the eye — OKLab's chroma range is small beside its lightness range.
`surfaceDistance.test.ts` pins the weight to CIELAB's ordering on a reference
table. **CIELAB dE thresholds do not port to these numbers**; they are a
different scale.

**Anchors carry chroma, and that was not decoration.** Hue and lightness alone
can only describe *vivid* colors, so `tan` came back an amber and
`anchorFromHex` silently saturated any muted brand color pinned into it.

**Yellow is the sharpest case for pinning, not a special case.** Its chroma peaks
at L 0.95, higher than any hue; below ~0.86 it reads gold. A lightness law chosen
for legibility yields gold and reports nothing.

**Source provenance, deliberately chosen.** LEGO comes from Brickset's
`status-Current` because that is the one field LDraw's `LDConfig` lacks —
production status. Copic uses `meodai/copic-colors`' *sampled* value rather than
the tidied hex the same dataset carries, because a marker's color is a
measurement. Both are generated by `scripts/gen-brand-colors.mjs`.

## Settled 2026-09-10

**The swatch set stays as landed: ten colors, no anchored yellow.** Ten is the
conventional count, and the farthest-point order means a consumer who wants
fewer takes the first N. A true yellow only exists near L 0.95 and would stand
far brighter than the rest; `citron` holds that hue slot at the set's lightness.

**`--wzl-border-strong` and `--wzl-border-raised` became one token,
`border-strong`** — `gray-400` in dark, `gray-500` in light, clearing 3:1 against
every surface. `border-raised` is gone.

**The regenerated neutral ramp becomes the theme editor's worked example** — the
ramp it generates for a new theme, shown beside weasel's pinned one. weasel's own
values stay pinned; landing the ramp would move every surface color and is a
visual-baseline event. The proposal, at 1.81× step spread against the shipping
ramp's 3.6× (ΔL 0.043 → 0.154, dark end crushed so 700/800/900 read as one field):
`#f5f6f7 #e0e1e4 #c6c8cb #a7a9ae #85888e #64676f #464a51 #2f3137 #1c1e22 #0c0e12`.

## Traps this work hit

**The dev server executes stale modules while serving fresh ones.** Twice. It
showed as 37 `lego-undefined` React key collisions — old component, new data —
and the orphaned buttons then made every source tab look like it held the same
colors. A hard reload is the only thing that settles it, and *the browser is not
evidence* until you have done one.

**This project's jsdom provides `window` but no `localStorage` at all.** Under
Node 26 the `draw` vitest project reads `window.localStorage` as undefined and
prints "localStorage is not available because --localstorage-file was not
provided", so `persistDraft` and friends silently store nothing (seen
2026-09-14). A test that reaches for storage asserts a stub, nothing more:
`ThemeEditor.test.tsx` swaps in an in-memory one with `vi.stubGlobal`. `presets.ts` splits
parsing from storage for exactly this reason.

Measured 2026-09-16: **Node 26 is not the problem — a loaded box is.** `npm test`
on Node 26 passes 1050 files / 11576 tests, the same counts two fleet nodes get
on Node 24. An earlier local run failed 7 tests (four in `ThemeEditor.test.tsx`,
two in `SemanticsLayer.test.tsx`, one in labkit's `Specimen.test.tsx`) as six 5s
timeouts and a missing `listbox` role, while another repository's vitest had the
CPU; it took 712.90s against 149.66s for the clean run and 63.76s on the fastest
node. The config sets no `testTimeout` and no `maxWorkers`, so the suite alone
drives this 12-core machine to load ~50 against a 5000ms default — anything else
running turns that into timeouts that read as failures.

**`Callout` from `@weasel-js/ui` is a React Aria popover, not an inline banner.**
Rendered inline with no trigger it never opens and renders *nothing*, silently.
There is no kit component for an inline status message.

**`.lk-shell-body` is a block container**, so `flex: 1` on a child resolves to
nothing. Take `height: 100%`. labkit's own stylesheet carries a comment saying so,
three lines from where this was got wrong.

**labkit's `theme/base.less` points at `./fonts/`**, correct for its published
`dist/` and resolving to nothing from source — so every dev load 404'd and the lab
rendered in a fallback face while Chrome tried to parse an HTML error page as a
font. `apps/theme-editor/vite.config.ts` serves them; any source-tree consumer of
labkit hits this.

**A palette search that scores the whole set per candidate move is O(n²) for O(n)
of change.** That, plus a distance function re-parsing both hexes inside the hot
loop, cost 1.7 seconds per slider tick at 16 colors. `cost.test.ts` guards both
the budget and the resulting chroma, because a speed test that lets quality slide
is not a guard.

## Verifying

```sh
npx tsc --noEmit                                   # from the repo root
npx vitest run --project=draw apps/theme-editor
npm run lint
npm run dev:theme-editor                           # port 4713, #/palette
```

`npm run check:test-projects` is the one that fails if a new app's tests are
collected by no project.

# Retained from completed work — the draw-coalescing arc

## Where it stands

Solid geometry, image quads, up to seven distinct textures, text and all three
gradients share one draw. **Nothing is left of step 4**, and
`docs/superpowers/specs/2026-08-14-batched-dispatch-design.md` is now a record
rather than a plan. `docs/TODO.md`'s **"(P2) Per-command draw cost"** entry is
the live account of the whole arc.

What still takes its own draw is what no run can express: per-vertex colors,
even-odd and inner/outer-aligned strokes (their own stencil passes), patterns,
registered shaders, and meshes past the batch's vertex cap.

**There is no obvious next step here.** The plan's own remaining item is the
"one thing to fix along the way" — dispatch is half-deferred, walking the tree
and emitting GL inline except for the batch, so every mutator has to remember to
flush first. That is a clarity argument, not a pressure one.

## Decisions made in conversation that the code does not explain

**All three gradients batch for one reason, and it is not the obvious one.**
Only a linear gradient's ramp position is affine in position. What is affine in
all three is the *coordinate* the ramp position is computed from — so a vertex
carries that, and interpolation across a triangle is exact. A linear gradient's
coordinate is the ramp position itself, which is why it needs no paint mode; the
other two carry a gradient-space point and the shader takes a `length` or an
`atan` of it.

**A branch in this shader is safe; a branch around a derivative is not.** The
paint mode is a flat varying, so every fragment of a quad takes the same arm.
`batchFill.test.ts` now guards the thing that actually matters — the brace depth
of the `glyphCoverage` call, and no `fwidth`/`dFdx`/`dFdy` inside any block —
instead of forbidding the token `if`, which the gradient arm would have tripped
for no reason.

**The branch has to carry the sample, not just the coordinate.** Selecting a uv
and sampling once afterwards makes every fragment in the program read a texture
at a coordinate the shader computed, which the hardware cannot schedule the way
it schedules a read from a varying. 65.1% of a fragment that way against 4.9%
splitting the fetch across the arms. This is the single most surprising number
the arc produced, and it is invisible to every test but `fill-rate.spec.ts`.

**A row index is a stable name; the `v` computed from it is not.** Growing the
ramp atlas moves every row's `v` and recycling one rewrites its texels, both
irreversibly — so `GradientRampAtlas.wouldReshape` is asked *before* the bake
and the run flushed if the answer is yes. Growth from an empty atlas is exempt,
and that exemption is load-bearing: without it the first gradient of a
renderer's life breaks whatever run it lands in, and `drawBatch.image.test.ts`
was passing on that wart.

**`gradFill` had never applied the group color matrix.** Every other paint
program did. It only became visible because a batched gradient does, which would
have made the same paint differ by which route it took.

**A test reaching for "a paint the batch cannot express" wants per-vertex
colors now.** Five files used a gradient for that; all of them go on passing for
the wrong reason otherwise. Also in `CLAUDE.md`'s Traps.

## The measurement instrument, which is the part that misleads

**A shader variant a compiler can fold measures nothing.** `fill-rate.spec.ts`
gated its glyph-math variant on `u_color.a * 0.0` — folded to zero, and every
line feeding that arm deleted with it, so the variant timed the control. The
glyph math costs about 100% of a fragment that is not a glyph, not the 1.4%
recorded when text landed. A runtime zero that is not a compile-time zero
(`u_color.a - 0.5` where the uniform is 0.5) is what keeps the code alive. The
text decision survives the correction because a wall is draw-bound, but every
"with and without" shader pair has this trap in it.

**`gl.finish()` does not block in Chrome** — commands go to the GPU process and
the call returns, which timed 43M fragments at 0.003 ms and read as free; a
one-pixel `readPixels` is the real sync point. Samples must be long enough that
the GPU clock is not still ramping through them, and variants must run forward
then mirrored (ABBA, or ABCCBA for three) — under ABAB whichever runs second
sits later on that ramp every time.

**Do not compare a perf number against one recorded on another day.** The same
unchanged tree measured 1.85 ms where `docs/TODO.md` records 1.50 for the same
rung. Always take the A/B back to back in one sitting, and quote the pair. A
worktree at the parent commit is how: `git worktree add <dir> HEAD~1`.

**`transition-matrix` cannot resolve a change of this size.** Three runs in one
sitting spread ~50% on an unchanged fixture. What it can say within a sitting is
that mixing is free: 512 alternating solids and gradients came in below 512
gradients alone. Draw counts, not milliseconds, are what the tests assert.

**`tests/visual/batch-pixels.spec.ts` exists because no screenshot can see a
batched run's composition** — the atlas quad covers the ground rect it
corrupted. Its gradient cases go further and check arithmetic too, because no
baseline covers a radial or conic gradient at all. Two lessons are built into
them: a conic probe on the `dy = 0` axis sits on the seam, where `fract` sends
one side to 0 and the other to 1; and a conic at a right angle or none cannot
catch a rotation going the wrong way, because one of `sin`/`cos` vanishes.

**Seven textures, not more, and the white texel owns slot 0.** WebGL2 guarantees
16 fragment texture units, so eight is safe without a `getParameter` — which the
GL recorder would answer with a recording function rather than a number. Bitmaps,
font atlases and the one ramp atlas share the seven above it.

**A bitmap wanted at two MAG_FILTERs still breaks the run.** That is state on
the texture object, not on the unit. A font atlas has no such quarrel, and must
not: filtering a distance field destroys it. The ramp atlas filters LINEAR in
both axes and each ramp is sampled at its row's center, where the neighbouring
row's weight is exactly zero.

## Verifying

- `npx vitest run --project=core packages/core/src/renderer/` — the batch's
  buffer-replay tests.
- `npx playwright test --config=tests/visual/playwright.config.ts` — the 51
  baselines plus `batch-pixels`.
- `npx playwright test --config=tests/perf/playwright.config.ts fill-rate` —
  fragment cost, and nothing else.
- `npx playwright test --config=tests/perf/playwright.config.ts atlas-wall` —
  the wall ladder. Draw-bound, so it cannot see fragment cost.
- A perf spec against a dev server left running from an earlier session fails as
  `Failed to fetch dynamically imported module`, not as anything about the code.
  Kill whatever holds port 4722 first.
