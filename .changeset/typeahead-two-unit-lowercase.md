---
"@weasel-js/ui-logic": patch
---

`typeaheadMatch` cycles past the highlight for a typed letter whose lowercase takes two code points, such as `İ`. It counted the lowercased query, which reads as two characters, so typing `İ` again stayed on the item it had found.
