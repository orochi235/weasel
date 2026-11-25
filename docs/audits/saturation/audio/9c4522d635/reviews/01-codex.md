# Review saturation for `audio`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 47 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Sound cache lifetime and in-flight loads | 1 | 1 | 0 |
| 2 | Scheduler callback isolation and timer rearming | 1 | 2 | 0 |
| 3 | Initial suspension and queued voice admission | 1 | 3 | 0 |
| 4 | Stream handoff, listeners, and voice teardown | 0 | 3 | 1 |
| 5 | Pattern rescheduling, score progression, and insert routing | 0 | 3 | 2 |
| 6 | Patch validation, synthesis math, and worklet dispatch boundaries | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An in-flight decode can repopulate an engine’s cache after disposal

[soundCache.ts](packages/audio/src/soundCache.ts#L62) · Pass 1 · Medium · Source-traced

An engine exposes the cache methods directly and clears stored sounds on dispose. If a load is still fetching or decoding when dispose clears the maps, its continuation stores the decoded buffer afterward. A caller retaining the disposed engine or its load closure can retain that newly cached buffer.

### 2. A throwing late-event callback shuts down the scheduler

[scheduler.ts](packages/audio/src/scheduler.ts#L95) · Pass 2 · Medium · Source-traced

The late-event hook runs outside the try block for event callbacks. If it throws during a timer pass, the rest of the removed batch is lost and the pass exits before rearming. The scheduler still considers itself running, so calling start again does not restore the timer.

### 3. Initial suspension does not establish the stale floor on first resume

[resumeWatch.ts](packages/audio/src/resumeWatch.ts#L21) · Pass 3 · Medium · Source-traced

An engine created against an already suspended context arms gesture listeners but initializes suspendedSince to false. The first running notification therefore leaves staleFloor at negative infinity. A voice booked for an already elapsed time before the first resume bypasses the backlog check in voices.ts, including on a previously running context that was suspended before engine creation.

Source and tests were left untouched.
