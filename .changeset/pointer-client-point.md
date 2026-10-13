---
'@weasel-js/core': patch
---

A behavior's `ctx.pointer.clientX` / `clientY` are the client point of the event, where every default action used to fill them with `0`. Move, resize, rotate, insert, and lasso-select read them from `InvocationCtx.screen`.

Breaking for a behavior that read them as numbers: `PointerState.clientX` and `clientY` are optional now, absent when the event carried no client point (a keystroke, a UI-driven trigger, a synthetic probe). Chosen on an agent's judgment over removing the fields.
