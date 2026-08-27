# Handoff — node paint as objects, and the property panel that edits it

One branch now, `node-stroke-union`, worktree
`.claude/worktrees/node-stroke-union`, at `ce82f4a2`, 16 commits off `main`
(`343c9913`). Not pushed. `tsc`, `eslint` and 7204 tests green.

The design lives in `docs/proposals/2026-08-26-node-stroke-union.md` — read it
first; it describes the model, not the branch. This file is only what that doc
can't carry.

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

**The panel.** `SelectionPanel` honours `block`, has a story
(`SelectionPanel.stories.tsx`) covering a shape node and a text node, and draws
depth only where a label marks it.

## Open decisions

1. **The align icon.** Two attempts, neither accepted. Nested squares say the
   concept and are illegible at 16px; a band against a shaded edge reads at
   every size but says "which side of an edge" and needs the shading to be
   understood as interior. Mike has approved the *join* set and the cap set;
   align is the blocker on wiring any of them.
2. **The aqua.** Mike asked to move ToggleBar's default treatment off "the
   aqua" and save it for another theme. ToggleBar has no colour of its own —
   every surface is `var(--wzl-accent)`, which resolves to `#2e1f7a`, deep
   indigo, and 17 components read it. Either he is looking at a surface with a
   local override, or what reads as a different colour is ToggleBar's glass
   ramp (`ToggleBar.module.css:83-87`), the loudest accent treatment in the
   kit. Unanswered — ask before changing a token 17 components share.
3. **Optional fields display their defaults as if they were values.** A text
   node with no stroke shows Cap/Join/Align with segments lit. `TextStyle` and
   `Stroke` fields are mostly absent and resolved at paint time, so a control
   falling back to its schema default *claims* a value the node doesn't hold.
   It wants placeholder-not-value semantics across every optional leaf, which
   is its own pass.

## Approved icon geometry, not yet built

20×20 viewBox, filled silhouettes. Heights rank as the geometry does — a miter
runs furthest past the corner, a round join reaches its half-width, a bevel is
cut shortest — so the set reads by height as well as by shape:

```
miter  M10 3.5 15.6 15.5H4.4Z
round  M4.4 15.5V12a5.6 5.6 0 0 1 11.2 0v3.5Z
bevel  M6.8 8.2h6.4l2.4 7.3H4.4Z
```

Cap (accepted, stroked not filled): a `stroke-width: 5` bar `M4 10H13` drawn
with each `stroke-linecap`, over a hairline terminus rule at `M13 3.2V16.8` —
the rule is what makes butt and square different rather than a claim.

The pipeline is friendlier than it looks: `scripts/gen-icons.mjs` already emits
a name→path map (`ICON_PATHS`) with an `IconName` type and an `<Icon name>`
component, so a schema can carry an icon *id* and the panel resolves it — no
React in core, no registry to build. What's left: glyphs into
`scripts/icons/`, an icon field on the enum leaf and its options, `block: true`
on cap/join/align to drop the row label, and the panel rendering a leading
glyph per bar.

## Next, in order

1. Wire the icons (blocked on decision 1).
2. **Paint moves out of `TextStyle`.** A text node painted by `data.fill` /
   `data.stroke` like every other node; `StyledRun.fill` / `.stroke` stay as
   per-range overrides; `withLeafStroke` is deleted rather than gaining a fill
   twin. Breaks documents holding `style.fill` — accepted, but it fails as a
   wrong colour rather than an error, so it wants a changeset line.
3. The placeholder pass (decision 3).
4. **Units.** Mike asked where unit support already exists. `ToolPrefNumberUnit`
   (`toDisplay`/`fromDisplay`/`suffix`) is the only mechanism wired end to end,
   and exactly one leaf uses it (`pose.rotation`). Three things to know before
   building on it: `PrefsForm` ignores `unit` entirely, so the same leaf shows
   degrees in the panel and radians in preferences; `SelectionPanel` converts
   the value but passes `min`/`max`/`step` unconverted; and the conversion
   tables you'd want (`UnitSystem`, in/mm/px) live in a *different* mechanism
   that is grid-snapping only, whose formatter `formatUnit` has zero callers.
   Nothing anywhere parses `"12mm"`. The schema type is hand-duplicated in core
   and weasel-ui by policy and a third time in the labkit adapter, so every
   field added lands three times.

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

- **The shell cwd resets to the main checkout.** A relative-path command then
  edits `/Users/mike/src/weasel` instead of the worktree, and a test run there
  measures the wrong tree. It happened twice in one session, once producing a
  confident and meaningless "all green", once a false report that a merge had
  dropped a file. Use worktree-absolute paths for everything, and re-check
  `pwd` after any command that ends in `open` or `cd`.
- **`SceneCanvas.animatedZoom.test.tsx` fails 9 tests under full-suite load and
  passes 14/14 alone.** Reproduced on this branch, on the collapse branch and
  on untouched `main`, then passed on a later run — intermittent, pre-existing,
  not caused by this work. It means the kit project has no reliably clean
  full-suite run right now.
- **jsdom cannot catch a layout collapse**, and didn't: the object leaf's
  double heading, its missing indentation, the content row nested inside a
  section of the same name, and the size/weight pair silently splitting into
  two rows were all found by screenshotting the story, with every test green.
