---
'@weasel-js/menu': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/hud': patch
---

Describe and grade actions in data, and give each variant its own state

- An action takes a `description`, which a toolbar button reads as its tooltip, and a menu row and a palette row as their hint, and a `grade` (`'danger'` for one that destroys something), which a menu row and a palette row draw in their grade's color and a toolbar button shows while pointed at. A variant may set its own of either, and its own `shortcut` text; each falls back to the action's. `ActionItem` carries all three, resolved.
- `enabled` is handed the params a run would get as its fourth argument, and `active` as its second, so the variants of one action can each be pressed or unavailable on their own: align left pressed while right is not, Bring Forward unavailable at the top of the stack. Bars, menus and the command palette ask once per variant, and the dispatcher hands the gate a binding's `opts.params`, so a key for one variant runs only when that variant can. An action that ignores the new argument behaves as before.
- `useCommand` takes `shortcut`, `preview`, `settings`, `description` and `grade`, and hands its `enabled` and `active` the params asked about. `CommandSettings` is an `ActionSettings` whose `read` takes no deps.
- `@weasel-js/menu`: an item and a submenu row take `description` and `grade` (`MenuGrade`, the theme's `Grade`), and a submenu, number, color and text row take `disabledReason`. ui's menu rows show a reason or a description in their tip and as their accessible description; hud's canvas menus draw a graded row's label in its color and describe a row to assistive tech the same way. `HudAccessibleNode` takes a `description`, mirrored as `aria-description`.
- `BarActionButton` takes a `grade`, and `useLeafAction` answers a `description` (the leaf's, else the action's) and a `grade`.
