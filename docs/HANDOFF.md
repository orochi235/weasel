# Handoff — the diagram plugin

**Branch:** `main`. Everything below is committed and **unpushed**; run
`git log --oneline @{u}..HEAD` to see what has not left the machine.

The work follows `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`,
whose arc list is the plan. That spec is marked up with what landed — read its
"Arcs" section before anything else.

## Where it stands

Every arc is in except edge labels. `@weasel-js/diagram` is published at 1.4.3
and has three demos — `#diagram-nodes` (bodies and ports), `#diagram-edges`
(derived paths and the three routers) and `#diagram-layout` — sharing
`apps/site/demos/diagram/shared.ts`.

## Next: edge labels

The last piece of arc 4, and the one open design fork — see below. Nothing else
in the spec is outstanding.

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

**Retargeting an existing edge is still unbuilt.** It needs a `setDependsOn`
op, which `docs/TODO.md` carries at P2. Authoring a *new* edge needed none,
which is why connect landed without it, and layout never touches `dependsOn` at
all — so arc 6 went by without closing it either.

## Traps this work hit

Arc 7's, first:

- **A demo that cannot show the feature it is about is a kit defect, not a demo
  problem.** `bodyTrait` put a row port at `u: 0` and the `w` compass port at
  `u: 0, v: 0.5`, so a ports row near the vertical middle stacked them — the
  later region won the hit and the other was grabbable nowhere. The demo showed
  four ports where six were declared, and looked correct. A row port on a side
  now takes that side's compass default with it.

Arc 6's:

- **`Scene.setPose` does not cascade to children.** Poses are absolute, so
  moving a container leaves its subtree where it was — a built body walks out
  from under its own label rows with every test green. `applyLayout` translates
  the subtree itself; `sceneToAdapter` has the same walk behind
  `cascadeContainerPose`, and it is not exported.
- **Idempotence and anchoring are different properties, and an idempotence test
  catches only one.** A layout that dumps everything at the origin is perfectly
  idempotent — the second run reads what the first wrote and agrees with it.
  Deleting the anchor left all 20 layout tests green until one asserted the
  result's bounding box still starts where the graph's did.
- **A charge force treats a node as a point,** so two wide boxes a comfortable
  center-to-center distance apart still cover each other. `separateBoxes` is a
  second force working on the box, and it is deliberately not alpha-scaled — an
  overlap at the end of the run is exactly as wrong as one at the start.
- **Declaring `force` as `LayoutFn` hid `ForceOptions` from every caller.**
  `ForceOptions` only widens `LayoutOptions`, so the annotation typechecked and
  silently made `linkDistance` an excess property at every call site. It carries
  its own signature and a `satisfies LayoutFn` instead.

And arc 5's:

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
