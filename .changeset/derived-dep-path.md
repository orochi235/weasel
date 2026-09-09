---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

Hand a derivation its dependencies' paths, and label an edge with one.

`DerivedDep` is now `{ node, pose, path }`. The path resolves on first read and
memoizes, so a route costs the same whether one node reads it or five, and a
dependency nobody asks about costs nothing. `resolveDerivedPath` moves beside
`derivedPose` in `core/scene` — a pose can now derive from a dependency's path —
and picks up the cycle guard the pose side already had.

`pointAlongPath(path, t)` is the new geometry primitive underneath: where a path
is at a fraction of its length, and which way it heads there, measured along the
flattened arc.

In `@weasel-js/diagram`, an edge label is an ordinary leaf node with
`dependsOn: [edge]` and `LABEL_DERIVE_POSE`. Its trait says where it sits —
`at: 'start' | 'mid' | 'end'` or a fraction, plus an `offset` perpendicular to
the route — and it reads the edge's resolved path rather than routing again, so
a label and its arrowhead can never disagree about where the edge went.
