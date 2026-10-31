---
"@weasel-js/path-tools": patch
---

`constrainAnchors` and `unconstrainAnchors` have glyphs of their own, `path-tools:constrainAnchors` and
`path-tools:unconstrainAnchors`, and `constrainAnchors` lists one variant per constraint kind, so a bar, menu or
palette offers each kind by name. The constraint actions, `deleteConstraint` included, are now in the `constraints`
action group rather than `anchors`: a surface drawing the `anchors` group no longer shows them. The kinds' names are
exported as `CONSTRAINT_KIND_LABELS`.
