# Handoff — the draw-coalescing arc is finished

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
