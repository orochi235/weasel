---
"@weasel-js/gestures": minor
"@weasel-js/core": minor
---

Device profile: the kit stops assuming a mouse.

`DeviceProfile` is one object holding pointer coarseness, hover capability and
pixel density, resolved once per `<SceneCanvas>` and published to its subtree.
Two things read it. The chrome-caps rule layer gains `coarsePointer:` and
`canHover:` selectors (plus matching fluent atoms), so consumers can gate
chrome on the device. And every handle size and hit radius — six independent
literal `8`s and one `24` before this — now derives from one base module times
`DeviceProfile.targetScale`, so a coarse pointer gets 14px handles and a 42px
rotation distance without paint and hit-test ever drifting apart. The public
`DEFAULT_HANDLE_SIZE` / `DEFAULT_ROTATION_HANDLE_DISTANCE` constants keep
their unscaled values.

`longPress` is a real gesture kind: spec, event, matcher, and route grammar.
The dispatcher synthesizes it for touch and pen presses held 500ms without
crossing the drag threshold — never for a mouse, and cancelled by movement,
release, cancel, or a second finger landing. An unmatched long-press
re-dispatches as `contextmenu`, so existing `contextMenu` bindings become
reachable by touch with no consumer change.

Also fixes a density bug: `useCanvasSize` read `devicePixelRatio` only inside
its `ResizeObserver` callback, so moving a window to a different-density
display without resizing it left the snapshot stale. Density now comes from
the profile, which watches a re-armed resolution media query.

Override any of it with the new `<SceneCanvas device={{ coarsePointer: true }}>`
prop — for tests, for demos that want touch-sized chrome on a desktop, and for
hybrid devices where the media query guesses wrong.
