# Review saturation for `simulation`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 8 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Frame-loop cancellation during integration callbacks | 1 | 1 | 0 |
| 2 | Force replacement and initialization failures | 1 | 2 | 0 |
| 3 | Clock debt, rewind and step changes | 0 | 2 | 1 |
| 4 | Pinning, dimensions and finite integration | 0 | 2 | 2 |
| 5 | Cooling thresholds, restart semantics and exports | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A RAF simulation can reschedule itself after stop inside onTick

[useSteps.ts](packages/simulation/src/useSteps.ts#L34) · Pass 1 · Medium · Source-traced

Calling stop inside onTick cancels any outstanding request. When the callback returns and alpha is still above the settle threshold, step returns true and the RAF callback queues another frame. The clock-backed path checks the running flag between steps, so the same stop works there.

### 2. A failed force replacement can leave uninitialized forces installed

[createSimulation.ts](packages/simulation/src/createSimulation.ts#L137) · Pass 2 · Medium · Source-traced

setForces stores the replacement list before initializing its new members. If an initializer throws, later ticks still invoke the partial replacement, including forces whose initialization never ran. Retrying with the same force objects skips initialization because they are already in the installed list.

Source and tests were left untouched.
