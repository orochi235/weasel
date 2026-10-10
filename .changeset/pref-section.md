---
"@weasel-js/prefs": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

**Breaking change to the schema types.** A pref schema's branch node was one type, `PrefGroup`, read two ways: the prefs store and `PrefsForm` took a group's key as a path segment, and a node's property schema took it as a heading over leaves whose own keys were whole node paths. There are now two types, and a schema of one is a type error where the other is read.

`PrefGroup` keeps `children` and the nested reading: `view` > `gridDensity` is the leaf at `view.gridDensity`. The new `PrefSection` holds `members`, and its key adds nothing to a path. `NodePropertiesEntry.schema` is a `PrefSection`, and so is a heading inside a `PrefObject`'s `children`.

What to rewrite:

- A node property schema passed to `createNodeProperties().register`, `<SceneCanvas>`, or `<SelectionPanel>`: rename `children` to `members` on the root and on every group inside it. An `object` leaf keeps `children`.
- A group nested inside an `object` leaf's `children`, in any schema: rename its `children` to `members`.
- Code that walks a node property schema reads `.members`. `prefSectionLeaves(members)` returns every leaf under a section's `members` or an object leaf's `children` by its own key, and `isPrefSection` tells a section from a group.
- `prefFieldChoices(schema)` no longer takes a second argument. It reads the path rule off the schema it is given, so pass a `PrefSection` where `false` was passed.
- `SelectionPanel`'s `isGroup` is gone; use `isPrefLeaf`.

A preferences schema and a tool's `options` are unchanged unless they nest a group inside an `object` leaf.

`PrefSchemaEditor` edits the sections inside an `object` leaf: it adds one where it used to add a group, prints it with `members`, and refuses to move a group under an object leaf or a section out from under one.
