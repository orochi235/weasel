---
'@weasel-js/ui': patch
---

New `DetailList` and `DetailRow`: a read-only list of labelled values, rendered as a `<dl>` with one `<dt>`/`<dd>` pair per row. A value can be any run of elements — code chips, badges, keycaps, links — and wraps inside its column rather than widening the list. Labels take the params label recipe and rail: the label column is `--wzl-params-label-width` wide (its content width by default), and case, tracking and alignment follow the other three `--wzl-params-label-*` properties, so a detail list lines its labels up with a property panel's inline rows. `title` puts a heading above the list and names it by it; `layout="block"` stacks each label over its value for narrow columns.
