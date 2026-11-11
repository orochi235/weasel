---
"@weasel-js/guides": patch
---

Undoing a guide add or remove puts the guide list back as it was. Undoing `addGuideOp` over an id the store already held restores the guide that was there, and undoing `removeGuideOp` puts the guide back at its place in the list.

`GuideStore` now requires `getGuides()`, which `createRulers` already required, and `addGuide` takes an optional `index` for a new guide; `useGuides` provides both. A custom store must implement `getGuides()`.

<!-- entry: breaking api fix -->
