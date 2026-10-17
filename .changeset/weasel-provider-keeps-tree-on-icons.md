---
'@weasel-js/core': patch
---

`WeaselProvider` no longer remounts everything below it when `icons` or `iconVariants` is set or cleared. It used to swap the component above its tree between a registry of its own and one that joins the registry in scope; one component now makes that choice inside, so the tree keeps its state. Clearing both props releases the tables they registered and joins the registry in scope again.
