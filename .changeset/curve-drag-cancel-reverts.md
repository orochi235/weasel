---
'@weasel-js/ui': patch
---

A canceled anchor drag in `CurveEditor` or a `createFunctionLayer` layer (a `pointercancel`, or a second press on the same pointer) left the points where the drag had put them, including a point a click on the curve had just inserted, with no `onChange`. The points now return to where they were before the press, and `onInput` reports them.
