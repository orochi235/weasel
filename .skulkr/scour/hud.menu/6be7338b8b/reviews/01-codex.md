# Review saturation for `hud.menu`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 13 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Host dismissal, focus ownership, and panel placement after layout changes | 2 | 2 | 0 |
| 2 | Editing key ownership and the keyboard exit path | 1 | 3 | 0 |
| 3 | Number chip geometry, repeat limits, and release behavior | 0 | 3 | 1 |
| 4 | Color picker normalization, labels, and accessibility state | 0 | 3 | 2 |
| 5 | Bidi caret mapping, grapheme movement, and panel drawing | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Open panels reuse stale placement after a canvas-only resize

[placePanels.ts](packages/hud/src/menu/placePanels.ts#L62) · Pass 1 · medium · Source-traced

The placer reads canvasSize on every call but reuses each rect when entries and parent row are unchanged. An element resize caused by a split pane or layout change can shrink the available canvas without a window resize event to dismiss the menu. Even after redraw, a previously in-bounds panel can remain partially or entirely outside the canvas.

### 2. Menu dismissal listens on the module window instead of the canvas window

[attachMenuHost.ts](packages/hud/src/menu/attachMenuHost.ts#L61) · Pass 1 · medium · Source-traced

For a HUD attached to a canvas in a same-origin iframe through code running in the parent window, menu dismissal installs its wheel, blur, and resize listeners on the parent. A wheel outside the menu within the iframe does not bubble to the parent window and can scroll the canvas while the menu remains open.

### 3. Tab cannot close the menu while a text row is being edited

[menuWidget.ts](packages/hud/src/menu/menuWidget.ts#L99) · Pass 2 · medium · Source-traced

The menu controller treats Tab as a close command, but an active editor consumes every key before the controller sees it. The editor leaves Tab and Shift+Tab unchanged while reporting them handled, so HUD focus wiring prevents the browser default and keyboard navigation stays in the edit. Enter or Escape is required before Tab can resume its menu behavior.

Source and tests were left untouched.
