---
"@weasel-js/quantity": patch
---

A `duration({ style: 'units' })` reads its own text back in a locale that groups with a period: `0.010s` in `da-DK` or `de-DE` is a hundredth of a second, not ten seconds. The seconds of the units form now take a decimal in either mark, as the clock form's already did.
