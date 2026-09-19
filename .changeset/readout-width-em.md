---
'@weasel-js/ui': patch
---

The property readout's default width is `2.8em` instead of `calc(5em - 24px)`, so it scales with the readout's font size rather than subtracting a fixed 24px. At the kit's own size the two are within a fraction of a pixel. `--wzl-property-readout-w` still overrides it.
