---
"@weasel-js/pdf": patch
---

A dash whose every length rounds to 0 where it is written strokes solid, as a dash too fine to draw does in the
renderer, instead of writing an all-zero dash array, which PDF forbids and readers draw as nothing.
