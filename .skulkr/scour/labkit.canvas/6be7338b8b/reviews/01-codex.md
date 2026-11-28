# Review saturation for `labkit.canvas`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 26 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Orbit zoom adapter and reference distance | 1 | 1 | 0 |
| 2 | Scheduler failures and context restoration | 1 | 2 | 0 |
| 3 | Registry snapshots and server render behavior | 1 | 3 | 0 |
| 4 | Coordinate conversion, density measurement, and camera transforms | 0 | 3 | 1 |
| 5 | Gesture routing, wheel forwarding, and pointer publication | 0 | 3 | 2 |
| 6 | Layer layout, touch CSS, and public export wiring | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Orbit zoom reports 100% after every change when home is absent

[orbitZoom.ts](packages/labkit/src/canvas/orbitZoom.ts#L14) · Pass 1 · medium · Source-traced

Orbit permits omission of home and publishes a zoom adapter in that case. The adapter divides the current distance by itself on every read, so the displayed value stays at 100% even while zoom commands change the distance. Setting the adapter to 100% again uses the new current distance as its reference and cannot return it to the opening magnification.

### 2. A throwing layer renderer leaves its saved canvas state on the stack

[useLayerScheduler.ts](packages/labkit/src/canvas/useLayerScheduler.ts#L80) · Pass 2 · medium · Source-traced

The scheduler saves context state before invoking the caller's render callback, then restores only on normal return. If the callback sets a clip and throws, the saved state stays on the stack and the clip remains active. A later redraw's setTransform does not reset that clip and can leave clear and paint restricted to the old region.

### 3. Reading a registered camera throws during server rendering

[cameraRegistry.ts](packages/labkit/src/canvas/cameraRegistry.ts#L40) · Pass 3 · medium · Source-traced

useRegisteredCamera supplies only subscribe and the client snapshot to useSyncExternalStore. React server rendering requires a server snapshot and throws when it is missing. The hook is used by trial chrome and camera setup even when no camera has mounted and the correct snapshot would be null.

Source and tests were left untouched.
