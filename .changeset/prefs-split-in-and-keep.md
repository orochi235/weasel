---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/theme': patch
'@weasel-js/labkit': patch
'@weasel-js/routing': patch
---

**Breaking:** what a node's conditions come to, `{ shown, enabled }`, is now called its status, freeing
"scope" for scoped prefs. `PrefScope` is `PrefStatus`, `PREF_SCOPE` is `PREF_STATUS`, `prefScopeAt`
is `prefStatusAt`, `prefScopeIn` is `prefStatusIn`, `prefScopeUnder` is `prefStatusUnder`,
`PrefScopeAtOptions` is `PrefStatusAtOptions`, and `PrefOwner`'s `scope` field is `status`. The old
names are gone, with no aliases.

**Breaking for stored data:** a split value's members are now keyed `$in`, not `$of`:
`{ $by: 'mode', $in: { dark: 4, light: 8 } }`. A value stored as `{ $by, $of }` is read as `$in` by
`recordValue`, which every store read and write starts from, so an old record reads correctly and the
next write to it stores `$in`. Code that builds or reads a `PrefLocus` itself renames the key.

A leaf may now be kept separately per selector, always, rather than split by the reader. Every name
starting `tbd`/`TBD_` is a placeholder until the feature is named, and will be renamed.

- **Schema.** `per: [{ selector, overrides? }, …]` on a leaf, outermost first. `selector` is a
  selector's path. With `overrides`, the selector is **closed**: only the options it names keep their
  own value, and every other option shares one. `overrides` is either option names or option →
  proposed value. Without `overrides`, the selector is **open**: an option gets its own value once one
  is written for it. A leaf has `per` or `splitBy`, not both.
- **Stored value.** A `PrefLocus` with one more member, the shared one, under `TBD_REST_KEY`
  (now `$else`): `{ $by: 'mode', $in: { types: 0 }, $else: { $by: 'layout', $in: { explorer: 0.3 }, $else: 1.1 } }`.
  With nothing stored, the leaf holds one empty locus per entry, each holding the next as its shared
  member. `defaultLocus`, where given, still wins.
- **Reading.** An option a closed selector leaves out reads the shared member. An option it names
  reads its own value once written; before that, its proposed value if it has one, else the shared
  member (decided 2026-11-01; a developer adding a proposed value moves what an unwritten option
  reads, on purpose). Under an open selector an option reads its own value where it has one, else the
  shared member. With no option named, a selector reads the shared member. Whatever reaches nothing
  reads `default`.
- **Writing** goes where the read comes from, except that an option allowed its own value gets one
  once written. With no option named, a write sets the shared member: what every untouched option
  reads.
- **Nesting.** Entries nest in declaration order. An option's own value ends the descent: it is not
  split further by an inner entry. Only the shared member holds the next entry.
- **Selectors that are no leaf.** A `selector` naming no leaf of the schema takes whatever options
  the app names, through the same `PrefSelection` it already uses. `store.get(path, { at })` is new
  beside `{ weights }`; `store.set(path, value, { at })` and `store.values({ at })` accept any option
  of such a selector. Nothing names one in the store's own selection, so an ordinary read gets the
  shared member. `prefsCss` writes no attribute blocks for one.
- **Changing a closed list in code** needs nothing done: an option added reads as above, and a
  stored member of an option no longer named is ignored on read and dropped on the leaf's next write.
- **Existing split values** are the open case by a leaf selector: `splitBy` leaves read and write
  exactly as before. `store.split` and `store.join` still apply only to `splitBy`.
- Where a kept value is stored (with a document, or in the reader's store keyed by document) is not
  decided here; resolution assumes neither.

`PrefsForm`'s split rows draw a closed selector as one row per option it names and one `Others` row
that edits the shared member, and offer neither split nor join for a `per` leaf. labkit's config
nodes take `.per(selector, overrides?)`, chained outermost first.
