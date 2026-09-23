---
'@weasel-js/labkit': patch
---

`sectionTree` rearranges a `ResolvedConfig` so its root sections are groups,
which is where `PrefsForm`'s rail layout looks for them. A section naming a
group brings it in whole, so it lands as an indented rail item; a section
naming a leaf drops it loose into that section's pane. `showIf` and `hidden`
are applied on the way, and a section they empty is left out rather than
opening onto nothing. It returns the tree, the config renested to match, and
`pathAt` to get a config path back from a rail one.

A flat schema's rail was otherwise one unnamed item however many headings the
panel drew, since a resolved schema keeps its sections beside the tree.

`PrefsForm`, `PrefsDialog` and their prop types now come through
`@weasel-js/labkit/weasel-ui`, which carried the `Pref*` vocabulary but not the
components that render it.
