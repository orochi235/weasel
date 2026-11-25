# Review saturation for `animator.engine`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 34 files in the [Skulkr partition](docs/audits/partition.json#L42), which was modified in the working tree. The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Handle identity, animator ownership and cancellation | 1 | 1 | 0 |
| 2 | External callbacks, error propagation and host teardown | 1 | 2 | 0 |
| 3 | Clock rates, scheduling, wakes and rewinds | 0 | 2 | 1 |
| 4 | Target offsets, hold and row-folding paths | 0 | 2 | 2 |
| 5 | Tween, physics, decay and compositor handoff boundaries | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| E1 | Sending a foreign handle to cancel can cancel an unrelated animation | [animatorApi.ts](packages/animator/src/engine/animatorApi.ts#L142) | 1 | Medium | Executed |
| E2 | A throwing cancellation callback can bypass the host's frame cancellation | [animatorApi.ts](packages/animator/src/engine/animatorApi.ts#L144) | 2 | Low | Executed |

- **E1.** Start one tween on each of two animators. Both receive ID 1. Call B's `cancel` with A's handle. B's tween is canceled while A's remains active. The handles carry behavior and a numeric ID but this API resolves only the ID in its own table. A stale reference after replacing an animator can therefore cancel unrelated work.
- **E2.** Run a hosted tween whose `onCancel` throws, then call `cancelAll`. The animator is inactive and the exception propagates, but the instrumented host receives no `cancelFrame` call. This leaves an already requested frame outstanding even though the table is empty. The table deliberately completes retirement before rethrowing, but the API's halt is after that call.

The probes bundled production modules in memory. Source and tests were left untouched.
