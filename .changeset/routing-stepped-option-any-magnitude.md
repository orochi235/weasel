---
'@weasel-js/routing': patch
---

A tool option's size and strength steps move at any magnitude. A step rounded its result to six decimal places,
so a value below a millionth grew to zero and an amount finer than a millionth never moved; it now sheds float
noise to twelve significant digits, and only where that keeps the step. A step past the double range on an option
with no endless end stops at the largest double rather than at `Infinity`, which the option then read as unset.
