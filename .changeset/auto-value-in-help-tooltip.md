---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

A row's ⓘ tooltip can end with what the row reads when it is auto. `PropertyRow`, `PropertyField`, `DialogRow`, and `PropertyHelp` take a new `autoValue` prop; given, the tooltip's last line is the word `auto`, drawn as an auto row's readout draws it, followed by the value. A row with an `autoValue` and no `description` gets the ⓘ for that line alone.

labkit's `ControlPanel` passes it for every leaf that has an `.auto()` resolver and is not `.manual()`, whether the row is pinned or auto: the value is what the resolver gives with that row unpinned beside the rows that already are.
