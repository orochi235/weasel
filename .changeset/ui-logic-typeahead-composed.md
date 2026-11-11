---
"@weasel-js/ui-logic": patch
---

Typeahead matches a label however its accents are encoded, so typing `á` finds `a` plus a combining acute, and typing `a` does not.

<!-- entry: rank=-5 fix -->
