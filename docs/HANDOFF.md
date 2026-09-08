# Handoff — the diagram plugin

**Branch:** `main`. Everything below is committed and **unpushed**; run
`git log --oneline @{u}..HEAD` to see what has not left the machine.

The work follows `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`,
whose arc list is the plan. That spec is marked up with what landed — read its
"Arcs" section before anything else.

## Where it stands

Arcs 1, 1b, 2, 3 and most of 4 are in. `@weasel-js/diagram` exists, is
published at 1.4.3, and has a demo at `#diagram-nodes`
(`apps/site/demos/DiagramNodesDemo.tsx`).

## Next: arc 5 — ports as affordances, and the connect gesture

Ports are painted today and hit-tested nowhere. Arc 5 makes them grabbable:

- The plugin contributes an affordance layer supplying `port` regions, and the
  kit's "visible chrome is always hittable" rule then gives hover and
  hit-testing. `composeAffordanceLayer` builds the layer;
  **`CanvasExtensionApi.registerLayer` is the only attach route that gets
  hit-tested** — a `Contribution.overlay` is painted and never hit. Hits arrive
  stamped `layer:<RenderLayer.id>`, the way `@weasel-js/hud` matches its own.
- Connect is an ordinary binding gated on `affordance.kind === 'port'`,
  dispatching a `diagram.connect` ongoing action. Preview during the drag is an
  ephemeral edge; commit is one op batch.
- **Invalid targets are declined in the binding spec, not in the action body** —
  the repo learned that one the hard way (see the phase-tables memory).

The demo's port-painting render layer should become that affordance layer; it
exists in the demo only because arc 5 had not happened.

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

## Traps this work hit

- **Two test fixtures cast `derivePath` to its old signature**, so widening it
  typechecked clean and failed at runtime. Any `as` around a derive callback is
  hiding something.
- **The dts build resolves `@weasel-js/core` against its built `dist`**, not
  source. A new core export needs `npm run build` before a peer package's
  `build` will typecheck against it.
- **`useScene` builds its scene once into a ref**, so editing a demo's `initial`
  nodes and saving leaves the old scene live under HMR. Hard-reload (a
  cache-busting query works) before trusting a before/after in the browser.

## Verifying

`npm test` is the gate; `npx vitest run --project=weasel-ui packages/diagram`
is the fast loop for this package. The site dev server is `npm run dev:kit`.
