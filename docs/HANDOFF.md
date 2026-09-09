# Handoff — the diagram plugin

**Branch:** `main`. Everything below is committed and **unpushed**; run
`git log --oneline @{u}..HEAD` to see what has not left the machine.

## Where it stands

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
