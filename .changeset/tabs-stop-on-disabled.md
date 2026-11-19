---
'@weasel-js/ui': minor
---

A disabled `Tab` takes the arrow keys and focus without being chosen, and shows its new `disabledReason` in a tooltip.

The tooltip reads the tab's name and its reason, and opens once keyboard focus or the pointer rests on the tab, as a menu row's does. An uncontrolled tab set opens on its `defaultSelectedKey`, or on the first tab that can be chosen when that is unset or disabled, and moves to that tab when its chosen tab is removed; with every tab disabled it chooses none. A controlled `selectedKey` naming a disabled tab is still shown.

<!-- entry: api behavior -->
