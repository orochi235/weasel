---
'@weasel-js/routing': patch
'@weasel-js/menu': patch
'@weasel-js/ui': patch
---

A command can say why it is disabled in its own words: `useCommand`'s `enabled` may now return a sentence, as an action's `enabled` already could, and the palette and bar buttons show it the way they show an action's. Menus now say why too: a menu item entry carries `disabledReason`, `resolveMenu` fills it from the action's or command's answer, and a DOM menu shows a disabled row's reason in a tooltip once the highlight rests on the row, keeping its shortcut, and gives it to assistive tech as the row's description.
