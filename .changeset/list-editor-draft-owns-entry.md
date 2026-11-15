---
'@weasel-js/ui': patch
---

A `ListEditor` entry keeps its typed text when typing moves to another entry without a blur.

The text is written to the entry it was typed in, and the next entry's draft compares against that entry's own text.

<!-- entry: fix -->
