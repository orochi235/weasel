---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

A `kindOf` target predicate must now declare whether it reads the affordance hit: `TargetPredicate.readsAffordance` is required, and the exclusive-claim filter reads it and no longer guesses. Build one with the new `hitPredicate((hit, bodyTarget) => …)` or `bodyPredicate((bodyTarget) => …)`, exported from `@weasel-js/gestures` and `@weasel-js/core`. This is a breaking change: a bare function as `kindOf` is a type error, and one passed from untyped code counts as not reading the hit, so an exclusive claim bars its binding.
