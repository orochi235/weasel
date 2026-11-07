---
'@weasel-js/ui': patch
---

`domFocusScope` leaves out of its tab order a control that a disabled `<fieldset>` disables, as the browser's Tab does. It read only the control's own `disabled`, so `moveFocus` could name a control that never took focus.
