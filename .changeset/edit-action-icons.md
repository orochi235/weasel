---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

The clipboard, duplicate, group, ungroup, reorder and flip actions now ship their own icons, so `<ActionBar group="clipboard" />` and its siblings draw glyphs with no `icons` map. Each reorder and flip variant carries its own glyph (Bring Forward / Bring to Front, Send Backward / Send to Back, Flip Horizontal / Flip Vertical). The twelve glyphs are exported from `@weasel-js/core` and `@weasel-js/ui` as `CutIcon`, `CopyIcon`, `PasteIcon`, `DuplicateIcon`, `GroupIcon`, `UngroupIcon`, `BringForwardIcon`, `BringToFrontIcon`, `SendBackwardIcon`, `SendToBackIcon`, `FlipXIcon` and `FlipYIcon`, in the same 20×20 `currentColor` register as the Pathfinder icons. An `icons` entry still overrides them.
