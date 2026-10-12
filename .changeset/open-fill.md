---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Fixes: a filled path with an open subpath painted and could not be clicked. `tessellate` and `pathSignedArea` closed the subpath, and `pointInPath`, `pathContainsRect`, `pathIntersectsRect`, and the polygon tests ignored it. All of them now ask the path.

Adds API: `PolygonPath.openFill`, `'close'` (a fill closes an open subpath with a straight edge back to its start, as SVG and canvas do) or `'none'` (an open subpath never fills), and `setDefaultOpenFill(rule)` / `defaultOpenFill()` in `@weasel-js/geom` for a path that names neither; the default starts at `'close'`. `fillsOpenSubpaths(path)` is the one answer. Set the default before anything is painted: a mesh already built keeps the rule it was built under.

Changes behavior: the filled-region hit tests now count an open subpath of three or more points as closed, so such a path is picked across the area its ends enclose. A node whose painter reports unfilled ink is still picked on its outline only.

Fixes: `editAnchorSet` returned a path with `fillRule: 'nonzero'` whatever the path it was given said. It, `reversePath`, `splitSubpaths`, the path transforms, the pen's continue and join, and the rig's skinned path now hand back a path with the fields of the one they were given. `anchorsToPath` takes that path as an optional third argument.
