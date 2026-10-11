---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

Types declared in code, placed by `PrefSchemaEditor`.

`prefType(name, leaf)` in `@weasel-js/prefs` returns the leaf with `name` in a new optional `type` field on `PrefBase`. The store, repair, and the forms treat it as the leaf it is; a use site spreads it under what it sets (`{ ...GradientStop, name: 'First stop' }`) or passes it as a list's or a map's `item`.

`PrefSchemaEditor` takes `types`, an array of such leaves (`PrefTypes`):

- The kind picker, in the attributes pane and in Add pref, offers each type by name beside the kinds.
- A leaf made from a type is one row in the structure tree. Its attributes are what its use sets: key, name, description, default, and the shared flags. The default is drawn by the type's own control.
- The literal prints the type's name: `first: { ...GradientStop, name: 'First stop' }`, or the bare `GradientStop` where nothing is set over it. The reader imports the name where the literal is pasted.
- A draft holds a typed leaf as the type's name and what the leaf sets, so code inside a type survives a reload for a leaf the source schema never held. A draft naming a type no longer in `types` opens with that leaf under the type's name, marked "(not registered)" in the kind picker.

Breaking, in the editor's tree: a list's or a map's `item` and a union's variants are no longer rows.

- A list or a map is one row. Its entry is edited in the list's own attributes, under Entry: a picker of the kinds one control edits (`number`, `boolean`, `string`, `enum`, `color`, `paint`, `field`) and the registered types, then the entry's name, its default, and a plain kind's own attributes. A list of lists or of objects needs a type.
- A union is one row and is no longer offered as a kind for a new pref; its variants come from a type. One already in a schema stays, and prints its literal as before.
- An `object` leaf with no type keeps its editable children.
- A change to an entry is reported as the list's `item` attribute changing, where it was a change at `<list>/item`.
- `printSchema(root, types?)` takes the types to print by name.

Also: an `object` leaf's fields no longer run past the edge of a narrow form. The nested control slot kept a 110px minimum inside a column that could be narrower.
