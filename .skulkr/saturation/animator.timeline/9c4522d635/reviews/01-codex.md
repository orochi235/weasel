# Review saturation for `animator.timeline`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 17 files in the [Skulkr partition](docs/audits/partition.json#L81), which was modified in the working tree. The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Loop policy, laps and playhead advancement | 1 | 1 | 0 |
| 2 | Seeks, overflow and clock limits | 1 | 2 | 0 |
| 3 | Event cursor, booking and cancellation | 0 | 2 | 1 |
| 4 | Sampled tracks, key boundaries and target holds | 0 | 2 | 2 |
| 5 | Clip validation, nested timing and replay | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| L1 | A fractional or NaN loop count can corrupt playhead lap accounting | [playhead.ts](packages/animator/src/timeline/playhead.ts#L8) | 1 | Low | Executed |
| L2 | A finite time advance can permanently erase an endless timeline's loop budget | [playhead.ts](packages/animator/src/timeline/playhead.ts#L83) | 2 | Low | Executed |

- **L1.** Create a 100 ms playhead with 1.5 passes, then advance it to 100 ms. It reports crossing half a lap, jumps to time 50, and exposes lap ID 0.5. A NaN policy also survives assignment and produces a NaN lap count in `landing(101, 100, NaN)`. These numeric values enter the public loop setting without validating that the setting is a valid pass count.
- **L2.** Advance an endless playhead with duration `1e-9` to finite time `1e308`. The quotient overflows, so the wrap takes infinitely many laps. The remainder logic recovers a finite local time, but the loop counter performs `Infinity - Infinity` and reads as NaN thereafter. The next wrap has no valid lap budget despite the timeline being configured as endless.

The probes bundled production modules in memory. Source and tests were left untouched.
