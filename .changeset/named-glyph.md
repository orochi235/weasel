---
'@weasel-js/ui': patch
---

A leaf's `icon` is looked up in the kit's icon set in one place, where a form's field, a bar's label, an action button, an object leaf's field, and `PaintInput` each did it themselves. A name the set lacks still draws nothing, and that now includes a name `Object.prototype` holds, such as `toString`, which the old lookups took for a glyph.
