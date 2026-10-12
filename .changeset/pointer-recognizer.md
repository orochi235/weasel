---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Pointer gesture recognition moved out of `useGestureDispatcher`'s effect into `createPointerRecognizer` in `@weasel-js/gestures`. It takes pointer samples and a clock, and emits `InputEvent`s to a sink: the press and the drag it becomes past `DRAG_THRESHOLD_PX`, click, double click, long-press with its contextmenu fallback, and multitouch start, move, end, and tap. It has no DOM, so its timings can be tested with a fake clock.

Additive in `@weasel-js/gestures`: `createPointerRecognizer` and its types, `clickEvents`, `longPressEvents`, `multiTouchGeometry`, `stylusOf`, and the thresholds `LONG_PRESS_MS`, `DOUBLE_CLICK_MAX_MS`, `DOUBLE_CLICK_MAX_PX`, and `TAP_THRESHOLD_PX`. `@weasel-js/routing` still exports `LONG_PRESS_MS`, and adds `multiTouchGestureId` beside `pointerGestureId`.

What a consumer of `useGestureDispatcher` can observe:

- `requestRedraw` follows the dispatcher's own notifications. It now also fires when a gesture in flight is ended or stepped by something other than an input event through the hook: the cancel a tool switch makes, `Dispatcher.cancelAll`, a UI-driven ongoing action. A canceled marquee no longer stays painted until the next redraw.
- A double click is timed on `performance.now()`, as long-press and multitouch tap already were, where it used `Date.now()`.
- The platform that decides whether `mod` means Command is read when the hook mounts, not when the module loads.
- The hover cursor's `keydown`/`keyup` listeners on `window` attach only when the pointer channel is on.
- A click is decided by whether the press crossed the drag threshold. The hook used to also ask whether a `pointer-<id>` handle was in flight; nothing the hook does opens one before the threshold, so only code calling `handleInput` on the hook's dispatcher with its own pointerdown could have seen the difference.

Tool `onActivate` / `onDeactivate` run from their own hook beside the tool registry, in the same order as before: the outgoing tool's `onDeactivate`, the cancel of in-flight gestures, then the incoming tool's `onActivate`.
