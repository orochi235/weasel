---
'@weasel-js/labkit': patch
---

labkit's declarations now import the weasel packages it depends on (`@weasel-js/ui`,
`@weasel-js/quantity`, `@weasel-js/loupe`, `@weasel-js/svg`) instead of inlining copies of
their types. The inlined copies included quantity's `Display` and `UnitTable`, which labkit never
re-exported, so a consumer whose inferred types reached them could get TS2742. The JavaScript
still bundles those packages; only the `.d.ts` files changed, and the types they name are the
same ones those packages publish.
