# Node paint as objects, and the property panel that edits it

**Merged to `main` at `6f819fc9` (2026-08-27). Not pushed.** `node-stroke-union`
and `paint-object-collapse` are gone with their worktrees; there is no branch to
pick up, only the agenda below. `tsc`, `npm test` (7714) and `npm run build` are
green on `main`.

The design lives in `docs/proposals/2026-08-26-node-stroke-union.md` — read it
first; it describes the model, not the work. This file is only what that doc
can't carry: what remains, and the decisions that live in conversation rather
than in the tree.

## What landed

**The data.** `data.fill` is a `FillStyle` and `data.stroke` a `Stroke`, with
no scalar form of either: no colour strings, no `data.strokeWidth`, no
`data.color`. `null` is an explicit "no paint", `undefined` takes the painter's
fallback. Alpha lives in `FillStyle.opacity`, one slot for every paint kind,
which is what lets the opacity actions scrub a gradient. `solid()` and
`strokeOf()` are the authoring helpers. `NodeInk` reports per-side reach
(`outset`/`inset`) because `align` decides which side of the silhouette the ink
lands on. SVG import keeps dash, cap, join and gradient stroke paints; both
importers share `strokeDataFromSvg`.

**The schema.** `ToolPrefObject` holds a compound value with its fields as
`children`, each edit committing the parent whole — `data.stroke` and
`data.style` are both shaped that way. Children may be organised into
`ToolPrefGroup`s that contribute nothing to the path. An empty group `name`
renders no heading. `ToolPrefEnumControl` gains `'toggle'` with `short` option
labels. `pair` merges adjacent fields into one row, inside an object leaf as
well as in a section. `PropertyRenderContext.valueAt(path)` reads any other
node path across the selection.

**Paint out of `TextStyle`.** A text node paints from `data.fill` and
`data.stroke` like every other kind; `TextStyle` is typography only.
`withLeafStroke` is gone, and so is the duplicate `data.style.fill` control.
The asymmetry this closed is worth knowing: `data.stroke` already reached
text through the painter's fold, `data.fill` never did, so picking a fill
colour with a text node selected wrote a field nothing read.
`resolveTextStyle(style, paint)` takes the node's paint second and derives
the caret and selection colours from it; `TextPose` and `SvgTextNode` each
gained `fill` / `stroke`. A caller with no node — a HUD widget, the debug
overlay — states its colour on the run.

**The panel.** `SelectionPanel` honours `block`, has a story
(`SelectionPanel.stories.tsx`) covering a shape node and a text node, and draws
depth only where a label marks it.

## Open decisions

1. **The aqua.** Mike asked to move ToggleBar's default treatment off "the
   aqua" and save it for another theme. ToggleBar has no colour of its own —
   every surface is `var(--wzl-accent)`, which resolves to `#2e1f7a`, deep
   indigo, and 17 components read it. Either he is looking at a surface with a
   local override, or what reads as a different colour is ToggleBar's glass
   ramp (`ToggleBar.module.css:83-87`), the loudest accent treatment in the
   kit. Unanswered — ask before changing a token 17 components share.
2. **Optional fields display their defaults as if they were values.** A text
   node with no stroke shows Cap/Join/Align with segments lit. `TextStyle` and
   `Stroke` fields are mostly absent and resolved at paint time, so a control
   falling back to its schema default *claims* a value the node doesn't hold.
   It wants placeholder-not-value semantics across every optional leaf, which
   is its own pass.

## The glyph set, built

`scripts/icons/paint.mjs` holds nine option glyphs and four category glyphs;
`paths.ts` is generated. Two registers, on purpose: an **option** glyph is a
filled silhouette — the glyph is the ink — and a **category** glyph is the
bare path that row treats, outlined at the set's 1.5.

`align` took several rounds and the accepted answer is worth keeping: one
circle of radius 6.2, zoomed until the 3.4-wide ink band's far edge leaves the
box. `inner` closes into a disc, `outer` into the box's complement of it, and
`center` is the annulus straddling the path — one band at three offsets, so
the set reads as a set. Two earlier attempts failed at 16px because `center`
and `outer` were both an L and differed only in thickness. The options run
inner, center, outer.

The cap bar starts at x -2 so the viewBox clips its *other* end; at 0 a round
cap domes there too and the glyph reads as a lozenge.

## What is left, in order

1. **The placeholder pass** (open decision 2). A text node with no stroke
   still shows Cap/Join/Align with segments lit, because a control with no
   value falls back to its schema default and so *claims* one. It wants
   placeholder-not-value semantics across every optional leaf.
2. **Units.** Mike asked where unit support already exists.
   `ToolPrefNumberUnit` (`toDisplay`/`fromDisplay`/`suffix`) is the only
   mechanism wired end to end, and exactly one leaf uses it
   (`pose.rotation`). Three things to know before building on it:
   `PrefsForm` ignores `unit` entirely, so the same leaf shows degrees in the
   panel and radians in preferences; `SelectionPanel` converts the value but
   passes `min`/`max`/`step` unconverted; and the conversion tables you'd
   want (`UnitSystem`, in/mm/px) live in a *different* mechanism that is
   grid-snapping only, whose formatter `formatUnit` has zero callers.
   Nothing anywhere parses `"12mm"`. The schema type is hand-duplicated in
   core and weasel-ui by policy and a third time in the labkit adapter, so
   every field added lands three times.
3. Two gaps the paint move exposed rather than caused, both in `docs/TODO.md`:
   outline-only text (a `null` fill has nowhere to be said), and text having
   no `NodeInk` (a text stroke adds zero hit reach).

## Decisions made in conversation, not visible in the code

- **Breaking compatibility beats adding a compatibility path.** Standing
  default. Don't offer a fallback-for-old-documents option; propose the break
  and name what it costs.
- **Depth is drawn only where a label marks it.** Rows under a suppressed
  heading don't indent — the panel's tree discipline.
- **A union is edited as a union**, and fields of one value are children, not
  siblings. Both rules exist because the alternative silently corrupts data.
- **Dash has no control.** A `number[]` has no leaf kind. It survives import,
  render and export untouched. The labkit example offers named presets and says
  so; the kit doesn't.
- The `stroke` pref kind and `NodeInkResult` were both added and then deleted
  on this branch. Don't reintroduce them: the first was a one-off for what
  `ToolPrefObject` does generally, the second was a compatibility shim.

## Traps

- **`SceneCanvas.animatedZoom.test.tsx` fails 9 tests under full-suite load and
  passes 14/14 alone.** Reproduced on this branch, on the collapse branch and
  on untouched `main`, then passed on a later run — intermittent, pre-existing,
  not caused by this work. It means the kit project has no reliably clean
  full-suite run right now.
- **A Storybook answering on your port may be another worktree's.** Concurrent
  sessions run their own on nearby ports, and one serving a different tree
  answers `/index.json` with stories that don't include yours — which reads as
  "my story failed to index" rather than "wrong server". `lsof -ti tcp:<port>`
  names the process and the tree it was started from.
- **The draw app's text-colour round trip was never driven by hand.** The
  painter reading `data.fill` is covered by tests and by the TextDemo and
  outline-demo screenshots, but picking a swatch with a text node selected in
  WeaselDraw was not: synthetic keystrokes do not reach the contenteditable
  overlay (`fill()` bypasses its input handler, and `pressSequentially` on a
  freshly-created node committed empty twice). Drive it manually before
  trusting that path.

- **jsdom cannot catch a layout collapse**, and didn't: the object leaf's
  double heading, its missing indentation, the content row nested inside a
  section of the same name, and the size/weight pair silently splitting into
  two rows were all found by screenshotting the story, with every test green.
