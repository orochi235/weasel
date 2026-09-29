---
"@weasel-js/core": patch
"@weasel-js/font": patch
"@weasel-js/labkit": patch
---

`warmRender` can load just what one render needs. Pass it the render,
`warmRender({ render: args })` with the args `renderSceneToPixels` or
`RasterSession.render` will take, or `{ commands }` already built. It builds
the commands the way the render does and loads only the font faces their text
is set in and the paint kinds they name. A capture no longer loads the mesh
chunk when it draws no mesh, and no longer fails because some unrelated lazy
font failed to load. It still rejects when a face the render needs fails.
`families` and `paintKinds` still override, and `warmRender()` with no render
still loads everything.

labkit's raster capture and the RenderToPixels and DebugOverlay demos now warm
only what they are about to render.

Additive: core exports `renderNeeds(commands)`, which returns the fonts and
paint kinds a command list draws with, and `debugSnapshotArgs(args)`, which
returns the `renderSceneToPixels` args behind `renderDebugSnapshot`.
`warmFonts` also takes a `FontRequest` (`{ family, weight?, style? }`, exported
from `@weasel-js/font` and core). A request loads what resolving that one
variant draws with: the exact variant, or the whole family when that variant
was never registered, the substitute family when the policy would swap one in,
and the variant's outline face. Unlike a bare family name, a request for a
family nothing registered resolves instead of rejecting.
