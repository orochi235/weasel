---
"@weasel-js/svg": patch
---

`<text>` `x` now means what the SVG spec says it means: the `text-anchor`
point. The serializer used to write the box's left edge beside
`text-anchor="middle"` or `"end"`, so every other SVG reader drew centered text
centered on that edge and right-aligned text ending at it. It now writes the
box's center for `middle` and its right edge for `end` (the left edge for
`start`), resolving `direction="rtl"` the same way the anchor itself does, and
the parser converts the anchor point back to the box's left edge.

**SVGs written by earlier versions import shifted.** Centered text in one of
those files now lands half its box width to the left of where it was saved, and
right-aligned text a whole box width to the left. Left-aligned text is
unaffected. There is no detection of older files.

**External SVG text now imports with a measured width.** A `<text>` with no
`data-weasel-width` used to get a 99999-wide box; now that `kit:text` aligns
within its box, centered or right-aligned imported text landed about 50000 or
100000 units right of where the file drew it. The width now comes from the
kit's text layout with the registered fonts, falling back to an estimate from
the font size when no registered font can measure the text, and the box is
placed so the text's anchor lands where the file put it.

**`UNBOUNDED_TEXT_WIDTH` is removed** from the package's exports. The parser no
longer produces it, so nothing has a sentinel left to check for.
