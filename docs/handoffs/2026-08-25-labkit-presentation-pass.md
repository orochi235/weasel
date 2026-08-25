# labkit presentation pass — handoff

Branch `feat/labkit-presentation-pass`, **committed, not pushed, not merged**.
Design: `docs/superpowers/specs/2026-08-24-labkit-presentation-design.md` — read it
first; this file only carries what the spec can't.

## Landed

**Arc 1 complete.** `@weasel-js/ui` exports 43 glyphs plus core's 14 tool glyphs
re-exported through the same barrel. Geometry is generated — edit
`packages/ui/scripts/icons/`, run `npm run gen:icons`, never hand-edit
`src/icons/paths.ts`.

**Arc 2 partly.** Content well, sidebar, toolbar, zoom control, title-bar drag,
and every defect the spec's "Defects to fix in passing" list names.

Gates green: `tsc --noEmit`, `eslint`, 382 labkit + 2254 labkit/ui tests.

## Traps

**`theme/base.less` element defaults live in `:where()` on purpose.** Bare
`button` nested under `.lk-root` is specificity (0,1,1) and outranks every
component class — it silently defeated `.lk-toolbar-button` entirely, and crushed
a 16px glyph to 2px by way of inherited padding. Don't unwrap them.

**`--wzl-control-h` is overridden to 22px on `.lk-toolbar`.** That is what keeps
the buttons, zoom slider and number field one height. Restyling the button alone
desynchronises them.

**Icons get proofed at 240–320px** (`CLAUDE.md`, "Drawing icons"). Three glyphs
shipped wrong at chrome size and were only caught large.

**`clone` is unresolved.** Mike wants the two squares overlapping and the
connection pinched at a medial plane — his sketch, not the current glyph. Five
attempts missed; ask for the sketch again rather than iterating from prose.

## Next

1. Finish arc 2: no add-trial control or mode toggle exists in the default header
   (`addTrial` / `setMode` are on `LabContext` with no UI), job status is still
   ad-hoc markup in `TrialChrome`, and the trial border is near-invisible against
   the workspace.
2. Define the two areas the spec doesn't yet cover — a **tool palette** and the
   **sidebar** — as real labkit surfaces rather than whatever a lab assembles.
3. Arc 3, the density and type-scale pass.

The title bar (24px for one word) and status bar (25px for "100%") are now the
two heaviest pieces of chrome relative to what they carry.
