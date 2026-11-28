# Review saturation for `labkit.loupe.lens`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 33 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Difference capture failure paths and bitmap ownership | 1 | 1 | 0 |
| 2 | Wheel forwarding and scroll chaining | 1 | 2 | 0 |
| 3 | Lens and seam geometry, transforms, and action dispatch | 0 | 2 | 1 |
| 4 | Lens scene operations, reticle following, and zoom controls | 0 | 2 | 2 |
| 5 | Frame scheduling, focus reports, and pixel rendering | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A synchronous comparison capture error can strand the first bitmap copy

[LensSlot.tsx](packages/labkit/src/loupe/lens/LensSlot.tsx#L153) · Pass 1 · medium · Source-traced

Both captures are invoked while evaluating the Promise.allSettled input, before entering the cleanup block. If the source returns a promise for the base capture but throws synchronously on the comparison request, the first ownCapture continues and can create a bitmap copy that the cleanup loop never receives or closes. The displayed error does not release that copy.

### 2. Wheel handoff drops the other axis when only one can scroll locally

[scrollByWheel.ts](packages/labkit/src/loupe/lens/scrollByWheel.ts#L65) · Pass 2 · low · Source-traced

Once an element can consume either axis, the helper scrolls it and returns, dropping the other axis even if an ancestor could consume it. For example, a diagonal trackpad gesture over a horizontal scroller nested inside a vertical document scrolls only horizontally. The handoff cancels the native event once this helper returns true, so the vertical component cannot reach the document.

Source and tests were left untouched.
