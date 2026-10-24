---
"@weasel-js/labkit": patch
---

A `ControlPanel` group drawn `as('section')` takes the motif it names with `.motif(…)`. It stays out of `<ControlPanel motif>`, which is for framed groups and sections: a section group with no motif of its own keeps its frameless `divider` look.
