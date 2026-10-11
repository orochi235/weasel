---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A new pref kind, `alias`: a leaf that shows another leaf. Its row draws that leaf's control and reads and writes that leaf's value, so one setting can sit on two pages over a single stored value.

```ts
play: { name: 'Play', children: { grid: { kind: 'alias', name: '', description: '', default: undefined, of: 'view.grid' } } }
```

`of` is the path the shown leaf's value lives at. `name` and `description` left empty are the target's; given, they rename the row at the alias's place only. An alias holds no value: a store neither reads nor writes one, `prefHoldsValue` answers false for it, and its path is not a `PrefPath`. `@weasel-js/prefs` adds `PrefAlias`, `prefAliasTarget` (which follows an alias of an alias and answers nothing for a missing target or a loop), `prefAliasedLeaf`, and `prefLeafAt`.

`PrefsForm` and labkit's `ControlPanel` draw an alias as its target's row; an alias of nothing draws a note saying so, in place. In labkit `f.alias('view.grid')` builds one, and its own `.section`, `.showIf`, `.label`, and `.describe` place and name it. `SelectionPanel` does not draw aliases yet.

`PrefSchemaEditor` lists `alias` among the kinds, with an `Of` picker, and makes one by a drag with Alt and Cmd (or Ctrl) held. Moving or renaming a pref, or a group above it, rewrites the aliases that name it.

This adds a member to `PrefKind`, so a `switch` over a built-in leaf's kind that ends in a `never` guard stops compiling until it handles `alias`.
