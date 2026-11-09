---
"@weasel-js/quantity": patch
---

`snapToStep` rounds in the decimals its operands are written with, so a decimal half such as `0.35` at a step of `0.1` snaps to `0.4` rather than `0.3`, and a half goes away from the origin on either side of it (`-0.35` snaps to `-0.4`).
