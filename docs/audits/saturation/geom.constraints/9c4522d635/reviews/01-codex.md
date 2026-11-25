# Review saturation for `geom.constraints`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the ten files in the area's [Skulkr partition](docs/audits/partition.json#L3518). The partition was modified in the working tree. The passes shared context.

## Yield per review

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Solver result contracts and convergence | 1 | 1 | 0 |
| 2 | Public option handling and retry state | 1 | 2 | 0 |
| 3 | Residual checks and finite arithmetic | 1 | 3 | 0 |
| 4 | Anchor remapping, reversed segments and edit writeback | 0 | 3 | 1 |
| 5 | Conflict-component partitioning and deletion filtering | 0 | 3 | 2 |
| 6 | Jacobian coordinate indexing, sparse solve and bound handling | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

## Distinct defects

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| C1 | A solve can report convergence outside the caller's tolerance | [solve.ts](packages/geom/src/constraints/solve.ts#L275) | 1 | Medium | Executed |
| C2 | A one-shot skip iterable is exhausted before the convergence check | [solve.ts](packages/geom/src/constraints/solve.ts#L267) | 2 | Medium | Executed |
| C3 | A non-finite residual is accepted by the constraint checker | [check.ts](packages/geom/src/constraints/check.ts#L105) | 3 | Low | Executed |

- **C1.** Fix both anchors at `(0,0)` and `(1,0.0005)`, add a horizontal constraint, and solve with `tolerance: 1e-7`. The solver cannot move either point and stops with a residual of 0.0005. It returns `converged: true` and an empty `unsatisfied` array. The return check takes the maximum of the requested tolerance and 0.001. A caller relying on the requested tolerance gets a successful result for an impossible solve.
- **C2.** Give the solver points `(0,0)` and `(1,1)`, one horizontal constraint, and `skip: (function* () { yield 0 })()`. Building the system consumes the generator and correctly skips the horizontal equation. The final check consumes the generator again and returns `converged: false` with `unsatisfied: [0]`. Using the equivalent array `[0]` leaves that constraint out of convergence. A second solve under relaxed held-point mobility can also receive an exhausted iterable.
- **C3.** Check a horizontal constraint joining `(-1e308,0)` to `(1e308,1)` in the default frame. Both points are finite but subtracting their x coordinates overflows. The residual includes `0 * Infinity` and becomes `NaN`. The comparison in `unsatisfiedConstraints` then returns an empty defect list even though the points differ in y by 1. Pre-edit checks can use this false result when deciding which constraints to carry into a solve.

The reproductions bundled the production modules in memory. Source and tests were left untouched.
