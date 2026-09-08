# Handoff — the diagram plugin

**Branch:** `main`. Everything below is committed and **unpushed**; run
`git log --oneline @{u}..HEAD` to see what has not left the machine.

The work follows `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`,
whose arc list is the plan. That spec is marked up with what landed — read its
"Arcs" section before anything else.

## Where it stands

Arcs 1, 1b, 2, 3, 5 and most of 4 are in. `@weasel-js/diagram` is published at
1.4.3 and has a demo at `#diagram-nodes`
(`apps/site/demos/DiagramNodesDemo.tsx`) where ports are grabbable and dragging
one onto another authors an edge.

## Next: arc 6 — layout

`layout(graph, currentPoses, opts) => Map<NodeId, Pose>`, as one undoable batch
of pose ops. `layered`, `tree` and `force`, the last reusing `useSimulation`
seeded from current positions rather than adding a second integrator. The three
rules that keep re-layout non-destructive — deterministic tiebreaks, within-rank
order seeded from the existing cross-axis order, a `pin` set nothing moves — are
in the spec. **Running layout twice on an unchanged graph produces zero ops, and
that is a test.**

`Graph` — the adjacency index — is rebuilt per layout invocation until
measurement says otherwise.

## Decisions made in conversation that the code does not explain

**Edge labels are deliberately unbuilt, and the reason is a design fork.** A
label is a node with `dependsOn: [edge]` positioned at a parameter along the
routed path — but a derivation is handed its dependencies' nodes and poses, not
their derived *paths*, so a label cannot read the route. Either a derivation
gets its dependencies' resolved geometry too, or the label re-runs the router
from the edge's own trait and the route resolves twice per frame. `docs/TODO.md`
carries this under the derived-geometry follow-ups. Decide before building.

**`dependsOn: 'children'` is deliberately absent from the reverse dependents
index.** Deleting a node deletes everything that names it in `dependsOn`; a
container must *not* be deleted when a child goes, because an emptied group is
still a group. That asymmetry is why a `'children'` container is invalidated by
an ancestor walk instead. Do not "fix" it by registering it.

**`derivePath`/`derivePose` were widened to `{ node, pose }` on purpose,** not
for convenience. `scene.ts` already invalidated dependents on `kit:setData` and
`kit:setLayer`, which only makes sense if a derivation can read a dependency's
data — it could not. The widening made an existing promise true.

**Ports live on the bounds and are cast onto the outline at read time.** The
anchor stays normalized against the bounds because that is what survives a
resize; `rayHit` moves it onto the shape. Do not store outline-relative
anchors.

**Connect declines in two different places on purpose.** Which presses start a
connect is routing, and lives in the binding's `target`. Which ports a live
connect may land on cannot be routing — the dispatcher never re-reads the
affordance under a moving pointer — so it is `canConnect` filtering the
candidate set instead. Neither is an action body inspecting a hit and bailing.

**Retargeting an existing edge was left for arc 6's neighborhood, not skipped.**
It needs a `setDependsOn` op, which `docs/TODO.md` now carries at P2. Authoring
a *new* edge needed none, which is why connect landed without it.

## Traps this work hit

- **A registered layer's hit reports `layer:<RenderLayer.id>`, not the region's
  `hitKind`.** `AffordanceRegion.hitKind` is dropped on that route and the
  region's `initialScratch` arrives as `AffordanceHit.payload`. A binding
  written against a `hitKind` matches nothing.
- **An exclusive claim bars a whole gesture protocol.** `claimedKinds:
  ['pointer']` covers `pointerDown`, `click` and `drag`; binding only `drag`
  leaves the press with nowhere to go and the dispatcher drops it, so the drag
  never starts. `grabPortAction` exists to absorb the other two. The kit warns
  — `exclusive claim by "<layer>" matched no binding` — and the chrome
  otherwise just looks dead.
- **The deps bag is built once, at `start`.** Every later pump event carries
  `deps: {}`, so an action reading a dep in `onEnd` reads nothing and commits
  nothing, silently. Capture deps into the scratch. A unit test that hand-builds
  an end ctx *with* deps will not catch this; only the browser did.
- **Two test fixtures cast `derivePath` to its old signature**, so widening it
  typechecked clean and failed at runtime. Any `as` around a derive callback is
  hiding something.
- **The dts build resolves `@weasel-js/core` against its built `dist`**, not
  source. A new core export needs `npm run build` before a peer package's
  `build` will typecheck against it.
- **`useScene` builds its scene once into a ref**, so editing a demo's `initial`
  nodes and saving leaves the old scene live under HMR. Hard-reload (a
  cache-busting query works) before trusting a before/after in the browser.
- **A test asserting a snapped position is worthless if the cursor sits on the
  port.** "Snapped to the port" and "still following the pointer" are then the
  same coordinate, and the test passes against an implementation with the
  filter deleted. Offset the pointer.

## Verifying

`npm test` is the gate; `npx vitest run --project=weasel-ui packages/diagram`
is the fast loop for this package. The site dev server is `npm run dev:kit`,
which binds `::` — reach it at `http://localhost:5173/weasel/`, not
`127.0.0.1`.

The connect gesture cannot be verified in jsdom: `setPointerCapture` there
records the call and does nothing, so the press protocol it depends on is not
emulated. Drive it in a real browser with synthetic `PointerEvent`s, stubbing
`setPointerCapture` (a synthetic pointer is not "active", so the real one
throws), and read the console — the kit's claim and route-conflict warnings say
precisely what is unwired.
