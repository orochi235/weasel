---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Separate a text node's content from its typography, and draw depth only where a label marks it

The text schema put `data.text` in a group named Text, so the section read
TEXT and the row inside it read Text — one word nested in itself — and the
style groups below it read as fields of the content string rather than as its
siblings. Content is its own section now, with the field full-width because
the section already names it.

A group with an empty `name` renders no heading. That already worked for
sections and is now documented on `ToolPrefGroup`, since it is how a schema
says "this group organises, it doesn't name": `Character` and `Paragraph`
carry the labels, and a `Typography` heading over them named nothing new.
It stays opt-in rather than a rule that rolls up any all-group parent —
a `Border` over `Top` / `Right` / `Bottom` needs its name.

Rows under a suppressed heading no longer indent. Depth drawn without a
visible parent put `Character` a level deeper than `Content` while being its
peer, which is the panel's own tree discipline broken by its own hand.
