---
'@weasel-js/ui': patch
---

A `Badge`'s `padding`, as a prop or through `style`, adds to its shape's insets, so the label stays clear of the outline.

A badge that set `padding` to make room for its shape's outline by hand now gets that room twice; drop the extra.

<!-- entry: fix visual behavior -->
