---
"@weasel-js/theme": patch
---

The palette generator works out each hue's peak lightness the first time it is asked for, rather than all 360 when the module loads, so importing `@weasel-js/theme` no longer costs 14–27 ms up front.
