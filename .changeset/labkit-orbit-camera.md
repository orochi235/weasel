---
"@weasel-js/labkit": patch
"@weasel-js/kernel3d": patch
"@weasel-js/routing": patch
---

labkit gets a 3D orbit camera as an instrument capability, the sibling of
`canvas` and `stage`.

**`orbit`.** An instrument declaring `orbit: { initialView, limits, gestures,
overlay }` gets a trial-owned kernel3d `Camera3d` in the trial's `view`, so the
camera persists, Clone copies it and Reset restores it. A drag turns it,
Shift+drag pans its target, the wheel and both pinches dolly, and a double
click goes home, all through the gesture dispatcher. `useTrialOrbit()` reads and
moves it from anywhere in the trial, and `as3DView` reads it off a stored view.
`<Orbit>` is exported for use outside a lab. `orbit` beside `canvas` or `stage`
throws. labkit now depends on `@weasel-js/kernel3d`.

**One camera surface for 2D and 3D.** The lab's zoom controls drive an orbit as
they drive a 2D camera, reading its zoom as home distance over distance, and
`RenderContext.trial.zoom` means the same. `CameraGestures` serves every camera
and gains `home`, a double click back to where the camera opened — on by
default for an orbit, opt-in for a 2D camera through `onHome` on `<Stage>`,
`<CanvasStack>` and `<CameraInput>`.

**Breaking.** `CameraGestures.pan` is renamed `drag`, since on an orbit a drag
turns rather than pans. `CameraView` gains a required `zoomOf(view)`, so a
`CameraView` built by hand needs one. `useViewPlacement` returns `{ place, home }`
rather than the placement function.

**kernel3d.** `orbitBy` and `dollyBy` take an `OrbitLimits`, and `clampCamera`
applies one; distance limits were fixed at 0.5..500, which is the default now.
`panBy` and the `camera.pan`, `camera.pinchDolly` and `camera.home` actions are
new, and `Camera3dDep` takes optional `limits()` and `home()`. `camera.dolly`
now binds the ctrl+wheel a trackpad pinch arrives as, which used to zoom the
page, and Safari's pinch. `useOrbitTool` binds Shift+drag to `camera.pan`.

**routing.** A wheel reported in lines or pages — Firefox's mouse wheel — is
converted to pixels before it reaches an action, so per-pixel rates are no
longer about a sixteenth as fast there.

**Icons.** labkit draws its glyphs from the app's icon registry, which it does
not mount: a lab with none draws placeholders and warns. Mount
`<IconRegistryProvider icons={kitIcons}>` (`@weasel-js/ui/kit-icons`) or the
trimmed `virtual:weasel-icons` set at the app root; labkit's examples now do.
