---
"@weasel-js/core": patch
---

The warning `<Canvas>` gives for a custom layer it cannot place now names what is actually wrong. A layer
anchored onto a chain that ends on an undefined key names that key, where it named its own anchor even when
that anchor was defined; a layer anchored onto a cycle it is not part of reports the cycle, where it reported
a dangling reference.
