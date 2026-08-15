---
'@weasel-js/ui': patch
---

`ActionsBar` and `OptionsBar` now share one stylesheet,
`components/segmentedControl.module.css`, instead of keeping byte-identical
188-line copies each. The two look the same and differ only in what a segment
does, so the styles had two places to stay in sync and no mechanism keeping
them there.

No visual or API change: same rules, same class names, same generated output.
The merged stylesheet is the same size either way — identical content already
collapsed to a single scoped hash — so this buys maintainability, not payload.

`ToggleBar` keeps its own copy. It carries the same base plus a `segmentMixed`
third state and a deliberately different `variant_minimal`, and folding those
together needs a decision about whether the three bars are one component.
