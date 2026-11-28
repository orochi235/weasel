# Review saturation for `menu`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 15 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Value setters, failure recovery, and numeric stepping | 1 | 1 | 0 |
| 2 | Placement with oversized menus and out-of-bounds anchors | 1 | 2 | 0 |
| 3 | Keyboard navigation, access keys, and typeahead | 0 | 2 | 1 |
| 4 | Pointer deferral, submenu transitions, and cancellation | 0 | 2 | 2 |
| 5 | Number formatting, links, dismissal, and public exports | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A throwing setter leaves a menu value cached as if the write succeeded

[heldValues.ts](packages/menu/src/heldValues.ts#L12) · Pass 1 · medium · Source-traced

The controller stores the new held value before calling the row's setter. If the setter throws before applying it, the menu later reads the rejected value. A retry with that same value is then suppressed by the equality check and never reaches the setter. This shared path affects text, number, and color rows.

### 2. An oversized RTL menu can be placed left of its bounds

[placement.ts](packages/menu/src/placement.ts#L13) · Pass 2 · low · Source-traced

The reverse placement helper can enter its first branch when the anchor is outside the right edge. For bounds x=0 and width=100, an anchor at x=200, and a menu width of 150, it returns -50. The bounds contract calls for shifting an oversized menu to the left bound, which the forward helper already enforces.

Source and tests were left untouched.
