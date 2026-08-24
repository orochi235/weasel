---
'@weasel-js/core': patch
---

Export `resolveParams` from the package entry

`BindingOpts.params` may be a thunk, and its own doc comment tells callers to
read it "via `resolveParams(opts?.params)`" — but that helper was defined and
used internally, never re-exported. Every consumer writing a parametric
`key-held` (or other) binding was stuck reimplementing the thunk check by
hand. `resolveParams` is now importable from `@weasel-js/core`.
