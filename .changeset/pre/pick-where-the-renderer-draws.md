---
'@weasel-js/core': patch
---

Picking answers for what was painted

Three defects in `<SceneCanvas>`'s hit paths, all one shape — a pick answering
from something other than what the renderer drew.

**Pose overrides were painted through and picked around.** `PoseOverride.pose`
is documented as replacing the document pose *everywhere the render and
hit-test paths read one*, and `sceneAdapter.getPose` honored it. But
`<SceneCanvas>` supplies its own `pickEvery`, which read `node.pose` raw — as
did the bounds resolver feeding selection chrome and the affordance
`ChromeState`, and the marquee/lasso scan. A consumer animating nodes through
overrides painted them at one place and picked them at another. `effectivePose`
is now the single rule and every one of those reads through it.

**A clipped-away child was still clickable.** A container clips its subtree and
the renderer honors it, so a child outside the clip is not painted.
`useSelectTool`'s own walk has rejected those since clipping shipped; the walk
`<SceneCanvas>` installs instead had no clip term at all. The new
`passesAncestorClips` walks the parent chain per surviving candidate, so a flat
render-order scan can apply the same test.

**The marquee's fast-reject used the unrotated pose box.** A 100×20 rect turned
45° puts a corner 32 units above that box; a rubber-band over that corner was
rejected before the rotation-correct silhouette test ran, while a click on the
same pixel selected the shape.
