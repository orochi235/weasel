---
'@weasel-js/ui': patch
---

A `SelectRow` whose value is absent or not one of its options now shows a placeholder instead of the first option ("Choose option…" unless its new `placeholder` prop names one), and `CheckboxRow`, `TextRow` and `NumberRow` stay controlled when given no value.
