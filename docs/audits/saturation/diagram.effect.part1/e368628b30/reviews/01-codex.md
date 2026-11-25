# Review saturation for `diagram.effect.part1`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 31 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Live graph edits after a parameter write throws | 1 | 1 | 0 |
| 2 | Playback state after partially successful graph startup | 1 | 2 | 0 |
| 3 | Plan and graph reconciliation across definition changes | 0 | 2 | 1 |
| 4 | Pipeline validation, grouping, and chain reordering | 0 | 2 | 2 |
| 5 | Editor selection, drawing, image evaluation, and preview cleanup | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Recovering from one failed parameter update applies successful updates twice

[liveRunner.ts](packages/diagram/src/effect/audio/liveRunner.ts#L68) · Pass 1 · Medium · Source-traced

In one update, change two live parameters on a custom stage and have one setter throw. The graph applies the other setter and then rethrows. applySets retries both individually, so the successful setter runs twice. A setter that schedules automation or records a side effect sees two calls for one edit.

### 2. A failed source start can leave audio playing while the runner shows paused

[liveRunner.ts](packages/diagram/src/effect/audio/liveRunner.ts#L255) · Pass 2 · Medium · Source-traced

Play a graph with two sources, one of which throws from start. The audio graph tries both sources and starts the healthy one before throwing the first error. The runner only publishes playing=true after start returns, so its state remains paused while the healthy source sounds and the preview loop stays off.

Source and tests were left untouched.
