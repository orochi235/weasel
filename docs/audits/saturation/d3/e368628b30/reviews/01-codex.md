# Review saturation for `d3`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 14 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Transition scheduling when user-supplied mappers throw | 1 | 1 | 0 |
| 2 | Reentrant interruption from transition start | 1 | 2 | 0 |
| 3 | Selection identity across removal and ID reuse | 1 | 3 | 0 |
| 4 | Join planning, key validation, and scene batch ordering | 0 | 3 | 1 |
| 5 | Chained item completion and pending removal ownership | 0 | 3 | 2 |
| 6 | Tween replacement, cancel-key construction, and timer ranges | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A throwing pose or delay callback leaves the transition permanently pending

[transition.ts](packages/d3/src/transition.ts#L232) · Pass 1 · Medium · Source-traced

During end(), schedule sets scheduled before running item callbacks. If a pose callback throws for an item, its jobs never launch and later items are skipped. The first end() throws synchronously. A second end() skips scheduling and returns a promise that cannot resolve without an explicit interrupt.

### 2. A start listener can interrupt a transition and still let its tween launch

[transitionRuns.ts](packages/d3/src/transitionRuns.ts#L51) · Pass 2 · Medium · Source-traced

Have an on('start') listener call interrupt() on its own transition. The listener runs from prepare(), after spawn checked canceled and before it registered handles. Once the listener has resolved end() and torn down the tracked items, spawn still starts the tween. That tween can write to a live node and can interrupt a competing transition.

### 3. An old selection can interrupt a replacement node's transition

[selection.ts](packages/d3/src/selection.ts#L64) · Pass 3 · Low · Source-traced

Keep a selection, remove its node, add a replacement under the same ID, and start a named transition on the replacement. Calling interrupt(name) on the old selection cancels the replacement's transition because it only uses the ID. Starting a transition on the same stale selection uses the recorded incarnation and correctly leaves the replacement alone.

Source and tests were left untouched.
