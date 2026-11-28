# Review saturation for `registry`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 25 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Inherited registration takeover and reentrant disposal | 1 | 1 | 0 |
| 2 | Equality, key identity and mixed value aggregation | 0 | 1 | 1 |
| 3 | Emitter snapshots, reflected batches and value-store notifications | 0 | 1 | 2 |
| 4 | Identifier allocation, timers, text and export helpers | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Releasing a child registration during handback can leave it stuck

[extensionRegistry.ts](packages/registry/src/extensionRegistry.ts#L116) · Pass 1 · P2 · Source-traced

Register the same value in a parent and child. Release the parent registration so the child takes it over, then re-register it in the parent within the same tick. During the microtask handback, untake removes the child's own copy and synchronously notifies subscribers before relean restores its inherited hold. If a child subscriber calls the child's release in that notification, the release finds neither hold and marks itself done. Handback then restores the hold, which can take ownership again on a later parent removal even though its only release already ran.

Source and tests were left untouched.
