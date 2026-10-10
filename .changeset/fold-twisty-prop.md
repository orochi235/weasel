---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`PropertyPanel`, `Subpanel`, and `PropertyGroup` take `twisty`: `'folded'` hides the twisty while the contents are open and folds on a press of the title instead; the twisty still takes keyboard focus and shows while it has it. `ControlPanel` and `ControlMatrix` pass it through. The default, `'always'`, is unchanged.

A panel's title sits closer to its contents: the gap under it is 8px, down from 12px (`--wzl-prop-panel-title-gap`), and a twisty no longer makes the title row taller.
