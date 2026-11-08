---
'@weasel-js/pdf': patch
'@weasel-js/diagram-formats': patch
'@weasel-js/d3': patch
'@weasel-js/svg': patch
---

Fixes to PDF output, SVG transform reading, the Mermaid and draw.io round trips, and the d3 binding's docs.

- `writePdf` writes no fill for a path whose fill covers nothing (no commands, or only open subpaths under `openFill: 'none'`), and clips such a path to an empty rectangle. Before, it wrote a painting or clipping operator with no path, which PDF has no meaning for.
- Mermaid text reads `&` only as the start of an HTML reference (`&amp;`, `&#65;`) and `#` only as the start of Mermaid's (`#quot;`, `#65;`). Text such as `&65;` or `&x41;` no longer reads back as `A`, and `##65;` keeps its first `#`.
- Mermaid sequence text escapes an `&` before a `#`, so a message reading `&#65;` reads back as written instead of as `#65;`.
- A Mermaid quadrant chart point named like a statement (`title Outlier`, `x-axis drift`, `accTitle`, `%% note`) is written quoted, so it reads back as a point instead of as a title, an axis, accessibility text or a comment. A quoted quadrant name or label is escaped like other Mermaid text, so one holding a literal `#35;` or `#quot;` reads back as written.
- draw.io end labels are written as plain text (`html=0`), so a label holding `<b>` or `&amp;` reads back, and draws in draw.io, as written instead of as markup.
- Mermaid pie, packet and xychart labels and titles are escaped like every other Mermaid text, so a label holding a literal `#quot;`, `#35;` or `<b>` reads back as written. Reading their quoted text now decodes every Mermaid and HTML reference, not only `#quot;`.
- `parseSvg` ignores a `transform` list that does not parse whole, as browsers do: an unknown function, a function with the wrong number of arguments (`matrix()` short of six, `rotate(30 5)`), an argument that is not a plain number (`translate(10px)`), or text between functions. Before, it applied the functions it could read. The warning now says which of these it was; only an unknown function is reported as unsupported.
- `BindOptions.layer` documents its default as the first of `scene.layers`, which is what `join()` uses, rather than the first system layer.
