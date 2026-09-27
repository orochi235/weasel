---
'@weasel-js/ui': patch
---

`Select`'s trigger no longer leaves an empty gap before its value. The selected row's check mark was copied into the trigger with the label and kept its space there while invisible; the trigger now hides it, and a `width='fit'` select no longer reserves room for it.
