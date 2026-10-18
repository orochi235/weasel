---
'@weasel-js/geom': patch
---

`puppetSolve(source, pins, opts?)` in `@weasel-js/geom/warp` returns the mesh `puppetMap` deforms for a pin set and where its vertices land, solved with `createArapSolver`'s options: pass `trace` to see every stage of the solve, or the round caps to bound it. `puppetMap` places points by the same solve, so with the default options the two agree. It is additive.
