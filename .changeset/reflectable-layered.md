---
'@weasel-js/registry': minor
---

A registry whose registrants are meant to stack can opt out of the clash warning with `createReflectable({ layered: true })`.

In a layered store every push over a live registrant is an override, so none draws the development clash warning. Use it where stacking is the registry's contract, as with a source that composes over the one beneath it; elsewhere, mark the default with `fallback` or push the override at a higher `rank`.

<!-- entry: api -->
