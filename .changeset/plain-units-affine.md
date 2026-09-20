---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Take typed units past linear factors.

A unit table entry is now `number | { factor, offset }`, so a scale that
disagrees with the base about where zero sits — degC against K — is
expressible; a bare number stays the shorthand for a pure factor, so every
existing table reads as it did. `unitScale(system, unit)` is the one reader
that widens the shorthand and defaults the offset, and `resolveUnit` /
`formatUnit` both go through it.

`parseNumber` reads a compound value: `5ft 3in` is 63in, a leading sign carries
across every term, and a term with no unit (or a unit the field does not
accept) leaves the value unreadable rather than half-read. Offsets have no
meaning in a sum, so a compound value takes pure scales only.

`prefUnit` converts through offsets in both directions and now returns a
`format`, which is what the SelectionPanel slider readout draws — `formatUnit`
had no callers before this.
