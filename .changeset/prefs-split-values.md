---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

A leaf's value can be split by another setting. Additive: a leaf lists the `enum` leaves it may be split by in `splitBy`, and its stored value may then be a locus, `{ $by, $of }`, holding one member per option of that leaf, nested for a second one. `store.get` reads the member the selectors are set to, `store.set` writes it, and `store.split`, `store.join`, and `store.locus` turn a value into a locus, back, and read it. `store.get(path, { weights })` folds the members by weight, a number linearly and a color in OKLCH, and every other kind takes its heaviest; `blends` in the open options gives a kind its own. `store.values({ at })` is the tree under a stated choice of selectors, `store.set(path, value, { at })` writes the member such a choice names, and `store.loci()` is every split leaf's locus by path. A selector changing is reported to subscribers as a change to every leaf split by it. `@weasel-js/prefs` now depends on `@weasel-js/paint`, for the color blend.

`PrefsForm` draws and edits split values. Additive: given `loci`, `onSplit`, `onJoin`, and `onChangeAt`, which `usePrefsValues` now returns as `loci`, `split`, `join`, and `setAt`, a leaf that lists `splitBy` marks the option each selector is set to beside its name and opens, under its row, to its own control for every option and to a Split or a Join for each selector. `defaultSplitOpen` names the rows open at first. A row that offers any of this is a group and no `<label>`, so an app renderer's control on such a leaf has to carry its own accessible name.
