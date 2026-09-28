---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

`routeToSpec` turns a parsed route into the `GestureSpec` it describes, so a route string can drive `matchSpec` directly. It throws on a route no spec can express: `keyUp`, a key or finger-count wildcard, or a target that is not a target form.

`specificity` now lives in `@weasel-js/gestures` beside the matcher. `@weasel-js/routing` and `@weasel-js/core` still re-export it.

`describeRoute` reads two or more required modifiers as a held chord ("the user holds Mod and Alt and drags anywhere") rather than "the user Mod and Alt-drags anywhere". It also names the modifiers on multi-finger taps, drops and pastes, which it used to leave out; puts the target on wheel routes; and says "long-presses" for `longPress`.
