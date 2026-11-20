---
'@weasel-js/storage': patch
---

`pickFile` resolves `null` and removes its input when the user dismisses the dialog in a browser that fires no `cancel` event on file inputs.

<!-- entry: fix -->
