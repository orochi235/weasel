# Review saturation for `labkit.lab.part1`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 30 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Lab switcher routing and same-document transitions | 1 | 1 | 0 |
| 2 | Surface and portal lifecycle, lent buffers, and presentation sizing | 0 | 1 | 1 |
| 3 | Lab provider boundaries, command ownership, and chrome composition | 0 | 1 | 2 |
| 4 | Workspace drag handles, zoom controls, and page styling | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Hash navigation can leave the lab switcher marking the previous route

[LabSwitcher.tsx](packages/labkit/src/lab/LabSwitcher.tsx#L112) · Pass 1 · medium · Source-traced

When path is omitted, the switcher reads window.location.hash only during React render. It does not subscribe to location changes. A switcher retained across same-document hash routes can therefore keep the previous current marker after browser Back or Forward, or after a link elsewhere changes the hash, until an unrelated render occurs.

Source and tests were left untouched.
