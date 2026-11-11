---
"@weasel-js/ui-logic": patch
---

`@weasel-js/ui-logic` exports `dropBand`, which part of an item a dragged pointer is over: before it, after it, or into it.

`dropBand(f, band)` reads the fraction `f` along the item. The leading and trailing `band` drop beside it and the middle drops into it; the default of a half leaves no middle.

<!-- entry: new api -->
