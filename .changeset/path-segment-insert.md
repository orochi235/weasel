---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Alt+clicking a segment of the path being edited now inserts an anchor where you clicked, and the pen cursor shows while Alt is held over a segment. A straight segment stays straight; a curve is split without changing its shape. The closing edge of a closed path can be split too, the new anchor becomes the selected one, and the click has to land within 8 screen pixels of the path — so the reach no longer changes with zoom. Before this, the split only worked on curves: a straight edge came back as a curve, and the closing edge could not be split at all.

Every anchor edit (drag, nudge, delete, cut, insert) can now be undone. Before, `SceneCanvas` recorded these edits as operations with no inverse, and undoing one threw an error.

Additive: `Action.enabled` gets a second, optional argument — the world point of the click or press being routed. When it returns disabled for that point, the dispatcher tries the next binding, and the hover cursor is not shown there. The hover cursor now also comes from the action a click would run, when the action a drag would run has no cursor. `nearestSegmentT` gets an optional `closed` argument and returns an exact parameter instead of the nearest of 32 samples. `segmentAt` is new. The `SceneCanvas` adapter gains `setData`.
