---
"@weasel-js/ui": patch
---

`KeyCap` draws every symbol legend as an icon instead of a font glyph: the Mac modifiers, ISO/IEC 9995-7's Control and Alt, the editing keys, the arrows, and the navigation keys. A symbol now matches its neighbors whatever font the chip is in, where it used to come from whichever fallback font had it. The icon is 1.25 times the legend's font size, and the symbol's character stays in the chip as visually hidden text, so a screen reader and `textContent` still read it. The 27 glyphs are ui's icons `ui:key*` (`ui:keyCommand`, `ui:keyEscape`, `ui:keyPageUp`, …), drawn at a 2-unit stroke so they hold up at legend sizes.
