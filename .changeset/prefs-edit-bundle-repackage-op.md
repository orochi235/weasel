---
'@weasel-js/prefs': major
---

A `weasel-bundles/1` export marks a bundle that changed package with `op: 'repackage'`.

`op: 'move'` now always means a member moved between bundles, an included bundle as well.
The document's `bundles` now also lists the package holding the bundles an included bundle moved between.

```ts
// before: a package move, and an included bundle moved between bundles, both read
{ op: 'move', kind: 'bundle', id, from, to }
// after: a package move
{ op: 'repackage', kind: 'bundle', id, from: oldPackage, to: newPackage }
```

<!-- entry: breaking data fix -->
