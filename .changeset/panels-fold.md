---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`PropertyPanel` and `Subpanel` fold. Both take the props `PropertyGroup` already had: `collapsible`, `defaultCollapsed`, `collapsed`, and `onCollapsedChange`. A folding panel draws a twisty before its title, keeps its contents mounted while folded, and marks its root `data-collapsed`. The props are exported as `CollapseProps`, with the `useCollapse` hook all three containers now share.

labkit's `ControlMatrix` takes the same four props. `ControlPanel` takes `collapsible` and `defaultCollapsed` for the whole panel; its controlled state uses the key `''` in the `collapsed` record and in `onCollapse`, beside the sections' keys.

`Subpanel`'s title row is now a `<div>` holding the `<h4>` and the rule, where the `<h4>` held both. A stylesheet that targeted `h4 > span` or `h4 > hr` inside a subpanel needs the new shape.
