---
"@weasel-js/gestures": patch
"@weasel-js/core": patch
---

One enumeration of the `TargetSpec` forms. `@weasel-js/gestures` now exports
`parseTargetSpec`, which resolves a target spec to a discriminated
`TargetSpecForm` (`body` / `kind` / `affordance` / `predicate`), and the three
places that used to re-derive the string prefixes independently — `matchTarget`,
and `targetRank` / `targetConsultsAffordance` in core's dispatcher matcher —
switch on it exhaustively. Adding a form to `TargetSpec` is now a compile error
at every site that has to handle it.

For consumers: `matchTarget`'s `specTarget` parameter and core's
`targetConsultsAffordance` take `TargetSpec | undefined` instead of `unknown`,
so a target string that is no known form is a type error rather than a silent
no-match. The predicate form has a name, `TargetPredicate`, carrying the
`readsAffordance` flag the exclusive-claim filter reads. Runtime behavior is
unchanged.
