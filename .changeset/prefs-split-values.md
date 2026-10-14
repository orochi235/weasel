---
'@weasel-js/prefs': patch
---

A leaf's value can be split by another setting. Additive: a leaf lists the `enum` leaves it may be split by in `splitBy`, and its stored value may then be a locus, `{ $by, $of }`, holding one member per option of that leaf, nested for a second one. `store.get` reads the member the selectors are set to, `store.set` writes it, and `store.split`, `store.join`, and `store.locus` turn a value into a locus, back, and read it. `store.get(path, { weights })` folds the members by weight, a number linearly and a color in OKLCH, and every other kind takes its heaviest; `blends` in the open options gives a kind its own. `store.values({ at })` is the tree under a stated choice of selectors. A selector changing is reported to subscribers as a change to every leaf split by it. `@weasel-js/prefs` now depends on `@weasel-js/paint`, for the color blend.
