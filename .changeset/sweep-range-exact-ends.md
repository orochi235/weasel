---
"@weasel-js/ui-logic": patch
---

A `range` sweep walks and reads its ends exactly, and keeps a value's own digits past the twelfth. It rounded every step to twelve digits to drop float drift, so a range from `123456.7890123` started at `123456.789012`, and one given a `count` could read `at` a hair outside its ends. Drift (`0.1 * 3` as `0.30000000000000004`) is still dropped; labels still show twelve digits.
