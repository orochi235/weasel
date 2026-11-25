# Review saturation for `apps.forge`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 24 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Axe exception matching across file, story and mode | 1 | 1 | 0 |
| 2 | Animation settling and focus-ring measurement | 1 | 2 | 0 |
| 3 | Story globs, shard coverage and build configuration | 0 | 2 | 1 |
| 4 | Frame theme, fonts and global settings propagation | 0 | 2 | 2 |
| 5 | Smoke checks, devtools decoration and library registration | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An exception for one story can hide new accessibility failures in another

[a11y.suite.tsx](apps/forge/a11y.suite.tsx#L63) · Pass 1 · Low · Source-traced

The Field story file documents an aria-input-field-name exception for WithOutput's slider thumbs. If another story in that file gains a control with the same violation, the sweep also skips it. The suppression keys only on file and rule, even when the exception identifies particular controls.

### 2. The accessibility sweep can wait forever on a zero-rate animation

[a11y.ring.ts](apps/forge/a11y.ring.ts#L17) · Pass 2 · Low · Source-traced

A story can leave a finite document-timeline animation running with playbackRate set to zero. It passes the running, timeline and finite-duration checks, but its current time never advances and its finished promise stays pending. The story times out before axe can inspect it.

Source and tests were left untouched.
