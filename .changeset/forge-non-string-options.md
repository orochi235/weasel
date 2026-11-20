---
'@weasel-js/forge': patch
---

A `select` or `radio` control with number, boolean or `null` options is drawn as a choice, and the story gets the chosen option itself.

Options with no string form, or two that read alike (`1` and `'1'`), still get no choice, and forge now warns, naming the control.

<!-- entry: fix -->
