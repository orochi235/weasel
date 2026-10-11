---
'@weasel-js/ui': patch
---

`<Icon>` takes a `mark`: a second, small glyph set in its lower right corner, with the main glyph cleared from around it, so `<Icon name="formPage" mark="markAdd" />` reads as "add a page". The mark is drawn at the main glyph's stroke weight.

The marks are new glyphs in a `Marks` group of their own, each usable alone like any other: `markAdd`, `markRemove`, `markCheck`, `markClose`, and `markDot`. `MARK_ICONS` lists them and `MarkIconName` is their type.

`PrefSchemaEditor`'s Add pref and Add group buttons use it, in place of two identical plus signs, and Remove carries the delete glyph.
