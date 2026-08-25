# labkit presentation pass — handoff

Arcs 1–3 are merged to main, unpushed. Arc 4 — the density, spacing and
type-scale pass — is what remains.

| Arc | What | Where |
|---|---|---|
| 1 — icon set | done | main |
| 2 — default chrome | done | main |
| 3 — chrome regions | done | main |
| 4 — visual language | not started | — |

Read `docs/superpowers/specs/2026-08-24-labkit-presentation-design.md` for the
four arcs, and the arc-4 entry in `docs/TODO.md` for the inventory already taken.
This file carries only what those can't.

`labkit/Chrome/Regions` in storybook renders all five trial regions.

## Traps

**jsdom cannot catch a layout collapse.** Arc 3 wrapped the workspace in a new
`.lk-lab__body` row; `.lk-shell-body` is a block container, so `flex: 1` on that
row resolved to nothing and the workspace's `height: 100%` collapsed to zero.
Every test still passed — 451 in labkit, 7903 in the repo — and the lab rendered
as an empty page. Screenshot anything that changes a container's box.

**`theme/base.less` element defaults live in `:where()` on purpose.** Bare
`button` nested under `.lk-root` is specificity (0,1,1) and outranks every
component class. Don't unwrap them. The flip side bit three times: because
`:where()` carries *no* specificity, its `height: var(--wzl-control-h)` still
beats any `@weasel-js/ui` component that sizes its own buttons from padding — it
crushed a 16px glyph to 2px, forced 28px ToggleBar segments into a 17px track,
and would have done the same to the palette region's `ToolButton`, which unsets
the height for that reason.

**`--wzl-control-h` is overridden to 22px on `.lk-toolbar`.** That is what keeps
the buttons, zoom slider and number field one height. The viewport region
deliberately does *not* override it — those controls are not in the 22px bar.

**Icons get proofed at 240–320px** (`CLAUDE.md`, "Drawing icons").

**`clone` is unresolved.** Mike wants the two squares overlapping with the
connection pinched at a medial plane — his sketch, not the current glyph. Five
attempts missed. Ask for the sketch again; do not iterate from prose.

**The smoke test cannot catch an undeclared dependency by bundling.** It packs
every `@weasel-js` package into the tree, so a bare specifier resolves whether or
not the importer declared it — confirmed by reintroducing the bug and watching
the bundle and typecheck both pass. The manifest audit is the check that works.

**The main checkout is shared with a concurrent session.** Never `git add -A`
there; stage explicit paths and check `git status` before assuming the tree is
yours. The same applies to `git stash`: the stash list is shared across
worktrees, so a `stash`/`pop` pair run on a clean tree pops *someone else's*
entry into yours.

## Left open

Three things arc 3 touched but did not settle, all arc 4's:

- `ZoomControl` — arc 2's editable zoom field — left the default chrome along
  with the toolbar's zoom group. The viewport region holds three icon buttons
  instead. It has no region of its own yet.
- `FpsMeter` and `ScaleIndicator` are view-scoped readouts with a home now (the
  viewport region) but no contribution.
- Whether the title bar (24px for one word) and status bar (25px for "100%")
  keep their height now that the regions carry more.
