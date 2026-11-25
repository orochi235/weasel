# Review saturation for `diagram.effect.part2`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 30 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Effect output cleanup when a custom disposer throws | 1 | 1 | 0 |
| 2 | Fan-in preparation for many-valued inputs | 1 | 2 | 0 |
| 3 | Asynchronous runner queue, abort, and retained previews | 0 | 2 | 1 |
| 4 | Run dependency ordering, symbols, and port presentation | 0 | 2 | 2 |
| 5 | Lane routing, rack layout, and persisted route reuse | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. One throwing disposer prevents later output cleanup and can strand previews

[pass.ts](packages/diagram/src/effect/runner/pass.ts#L141) · Pass 1 · Medium · Source-traced

Run stages that return two owned outputs with custom disposers, and have the first disposer throw. The pass stops cleanup immediately, skipping later outputs and leaving its ownership list uncleared. In runPipeline the error originates in finally after the return was prepared, so the caller receives neither the result nor its previews to close.

### 2. Preparing a many-input copies its growing value list on each wire

[pass.ts](packages/diagram/src/effect/runner/pass.ts#L62) · Pass 2 · Low · Source-traced

Connect a large set of successful stages to one many-valued input. The runner copies the complete list collected so far before adding each new value. Preparing that input does quadratic work and allocation on each run, including played frames.

Source and tests were left untouched.
