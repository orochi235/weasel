---
"@weasel-js/symmetry": patch
---

Every symmetry kind draws only copies whose transforms are finite, in `symmetryTransforms`, each `SYMMETRY_KINDS` row's `transforms` and `pointGroup`, and so `editSymmetries`. A repeat or wallpaper step past the double range, a center near its end, or an axis that is `NaN` had made copies of `Infinity` or `NaN`; those copies are now left out, and the original still draws.
