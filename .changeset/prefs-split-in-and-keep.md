---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/theme': patch
'@weasel-js/labkit': patch
'@weasel-js/routing': patch
---

Scoped prefs: a pref declares the settings its value is kept separately for, and the store resolves which
value applies. A **pref** is the declaration; a **value** is one stored value of a pref under a scope, the
shared `$else` one included; the **current value** is what a read returns under the current selection.

**Breaking: `PrefScope` changed meaning.** It used to be `{ shown, enabled }`, a node's status under its
parents' conditions. That is now `PrefStatus`, and `PrefScope` is the stored shape of a scoped value,
`{ $by, $in, $else }`, which was `PrefLocus`. The status family is renamed with no aliases: `PREF_SCOPE` is
`PREF_STATUS`, `prefScopeAt` is `prefStatusAt`, `prefScopeIn` is `prefStatusIn`, `prefScopeUnder` is
`prefStatusUnder`, `PrefScopeAtOptions` is `PrefStatusAtOptions`, and `PrefOwner`'s `scope` field is
`status`. The locus family is renamed the same way: `isPrefLocus` is `isPrefScope`, `prefLocusMember` is
`prefScopeValue`, `prefLocusSelectors` is `prefScopeSelectors`, a store's `locus(path)` and `loci()` are
`scope(path)` and `scopes()`, `usePrefsValues`' `loci` and `PrefsForm`'s `loci` prop are `scopes`, and
`PrefsCssSource.locus` and theme's `ThemePrefsSource.locus` are `scope`, and `themePrefsValues` returns
`scopes` where it returned `loci`.

**Breaking: `splitBy` is gone, and so is reader-driven splitting.** A pref lists its selectors in
`scopes: [{ selector, overrides? }]` (`PrefScopeSpec`), outermost first, or with labkit's
`.per(selector, overrides?)`. Scopes are design-time only (decided 2026-11-01): the store's `split` and
`join`, `usePrefsValues`' `split` and `join`, and `PrefsForm`'s `onSplit` and `onJoin` with their Split
and Join buttons are gone. A scoped pref with nothing stored holds one empty scope per selector, so its
first write keeps the current option's own value, where a `splitBy` pref wrote one value for every
option until a reader split it.

A stored value whose shape the declaration does not match still reads: a plain value reads as the
shared value; a value split by a selector the declaration scopes at that level reads as that scope; a
value split by any other selector reads as it always did. The first write to it rebuilds it in the
declared shape, with what it reads under the current selection as the shared value, so only the value
written changes.

**Breaking for stored values:** a scoped value's own values are keyed `$in`, not `$of`. A value stored as
`{ $by, $of }` is read as `$in` by `recordValue`, which every store read and write starts from, so an old
record reads correctly and the next write to it stores `$in`.

- **Closed and open.** A selector given `overrides` is closed: only the options it names keep a value of
  their own, and every other option shares one, stored under `PREF_ELSE` (`$else`). `overrides`
  (`PrefOverrides`) is option names, or option → proposed value. A named option reads its own value once
  written; before that, its proposed value if it has one, else the shared value (decided 2026-11-01: a
  developer adding a proposed value moves what an unwritten option reads, on purpose). A selector given no
  `overrides` is open: an option reads its own value once one is written for it, and the shared value
  until then. With no option named, a selector reads and writes the shared value; whatever reaches no value
  reads `default`.
- **Nesting.** Selectors nest in declaration order. An option's own value ends the descent, and a write
  replaces it, unless it is already split by the next selector in (as a nested `defaultLocus` holds it);
  only the shared value holds the next selector in otherwise.
- **Admitted selectors.** A schema's root lists `admits: [...]` (labkit: `f.schema(…).admits(...)`), the
  selectors its prefs may name that are no pref of it, whose option the app names through the same
  `PrefSelection` it already uses. `store.get(path, { at })` is new beside `{ weights }`. A selector that is
  neither a pref nor admitted is a `checkPrefSplits` problem: `selector "docment" is not admitted by this
  schema (it admits: document, layout)`. `prefsCss` writes no attribute blocks for an admitted selector.
- **Changing a closed list in code** needs nothing done: a stored value of an option no longer named is
  ignored on read and dropped on the pref's next write.
- New helpers: `prefScopesOf(pref)`, `prefOverridesOf(pref, selector)`, `prefOverrideOptions(overrides)`,
  `prefScopedDefault(pref)` and `prefScopeOptionValue(scope, option, absent, overridesOf?)`.
- Where a scoped value is stored (with a document, or in the reader's store keyed by document) is not
  decided here; resolution assumes neither.

`PrefsForm` draws a closed selector as one row per option it names and one row for the shared value,
called `othersLabel` (default `Others`).
