---
'@weasel-js/routing': patch
'@weasel-js/gestures': patch
---

Lifting one finger of a pinch committed every gesture in flight, so a drag started by another finger ended mid-drag and a held Space released its tool. A three-finger gesture whose fingers lifted one at a time was never ended at all, and neither was a pinch one of whose pointers was canceled. `useGestureDispatcher` now ends the multitouch gesture alone, on the first finger to lift (`'commit'`) or be canceled (`'cancel'`). `MultiTouchEvent` gains an optional `end` field, which is how the dispatcher is told.
