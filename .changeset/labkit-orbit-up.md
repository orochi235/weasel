---
'@weasel-js/labkit': minor
---

An orbit trial pans and dollies a scene whose up is not +y the right way, once it declares `orbit: { up }`.

`<Orbit up>` takes the same axis for a camera outside a trial. Use the scene's `World3d.up`, and pass it to `cameraViewProjection` when drawing.

<!-- entry: api fix -->
