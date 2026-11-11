---
"@weasel-js/ui-logic": patch
---

Typeahead composes the query and each label before comparing, so typing `á` lands on a label that spells it `a` followed by a combining acute, as it does on one spelled composed, and typing `a` no longer does.
