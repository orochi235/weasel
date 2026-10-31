---
"@weasel-js/ui": patch
---

A row laid along a shape (a curved `Bar`, segments, swatch rings, run slots) that runs at most `RUN_SLACK` (8px)
past its track no longer scrolls: it is drawn whole, centered on the track. A curved `Bar` in `'menu'` mode keeps an
item on its line under the same allowance rather than sending it to More.

In a vertical `Bar`, a button that opens a popover or menu shows its glyph alone when it has one, keeping its name as
its accessible name; one without turns 90 degrees and reads along the bar.
