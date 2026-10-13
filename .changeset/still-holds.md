---
'@weasel-js/animator': patch
---

A hold of plain values costs a frame about what a finished tween does. `animator.hold({ target, value, weight })` with neither given as a function used to be read every frame like any other hold; its target is now read again only when the hold is touched, when another hold joins or leaves the target, or when the committed value under it moves. With 10,000 target table rows each under one such hold, a frame took 22.0 ms and takes 0.6 to 3.5; with 1,000, 0.52 ms and now 0.05 to 0.07 (`node tests/perf/target-reads/run.mjs table 10000 held`, plain Node, one run before and three after on a machine busy with other work, which is why the range is wide). A hold whose `value` or `weight` is a function is read every frame as before (`... table 10000 heldfn`), and so is a plain one while it shares its target with one.

One thing changes for a caller: a `value` passed as an array or object and then written in place used to show at the next frame the animator ran. It now shows when `handle.touch()` is called.
