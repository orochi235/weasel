---
'@weasel-js/geom': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Path edit has a brush for deleting anchors. Alt-drag anywhere while a path is being edited, and every anchor the round brush passes over is deleted, each gap refit to the shape it replaces exactly as the Delete key refits one (`deleteAnchorsAt`). The path previews without them during the stroke and commits as one undo step on release; Escape cancels it. The brush is 12 screen pixels in radius at every zoom; a binding's `radiusPx` param changes it, and a thunked param can resize it mid-stroke. The action is `brushDeleteAnchors`, in the standard actions and the `paths` feature preset, and `ActionParamSchema` types its `radiusPx` for `<SceneCanvas tune>`. Alt-click still inserts an anchor.

`@weasel-js/routing` adds a `brush` overlay variant: `{ kind: 'brush', points, radiusPx }`, the world path a round brush has taken and its radius on screen. `<SceneCanvas>`'s dispatcher overlay paints it as the swept band and a rim at the brush's position, gated by the `action.brush` chrome-caps id.

`@weasel-js/geom` adds `anchorsUnderBrush(set, from, to, { radiusPx, scale })`: the flat indices of the anchors within `radiusPx` of a segment, measured on screen.
