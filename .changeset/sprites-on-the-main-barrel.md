---
'@weasel-js/core': patch
---

Export `SpritesDrawCommand` and `SPRITE_STRIDE` from the main barrel.

They shipped in 1.4.1 reachable only from the `@weasel-js/core/renderer` subpath, because `src/index.ts` re-exports the renderer by name rather than with a star and only the renderer's own barrel was updated. Every other `DrawCommand` variant is nameable from `@weasel-js/core`, and a consumer cannot pack a sprite run without the stride constant.

`index.barrel.test.ts` now asserts that every `*DrawCommand` the renderer barrel names is named on the main barrel too, so the next variant cannot land half-exported.
