---
"@weasel-js/theme": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

**`tokens.css` no longer sets a document font.** It was the one rule in the
file that was not an inert custom property, and it re-typed the whole document
— so an app with its own typography could not import the stylesheet at all and
hand-wrote the `--wzl-*` bridge instead, which falls silently behind whenever a
component starts reading a token the list does not carry. The rule moved to
`fonts.css`, beside the `@font-face` declarations, which is the file that
already meant "give me the kit's typography". A surface that wants both now
imports both.

**`--wzl-slider-track-tint` and `--wzl-slider-thumb-tint` are renamed to
`--wzl-slider-track-mix` and `--wzl-slider-thumb-mix`.** They are the second
argument of a `color-mix`, so they must be percentages; the old names read as
colors, and setting one to a color invalidated the declaration and left the
thumb unpainted with no error anywhere.

**Slider size tokens carry their own defaults.** `--wzl-slider-track-h` and
`--wzl-slider-thumb-size` were used bare, so unset the track had no height and
the control was present, focusable, operable and invisible. An incomplete
bridge now degrades to the wrong size instead of to nothing.

**`ColorRow` and `NumberRow` take `onInput`.** `Slider` and `SliderRow` split
the live value from the committed one; these rows had a single callback with
nothing saying which semantics it had, so a consumer with an undo stack got one
entry per tick. `ColorRow` also takes `onAlphaInput`. A row given one callback
still fires continuously, as before.

**`RangeSlider`'s track has no `min-width` floor.** The root is a column flex
container, so `align-items` on it governs the horizontal axis and collapses the
track — and the 80px floor turned that into a small slider that looked
deliberate rather than a broken one that would have been found in seconds.

**The property readout's width takes `--wzl-property-readout-w`,** rather than
leaving a consumer to match the hashed class name.

**labkit mints ids through a helper that checks for `crypto.randomUUID`.** It
exists only in a secure context, and a LAN address is not one — so a lab opened
on a phone or a tablet by IP threw on its first render and showed a blank page
with nothing in reach to say why.
