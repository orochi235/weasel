---
"@weasel-js/symmetry": patch
---

`specOfData`, which reads a symmetry group's spec from its `data`, reads any field holding a value of the wrong type at its default, as a saved file can hold. A kind named for an `Object.prototype` member (`toString`, `__proto__`) threw a `TypeError` on every draw; a wallpaper cell of `wallpaper` recursed until the stack ran out and one of `repeat` drew a repeat's steps as its cell; an extent of `null` threw. A kind is now one `SYMMETRY_KINDS` holds as its own, a cell one of the wallpaper cells, and an extent a box of numbers.
