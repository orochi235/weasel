---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

A described row shows its description in a tooltip when its label is hovered, with no ⓘ beside the label. Keyboard focus on the row's control still opens it, and the control is still described by it for assistive technology. The kit setting `help.icon` brings the ⓘ back. A `ControlMatrix` row's help opens off its label the same way.
