---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

labkit's `ControlPanel` draws a group `as: 'bar'` (`f.group({...}).as('bar')`) as one line of its leaves in their bar forms under no heading, where it drew a headed group of rows. A leaf that names no `control` takes the bar's default, so a boolean is a toggle button there and a checkbox in a row. A leaf whose control the lab draws itself keeps its row form.

`@weasel-js/ui` exports `renderBarLeaf` and its `BarLeaf` argument: the one place a leaf kind's bar form is decided, for a surface that draws its own bar through `BarLayout`.
