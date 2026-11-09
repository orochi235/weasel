---
'@weasel-js/routing': patch
'@weasel-js/cursor': patch
---

Fixes to press ownership, menus, tool sets and shortcuts in routing, and to cursor glyph lookup and mark placement.

- A dispatcher leaves a press to an item inside it that opened a pointer session of its own before the dispatcher heard the press (an item listening natively rather than through React). Before, a press released in place on such an item also ran the surface's click binding.
- `withoutTools` keeps the sets nested in the set it cuts from, so a stack inside one (path-tools' warp stack inside `RESHAPE_TOOLS`) is still a stack. Before, it flattened every nested set into plain ids. A nested set it empties is dropped.
- A menu row asks `enabled` and `active` with the params its run hands `trigger`: the menu's own params and the point it opened at, as well as the variant's. Before, a row read only the variant's params, so an action judging the menu's params was shown disabled while `trigger` would run it, or the reverse.
- `useCommand` compares `icon` by value, so an icon with a mark written inline (`{ name, mark }`) no longer replaces the action on every render.
- `actionShortcuts` finds a variant's key through a binding whose `params` is a thunk.
- `cursorFor` and `cursorGlyph` throw on a glyph or mark named like an `Object.prototype` member (`constructor`, `toString`) instead of baking it.
- `placeCursorPath` (and `markedGlyph` through it) reads numbers written without a leading digit (`.5`), run together (`1.5.5`) or with an exponent (`1e-3`), and throws on a command whose numbers do not make whole points. Before, it misread the first three and dropped a trailing number.
