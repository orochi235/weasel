---
'@weasel-js/forge': patch
---

Index pages keep their styles in the workshop document. `IndexPage` now imports
its own stylesheet; before, only the iframe entry did, so an index page rendered
in the document had no padding, width limit or cell styling.
