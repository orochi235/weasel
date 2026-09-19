---
'@weasel-js/core': patch
---

The renderer's `mat3.translate` and `mat3.scale` are renamed `mat3.translated`
and `mat3.scaled`. They compose onto the matrix you pass (`m · T`, `m · S`),
where `@weasel-js/geom`'s `translate` and `scale` build a fresh matrix, so the
shared names let code moved between the two compile and then misbehave.

This is a breaking change for anyone calling `mat3.translate` or `mat3.scale`
from `@weasel-js/core`: rename the call; the behavior is unchanged.
