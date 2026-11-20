---
'@weasel-js/routing': patch
---

`createKeymapContribution` throws on a keymap binding a held Escape, as it does for a pressed one. Escape always closes the keymap first, so the binding could never run.

<!-- entry: fix -->
