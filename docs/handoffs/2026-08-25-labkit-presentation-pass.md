# labkit presentation pass — handoff

Arcs 1 and 2 are **merged to main** (`f77b877b`), unpushed. Arc 3 is specified and
planned, not started, on `feat/labkit-arc3` (worktree `/Users/mike/src/weasel-arc3`).

| Arc | What | Where |
|---|---|---|
| 1 — icon set | done | main |
| 2 — default chrome | done | main |
| 3 — chrome regions | spec + plan written | `feat/labkit-arc3` |
| 4 — visual language | not started | — |

Read in this order: `docs/superpowers/specs/2026-08-24-labkit-presentation-design.md`
(the four arcs), then `2026-08-25-labkit-chrome-regions-design.md` (arc 3's design),
then `docs/superpowers/plans/2026-08-25-labkit-chrome-regions.md` (eleven tasks).
This file carries only what those can't.

To see any of it, run a storybook from the worktree on its own port — `npx storybook
dev -p 6012 --no-open` — so it does not collide with the main checkout's on :6010.

## What arc 3 is

Not what this handoff previously said. Arc 3 was going to be the density pass; the
density pass is now **arc 4**, and arc 3 is the structural work underneath it —
restyling chrome before the regions settle means restyling it twice.

The finding that reshaped it: labkit has **three** half-built mechanisms for routing
a declaration to chrome and no single one. `detectCapabilities()` is exported,
unit-tested and never called. The `toolbar`/`sidebar`/`statusBar` props on
`TrialChromeProps` are exported but `Trial` never passes them, so a consumer of
`<Lab>` cannot replace any chrome region today. `sidebarExtras` is the live one, and
it appends rather than lays out. Arc 3 replaces all three with one region model and
deletes the other two.

Decisions made in conversation that the spec states but does not argue:

- **Contributions are declarative data**, with `render` as an escape that shows in
  the declaration. Chosen so the chrome owns presentation and arc 4 has one place to
  change.
- **A duplicate id throws**, following core's `mergeContributions`. Suppressing a
  built-in is therefore an explicit `suppress={['id']}`, not a same-id shadow. An
  unknown id in `suppress` throws too.
- **The tool slot exists at both levels.** A trial has an optional one and usually
  falls back to the lab's. Which slot a trial uses follows from where its tools were
  *declared* — not from a runtime detach.
- **`dragDrop`'s palette is a sidebar section, not the palette region.** It is a
  source list you drag from; the palette region is a tool strip you select in.

## Traps

**`theme/base.less` element defaults live in `:where()` on purpose.** Bare `button`
nested under `.lk-root` is specificity (0,1,1) and outranks every component class.
Don't unwrap them. The flip side bit twice: because `:where()` carries *no*
specificity, its `height: var(--wzl-control-h)` still beats any `@weasel-js/ui`
component that sizes its own buttons from padding — it crushed a 16px glyph to 2px,
and forced 28px ToggleBar segments into a 17px track. **Arc 3's palette region embeds
`ToolButton` and will hit this**; the plan unsets the height for that region.

**`--wzl-control-h` is overridden to 22px on `.lk-toolbar`.** That is what keeps the
buttons, zoom slider and number field one height. The viewport region deliberately
does *not* override it — those controls are not in the 22px bar.

**Icons get proofed at 240–320px** (`CLAUDE.md`, "Drawing icons").

**`clone` is unresolved.** Mike wants the two squares overlapping with the connection
pinched at a medial plane — his sketch, not the current glyph. Five attempts missed.
Ask for the sketch again; do not iterate from prose.

**The smoke test cannot catch an undeclared dependency by bundling.** It packs every
`@weasel-js` package into the tree, so a bare specifier resolves whether or not the
importer declared it — confirmed by reintroducing the bug and watching the bundle and
typecheck both pass. The manifest audit is the check that works.

**`core`'s `ToolsApi` is not reusable in labkit**, and `@weasel-js/ui`'s `ToolPalette`
takes one. It carries hotkey slots, ambient tools, eligibility tiers and
`getActiveOverlays(): RenderLayer[]`, all bound to the gesture dispatcher — requiring
an instrument to supply one would require it to be a weasel scene. `ToolGroup` and
`ToolButton` are controlled and carry no such dependency, which is why the palette
region uses those two directly.

**The main checkout is shared with a concurrent session.** Never `git add -A` there;
stage explicit paths and check `git status` before assuming the tree is yours.

## Next

Execute the arc 3 plan. Then arc 4, whose inventory is already taken: 128 `font-size`
declarations across labkit and `@weasel-js/ui` with 13% tokenized, 15 distinct sizes
between 9px and 18px, six radii for one card family, three conventions for monospace,
and raw `font-weight: 600` against a token set resolving to 300/500/700. The trial
border sits at ~1.53:1 against the workspace and its box-shadow is a *light* shadow on
a near-black field, pointing the wrong way for elevation.

Two open questions arc 3 does not settle: whether the title bar (24px for one word)
and status bar (25px for "100%") keep their height once the regions carry more, and
what `FpsMeter` and `ScaleIndicator` become now that a viewport region exists to hold
them — both are view-scoped readouts and neither is contributed yet.
