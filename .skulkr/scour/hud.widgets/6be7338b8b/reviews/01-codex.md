# Review saturation for `hud.widgets`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Window pointer lifecycle and frame hit zones | 2 | 2 | 0 |
| 2 | List row identity across updates and keyboard scroll visibility | 1 | 3 | 0 |
| 3 | Rect, image, text, and label command lifetimes | 0 | 3 | 1 |
| 4 | Round resizing, window theming, and frame rendering | 0 | 3 | 2 |
| 5 | List drawing, accessibility tree, and story coverage | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A window content press can fire a click released outside its interior

[windowDrag.ts](packages/hud/src/widgets/window/windowDrag.ts#L82) · Pass 1 · medium · Source-traced

The release branch validates the press zone and finite coordinates but never checks the release zone. A down just inside the content followed by a release across the adjacent border within the drag threshold can call onContentClick with a point on the frame. The close branch already checks the release zone.

### 2. The window close hit zone extends below the close box

[zones.ts](packages/hud/src/widgets/window/zones.ts#L52) · Pass 1 · low · Source-traced

The frame draws a close box vertically centered at (titleH - closeSize) / 2. The hit test uses the same horizontal position but treats the entire non-resize titlebar height in those columns as close. With defaults, pressing and releasing at y=22 relative to the top closes the window even though the box ends at y=19.

### 3. Reordering a focused list can move its active row out of view

[list.ts](packages/hud/src/widgets/list/list.ts#L135) · Pass 2 · medium · Source-traced

setRows preserves the active row by ID but only clamps the old scroll offset. If that row moves from the first visible slot to the bottom of a fixed-height list, the visible focus ring disappears and Enter still activates that offscreen row. Focus and keyboard movement call reveal, but row updates skip it.

Source and tests were left untouched.
