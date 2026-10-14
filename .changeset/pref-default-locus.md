---
'@weasel-js/prefs': patch
---

A leaf's default may be split. `defaultLocus` on a leaf that lists `splitBy` is what it holds while nothing is stored for it: `store.get` reads the member the selectors name, `store.locus` and `store.loci` report it, a first `set` writes into the member and keeps the others, and `reset` returns to it. `default` stays what a member it leaves out reads as. A `defaultLocus` split by a selector the leaf's `splitBy` does not list is ignored, and the store warns of it when it opens (`checkPrefSplits` code `default`).

A store over a schema whose keys are not literal, as one built at run time has them, now types every value as `unknown`. It typed them as `never`, so no `set` on such a store compiled without a cast.
