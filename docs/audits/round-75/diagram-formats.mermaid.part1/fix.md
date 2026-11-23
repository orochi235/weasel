Architecture reader hangs on a group loop that does not pass through the group being checked (A+B): fixed c4ffe9e8c6

C4 and architecture writers drop an edge's dash without a warning (A): fixed 0baadfce85. `dash` joins the shared edge-warning list; the class and ER writers keep it, since their dotted lines hold a dash.

Block writer drops or clamps link widths other than 3 without a warning (A): fixed db072d550e

Class reader gives a namespace and a class the same id when they share a name (B): fixed f4f017fd5f. This was a strict call: the reader now throws, naming the line, and it is recorded in `docs/unruled.md`. Renaming the container the way the flowchart reader does would not read back, because the class writer names a namespace by its id.

One more commit, 611ec18d54, shortens two of these changeset titles that were over the 140-character limit. It is a follow-up on my own changesets, not an extra defect.

Checks:
- `npx vitest run --maxWorkers=1`:
  - architecture.test.ts pass (20)
  - c4.test.ts pass (28)
  - block.test.ts pass (26)
  - class.test.ts pass (27)
  - er.test.ts pass (15)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass ("OK — 792 changeset(s), 10 with warnings"; none of the warnings are from these changesets)
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script. The gate's root `npm run lint` passed.

tally: 4 of 4 fixed, 0 extra fixed