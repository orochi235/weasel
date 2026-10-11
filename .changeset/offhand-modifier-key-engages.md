---
'@weasel-js/routing': patch
---

A tool held on a modifier key (`eligibility: { offhand: 'alt' }`, or `'shift'`, `'ctrl'`, `'meta'`) never engaged: the modifier's own keydown reports its flag set, and the binding `buildToolOffhandBindings` wrote forbade every modifier. A modifier trigger now engages on its keydown whichever other modifiers are down. A trigger that is not a modifier (`'space'`, `'o'`) still engages only with no modifier held.
