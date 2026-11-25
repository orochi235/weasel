# Review saturation for `core.interactions.actions.defaults`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 17 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Camera drag release and external zoom | 1 | 1 | 0 |
| 2 | Rotated container wheel conversion | 1 | 2 | 0 |
| 3 | Context menu selection and anchoring | 0 | 2 | 1 |
| 4 | Copy trees, operand requirements and lock reachability | 0 | 2 | 2 |
| 5 | Undo, tool reset, cancellation and pinch routing | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A drag coast converts release velocity at an obsolete zoom

[viewportDragPan.ts](packages/core/src/interactions/actions/defaults/viewportDragPan.ts#L148) · Pass 1 · Low · Source-traced

With inertia enabled, move the drag, zoom externally before pointer-up, then release without another pointermove. The release uses the pre-zoom base scale despite taking its initial position from the current view. At double zoom a fling travels at twice the expected screen speed.

### 2. Wheel scrolling ignores the direction of a rotated container's axes

[containerScroll.ts](packages/core/src/interactions/actions/defaults/containerScroll.ts#L216) · Pass 2 · Medium · Source-traced

Give a container a quarter-turn and overflow along its local x axis. A vertical wheel delta points along that axis on screen, but the action only sends world x to local x. It therefore yields to viewport pan even though the container can scroll in the wheel's direction. The conversion uses basis lengths and loses orientation.

Source and tests were left untouched.
