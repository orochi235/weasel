---
'@weasel-js/registry': patch
---

A child extension registry registering the value its parent already resolves an id to changes nothing: it follows the parent's later replacement, and keeps the id if the parent releases it.

<!-- entry: fix -->
