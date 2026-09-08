---
'@weasel-js/core': patch
---

`createPoseOverrides` is public.

`Scene` is public and its `overrides: PoseOverrides<TPose>` is mandatory — and
load-bearing, since every ongoing gesture writes a frame to it. The factory that
builds one was internal, so a consumer assembling a scene-like object by hand
had to reimplement the table from its type. It is now exported alongside
`createScene`.
