---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

Render text decorations as a toggle row, and ship a builtin font-family control

`SelectionPanel` rendered every boolean leaf as a `Switch`, ignoring the leaf's
`control` entirely — so the three text decorations arrived as three switch rows
where every text editor puts one row of U / S / O. `ToolPrefBooleanControl` now
accepts `'toggle'`, `ToolPrefBoolean` carries a `short` label for it (the pair
takes the row's name, leaving the leaf only a glyph's worth of room), and the
panel honors both. Core's text schema asks for it: `underline`,
`strikethrough` and `overline` share a `Decoration` pair.

A run of adjacent leaves sharing a `pair` renders as one `ToggleBar`, not one
bar per leaf — the same segmented control the `Align` row beside it already
draws. Each segment still writes only its own leaf, so flipping one decoration
never invents values for the other two. An unset toggle is left unselected
rather than dimmed: unselected is what a toggle button's off state means, and
the dimming the `Switch` path uses for the same case reads as disabled on one.
A leaf a consumer claims with its own `renderers` entry drops out of the run.

`FontFamilySelect` moves from WeaselDraw into `@weasel-js/ui`, and
`SelectionPanel` reaches for it on a `font-family` leaf. Core's own default
text schema declares that kind, so a consumer passing no `renderers` — the
Storybook story, any app taking the defaults — got the literal
`(font-family: no renderer)` placeholder where the font picker belongs. The
control offers both tiers that can actually paint and probes substitution at
the node's own weight and style, so its label names the variant that will
render. `@weasel-js/ui` now depends on `@weasel-js/font`.
