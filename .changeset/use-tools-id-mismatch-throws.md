---
'@weasel-js/routing': patch
---

`useTools` throws when a `registry` key differs from its tool's `id`, or when two different tool objects share an id.

Calls that used to pass silently now throw: a tool keyed under another name could never become active, and a second tool with a taken id quietly replaced the first. The same tool object in both `registry` and `ambient` still merges.

<!-- entry: fix behavior -->
