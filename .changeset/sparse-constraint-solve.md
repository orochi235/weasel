---
'@weasel-js/geom': patch
---

The path constraint solve is sparse. Each constraint's derivatives are analytic rather than central differences, and each step solves the damped normal equations by a Cholesky factorization kept inside the envelope of a reverse Cuthill-McKee ordering, rather than by dense elimination of an `m × m` matrix built from a full `m × 2n` Jacobian. A chain of constraints along a path now costs time close to linear in its length: a drag frame on a 200-anchor staircase went from about a second to a few milliseconds. Results are unchanged.
