---
'@weasel-js/svg': patch
---

Adds: `parseSvg` applies the rules inside `@container`, which it skipped whole. A size query is answered against the root `<svg>`, sized by the same viewport `@media` sees, and holds for the root's descendants when the root declares `container-type: size` or `inline-size`, or the `container` shorthand; a named query needs the root to declare that name. `width`, `height`, `inline-size`, `block-size`, `aspect-ratio`, and `orientation` are read in either syntax, an `inline-size` container answers the inline axis alone, and a style query never holds. A document whose root is not a container parses as before.

Making the root the one container, where a caller might have supplied boxes for others, was an agent's judgment.
