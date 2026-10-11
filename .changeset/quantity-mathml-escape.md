---
'@weasel-js/quantity': patch
---

The `fraction` kind wrote a custom constant's `symbol` into its MathML unescaped, so a symbol holding `<` or `&` produced malformed markup. It is escaped like the HTML form.
