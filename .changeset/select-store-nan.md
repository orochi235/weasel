---
"@weasel-js/select": patch
---

`createSelectionStore` compares a write with what it holds as a `Set` does, so writing the same ids again tells no one even when one of them is `NaN`.
