# labkit presentation pass — handoff

Two branches, **committed, neither pushed nor merged**:

| Branch | Worktree | Contents |
|---|---|---|
| `feat/labkit-presentation-pass` | `/Users/mike/src/weasel` | arcs 1 + first half of 2 |
| `feat/labkit-arc2` | `/Users/mike/src/weasel-arc2` | rest of arc 2, branched from the above |

Design: `docs/superpowers/specs/2026-08-24-labkit-presentation-design.md` — read it
first; this file only carries what the spec can't. To see any of this, run a
storybook from the worktree on its own port — `npx storybook dev -p 6011
--no-open` — so it does not collide with the main checkout's on :6010.

## Landed

**Arc 1 complete.** `@weasel-js/ui` exports 43 glyphs plus core's 14 tool glyphs
re-exported through the same barrel. Geometry is generated — edit
`packages/ui/scripts/icons/`, run `npm run gen:icons`, never hand-edit
`src/icons/paths.ts`.

**Arc 2 complete.** Content well, sidebar, compact toolbar, `ZoomControl`,
title-bar drag, `ControlPanel` rebuilt on the property rows, a default lab header
(add-trial + mode toggle), `JobProgress`, a raised trial surface, and every defect
the spec's "Defects to fix in passing" list names.

Gates green on the worktree: `tsc --noEmit`, `eslint`, 2258 labkit + ui tests,
full `build`, and `test:smoke:consumer`.

## Traps

**`theme/base.less` element defaults live in `:where()` on purpose.** Bare
`button` nested under `.lk-root` is specificity (0,1,1) and outranks every
component class. Don't unwrap them. The flip side bit twice: because `:where()`
carries *no* specificity, its `height: var(--wzl-control-h)` still beats any
`@weasel-js/ui` component that sizes its own buttons from padding — it crushed a
16px glyph to 2px, and forced 28px ToggleBar segments into a 17px track. Every ui
component labkit embeds is exposed to this; check button heights when adding one.

**`--wzl-control-h` is overridden to 22px on `.lk-toolbar`.** That is what keeps
the buttons, zoom slider and number field one height.

**Icons get proofed at 240–320px** (`CLAUDE.md`, "Drawing icons").

**`clone` is unresolved.** Mike wants the two squares overlapping with the
connection pinched at a medial plane — his sketch, not the current glyph. Five
attempts missed. Ask for the sketch again; do not iterate from prose.

**The smoke test cannot catch an undeclared dependency by bundling.** It packs
every `@weasel-js` package into the tree, so a bare specifier resolves whether or
not the importer declared it — confirmed by reintroducing the bug and watching
the bundle and typecheck both pass. The manifest audit is the check that works.

## Next

1. **Arc 3.** Density and type-scale pass over `Toolbar`, `Sidebar`, `StatusBar`,
   `FpsMeter`, `ScaleIndicator`, `PropertyPanel`. `PropertyPanel.less` still holds
   ~12 hardcoded `rgba()` values authored against a dark panel; two of them
   rendered as a gray slab on the light theme and are fixed, the rest sit in
   `EffectCard` and the toggle rows.
2. **The undefined areas** — a **tool palette**, the **sidebar** as a real surface,
   and a region for **viewport controls**. Zoom sits in the trial toolbar because
   that is where it landed; the toolbar acts on the trial, pan/zoom/fit act on the
   view of it. `ScaleIndicator` and `FpsMeter` probably follow it there.
3. **The toolbar's leading slot.** Save/snapshot holds it and hasn't earned it.
   Likely capability-driven rather than a fixed control — not a reshuffle.

The title bar (24px for one word) and status bar (25px for "100%") are the two
heaviest pieces of chrome relative to what they carry.
