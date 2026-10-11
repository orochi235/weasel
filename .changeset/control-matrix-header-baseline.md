---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

A titled `ControlMatrix` sets its column headers on the panel title's baseline. They were centered on the title row, which left the smaller header text about 3px above the title's line.

`PropertyPanel` lines its actions up with its title by `--wzl-prop-panel-actions-align`, a new hook: `center` as before when unset, `baseline` for actions that are text.
