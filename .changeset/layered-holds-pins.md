---
'@weasel-js/diagram': patch
---

`layered` builds the layout around every pinned node, not only the first. Each pin after the first
keeps its place across its rank, with the rest of the rank pushed clear of it, and the gap on the
first pin's side of its rank stretches or shrinks to reach it, so a long edge no longer runs through
a second pin and a re-run moves nothing. A pin it cannot reach — one that would shrink a gap below a
quarter of `rankGap`, or that has too little room beside another pin in its rank — is laid out
around as before and named in the new `LayeredPlan.unheld`.
