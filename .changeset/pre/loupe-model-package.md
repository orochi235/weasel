---
"@weasel-js/loupe": patch
"@weasel-js/hud": patch
---

Split the loupe's model out of its painter

The loupe was a WebGL widget all the way down: `createLoupe` held both the
state a magnifier has — where it is aimed, how far it magnifies, whether it is
showing a re-render or actual pixels, what colour it is over — and the code
that draws that into a HUD window. None of the first half is about GL, and a
surface that is not a WebGL canvas could not have any of it.

`@weasel-js/loupe` is the model on its own. It asks a `LoupeSurface` five
questions — where is the lens, does it cover this point, what colour is here,
can anyone still see it, and please repaint — and answers with aim, factor,
mode, colour and picking, including the freeze rule that keeps a stationary
lens' own borders reachable and the refusal to report a lens' chrome as
artwork. The pure geometry (`loupeInnerView`, `loupeSourcePoint`) moved with
it.

`createLoupe`'s API is unchanged; it is now a painter over that model, and
`@weasel-js/hud` re-exports `loupeInnerView` from its new home. A painter for
a surface that is not a WebGL canvas no longer has to reimplement a magnifier
to exist.
