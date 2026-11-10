---
'@weasel-js/prefs': patch
---

A schema child keyed `__proto__` survives `orderPrefGroup`, `visiblePrefSubtree`, `filterPrefSubtree`, and `applyPrefConditions` instead of vanishing from the copy they make, and a selector at such a path keeps its option in a store's reads.
