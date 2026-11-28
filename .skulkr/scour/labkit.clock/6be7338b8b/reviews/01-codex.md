# Review saturation for `labkit.clock`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 15 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Clock snapshots and server render entry points | 1 | 1 | 0 |
| 2 | Held frame replay and loop termination | 1 | 2 | 0 |
| 3 | Transport command state across repeated calls | 1 | 3 | 0 |
| 4 | Shortcut focus routing and transport component wiring | 0 | 3 | 1 |
| 5 | Clock declaration and persistence lifecycle | 0 | 3 | 2 |
| 6 | Frame subscriptions, context precedence, and story setup | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Trial clock hooks omit server snapshots

[useTrialClockSetup.ts](packages/labkit/src/clock/useTrialClockSetup.ts#L71) · Pass 1 · medium · Source-traced

useSeededClock invokes useSyncExternalStore without a server snapshot even when the instrument has no clock. React server rendering throws before that path can return null. Clock lookup and transport hold subscriptions in hooks.ts and useTransportControl.ts have the same omission.

### 2. An infinite held time can hang replay on a looping clock

[runTo.ts](packages/labkit/src/clock/runTo.ts#L14) · Pass 2 · high · Source-traced

HeldClock forwards at into runTo when a clock is non-seekable with a positive fixed step. If at is Infinity, the iteration budget starts at Infinity and decrementing it leaves it there. A looping clock never pauses at a terminal pass or reaches Infinity, so the loop blocks the thread.

### 3. Two toggles on the same control snapshot do not undo one another

[transportControl.ts](packages/labkit/src/clock/transportControl.ts#L86) · Pass 3 · medium · Source-traced

toggle branches on the playing value captured when the control was created. Calling toggle twice before React publishes a fresh control invokes the same play or pause action twice, though the first call synchronously changed clock.rate. This can affect an imperative consumer holding the exported control or two invocations before a rerender.

Source and tests were left untouched.
