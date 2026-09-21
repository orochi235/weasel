---
'@weasel-js/ui': patch
---

`KeySequence` now recognizes Windows and Linux modifier labels (`Ctrl`, `Alt`, `⊞`, `Win`, `Super`) and macOS text legends (`Cmd`, `Option`, `Control`, `Shift`) as modifiers, so they sort ahead of the key and get the `+` separator. Previously only the macOS glyphs did, and a Windows shortcut rendered in input order with no separator. Those labels also take the modifier chip width now.
