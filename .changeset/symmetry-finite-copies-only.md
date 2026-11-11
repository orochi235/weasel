---
"@weasel-js/symmetry": patch
---

Every symmetry kind leaves out a copy whose transform is not finite, and the original still draws.

That covers `symmetryTransforms`, each `SYMMETRY_KINDS` row's `transforms` and `pointGroup`, and `editSymmetries`.

<!-- entry: rank=-5 fix -->
