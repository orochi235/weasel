# Review saturation for `labkit.state`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 29 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Open and close lifetimes across React render and commit | 1 | 1 | 0 |
| 2 | Stored view validation and projection constraints | 1 | 2 | 0 |
| 3 | Snapshot hydration, config migration, and unreadable records | 0 | 2 | 1 |
| 4 | Remote cache binding, persistence writes, and ordering | 0 | 2 | 2 |
| 5 | Trial restart signaling, undo ownership, and undocked panels | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An abandoned render can leave an opened store subscribed

[useOpenOnce.ts](packages/labkit/src/state/useOpenOnce.ts#L32) · Pass 1 · medium · Source-traced

The hook calls open during render, while all cleanup is registered in a passive effect. If a render suspends and is discarded before committing, no effect runs for that entry. An asynchronous open can still complete and bind its record cache and storage listeners, with no component left to close them.

### 2. Stored orbit views accept a degenerate clipping range

[view.ts](packages/labkit/src/state/view.ts#L60) · Pass 2 · medium · Source-traced

as3DView treats the lens fields as usable when each is positive and finite independently. Saved near and far values that are equal are accepted unchanged, even though the perspective matrix divides by their difference. Reopening such a view can leave rendering and picking unusable, despite the normalization contract for unusable lens fields.

Source and tests were left untouched.
