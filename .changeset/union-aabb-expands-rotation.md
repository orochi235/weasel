---
'@weasel-js/core': patch
---

Selection chrome, gesture bounds and SVG export fold rotated ink, not pose boxes

Every union a user looks at or clicks folded each member's *unrotated* box.
Select two shapes, rotate one, and the multi-selection frame and its handles
sat inside the rotated shape's ink — affordances hand `ChromeState.unionBounds`
out as the target bounds for paint *and* hit-test, so the handles were both
drawn and grabbable in the wrong place, while `getGestureBounds()` reported the
correct larger box.

`unionAABB` expands each rotated member via `axisAlignedBounds` before folding
and is now the one implementation. It lives in `core/geometry/unionBounds.ts`
beside the rotation-free `unionBounds`, which stays correct for commit-time
actions that write poses back in the unrotated frame; the module says which to
reach for. `unionGestureBounds` is **removed** — it was `unionAABB` under
another name. Both new functions are exported from the package root.

Moved onto it: `ChromeState.unionBounds`, the selection overlay's
container-to-leaves resolver, the multi-rotate pivot (which put the pivot in
the wrong place whenever a member was rotated), and WeaselDraw's export
viewBox, which clipped rotated shapes out of the copied SVG.
