---
'@weasel-js/ui': patch
---

A property panel's text field commits through `onChange` when its caller previews the typing through `onInput`, and Escape gives that caller back the text it began from.

<!-- entry: fix -->
