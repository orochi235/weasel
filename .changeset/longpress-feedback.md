---
"@weasel-js/core": patch
"@weasel-js/routing": patch
---

A touch or pen long-press now shows that it is registering. While a press is
held and some binding would fire on it — a `longPress` binding, or a
`contextMenu` one through the fallback — `<SceneCanvas>` draws a ring in the
theme accent that fills around the press point over the hold. It appears
after 120ms, so a tap shows nothing, and disappears when the press fires,
moves past the drag threshold, lifts or is canceled. Under
`prefers-reduced-motion` it is a static ring. A press nothing is bound to
shows nothing. When the long-press fires and a binding handles it, touch and
pen pointers get a short `navigator.vibrate` pulse where the API exists.

Additive. `<SceneCanvas longPress={{ feedback, haptics, duration }}>` controls
it: `feedback: false` turns the ring off, a `SurfaceContribution` replaces it,
`haptics: false` turns off the pulse, and `duration` sets the hold time
(default `LONG_PRESS_MS`, 500ms). Under a `tools` takeover, add
`createLongPressFeedbackContribution()` to your own ambient entries.

The press being held is observable state: the `longPress` dep is a
`LongPressState` whose `get()` returns where the press landed (client,
canvas-local and world), the view it routed to, when it started, its duration
and whether it is `armed`, and whose `progress()` returns 0→1.
`useGestureDispatcher` takes the same controls as `longPress: { state,
haptics, duration }`, with `createLongPressStore()` making the state. New
exports: `createLongPressStore`, `LONG_PRESS_MS`, `PendingLongPress`,
`LongPressState`, `LongPressStore`, `LongPressOptions`,
`createLongPressFeedbackContribution`, `LongPressFeedbackOptions`,
`LONG_PRESS_FEEDBACK_ID`, `SceneCanvasLongPress`.
