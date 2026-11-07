---
'@weasel-js/forge': patch
---

A list knob whose entries are numbers or booleans (`f.list([1], f.number(0))`, or a story arg typed `number[]`) is read back from forge's URL. `decodeKnob` used to refuse any list whose entries were not strings, so such a knob fell back to its default on reload and in a shared link.
