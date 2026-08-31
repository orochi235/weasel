---
'@weasel-js/core': patch
---

Flip negates rotation; alignment guides and `gaps` distribute measure ink

Three paths read a pose's stored, unrotated box where the rotated extent was
wanted.

`flipPoseAboutBounds` carried rotation through untouched, so a mirrored shape
came back turned the same way — invisible on a rectangle, whose AABB is
symmetric under a sign flip, and plainly wrong on an asymmetric one, which
translated instead of mirroring. It now negates the pose's rotation.

`deriveAlignmentGuides` advertised a stationary rotated sibling's lines at its
stored edges, while the dragged selection matched against them by its ink.
`RECT_ALIGN_PROJECTION.boundsOf` now returns the rotated AABB and
`deriveAlignmentGuides` reads its targets through the same projection — a new
`projection` option defaulting to the rect one, so existing callers get the fix
without a change.

`useDistribute`'s `gaps` mode divided the leftover span by stored widths, so a
rotated member ended up with a gap short by the difference; `centers` shared the
line and the blind spot. Both now measure with `visualBoundsViaDescriptor`.
`distributeHorizontalAction` / `distributeVerticalAction` also take
`params.mode`, so `gaps` is reachable from a binding rather than only from the
hook.

Flip and distribute return different poses than before for rotated shapes.
That is the fix, but it is a behavior change for anything depending on the
old output.
