---
"@weasel-js/core": minor
---

Publish the sub-packages. `@weasel-js/geom`, `/gestures`, `/history`, `/modes`,
`/svg`, `/d3`, `/theme`, `/ui`, and `/hud` are now real published packages
rather than source inlined into `@weasel-js/core`'s bundle.

For consumers of `@weasel-js/core` this is close to transparent — the public
API is unchanged and the sub-packages install as dependencies. It matters if
you were using any of those packages' types indirectly, or if you want to
depend on one alone: the geometry kernel (`@weasel-js/geom`) and the headless
undo engine (`@weasel-js/history`) are dependency-free and usable without the
React canvas.

The change also removes a latent duplicate-module hazard: while the packages
were inlined, a consumer holding both `@weasel-js/core` and one of them would
have gotten two copies of it.

`@weasel-js/ui` ships its styles as one bundled stylesheet — import
`@weasel-js/ui/style.css`. `@weasel-js/theme` exposes its tokens at
`@weasel-js/theme/tokens.css`.
