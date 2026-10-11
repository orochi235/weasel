---
'@weasel-js/forge': patch
---

The story index and the loaders now agree on what a story is and what it is titled. A CSF story takes the title its index entry has, as a native one already did, so a meta `title` the index cannot read (an imported constant, a template with an expression) no longer gives the loaded story a second id; the index does now read a title held in a `const` of the same file or written as a plain template. In a native file, an exported call is listed only when it calls `story`, directly or through a function of that file that returns the call, so `export const rows = makeRows()` is no longer a story that faults when opened. `forgeTest` resolves a `meta` or `story` that reaches forge through a project helper, as the workshop does. `loadCsfModule` and `runStory` take the index title where they took an auto title, which is breaking for a caller that relied on the meta's own title winning.
