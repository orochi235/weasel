---
"@weasel-js/core": patch
---

The default actions now work in a scene where a container's pose is a frame.
Each one read a stored pose as though it were world, which is right only under
the identity composition every consumer ships today; under any other one a
selection inside a rotated container aligned to the wrong edge, orbited the
wrong pivot, and grew along the wrong axis.

`resize`, `rotate`, `flip`, `align`, `distribute` and `clone` now compose the
poses they measure up to world, and rebase every pose they write — preview,
override and committed op alike — into the frame the node stores it in. An
action that reads world and writes world looks right for one gesture and drifts
on the next, so `scenePoseFrame` pairs the two directions and each action's
tests run against a rotated-container fixture where local and world differ.

`align`, `distribute` and `flip` also read through `effectivePose` now, so they
see a gesture's in-flight override instead of the pose underneath it.

`group` and `ungroup` re-express every member across the change of frame, so
neither moves anything on screen. The container takes the world envelope of its
members' ink (`unionAABB`, so a turned member contributes what it covers rather
than the box it was posed in). Its pose is derived from its members only under
an identity composition: anywhere else that derivation reads poses expressed in
the container's own frame to compute that frame, which is circular, so the
container keeps the authored envelope until that has its own answer.

`useAlign` and `useDistribute` take the same seam — an optional `getParent` on
the adapter and an optional `composition` in the options. Both default to the
absolute-pose behavior they have today.
