---
'@weasel-js/geom': patch
---

A hard puppet warp no longer folds the outline back on itself. The as-rigid-as-possible solve now
runs five local/global rounds after its two linear steps, and when those leave any triangle turned
over, an injective pass rights them with the pins held exactly, so `warpPath` no longer refits a
backward stretch as a loop or a spike. Every puppet-warped shape redraws a little differently.

`ArapSolver.solve` takes options: `iterations` caps the local/global rounds (0 gives the two linear
steps alone), `injectiveIterations` caps the injective pass (0 skips it), and `trace` is called with
every vertex's position after each stage. New exports: `ArapSolveOptions`, `ArapStep`, `ArapStage`,
`ARAP_ROUNDS`, and `ARAP_INJECTIVE_ROUNDS`.
