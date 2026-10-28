---
'@weasel-js/ui': patch
---

A rail `PrefsForm`'s pane and section rail clear a scrollbar once. Each pads its far side to keep an overlaid scrollbar off what it holds; where the scrollbar takes room of its own instead, as macOS draws it with a mouse connected, that padding now drops to the near side's, and the scrollbar's gutter does the clearing. Before, the gutter came on top of the padding, so a pane held 15px less with a mouse than with a trackpad; it now holds 11px less, the room the scrollbar itself takes.
