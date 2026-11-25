- snapBackOrDelete deletes nested dragged ids twice (A): fixed 20bbb7ab1f
- Multi-child drop within one layout container treats unplaced members as obstacles at their old poses (A): question (confirmed by a test: dragging the first two of four `slots(rowSlots())` children two slots right lands C, A, D, B instead of C, D, A, B. The cause is that `LayoutStrategy` places one dragged child at a time. Fixing it means a strategy contract that takes the whole drop, and rewriting all six strategies in `@weasel-js/guides` to it, which is too big for this pass. Filed as a P2 TODO entry with its closing condition in 7afd3075ee. TODO 0 → +1 net.)
- Layout refusal drawn twice when reparentOnDrop is on (A): fixed 6c62a22ad9
- Layout release translates the non-layout roots itself, so page drop and reparent-on-drop never run for them (B): fixed 877d1e30e0
- Descendants of an envelope landed in another frame are moved by poses from two different frames (B): not a defect (an envelope's members share their root's frame before and after the drop, so the bounds difference keeps their stored offsets from the root, and they land in the slot rigidly with it. A test of an envelope dropped into a container turned a quarter passes at the frozen tree; it was committed as a guard in 7df84b4247)

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: snapBackOrDelete.test.ts 9 passed; move.canDropIntoRefusal.test.ts 5 passed; move.layoutExitPage.test.ts 5 passed; move.layoutExitPlainRoot.test.ts 1 passed; move.layoutDropEnvelopeTurned.test.ts 1 passed. All 51 files under `packages/editing/src/actions/move` also passed (256 tests).
- `npm run checks:gate`: all 33 passed.
- `npm run lint -w packages/editing`: not runnable, because the package has no `lint` script. Ran `npx eslint` on every changed `.ts` file instead: pass (exit 0). The gate's root `npm run lint` passed.
- Tree clean apart from `.skulkr/`.

tally: 3 of 5 fixed, 0 extra fixed