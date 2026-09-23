---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Kit actions can now fill a whole editor toolbar from the registry.

- `Action.variants` lists the separate things a parametric action does, each with its own label and params. `flip` declares Flip Horizontal and Flip Vertical; `reorder.forward` and `reorder.backward` declare their one-step and all-the-way forms. `actionItems(action)` expands an action into the entries a bar, menu or palette shows: one per variant, or the action itself. An action without an immediate invoker gets none, because `trigger` cannot start a drag.
- `actionShortcuts(action, params)` returns only the shortcuts whose binding passes those params, so each variant shows its own key.
- `ActionBar` renders one button per entry and triggers it with that entry's params. `icons` and `labels` are now keyed by entry key (`flip:y`, `reorder.forward:extreme`), which is still the action id for an action without variants. `enabled` is evaluated with the deps the action declares in `requires`, not a fixed set of six, and a tooltip without a `shortcut` override now shows the binding's key.
- New groups: `history` (undo, redo), `clipboard` (cut, copy, paste), `edit` (duplicate, delete), `structure` (group, ungroup) and `flip`.
- New `clipboard.paste` action, which calls the `clipboard` dep's `paste()`. It has no key binding, because Cmd/Ctrl+V already arrives as a paste event.
- `enabled` now follows the current state: undo and redo follow the history stacks, `delete` and `group` need a selection, `ungroup` needs a selected container, and `clipboard.paste` needs a non-empty clipboard. `delete`, `group` and `ungroup` used to report enabled unconditionally.
- Align actions now register left, center, right, top, middle, bottom.
- `buildDepsFromRequires` is re-exported from `@weasel-js/core`.
