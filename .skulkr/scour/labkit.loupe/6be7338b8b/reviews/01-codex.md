# Review saturation for `labkit.loupe`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Pixel source replacement and canvas clearing | 1 | 1 | 0 |
| 2 | DOM magnification and keyboard focus | 1 | 2 | 0 |
| 3 | Host pointer coordinates and dispatcher ownership | 0 | 2 | 1 |
| 4 | Lens geometry, scene painter, and mode selection | 0 | 2 | 2 |
| 5 | Sampling subscriptions, lens reports, and shared surface damage | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A missing source leaves the last frame visible in the loupe

[SourceLoupe.tsx](packages/labkit/src/loupe/SourceLoupe.tsx#L48) · Pass 1 · medium · Source-traced

When a source getter changes from a live canvas to null, the frame loop releases the old source and returns before clearing the destination canvas. The lens keeps displaying its last frame for as long as the getter returns null, even though subsequent samples have no source.

### 2. The magnified DOM copy can still receive keyboard focus

[LoupeBubble.tsx](packages/labkit/src/loupe/LoupeBubble.tsx#L49) · Pass 2 · medium · Source-traced

The wrapper uses aria-hidden and pointer-events none, which do not take descendants out of sequential keyboard focus. A render callback that draws a button or input therefore adds a second tabbable control inside the visible lens. Keyboard focus can enter the duplicate, even though it is hidden from assistive technology.

Source and tests were left untouched.
