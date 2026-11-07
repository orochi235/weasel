---
"@weasel-js/gestures": patch
---

`isEditableTarget` now counts only the `<input>` types that take typed text (text, search, email, url, tel, password, number and the date and time types), plus textarea and contenteditable. Focus on a checkbox, radio, button, range, color or file input, such as a React Aria `Switch`'s hidden checkbox, no longer stops Cmd+Z and other bound keys. `focusedControlOwnsKey` now also gives a range input its arrow, Home, End and Page keys and a radio its arrows, so those still move the control rather than the canvas.
