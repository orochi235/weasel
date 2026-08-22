---
'@weasel-js/ui': patch
'@weasel-js/hud': patch
---

Correctness and keyboard fixes across `@weasel-js/ui` and `@weasel-js/hud`

`Select` and `ComboBox` converted a controlled `selectedKey={null}` to
`undefined`, which is React Aria's signal for *uncontrolled*. Clearing a
selection therefore left the old value on screen and logged a
controlled-to-uncontrolled warning. `SelectionPanel` hits this on every mixed
enum property. Both now pass `null` through.

`DataGrid`'s reorder hook measured rows against the wrapper `<div>`, whose only
child is the `<table>`, so every drop reported the same index. The ref moves to
`<tbody>`. Sortable headers become real buttons carrying `aria-sort`, and the
drop indicator is a class on the target row rather than a hard-coded 28px
offset.

`useReorderDragList` treated the first locked row as a ceiling for the whole
list, so a row *below* a locked one could be dropped above it. A drop is now
clamped to the run between the nearest locked rows either side of the grabbed
row, and a multi-selection drops the members that sit past the wall.

`Slider` ignored `constraint: 'ordered'` on the keyboard path — End sent a
thumb straight past its neighbor. It also left its `document` listeners
attached after `pointercancel` and after unmounting mid-drag, so a thumb kept
tracking a released pointer, and a press did not focus the thumb the arrow keys
are bound to.

`BandEditor` had the same drag-teardown gap. Its `x` / `Delete` merge fired
from anything inside a band — including typing `x` in a consumer's input and
pressing Cmd+X — and its seams ignored Home/End.

`GradientHandles` committed the mount-time handle position when a handle was
clicked without moving, and committed the abandoned position on
`pointercancel`. A press that never moves now writes nothing, a cancel restores
the live preview, and the handles respond to the arrow keys. Their `role`
drops from `slider`, which requires an `aria-valuenow` a 2-D position does not
have, to `button`.

`CurveEditor`'s `endpoints="pinned-both"` snapped an endpoint to the range
corner on the first drag instead of holding it still.

Every overlay the package renders into a portal — `ComboBox`, `Callout`,
`Tooltip`, `Dialog`, alongside the `Select` popover that already did — carries
`data-weasel-overlay`, the marker consumers use to ask whether focus left their
component.

In `@weasel-js/hud`: detaching left the hovered widget believing the pointer
was still over it, and `hovermove` fired only on entry, so its `x`/`y` froze
for the rest of the hover. The six widget factories ignored the detached-HUD
guard `add()` enforces. `Widget` gains an optional `disposed` flag, which lets
a loupe whose window is removed through the HUD stop reading pixels back and
release its listener; `aimAt` after `dispose` is now a no-op.
