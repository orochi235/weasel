---
'@weasel-js/diagram-formats': patch
---

A Mermaid block diagram's `columns` or span, a gitGraph branch's `order`, or a packet field's bits, written with too many digits to hold is
refused naming its line, where it was read as infinity and written back as `Infinity`, which no reader takes.
