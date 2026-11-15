---
'@weasel-js/ui': patch
---

A property panel's text field commits through `onChange` when its caller previews the typing through `onInput`.

Escape gives that caller back the text the edit began from.

<!-- entry: fix -->
