---
'@weasel-js/forge': patch
---

A Storybook `select` or `radio` control whose options are numbers, booleans or `null` is drawn as a choice, and the story gets the chosen option itself.

Options with no string form, or two that read alike (`1` and `'1'`), still get no choice, and forge now warns, naming the control.

<!-- entry: fix -->
