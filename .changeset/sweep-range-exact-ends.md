---
"@weasel-js/ui-input": patch
---

A `range` sweep walks its ends exactly and keeps a value's digits past the twelfth.

Float drift, such as `0.1 * 3` reading `0.30000000000000004`, is still dropped, and labels still show twelve digits.

<!-- entry: fix -->
