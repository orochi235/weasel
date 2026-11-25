# Review saturation for `audio.graph`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 13 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Transport recovery after source startup errors | 1 | 1 | 0 |
| 2 | Outgoing cleanup and throwing lifecycle hooks | 1 | 2 | 0 |
| 3 | Graph edge identity, cycle traversal, and patch validation | 0 | 2 | 1 |
| 4 | Fader timing and source playhead rate integration | 0 | 2 | 2 |
| 5 | Processor bindings, port changes, and tap lifecycle | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A second start cannot retry a source that failed to start

[transport.ts](packages/audio/src/graph/transport.ts#L47) · Pass 1 · Medium · Source-traced

Transport sets playing before startAll and never clears it when an individual source fails. A subsequent start is a no-op, including for the failed source that its wrapper still marks stopped. Retrying requires stopping the entire graph and restarting other sources.

### 2. A throwing stop hook can strand outgoing nodes and skip graph teardown

[wrapper.ts](packages/audio/src/graph/wrapper.ts#L106) · Pass 2 · Medium · Source-traced

Outgoing ownership is removed before calling the custom stop hook, and a throw skips cutting the faders and disposing that def. During graph disposal the same error can exit edits.dispose before output disconnect and waiter settlement, after the graph has already latched torn. Subsequent dispose calls cannot complete that cleanup.

Source and tests were left untouched.
