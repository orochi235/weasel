# Review saturation for `apps.draw.src.modality`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 13 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Mode initialization and exit transitions | 1 | 1 | 0 |
| 2 | History entry identity across a soft mode boundary | 1 | 2 | 0 |
| 3 | Path-edit target selection and mode switching | 0 | 2 | 1 |
| 4 | Scope dimming, entered groups and selection updates | 0 | 2 | 2 |
| 5 | Shortcut routing and mode indicators | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An initial non-normal mode starts without an active machine session

[machine.ts](apps/draw/src/modality/machine.ts#L44) · Pass 1 · Medium · Source-traced

Construct the machine with initial path-edit or a strict mode. The registry reports the requested mode, but active remains false and no journal exists. The corresponding exit, commit or cancel is a no-op, so the initial mode cannot close through its normal controls.

### 2. Soft-mode discard can leave a write coalesced into a pre-mode entry

[machine.ts](apps/draw/src/modality/machine.ts#L60) · Pass 2 · Low · Source-traced

Use per-edit soft-mode history with coalescing enabled. Record an edit, enter the mode, and immediately make a second edit with the same coalescing key. Entry does not seal the preceding group. If the second write merges into the previous entry, discard sees only an entry id below its starting id and leaves the mode write in place.

Source and tests were left untouched.
