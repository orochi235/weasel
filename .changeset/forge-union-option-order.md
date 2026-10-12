---
'@weasel-js/forge': patch
---

A control read from a string-union prop lists its options in the order the type is written in, where it listed them in the order the compiler held them: `Button`'s `variant` read link, ghost, primary, secondary. The order is followed through a plain type alias. A union the type computes, through `Exclude` or a generic, keeps the compiler's order.
