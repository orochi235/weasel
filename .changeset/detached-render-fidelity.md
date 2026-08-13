---
"@weasel-js/core": patch
---

Detached scene renders honor pose rotation and per-node alpha.

Rotation and the per-id alpha multiplier were applied by `buildSceneLayer`,
the main canvas's scene walk. Every other way of painting a scene —
`<SceneViewCanvas>`, `<MinimapCanvas>`, and `renderSceneToPixels` — goes
through `buildSceneViewCommands` instead, which applied neither. A rotated
node came out upright in a minimap, a thumbnail, or a print export, and a
scene dimmed on screen exported at full strength.

Both wraps now live in one helper that both scene walks call, so the detached
renders match the canvas. Rotation needs nothing from the caller — it comes
off the pose. Dimming does: `alphaFor` is a new optional prop on
`<SceneViewCanvas>` and `<MinimapCanvas>`, and a new argument to
`renderSceneToCanvas`, `renderSceneToPixels`, `planPixelRender`, and
`buildSceneViewCommands`. Pass the same function `<SceneCanvas>` gets.

If you supply a `drawOne` to one of these that rotates its own output, it will
now rotate twice — emit unrotated geometry and let the pose drive it, which is
what the main canvas has always required.
