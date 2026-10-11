---
'@weasel-js/core': patch
---

The camera and the vertex color helpers run on animation targets, so another animation on the same view or the same node's colors adds to them.

**Camera.** `useViewAnimation` and `useViewAnimationOn` return a new `viewTarget`, the view as a `Target<View>`. Run a shake or a nudge on it with the animator the hook was given, without the hook's cancel key, and it adds to a camera animation in flight. `stop()` and an outside write to the view cancel the hook's own animation and leave that one running; after an outside write it carries on from where the writer put the view. `viewAxes` is exported for building a view target of your own. `animate`, `animateToBounds`, `stop`, `target`, and `isAnimating` behave as before, and the channel still reads the live view mid-flight. A `<SceneCanvas>` keeps its camera animator private, so its `animateView` gains nothing new here.

**Colors.** `animator.colorOverrides.target(id, channel, length)` is the target for one node's colors on one channel; every caller gets the same one. `release(id, channel)` drops the colors a finished or canceled animation left painted. `tweenVertexColors`, `springVertexColors`, and `staggerVertexColors` move that target. What a consumer would notice:

- Breaking: a second `tweenVertexColors` or `staggerVertexColors` on a node and channel no longer cancels the first. Both run and add, which can paint colors outside 0..1 while they overlap.
- Breaking: `springVertexColors` springs each number on its own and drops its `interpolation` and `interpolate` options. An underdamped spring now overshoots `to` where it was clamped before. It still interrupts what is running, and now starts at the velocity of what it interrupts.
- A color animation over an override stored with `colorOverrides.set` (a `cycleVertexColors`, or your own array or function) adds what it has left to travel on top of the override and no longer replaces it. When it finishes, the override is still there.
- `colorOverrides.get` answers the colors a target is painting where `set` stored nothing, so reading mid-animation works as before. Nothing is stored with `set` by these helpers any more.
- As before, the painted colors are dropped when the animation finishes, and a canceled one holds its colors until `colorOverrides.clear`.

Animations on a target take `interrupt: false` to join their `cancelKey` without canceling whoever holds it, so one key can group animations that add.
