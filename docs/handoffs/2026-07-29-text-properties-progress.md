# Text properties — progress

Executing `docs/superpowers/plans/2026-07-28-text-properties.md` (13 tasks) on
branch `text-properties`, worktree `/Users/mike/src/weasel-text-properties`,
based on `main` (spec 1 merged).

**Nothing pushed. Nothing published.**

## State

All 13 plan tasks are done, plus both carried defects. What remains is the
visual-baseline decision below.

| Plan task | Commits |
| --- | --- |
| 1. N-segment node paths | `25efd67a`, `a2919980` |
| 2. New style keys | `a650166a` |
| 3. Run algebra | `1ec821f2`, `a0802a26` |
| 4. useTextEdit range surface | `a70183d4`, `168c16a6` |
| 5. letterSpacing in layout | `d66a273a`, `f9e9402c` |
| 6. Decoration geometry | `75b8a027`, `c4060b4b` |
| 7. DOM overlay round-trip | `33c37a83`, `4df2d41c` |
| 8. SVG round-trip | `828f0ad1`, `9aec4468` |
| 9. Schema groups | `60894de2` |
| 10. ToolOptionsBar | `2c01c84a`, `86f3ba19` |
| 11. Character controls in draw | `7c34b24f`, `a5af2499`, `5ff0493e`, `7221d10d`, `f1bc1e0d` |
| 12. Changeset + docs | `e7d71c9a` |
| Carried: tracking in 2D measurement | `1d728470` |
| Carried: `fill.color` on non-solid fills | `c3d355be` |

Earlier, out of plan: `0226df35` deleted the dead `GlyphLayout`; `685a16e7`
unified the two `MIXED` sentinels (core owns `core/mixed.ts`, `@weasel-js/ui`
re-exports, `MIXED_STYLE` gone).

## What Task 11 turned out to be

The plan scoped it as "build two components and mount a bar." Draw had no
text editing at all — the kit's `textEdit` dep was never overridden there, so
the text tool's edit binding reached `SceneCanvas`'s warn-only stub. Wiring
it surfaced five defects that only a real browser could find, all now fixed
with tests:

1. **The default scene painter ignored `data.runs`** (`5ff0493e`). `kit:text`
   re-flattened `data.text`, so every run-level styling this arc built was
   invisible to anything the default scene layer drew. The data was correct
   at every layer up to the draw call — the exact producer/consumer failure
   the spec-1 handoff warned about.
2. **Clicking the bar committed the edit.** Blur commits, and a toolbar takes
   focus. `isEditorChrome` exempts designated chrome.
3. **The published `selection` cleared when focus left the overlay**, which a
   consumer reads as "collapsed caret" — so a range patch silently went to
   the node instead. It now clears on `startEdit` and teardown only.
4. **Restoring the caret into the overlay from a focused field destroyed the
   text.** Browsers route editing commands by selection, not focus, so the
   Enter that committed a size field also ran `insertParagraph` over the
   restored range. Restore is now skipped for text-entry focus and kept for
   button focus (the bold-then-italic flow).
5. **Nothing could end an edit** once focus was in chrome — the overlay can't
   blur. A pointerdown outside both now commits.

Plus: the text tool now enters edit on the box it inserts, because an empty
text box paints nothing and its own click-to-edit binding had nothing to
click.

Two things the plan asked for that were resolved differently:

- **`fontWeight` 100–900.** The bar has no weight control at all — a run's
  weight is the boolean `bold`. The trap the plan flagged applies to the
  sidebar's numeric leaf, which is left numeric on purpose (it is the model's
  true type); `nodeStyle.ts` documents the `>= 600` bucket where the two
  vocabularies meet.
- **Mixed presentation.** `SelectionPanel`'s idiom for a boolean is a
  reduced-opacity `Switch` with a `title`, because `Switch` has no
  indeterminate state. A toggle *button* does, so `ToggleBar` gained
  `mixedValues` → `aria-pressed="mixed"` rather than copying the workaround.

## Open — needs a decision before this branch merges

**Visual baselines.** `apps/site/demos/textDemoScene.ts` gains a `t6` node
carrying run-level underline, strikethrough, and tracking — the first scene
that pins the derived decoration constants (`0.10` / `-0.30` / `0.05` em) by
pixels. The `text` baseline therefore moves, and accepting it freezes those
three numbers. They are guesses, not font metrics: the BmFont atlas doesn't
carry `underlinePosition` / `underlineThickness`. Look at the render before
accepting — this is the cheap moment to change them.

## Traps for whoever runs the gate

- **The plan's Task 13 gate command is incomplete.** `npm run build` does not
  build `@weasel-js/labkit`, but `check:manifests` validates it. CI has a
  separate `npm run build -w @weasel-js/labkit` step between them (see
  `.github/workflows/ci.yml`); run that or the manifest check fails on a
  fresh worktree. It passes in the main checkout only because a stale `dist`
  is on disk there.
- **Run the full `npm test`, not `test:kit` + `test:ui`.** A regression from
  `60894de2` sat undetected through a full code review because nobody ran
  `test:draw`.

## Contracts established during the arc — do not silently reverse

1. **Run-level flags are additive over the node `TextStyle`; a run cannot
   un-set one.** Setting a flag to `false` deletes the key; resolution is
   `run.flag || style.flag`, never `??`. The character bar's toggle therefore
   visibly refuses to un-bold a range inside a bold node. Both ways out are
   model changes — see `docs/TODO.md` §Text.
2. **`letterSpacing` is world units**, applied after every glyph including the
   last (CSS), per code point rather than per grapheme cluster.
   `ResolvedRun.letterSpacing` is required, not optional.
3. **`letter-spacing` is not part of the CSS `font` shorthand.** Every
   `ctx.font = fontString(style)` / `el.style.font = …` site needs its own
   assignment. `measuredWidth` now owns the 2D-side formula so the wrap, the
   caret, and `fitTextPose` can't drift from `layoutRuns`.
4. **Decoration is its own channel** (`LaidOutRuns.decorations`), drawn by a
   separate `pathFill` pass. It cannot ride in `LaidOutGroup.quads` (textured
   MSDF, 5-float stride). `groupKey` deliberately excludes decoration.
5. **The SVG format is exactly as expressive as the runs model** — recorded in
   `packages/svg/README.md` along with the deliberate
   decoration-is-inherited difference from real CSS.
6. **The edit overlay carries the view scale** (`TextEditScreenPose.zoom`) and
   keeps every metric in world units. This is the only arrangement in which
   run-level `fontSize` / `letterSpacing` are right at zoom ≠ 1, because
   `runsToDom` / `domToRuns` are a world-unit round trip.
7. **A text node's color is a `paint` leaf, not a `color` leaf pointed into
   the union.** `TextStyle.fill` is tagged; the old path read `undefined` off
   a gradient and wrote a hybrid the renderer painted flat solid.

## Closed since the last handoff

- The `commit()` text-derivation divergence is resolved: the rich path now
  trims the caret-holder newline exactly as the plain path always did, so one
  edit doesn't commit a byte more text for having been styled.
- The `transform: scale(zoom)` overlay follow-up is implemented, not deferred.
