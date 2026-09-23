---
'@weasel-js/ui': patch
---

`PropertyPanel` takes `actions` and `selectable`. `actions` puts controls on the trailing edge of the title row, outside the heading, so a switch or a clear button no longer has to be packed inside the `title` node, where it took the title's type and joined its accessible name. `selectable` lets text in the panel be selected and copied, reaching past the `user-select: none` every member of the family sets; a `debug` panel is selectable unless given `selectable={false}`, since the ids and traces it shows are there to be copied. Other panels behave as before.
