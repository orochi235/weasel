---
'@weasel-js/font': patch
'@weasel-js/core': patch
---

`@weasel-js/font`'s six reset seams — `_resetFontRegistryForTests`,
`_resetFallbackForTests`, `_getPagesForTests`, `_resetDynamicFontsForTests`,
`__setGlyphRasterizerForTests` and `_resetFontOutlinesForTests` — are no longer
exported from the package barrel. They now live at a new
`@weasel-js/font/test-seams` entry point.

Nothing loses the ability to reach them. They exist because font registration,
the fallback policy, the dynamic atlas and the outline registry are global
module state that changes what renders, so a test in another package that sets
one has to be able to put it back — which is why they were on the barrel in the
first place. A named test-seam entry serves that need without an application
finding a `_resetFontOutlinesForTests` by autocompleting the barrel. Both
entries share one chunk, so the registries remain single instances.

This is a breaking change for anything importing those six names from
`@weasel-js/font`; the import specifier is the only edit.

`evaluateEnabled` in `@weasel-js/core` is now marked `@experimental` at its
definition. An `@internal` block intended for it had come detached and sat above
three unrelated constants, so the function read as undocumented public API while
a stale marker said otherwise. It is genuinely public — `@weasel-js/ui`'s
`ActionBar` calls it — and `@experimental` matches the rest of the `enabled`
predicate surface.
