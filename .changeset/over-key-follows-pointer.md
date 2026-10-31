---
"@weasel-js/routing": patch
"@weasel-js/labkit": patch
---

A key held for an `over` binding now follows the pointer: a key already down when the pointer comes over a surface presses that surface's `over` key-held bindings, and leaving releases them. A single-press `key` binding is not repeated on arrival. Holding a loupe's peek key and then moving onto a loupe raises it again, and the peek carries from one loupe to the next.
