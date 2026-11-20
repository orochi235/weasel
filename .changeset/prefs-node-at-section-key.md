---
'@weasel-js/prefs': patch
---

`prefNodeAt` finds nothing at a nested section's key, as its docs say, so `resetPlans` given one writes nothing rather than paths no leaf has.

<!-- entry: fix -->
