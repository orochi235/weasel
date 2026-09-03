---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

Pack property rows two-up, and size their fields to their content

A property panel spent a full row on every leaf and stretched each field to
whatever width the row had, so a 38-flag lab sidebar scrolled for two screens
to show four dozen digits. The grid was already there — `PropertyList` and
`PropertyGroup` have taken `pack="pairs"` since they were written — but only
`PropertyRow` could opt out of it, so nothing that rendered a schema could use
it: `ControlPanel` hardcoded `pack="auto-color"`, which spans everything but a
colour.

`ControlPanel` now takes `pack` and `layout`. It defaults to `pack="pairs"`
(two controls per row), with `'auto'` for the middle ground — text, sliders and
segmented toggles keep the full width, everything else pairs — and `'one-up'`
for what it used to do. A custom `controls` renderer places itself like any
built-in row and opts out the same way, with `<PropertyRow span>`.

`span` is now on every typed row (`NumberRow`, `TextRow`, `SelectRow`,
`ToggleRow`, `CheckboxRow`, `ColorRow`, `SliderRow`), not just on the
`PropertyRow` they are built from.

Fields size to their content rather than to their cell: a number gets 9ch and a
string 16ch, both capped at the column so a narrow sidebar still fills. Fields
also state a height (`--wzl-prop-field-height`, 20px) rather than padding to
one — the display face's line box is half again its font size, so a padded field
stood 27px tall around 13px of text and trimming the padding could not fix it.
The row and group gutters came in to match.

Widths, heights and gutters are all overridable:
`--wzl-prop-number-width`, `--wzl-prop-text-width`, `--wzl-prop-field-height`.

A lab's trial sidebar states its width (`--lk-trial-sidebar-w`, 20rem) instead
of deriving it from content: an auto-width sidebar is as wide as its widest
label, so one verbose config key was setting the width of the lab. An inline row
puts its label on the left edge and its field on the right, so fields of
different widths still read as one rail down the column, and it keeps its one
line in a column narrower than it wants: the field yields width to the label
down to a four-character floor, and the label — which may be a single
unbreakable name — never yields.

Every property panel is visibly denser for this — WeaselDraw's inspector as
much as a lab's controls.
