---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

A select draws an option's icon beside its label, in the trigger and in the list.
`SelectOption` and `SelectItem` take a new `icon`, and an enum field drawn as a
select passes it the option's `glyph` when that is drawn rather than a letter —
so a labkit `ConfigOption` with an `icon` now shows it in a select as a
segmented row already did.
