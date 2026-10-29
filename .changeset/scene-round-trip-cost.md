---
'@weasel-js/core': patch
'@weasel-js/history': patch
'@weasel-js/registry': patch
---

A scene's `add` and `remove` cost less again: a history builds the step it reports only when something observes its steps, and expands caused ops only when an op has them; a remove narrows an empty selection without building node gates; an empty pose-removal drain returns early; and a `kit:add` payload takes its optional fields by assignment. An emitter with no listeners now returns from `emit` without copying its listener set.
