---
'@weasel-js/labkit': patch
---

Adds API: `.showIf` on a leaf and on a group takes a condition written as data (`.showIf({ path: 'mode', is: 'row' })`) as well as the function it took, and `.enableIf` is new and takes the same two forms. A condition stays data through `resolveConfigSchema`: it lands on the resolved leaf or `PrefGroup` as `showIf` or `enableIf`, so an export and a schema editor see it, and `resolveConfigSchema` throws on one that reads a path no leaf holds or compares against a value the leaf never holds, naming each node and what is wrong with its condition. A function still sits beside the tree, in `ResolvedConfig.showIf` and the new `ResolvedConfig.enableIf`. `isLeafVisible` answers both forms, and `isLeafEnabled` is its counterpart for `enableIf`. `ControlPanel` hides a row by either form of `showIf`; it does not draw a disabled row yet, so `enableIf` has no effect on screen.
