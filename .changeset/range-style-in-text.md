---
'@weasel-js/text': patch
'@weasel-js/registry': patch
'@weasel-js/core': patch
---

text: the run algebra lives here now: `styleAtRange`, `applyStyleToRange`, `patchRangeStyle`, `effectiveRangeStyle`, `rangeWeight`, `setFlagOverRange`, `nodeHasFlag`, and `unboldPatch`, with the `RangeStyle`, `RunStylePatch`, `StyleKey`, `FlagKey`, and `SetFlagResult` types. `runsCarryStyling` and `supersededKey` are exported beside them. None of them needed a scene. The `MIXED` sentinel and its `Mixed` type moved to `@weasel-js/registry`, and text exports them too. `@weasel-js/core` still exports every name it did before.
