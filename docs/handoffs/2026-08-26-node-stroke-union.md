# Node paint as objects, and the property panel that edits it

**Committed to `main`, not pushed** — the panel pass ends at `63a679ef`.
The tree is clean. `tsc`,
`npm test` (7714) and `npm run test:stories` (289) are green.

The model is described in `docs/proposals/2026-08-26-node-stroke-union.md` —
read that first. This file carries only what it can't: what is left, and the
decisions that live in conversation rather than in the tree.

## What landed earlier, on `main`

**The data.** `data.fill` is a `FillStyle` and `data.stroke` a `Stroke`, with
no scalar form of either: no colour strings, no `data.strokeWidth`, no
`data.color`. `null` is an explicit "no paint", `undefined` takes the painter's
fallback. Alpha lives in `FillStyle.opacity`, one slot for every paint kind,
which is what lets the opacity actions scrub a gradient. `solid()` and
`strokeOf()` are the authoring helpers. `NodeInk` reports per-side reach
(`outset`/`inset`) because `align` decides which side of the silhouette the ink
lands on. SVG import keeps dash, cap, join and gradient stroke paints.

**The schema.** `ToolPrefObject` holds a compound value with its fields as
`children`, each edit committing the parent whole. Children may be organised
into `ToolPrefGroup`s that contribute nothing to the path; an empty group `name`
renders no heading. `ToolPrefEnumControl` gains `'toggle'` with `short` option
labels. `pair` merges adjacent fields into one row.
`PropertyRenderContext.valueAt(path)` reads any other node path across the
selection.

**Paint out of `TextStyle`.** A text node paints from `data.fill` and
`data.stroke` like every other kind; `TextStyle` is typography only.
`resolveTextStyle(style, paint)` derives the caret and selection colours from
the node's paint. A caller with no node states its colour on the run.

## What the panel pass changed

A visual pass on `SelectionPanel`, plus two theme fixes it uncovered.

**The panel.** Sections run Layout → Content → Appearance; the stroke row is
width then colour, each taking half. Stroke width is a slider (0–20, step 0.5):
`SelectionPanel` had been ignoring `control: 'slider'` altogether — only
`PrefsForm` honoured it — so the branch is new, and its readout deliberately
does not clamp where the thumb does. The opacity readout reads `%`. Paired
fields split a row evenly, the exception now being segmented bars, which are
sized by their segments.

**ToggleBar gained a `flat` variant** — no track, no glass, no pill; each button
outlined in `--wzl-border-strong` over `--wzl-surface-sunken`, selected a flat
accent. It is a new variant rather than a change to `minimal`, which nine files
use and which drops the selected background entirely. `cap`, `join` and `align`
lost their `icon` in the schema, which is what lets the three bars share one row.

**Two theme fixes.** `552103a3` had widened the font-weight scale to 300/500/700
to match interstellar; Oswald is a condensed display face whose usable range is
200–700 and whose ranks sit low, so every heading rendered bold. That commit is
reverted — the scale is back to 200/300/350/400 and interstellar has its own
override again. Separately, `color-scheme` was emitted only inside the
`[data-wzl-mode]` blocks, so a surface that never calls `applyTheme` got the
dark palette with light native widgets; `:root` now carries the default mode's
scheme, with a test.

## What is left, in order

1. **A paint editor in the kit.** `FillStyle` has five variants — solid,
   pattern, and three gradients — with stops, geometry, `units`, `origin` and
   per-paint opacity. The panel edits **solid colour only**: a gradient renders
   as the indeterminate chip, and the first touch writes `{ fill: 'solid',
   color }` over it (`SelectionPanel.tsx`, `case 'paint'`), destroying it.
   Meanwhile `@weasel-js/ui` already exports `GradientEditor` (kind and stops)
   and `GradientHandles` (geometry) and **no kit panel uses either**; WeaselDraw
   hand-rolls the whole editor through the `renderers` escape hatch — kind
   switcher, per-kind seeding, pattern picker, pattern recolour — and almost all
   of it is kit-shaped code sitting in an app.

   Two things make this an arc rather than a control. `setStroke` takes only a
   `color` param where `setFill` takes a whole paint, so **a gradient stroke has
   no write path at all**. And gradient geometry needs a canvas overlay with
   pose-frame conversion (`fillInPoseFrame` / `fillToBoundsFrame`) that
   `SelectionPanel` cannot reach. Not in `docs/TODO.md` yet; the adjacent
   pattern entry there is about tiles, not about the panel.

2. **The placeholder pass.** A control with no value falls back to its schema
   default and so *claims* one — a text node with no stroke lights a segment in
   Cap, Join and Align. The diagnosis is narrower than it looks: the read path
   already knows. `nodeValueAt` returns `undefined` and `aggregateValue` passes
   it through; the information is discarded one line later where `undefined`
   -because-absent and `undefined`-because-mixed collapse into one `value` plus
   a `mixed` boolean. Each control then re-invents `?? p.default`. Most controls
   can already express it — `ToggleBar` takes `value: null`, `Select` a
   placeholder, `ColorField` a real `mixed` prop; `Switch` has no affordance.
   The new slider branch shows `—` and is the shape to copy. **`PrefsForm` must
   keep substituting** — a sparse prefs blob genuinely means "use the default",
   which is exactly what a scene node does not mean.

3. **Units.** `ToolPrefNumberUnit` (`toDisplay`/`fromDisplay`/`suffix`) is the
   only mechanism wired end to end and exactly one leaf uses it
   (`pose.rotation`). `PrefsForm` ignores `unit` entirely, so the same leaf
   shows degrees in the panel and radians in preferences; `SelectionPanel`
   converts the value but passes `min`/`max`/`step` unconverted; and the
   conversion tables you'd want (`UnitSystem`, in/mm/px) live in a *different*
   mechanism that is grid-snapping only, whose formatter `formatUnit` has zero
   callers. Nothing anywhere parses `"12mm"`. The schema type is hand-duplicated
   in core and weasel-ui by policy and again in the labkit adapter, so every
   field added lands three times.

4. Two gaps the paint move exposed rather than caused, both in `docs/TODO.md`:
   outline-only text (a `null` fill has nowhere to be said), and text having no
   `NodeInk` (a text stroke adds zero hit reach).

## Open decisions

- **Optional fields display their defaults as if they were values** — item 2
  above, still unanswered as a semantics question across every optional leaf.
- **The aqua.** Asked for ToggleBar's default treatment to move off "the aqua"
  and be saved for another theme. ToggleBar has no colour of its own — every
  surface is `var(--wzl-accent)`, deep indigo, which 17 components read; what
  reads as a different colour is its glass ramp. The panel's bars are off it now
  via the `flat` variant, but the default variant is untouched. Ask before
  changing a token 17 components share.

## The glyph set

`scripts/icons/paint.mjs` holds the option and category glyphs; `paths.ts` is
generated — re-run `node packages/ui/scripts/gen-icons.mjs` after editing.

**align** took several rounds and the answer is worth keeping: one circle of
radius 6.2, zoomed until the 3.4-wide ink band's far edge leaves the box.
`inner` closes into a disc, `outer` into the box's complement of it, and
`center` is the annulus straddling the path — one band at three offsets, so the
set reads as a set. Two earlier attempts failed at 16px because `center` and
`outer` were both an L differing only in thickness.

**cap** is drawn in both registers: a hollow rectangle for the path, solid ink
for what the cap adds past its right edge, so `butt` reads as "nothing beyond
the end" rather than as a shorter bar. Each of the three is placed by its own
ink extent — one shared x centres the set but leaves `butt` visibly left in its
segment, and a segmented control is judged a button at a time. The cap ink is
flush with the body's *outer* profile, half a stroke past its edges; matched to
the centreline the two meet in a visible step. This replaced a filled slab
ending on a terminus rule, which could not be centred at all: its body bled off
the left edge, pinning the ink to x 0 whatever the terminus did.

## Decisions made in conversation, not visible in the code

- **Breaking compatibility beats adding a compatibility path.** Standing
  default. Propose the break and name what it costs.
- **Depth is drawn only where a label marks it.** Rows under a suppressed
  heading don't indent.
- **A union is edited as a union**, and fields of one value are children, not
  siblings. Both rules exist because the alternative silently corrupts data.
- **Dash has no control.** A `number[]` has no leaf kind. It survives import,
  render and export untouched.
- The `stroke` pref kind and `NodeInkResult` were both added and then deleted.
  Don't reintroduce them: the first was a one-off for what `ToolPrefObject`
  does generally, the second a compatibility shim.

## Traps

**A range input's unfilled track ignores `color-scheme`.** Chrome fills the left
of the track with `accent-color` and paints the remainder near-white on a dark
surface regardless. Overriding the track background removes the accent fill
entirely rather than recolouring the remainder — measured both ways. Both
sliders therefore paint their own track from a `--slider-fill` custom property
set inline, since no static rule expresses "filled to N%". The CSS is duplicated
in `SelectionPanel.module.css` and `ColorField.module.css`; a shared range
component is the right home and was not built.

**`.size_sm .segment` outranks `.segment:has(> svg)`**, so a small bar's glyph
padding has to be restated per size or glyphs get the text padding and read as
wide plates. The same shape of bug is why `variant_minimal` restates it too.

**`SceneCanvas.animatedZoom.test.tsx` fails 9 tests under full-suite load and
passes 14/14 alone.** Reproduced on several branches including untouched `main`,
then passed on a later run — intermittent and pre-existing. It did not recur
this session.

**A Storybook answering on your port may be another worktree's.** One serving a
different tree answers `/index.json` with stories that don't include yours,
which reads as "my story failed to index". `lsof -ti tcp:<port>` names the
process and the tree it was started from.

**The git stash stack is shared by every worktree of this repo.** A `stash`/`pop`
pair run in one worktree can pop another session's work into it.

**jsdom cannot catch a layout collapse**, and did not catch any of this
session's defects — the wide segments, the wrapped row, the light slider track
and the uncentred glyphs were all found by screenshotting the story with every
test green. Screenshot anything that changes a box.

**The draw app's text-colour round trip was never driven by hand.** Synthetic
keystrokes do not reach the contenteditable overlay. Drive it manually before
trusting that path.
