- Crossings at a graph vertex cost nothing (A): fixed a77dd4bbaf
- Undo/redo leave the router stale (A): fixed 6fadb251fd. The router reseeds after an undo, redo or history jump. Undo inside an open journal and `scene.replay` are not covered, because they don't reach `scene.history.observe`.
- A cancelled drag's previews come back when a later drag runs out of budget (A+B): fixed 20031da685, on top of e781181ee1. Core's `TransformFollower` gets an optional `begin()`, called once when a move, resize or rotate drag starts. The avoid follower uses it to call the new `AvoidRouter.beginPreview()`.
- The follower's `still` shortcut serves the last drag's previews on a new drag's first frame (A+B): fixed 20031da685, since `begin()` also clears `last`.
- The spec router skips self-loops with both ports named (A+B): fixed 21fd556599
- The spec router files no obstacle for a split connector's label (A+B): not a defect. A split edge built from specs keeps router `bezier`, not `avoid`, so `avoidSceneInput` doesn't file its label either; the two readers agree. Its label pose in specs is also a placeholder until the scene derives it.
- The spec router routes through cluster boxes (B): fixed a13685fdb2
- A moved label is matched against routes by `clearance` instead of `labelClearance` (A): fixed aa282f5c29. Fixed in both `dirtyEdges` and `DragIndex.frame`.
- A locked connector's refused route is recorded as held, so it never reroutes after unlock (A): fixed 72144b929d. Adds `AvoidRouter.forget(ids)`. While a connector stays locked, every edit that disturbs it reroutes it again and the write is refused again.
- The routeEdge window loop never ends on a non-finite limit (A+B): fixed a311131ac9. Both halves are fixed: the loop stops once the window overflows, and `limitOf` skips coordinates that aren't finite.
- `nearEdges` indexes past the end of `shapes` (A+B): fixed e15f92c172. Fewer than two shapes now throws.
- The full-route bench reports only the last run's unrouted count (A+B): fixed 17bab9428d
- A pathless connector's fallback line skips its waypoints (B): fixed 1fef4ee48f

Extra defects found while fixing:
- `createAvoidRouter` grew past the 120-line function cap with the new methods: fixed a1228b6fa2 (moved the drag-frame loop into its own function)
- This round's changeset titles were over the 140-character limit: fixed 9cc4322e8e

Checks:
- Touched test files, one at a time with `--maxWorkers=1`: all pass. That is 13 avoid files under `packages/diagram/src/avoid/` (avoidFixture, edgeRoute, segments, router.labelClearance, dirty, avoid.locked, avoid.history, router.preview, avoid.follower, specRoutes, router, avoid.scene, avoid.offPage), the existing avoid tests (search, nudge, router.pbt, router.shrunk, avoid.passOrder, pins, holds), and editing's `transformPreview.published.test.ts`.
- Not run after the last change: `router.model.pbt.test.ts`, which passed before the segments fix.
- Unrun: none (no browser tests touched).
- `npm run checks:gate`: first run 2 of 32 failed (`check:changesets`, `check:size`); after the fixes, "checks:gate: all 32 passed".
- `npm run lint -w` for diagram, core and editing: fail with "Missing script: lint" (none of the three has one). In its place, `npx eslint` on every changed `.ts` file: pass, exit 0.
- Tree clean, nothing in `.skulk/` committed.