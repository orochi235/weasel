---
'@weasel-js/core': patch
---

A node that derives from a skinned path follows it as it bends. `DerivedDep.path` now answers the path a pose override shows the dependency by, ahead of one the dependency derives, so a `derivePose` or `derivePath` reading `deps[0].path` gets a skinned path as its rig bends it where it used to get `null`. A derivation is run again when that path is replaced, even inside the same bounds. The document reading (`documentPose`) and a lookup through a scene slot's `toPose` still answer the derived path alone.

Changes behavior: a derivation that took a non-null `path` to mean "this dependency derives one" now also sees one on any node a pose override gives a `path`.
