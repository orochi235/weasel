# Review saturation for `hud.loupe`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 16 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Framebuffer crop geometry, color sampling, and coordinate transforms | 1 | 1 | 0 |
| 2 | Shared contribution routing and per-surface aim state | 1 | 2 | 0 |
| 3 | Control press, move, commit, and cancel transitions | 0 | 2 | 1 |
| 4 | Ring geometry, glyph placement, and label painting | 0 | 2 | 2 |
| 5 | Vector view selection, frame invalidation, and teardown | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Pixel magnification shifts away from its aim at pane edges

[pixelReadback.ts](packages/hud/src/loupe/pixelReadback.ts#L88) · Pass 1 · medium · Source-traced

The region helper moves a crop inward near a pane edge so the requested rectangle fits. The lens then stretches the entire bitmap into its interior without compensating for that translation. For example, when a 40-device-pixel crop is requested at x=3, its left edge clamps to zero and its middle displays x=20. The advertised center and the pixel picked there still use x=3 through the model, so the center color can disagree with the picture.

### 2. A shared HUD contribution sends aim and leave to every attached surface

[loupeRoutes.ts](packages/hud/src/loupe/loupeRoutes.ts#L37) · Pass 2 · medium · Source-traced

A contribution created without a HUD supports multiple attachments. Its hover and leave actions iterate every registered surface, with no check for the canvas that dispatched the gesture. Moving in one canvas can change the aim and controls in a different canvas, using client coordinates interpreted against that second element, and leaving one canvas resets the other lens's held-pointer state.

Source and tests were left untouched.
