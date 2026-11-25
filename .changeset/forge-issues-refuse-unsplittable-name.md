---
'@weasel-js/forge': patch
---

forge's issues endpoint refuses a component name holding a comma, a double quote, or a control character, which `gh` would read as more than one label.

<!-- entry: fix -->
