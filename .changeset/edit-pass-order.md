---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

Scene edit passes now compose. `scene.addEditPass(pass, { order })` runs passes by ascending
`order` (default 0), ties in the order they were added, and each pass hears the edit's own changes
plus every write the passes before it made; it still runs once per edit, and undo, redo, and
history replay still run none. This changes what a second pass hears: it used to miss the first
pass's writes. `SceneEditSummary.docChanged` lists the document-value keys an edit set.

Diagram exports `DIAGRAM_PASS_ORDER`, where each of its passes runs, and avoid routing installs its
pass at `DIAGRAM_PASS_ORDER.avoid`. The routers (`straight`, `orthogonal`, `bezier`, `avoid`,
`ROUTERS`) moved to their own module; the package exports them as before.
