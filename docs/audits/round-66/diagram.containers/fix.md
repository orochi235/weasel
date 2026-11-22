Lane order sorted by start edge instead of by middle, as the layout and theme sort (A+B): fixed eb4c9facd2

`diagramDropParentAt` skips `canReparent` for an insert because the id list is empty (A): fixed f851d79d29

`addLane` names a lane inserted at an index `Lane ${count+1}` (A): not a defect. The "in the order they stack" promise covers only a new pool's first lanes. Renumbering to match the order would rewrite titles users may have edited.

Release refused while any lane of the pool is locked, even one the restack leaves in place (A): fixed 0052084e65

`addLane` drops the pool's lane styles in a scene with no theme (B): fixed e6378159a9. `LaneActionOptions` gets a new `laneStyles` option, so its changeset is minor/api.

`addLane` at an index moves later lanes without checking locks (B): fixed 9035ee9a01. This was a strict call: it returns null and changes nothing, recorded in `docs/unruled.md`.

`diagramDropParentAt` calls `compose` detached from its object (B): not a defect. Core and editing call `compose`/`decompose` detached in dozens of places, so this line follows the engine's contract. I stated that contract on `PoseComposition` in 5354f8507a.

`laneScratchOf` throws on a `null` payload (B): fixed 6a90757195. The fix is in `payloadOf`, which also covers the same slip in the label, port, waypoint, edge-end, and sequence scratch readers.

A pool drawn shorter than its lanes' minimum gets lanes that overflow it (B): not a defect. The pool's `laneStackLayout` arrive grows the pool and recenters its title on insert. I wrote a test for it and it passed without any fix.

Checks:
- containers.scene.test.ts: pass (24)
- canDropInto.test.ts: pass (14)
- containerActions.test.ts: pass (20)
- containerActions.pbt.test.ts: pass (1)
- containerTheme.test.ts: pass (4)
- laneStack.test.ts: pass (9)
- regions.marks.test.ts: pass (5)
- `packages/diagram/src/theme`: pass (14 files, 98 tests)
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run check:changesets`: "OK — 7 changeset(s)"
- `npm run lint -w` for diagram and core: unrun, because neither package has a `lint` script. eslint on every changed file: pass (exit 0).

tally: 6 of 9 fixed, 0 extra fixed