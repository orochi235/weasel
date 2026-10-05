---
'@weasel-js/select': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

New package `@weasel-js/select`: selection as a value. `intentOf(modifiers, policy)` reads a press as `'replace'`, `'toggle'` or `'range'` under a policy naming which keys toggle and which range, and `select(state, id, intent, { order, eligible })` applies it to `{ ids, anchor }`. Ineligible ids — locked or disabled rows — are skipped by a range, dropped when a selection grows, and selected alone when pressed. `createSelectionStore` keeps ids outside a component, behind the `SelectionStore` contract, which core still exports under the same name.

core's `useSelection`, and `Tree` and `LayerList` in `@weasel-js/ui`, now select through it rather than each keeping its own rules. `SelectionMode` and `SelectionExtendKey` are declared in `@weasel-js/select` and still exported from `@weasel-js/routing` and `@weasel-js/core`. Two edges change: `LayerList`'s Shift+arrow with its anchor hidden in a collapsed branch now selects the row it reaches instead of doing nothing, and a Cmd/Ctrl-press in a multi-select `Tree` drops any disabled row from the selection it builds on.
