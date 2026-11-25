snapToContainer pins the first node's slot to where the drag entered the container (A): fixed f3a9bac087

snapBackOrDelete measures the distance on `draggedIds[0]` even when another dragged node carries it, and in stored-frame units (A): fixed 574897f3ec

A layout container with a singular world pose throws on every move (A): fixed e0f215e2ad

The release is judged partly at the release point and partly at the last move's point (A): fixed 9fd1b66130

snapToContainer's undo `from` is the shown mid-glide pose instead of the document pose (A): fixed 2dc2b32bd5

A layout drop reparents across layers with no layer change (B): fixed 29bb959dd4

snapToContainer pins the first node's slot (B): duplicate of A's snapToContainer slot finding, fixed f3a9bac087

A layout drop moves the root's descendants by a translation only (B): not a defect (envelope children are stored in the same frame as their root, so moving them by the root's change in stored pose keeps them rigid with it, turned slot included; a test of an envelope dropped into a container turned a quarter turn, with a nonzero offset, landed the member at the expected stored pose before any change, so no test was added)

A layout child let go off every page with the pasteboard off lands off-page at the top level (B): fixed c7384a6b78

The layout preview places dragged nodes without the snap lead that the commit uses (B): fixed c81c6c5b0f

reparentOnDrop raises a node to the top of its own parent (B): not a defect (there is no `'inside'` mode; `'top'` is documented as landing the node at the top of the container under the cursor, its own parent included)

The drop verdict is asked about nested drag ids, not just the outermost ones (B): fixed 79a6b168f8

Extra fixes, made while fixing the above:
- The page-exit fix also covers a layout child let go outside its container onto empty space on a page. Exits looked only on the node's own layer and pages sit on a lower one, so such a child landed at the top of the tree; it now lands on that page (c7384a6b78).
- The singular-container fix also covers the drop-candidate path and the release path, not just the source container's reflow (e0f215e2ad).

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: snapToContainer.test.ts pass (15), snapBackOrDelete.test.ts pass (8), snapBackOrDelete.path.test.ts pass (2), move.layoutSingular.test.ts pass (1), move.endPointer.test.ts pass (3), move.layoutDropLayer.test.ts pass (2), move.canDropInto.test.ts pass (5), move.layoutExitPage.test.ts pass (3), move.landing.test.ts pass (4).
- Neighboring move tests (move.test, lifecycle, reparentEndCtx, pages, momentum, snapToContainerDwell, layoutDrop*, canDropIntoRefusal, layoutExitEnvelope, layoutThrow, swapOverLayout): pass.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/editing`: not run, because the package has no `lint` script ("Missing script: lint"). In its place, `npx eslint` on every changed `.ts` file passed, and the gate's root `npm run lint` passed.
- Each fix has its own changeset; `check:changesets` is in the gate.
- Working tree clean.

tally: 9 of 12 fixed, 1 extra fixed