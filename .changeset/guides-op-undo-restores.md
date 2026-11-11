---
"@weasel-js/guides": patch
---

Undoing `addGuideOp` over an id the store already held puts back the guide that was there, rather than removing the id; undoing `removeGuideOp` puts the guide back at the place in the list it held, rather than at the end. `GuideStore` now asks for `getGuides()`, which `createRulers` already required, and `addGuide` takes an optional `index` for a new guide; `useGuides` provides both.
