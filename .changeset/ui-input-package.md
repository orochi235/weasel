---
"@weasel-js/ui-input": patch
---

`@weasel-js/ui-input` is a new package: what a key or a pointer does to a control, as pure functions.

It holds the rules `@weasel-js/ui-logic` exported until now: arrow steps and `sliderKey`, `sliderAt` and `Span`, list and grid roving, typeahead, `treeKey` and `rowKey`, `selection`, the reorder and drop-gap rules, `edgePush`, `nearestToward`, `tabSort` and `tabStep`, `editEnd`, sweeps and `createStepRepeat`. It depends only on `@weasel-js/quantity`, and exports `Box` for the rules that read one.

<!-- entry: new api -->
