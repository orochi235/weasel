---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/gestures": patch
"@weasel-js/geom": patch
"@weasel-js/svg": patch
"@weasel-js/paint": patch
"@weasel-js/font": patch
"@weasel-js/text": patch
"@weasel-js/history": patch
"@weasel-js/kernel3d": patch
"@weasel-js/diagram": patch
"@weasel-js/labkit": patch
"@weasel-js/theme": patch
"@weasel-js/ui": patch
---

Close the places where two tiers spelled one concept differently.

**A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
the world `drag.delta` and then divided by the zoom anyway, panning at
1/scale² for any event source that supplies no `clientX`/`clientY` — which is
every synthesized `InputEvent`, since those fields are optional. It now
reconstructs the client delta exactly, by undoing each end of the world delta
against the view that produced it.

**Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
`worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
lands at the origin. All three now also carry `clientX`/`clientY`, so a
context-menu action can finally read `ctx.screen` — the case that surface was
added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
affine in a file that imports from both. `translatePolygonInPlace` is
gone: it was the one sanctioned writer into a committed path's coord buffer,
documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
`useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
was declared and never written by anything; it is gone.

**Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
matching the reason `geom/3d` already gives for its own. `History.entries()`
returns `readonly` arrays, which is what its docstring always asked callers to
assume.

**One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
`Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
`ScreenLength` rather than that union written out again. `kernel3d`'s
`ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.

**Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
`@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
`@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
name the repack between the GL layout and geom's.

**Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
rotated no longer reports itself unrotated to `useResize` and to diagram's port
placement. `ToolDef.capabilities` is documented as reaching
`Tool.eligibility.capabilities`, which is where it actually goes — following
the old text gave `undefined`, and `eligibleForMode` turns that into a tool
that vanishes from every mode. `MultitouchEvent.centroid` is documented as
canvas-local, which is what the dispatcher hands over. `drag.points` is a
snapshot on `onEnd` rather than the dispatcher's live accumulator.

`tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
`loupe`, which it had never included.
