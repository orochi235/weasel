## Hovering a separator leaves a pending submenu open running, where hovering a panel's padding cancels it
- where: packages/menu/src/controller.ts:155 (createMenuController → hover)
- scenario: the HUD renderer reports the line under the pointer by span (`rowAt` → `menuRowAtY` in ui-logic), so a
  separator arrives as its index. `hover(level, sepIndex, p)` returns at line 155 (`!isRowAt`) before anything else
  runs: no `cancel()`, no `lastPoint` update. Rest on submenu row R (its 200 ms `open` timer starts), then move
  down onto the separator below it: R's submenu still opens 200 ms later, beside a row the pointer has left, and
  the highlight stays on R. Move the same pointer into the panel's top or bottom padding instead and `rowAt` gives
  `null`, so `hoverNow(level, null)` runs `cancel()` and the submenu never opens. The controller answers "pointer
  over no row of this panel" two ways, depending on whether that non-row is a separator or padding. It should
  treat a non-row index as `null` (or at least cancel the pending `open`) so both behave the same.
- evidence: read (controller.ts:153-167, hoverNow at :123-131; hud/src/menu/menuWidget.ts:178-182; ui-logic/src/menuPanel.ts:95-98)
- severity: low

## Files read
packages/menu/src/access.ts
packages/menu/src/controller.ts
packages/menu/src/dismiss.ts
packages/menu/src/entries.ts
packages/menu/src/heldValues.ts
packages/menu/src/index.ts
packages/menu/src/keyPlan.ts
packages/menu/src/keys.ts
packages/menu/src/links.ts
packages/menu/src/numberText.ts
packages/menu/src/numberValues.ts
packages/menu/src/pbt.fixture.ts
packages/menu/src/placement.ts
packages/menu/src/triangle.ts
packages/menu/src/typeahead.ts

<!-- done: 1 findings, files read: 15 -->
