# Review saturation for `labkit.lab.part2`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 30 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Presentation clock readiness and host state notifications | 1 | 1 | 0 |
| 2 | Stored opening, snapshot holds, and still rendering lifecycle | 0 | 1 | 1 |
| 3 | Workspace layout persistence and panel host bookkeeping | 0 | 1 | 2 |
| 4 | Key claims, focus ownership, ambient entries, and menus | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Presentation can announce that a function-declared clock is absent before it registers

[presentation.tsx](packages/labkit/src/lab/presentation.tsx#L124) · Pass 1 · medium · Source-traced

The presentation readiness check considers every function-valued clock declaration unclocked, even when the current config makes it return a clock. If presentation messaging attaches before that clock is registered, it immediately posts clock:false and ignores clock commands until registration. The message hook explicitly waits for registration for equivalent static declarations so the first state can be used to send a command.

Source and tests were left untouched.
