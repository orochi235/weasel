# geom.constraints: saturation

Repeated blind reviews of the area `geom.constraints` (10 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report geom.constraints` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                          | where                                                               | first | codex | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|------:|------:|----------|
| D1  | A solve can report converged: true with empty unsatisfied when the residual exceeds the caller's tolerance, because the return check uses max(tolerance, 0.001) | packages/geom/src/constraints/solve.ts:275                          |     1 |     1 | medium   |
| D2  | A one-shot skip iterable is consumed while building the system, so the final convergence check sees it exhausted and reports skipped constraints as unsatisfied | packages/geom/src/constraints/solve.ts:267                          |     1 |     1 | medium   |
| D3  | A non-finite (NaN) residual from overflowing coordinate subtraction is accepted by unsatisfiedConstraints, which returns no defects for a violated constraint   | packages/geom/src/constraints/check.ts:105 (unsatisfiedConstraints) |     1 |     1 | low      |
