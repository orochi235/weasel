- Edges at a pin ELK couldn't hold keep ELK's route, label point and ports (A+B): fixed 34b75f86c2. This also covers an edge at a cluster that holds such a pin.
- A failed bundled-elkjs import is cached, so every later layout fails (A+B): fixed 84ea0844eb
- A node and a cluster sharing an id get the same ELK id (B): fixed 935cb1f6cc. I made the strict call: `elkPlan` now rejects any id shared by two participants or clusters, and that also catches two nodes with the same id. Recorded in `docs/unruled.md`.
- An edge label's `offset` is dropped, so ELK leaves room in the wrong place (A): fixed aa230bf102. ELK can't be told which side of the wire a label sits on, so a label with an offset now gets room centered on its wire, wide enough across the ranks for the label on either side. It reserves more space than the label needs.
- README documents `ElkPlan.groups`, but the field is `clusters` (A): fixed 5ec47051ed, which also changes the README's other "group" wording to "cluster".
- A reordering cluster's `ordered` member order never reaches ELK (A): fixed 5ec47051ed, as docs only. The README now lists it as "not taken". I checked elkjs 0.12 directly: per-cluster `forceNodeModelOrder` crashes it while it lays out every level at once (`INCLUDE_CHILDREN`), and `inLayerSuccOf`, `positionChoiceConstraint` and semi-interactive `elk.position` are ignored. The only option that works applies to the whole graph and would reorder clusters that didn't ask for it.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/diagram-elk/src/elkPlan.test.ts`: pass (30/30)
- `npx vitest run --maxWorkers=1 packages/diagram-elk/src/elkPlan.load.test.ts` (new): pass (1/1)
- `npx vitest run --maxWorkers=1 packages/diagram-elk/src/toElk.test.ts` (new): pass (3/3)
- `npx vitest run --maxWorkers=1 packages/diagram-elk/src/elkPlan.cloud.test.ts`: pass (2/2)
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run check:changesets`: "[changesets] OK — 2030 changeset(s)."
- `npm run lint -w @weasel-js/diagram-elk`: not run, because the package has no `lint` script ("Missing script: lint"). `npx eslint packages/diagram-elk/src` passed with no output.

The tree is clean apart from `.skulk/`.