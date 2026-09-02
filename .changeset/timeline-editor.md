---
'@weasel-js/ui': patch
---

Add `<Timeline>`, a keyframe editor for the timeline primitive.

`<Timeline>` is controlled and pure: it takes tracks, a duration and a playhead,
and emits `onInput` during a gesture and `onChange` at its end.
`<AnimatedTimeline handle={h}>` binds it to a live `TimelineHandle`.

A dope sheet edits time and easing for every track kind. A graph mode adds a
value axis, and only for sampled tracks whose values are numbers — a `Pose` has
no honest vertical position, so those rows stay dope rows. `renderKeyEditor`
hands the selected key to the consumer, which supplies a control that knows its
own value type.

A `KeySelection` addresses a track by its index path (`{ trackPath: [2, 0] }`),
so keys inside an expanded nested timeline drag, delete and re-ease like any
other. Times reported to the editor are the addressed track's own; the component
crosses into ruler time to snap and back out to commit.

Dragging a bezier handle previews the curve through `cubicBezierEasing`
directly rather than `resolveEasing`, since a drag writes a fresh set of
control points on every pointermove and `resolveEasing`'s cache is keyed by
them — routing the preview through it would fill core's memo cache with
hundreds of throwaway entries per gesture.
