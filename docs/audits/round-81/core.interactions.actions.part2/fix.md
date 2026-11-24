resolvePreviews lists a previewed node twice when a previewed frame above its parent carries it (A+B): fixed 811bbf5fb1
withPath's cache ignores the node's frame, so it returns a stale pose after the parent moves (A): fixed 6ac5e58de8
A line insert preview on a parallax plane with only one of `a`/`b` leaves that end in plane coordinates (A): fixed 312a48b26a
useActionSet keys registration on action ids, so an action rebuilt under the same id stays stale (B): fixed f40c5819cf
resolveSpatialReference accepts NaN or Infinity coordinates (B): fixed 2d4af6b5fe

Follow-up commits: 685cb539a2 shortens all five changeset titles to under 140 characters. b5b779a8c7 fixes three gate failures from these commits: it builds the action identity cache with `createPart` (check:part-caches), types a test node id (typecheck), and gives the plane extras keys a fixed type (check:proto-index).

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: spatialReference.test.ts pass (4), resolvePreviews.test.ts pass (15), pathCommands/pathNodes.frames.test.ts pass (5), useActionSet.test.tsx pass (5), and editing's planeInput.test.ts pass (26).
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w packages/core` and `-w packages/editing`: not run, because neither package has a lint script ("Missing script: \"lint\"").
- `npm run check:changesets`: OK.
- The tree is clean.

tally: 5 of 5 fixed, 0 extra fixed