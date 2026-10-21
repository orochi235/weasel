---
'@weasel-js/labkit': patch
---

`.dialog()` takes `commit`, a function from the draft to the value Done writes. Done runs it once on an edited draft, and Cancel never runs it, so a body can edit a raw draft that passes through states the saved value never should — a blank tag, a half-typed duplicate name — and clean it once at Done. A dialog closed without an edit still writes nothing.

In development, a dialog body that calls its `setValue` after its dialog has closed now gets a console warning naming the row; the write is dropped, as it always was. Since 1.11.0 a dialog body that keeps its own state and writes it on close, for instance in an unmount cleanup, loses its edits, because Done saves the draft before the body unmounts. Write each edit into the draft as it is made instead.
