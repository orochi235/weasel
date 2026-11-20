---
'@weasel-js/devtools': patch
---

The devtools panel names an `Error`, `RegExp`, buffer or DOM node in a node's data, rather than showing `{}`. An error carries its name and message, a regexp its source and flags.

<!-- entry: fix -->
