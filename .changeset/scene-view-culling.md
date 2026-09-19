---
'@weasel-js/core': patch
---

The scene slot can skip what the view cannot see. Pass
`layers={{ scene: { drawOne: defaultDrawOne, cull: true } }}` to
`<SceneCanvas>` (or `cull: true` on a `<Canvas>` scene slot) and commands that
cannot reach the view are dropped before they reach the renderer, so an
off-screen node no longer costs tessellation, upload or a draw.

The cull is conservative: paths are bounded by their control points plus the
farthest their stroke can reach, rotated content by the box around its
corners, and text, custom shaders and anything under an effect are always
kept. It is off by default because it makes the scene layer's output depend on
the view, which matters only if you cache or re-display that output under a
different camera.

The same pass is exported as `cullDrawCommands(cmds, transform, rect)` for
custom layers. This adds API; nothing existing changes.
