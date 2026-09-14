# Handoff — the theme editor, phase 2 (merged; Task 18 waits on TokenPanel)

**Where it lives:** merged into `main` on 2026-09-14 (`be97b83b`, "Merge branch
'theme-editor'"). Not pushed; `git log --oneline origin/main..main` lists what
has not left the machine. Pushing is Mike's call, never yours. The worktree
`.worktrees/theme-editor` sits on `theme-editor`, fast-forwarded to `main`, and
can be removed. Don't leave `main` checked out in a worktree: the primary
checkout needs it to merge its own branch.

**Other sessions are in this repository**, in the primary checkout
(`/Users/mike/src/weasel`, branch `forge-sidebar-clicks`). Stay in your
worktree, stage explicit paths and commit with a pathspec, and never switch,
merge or rebase their branch.

## What is done

Phase 2 of `docs/superpowers/specs/2026-09-10-theme-engine-and-editor-design.md`
is merged:
`#/theme` saves through a dev-server theme store (hash conflict check; a save
that would break the token build is refused before anything is written), keeps
an unsaved draft across reloads, and has the header, layer rail, a preview in
both modes, Ramps / Scales / Semantics editors, click to inspect, Export (CSS,
definition, DTCG) and New theme. Reviews and headless browser passes along the
way fixed engine edges (`lightBias`, own ramps shadowing inherited pins, token
name characters, three ramp edge cases) and two `@weasel-js/ui` defects
(segmented bar height inside labkit; property rows' names and label clicks).
Each carries a `patch` changeset.

Verified 2026-09-14 at `a2b36ad7`: `npx tsc --noEmit` clean; `npx vitest run
--project=draw apps/theme-editor` 125/125; `npx vitest run --project=weasel-ui
packages/theme packages/ui/src/components/Properties
packages/ui/src/components/ToggleBar` 352/352; `npm run lint`, `check:bumps`
and `check:test-projects` clean. In a headless browser (emulating
`prefers-color-scheme`, since `LabShell` here has no mode buttons): both modes,
a ramp slider and Compare, an inherited ramp staying read-only, Inspect
landing on the clicked button's tokens without moving the preview's slider,
typing a half-finished reference in the rule drawer, all three exports matching
the repo files byte for byte, and a New theme `harbor` saved into
`packages/theme/themes/` with `tokens.css` regenerated (then removed; the
generator put the tree back exactly).

## What is next

1. **The full suite** (`npm test`) has not been run on the merged `main`; it is
   the gate before pushing.
2. **Plan Task 18**, once `forge-sidebar-clicks` reaches `main`: Seeds,
   Components and Pins edit through weasel-ui's `TokenPanel` instead of
   read-only lists. The plan is deleted; `git show
   2e9fa4ee:docs/superpowers/plans/2026-09-14-theme-editor.md` still has it. In
   short: each `layerRows` row becomes a `TokenEntry` (`group` is the name up to
   its first hyphen, as `emitManifest` groups), `onChange(name, value)` becomes
   `setPin`, a `null` value becomes `removePin`, and a seed edits
   `draft.seeds`. `forge-sidebar-clicks` also edits `PaletteLab.tsx`; a dry-run
   merge against it was clean at `6df10ccf`.

## Decisions made in conversation that the code does not explain

**The Seeds, Components and Pins rows use weasel-ui's `TokenPanel`**, which
exists only on `forge-sidebar-clicks`, another session's unmerged branch. Mike
decided 2026-09-14 to wait for it to merge: until then those layers are
read-only lists (plan Task 18). Don't merge that branch into this one.

**Answered 2026-09-14, and already in the spec's phase 1 text:** the chroma
envelope gains `lightBias` (`sin(πt) + lightBias·(1−t) + darkBias·t`, built in
`f9f41e2a`), and a theme's own ramps and scales shadow the pins it inherits, so
a theme extending weasel can show its generated ramps (plan Task 7).

**Open for Mike: should an anchor set a ramp's chroma peak directly?** Today
an anchor sets `peak = anchor C · max / e`, where `e` is the envelope at the
anchor's position, so the envelope passes through the anchor's chroma. With an
anchor on an end step and that end's bias at exactly 0, `e = 0` and phase 1's
guard falls back to `peak = anchor C`; as the bias moves off 0, `e` is tiny and
the peak jumps to gamut-clipped color. A 0.1 floor on `e` was tried and taken
back out (plan Tasks 21, 23): it turned a gray ramp anchored on its darkest step
blue. `peak = anchor C` at every position removes the jump, and changes any
anchor placed away from the envelope's peak. weasel's only anchor is mid-ramp,
so neither choice moves what ships.

**The dev server for this worktree runs on port 5187**, not 5177: the primary
checkout's `dev:theme-editor` owns 5177, and Playwright's visual config also
reuses 5177. `npx vite --config apps/theme-editor/vite.config.ts --port 5187 --strictPort`.

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

Run it with `npm run dev:theme-editor` (port 5177). Tests are in the `draw`
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
which is what keeps the engine in-scope. None of this is built.

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

## Open

**47 `--wzl-*` properties are read in live source and declared by no theme.**
Some are deliberate container-override hooks (`--wzl-prop-*`, `--wzl-field-h`);
the rest is rot from the original May token vocabulary (`--wzl-text`,
`--wzl-panel-bg`, `--wzl-button-fill*`) that `packages/ui` never finished
migrating. Nothing checks for either case.

**`hexToRgba` in `packages/theme` throws on any non-hex value**, so the alpha
extension only works when the token it points at is a hex literal. Point it at
`interstellar`'s `rgba(...)` and it dies. Verified with a probe.

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
npm run dev:theme-editor                           # port 5177, #/palette
```

`npm run check:test-projects` is the one that fails if a new app's tests are
collected by no project.

# Retained from completed work — the draw-coalescing arc

**Branch:** `main`. Everything is committed and unpushed; run
`git log --oneline @{u}..HEAD` to see what has not left the machine.

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
  Kill whatever holds port 5176 first.

---

# Retained from completed work — the diagram plugin

That work is finished and merged. These notes are kept because nothing else
records them; **they belong in `packages/diagram/`, and moving them there is an
open chore.** Do not read the section below as open work.

## Where it stood

The plugin is complete. `@weasel-js/diagram` holds the `DiagramNode` trait,
ports on the outline, the body builder, edges routed by `straight` /
`orthogonal` / `bezier`, edge labels, the connect gesture, and `layered` /
`tree` / `force` layout — each of which can also be run live. Four demos:
`#diagram-nodes`, `#diagram-edges`, `#diagram-layout` and `#diagram-live`,
sharing `apps/site/demos/diagram/shared.ts`.

Nothing in the original spec is outstanding. What is left is in `docs/TODO.md`:
a `setDependsOn` op (retargeting an existing edge), and the derived-geometry
follow-ups under "Scene, adapters & layout".

## Decisions made in conversation that the code does not explain

**`dependsOn: 'children'` is deliberately absent from the reverse dependents
index.** Deleting a node deletes everything that names it in `dependsOn`; a
container must *not* be deleted when a child goes, because an emptied group is
still a group. That asymmetry is why a `'children'` container is invalidated by
an ancestor walk instead. Do not "fix" it by registering it.

**Ports live on the bounds and are cast onto the outline at read time.** The
anchor stays normalized against the bounds because that is what survives a
resize; `rayHit` moves it onto the shape. Do not store outline-relative
anchors.

**Connect declines in two different places on purpose.** Which presses start a
connect is routing, and lives in the binding's `target`. Which ports a live
connect may land on cannot be routing — the dispatcher never re-reads the
affordance under a moving pointer — so it is `canConnect` filtering the
candidate set instead. Neither is an action body inspecting a hit and bailing.

**A live run does not re-anchor, and the one-shot layouts do.** The anchor
translation exists so a single 300-tick jump does not move the diagram off
where the author left it. A live run cannot jump, and re-anchoring per frame
would fight a drag — the anchor is measured from where the nodes were, and a
pinned node is deliberately somewhere else.

**A pose run's frame is the whole picture, not a delta.** An id a producer
omits stops being published. That is what releases a node the moment a gesture
takes it, and it is why the diagram producers drop a pinned participant's whole
subtree from the frame rather than only the participant.

## Traps this work hit

- **A stroke marker on a derived path was dropped by the painter, not by the
  edge.** `kit:derived` emitted its stroke command and returned; `kit:path`
  follows with a `markerDrawCommands` pass and it did not.

- **The `orthogonal` router consulted only the departing end's normal**, so an
  edge between two boxes standing side by side dropped onto a west-facing port
  from above and put its arrowhead across the corner. A leg whose two ends face
  the same axis turns twice now.

- **The innermost hit wins, so a labeled box could not be dragged at all** —
  the press grabbed the label and pulled it out of the box. `pickable: false`
  on content a container owns is the fix; every demo that builds a body needs
  it. Three demos had shipped with the defect and the hints told people to drag.

- **A demo that cannot show the feature it is about is a kit defect, not a demo
  problem.** `bodyTrait` put a row port and the `w` compass port at the same
  point, so the demo showed four ports where six were declared and looked
  correct. A row port on a side now takes that side's compass default with it.

- **`Scene.setPose` does not cascade to children.** Poses are absolute, so
  moving a container leaves its subtree where it was. `applyLayout` and
  `layoutPoses` translate the subtree themselves; `sceneToAdapter` has the same
  walk behind `cascadeContainerPose`, and it is not exported.

- **Idempotence and anchoring are different properties.** A layout that dumps
  everything at the origin is perfectly idempotent. Deleting the anchor left all
  20 layout tests green until one asserted the result's bounding box still
  starts where the graph's did.

- **A charge force treats a node as a point,** so two wide boxes a comfortable
  center-to-center distance apart still cover each other. `separateBoxes` works
  on the box and is deliberately not alpha-scaled.

- **Declaring `force` as `LayoutFn` hid `ForceOptions` from every caller.** It
  carries its own signature and a `satisfies LayoutFn` instead.

- **A registered layer's hit reports `layer:<RenderLayer.id>`**, not the
  region's `hitKind`, and the region's `initialScratch` arrives as
  `AffordanceHit.payload`.

- **An exclusive claim bars a whole gesture protocol.** `claimedKinds:
  ['pointer']` covers `pointerDown`, `click` and `drag`; binding only `drag`
  leaves the press with nowhere to go. `grabPortAction` absorbs the other two.

- **The deps bag is built once, at `start`.** Every later pump event carries
  `deps: {}`, so an action reading a dep in `onEnd` reads nothing and commits
  nothing, silently. Capture deps into the scratch.

- **The dts build resolves `@weasel-js/core` against its built `dist`**, not
  source. A new core export needs `npm run build` before a peer package's
  `build` will typecheck against it.

- **`useScene` builds its scene once into a ref**, so editing a demo's
  `initial` nodes and saving leaves the old scene live under HMR. Hard-reload
  (a cache-busting query works) before trusting a before/after in the browser.

- **A test asserting a snapped position is worthless if the cursor sits on the
  port.** Offset the pointer.

## Verifying

`npm test` is the gate; `npx vitest run --project=weasel-ui packages/diagram`
is the fast loop for this package, and `--project=core` for the seams under it.
The site dev server is `npm run dev:kit`, which binds `::` — reach it at
`http://localhost:5173/weasel/`, not `127.0.0.1`.

Neither the connect gesture nor a live run's pin can be verified in jsdom:
`setPointerCapture` there records the call and does nothing, and nothing drags.
Drive them in a real browser with synthetic `PointerEvent`s, stubbing
`setPointerCapture` (a synthetic pointer is not "active", so the real one
throws), and read the console — the kit's claim and route-conflict warnings say
precisely what is unwired.
