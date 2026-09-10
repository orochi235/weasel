# Handoff — text and gradients into the shared batch

**Branch:** `main`. Everything is committed and unpushed; run
`git log --oneline @{u}..HEAD` to see what has not left the machine.

## Where it stands

The renderer's draw-coalescing arc has one piece left in each of two paints.
`docs/TODO.md`'s **"(P2) Per-command draw cost"** entry is the live record of
the whole arc — read it first, not this file, for what has landed.

Solid geometry, image quads and up to seven distinct bitmaps now share one
draw. Text and gradients still take their own program, and so still break a run
at every label and every gradient fill.

**Next: text.** The question of whether it can share the batch program was open
in `docs/superpowers/specs/2026-08-14-batched-dispatch-design.md` and is now
answered there — it branches, it does not stay separate. A merged program must
run the glyph math on every fragment, because `fwidth` inside non-uniform
control flow is undefined and the derivative has to be taken before anything
selects on paint mode. That costs 1.4% of a fragment that is not a glyph,
measured head to head at 432M fragments a frame by
`tests/perf/fill-rate.spec.ts` — an upper bound of the right order, not a
figure: the box was carrying a load average around 8, which is what that run's
45% spread was. The decision needs only that the cost is small. So the cost is not the fragment; it is the
vertex, which grows a paint mode and a bold threshold.

**Then: gradients**, via a ramp atlas — ramps are 1D and atlas into rows of one
texture. Step 4 of the same spec.

## Decisions made in conversation that the code does not explain

**The measurement instrument was the hard part, and its corrections are in
`fill-rate.spec.ts`'s comments because they will be re-derived otherwise.**
`gl.finish()` does not block in Chrome — commands go to the GPU process and the
call returns, which timed 43M fragments at 0.003 ms and read as free; a
one-pixel `readPixels` is the real sync point. Samples must be long enough that
the GPU clock is not still ramping through them. And variants must alternate
ABBA: under ABAB whichever runs second sits later on that ramp every time, which
reads as that variant being faster.

**Do not compare a perf number against one recorded on another day.** The same
unchanged tree measured 1.85 ms where `docs/TODO.md` records 1.50 for the same
rung. Always take the A/B back to back in one sitting, and quote the pair.

**`tests/visual/batch-pixels.spec.ts` exists because no screenshot can see a
batched run's composition** — the atlas quad covers the ground rect it
corrupted. Anything that changes what shares a draw needs a probe on a pixel
the covering command does not cover. This is also in `CLAUDE.md`'s Traps.

**Seven bitmaps, not more, and the white texel owns slot 0.** WebGL2 guarantees
16 fragment texture units, so eight is safe without a `getParameter` — which
the GL recorder would answer with a recording function rather than a number.
Slot 0 is reserved so a solid's `texture() * a_vertexColor` is exactly the
vertex color whatever else joins its run; that is the invariant the tint bug
broke.

**A bitmap wanted at two MAG_FILTERs still breaks the run.** That is state on
the texture object, not on the unit, so no number of slots fixes it.

## Verifying

- `npx vitest run --project=core packages/core/src/renderer/` — the batch's
  buffer-replay tests.
- `npx playwright test --config=tests/visual/playwright.config.ts` — the
  baselines plus `batch-pixels`.
- `npx playwright test --config=tests/perf/playwright.config.ts atlas-wall` —
  the wall ladder. Draw-bound, so it cannot see fragment cost.
- `npx playwright test --config=tests/perf/playwright.config.ts fill-rate` —
  fragment cost, and nothing else.

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
