---
'@weasel-js/animator': minor
'@weasel-js/ui': patch
---

A timeline key can ease by blits' `steps` and `linear` easings, CSS's `steps()` and `linear()`, and a clip carries them.

`Keyframe.easing` takes `{ steps, jump? }` and `{ linear: points }` as `@msb235/blits` defines them, beside a name, a bezier or a function; `resolveKeyEasing` gives the curve any of them stands for, and the curve editor draws them. `linear` needs a blits release that has it.

<!-- entry: rank=5 new api -->
