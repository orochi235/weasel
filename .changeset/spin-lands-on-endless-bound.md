---
'@weasel-js/quantity': patch
---

`spinKey` lands a step that would cross an endless bound on the bound itself, as a slider thumb does: Page Up from 5 on a 0–10 field whose top is endless went straight to infinity, and so did an arrow from 9.5 with a step of 1. The next press past the bound reaches infinity as before. Every number field and menu value that spins through `spinKey` follows.
