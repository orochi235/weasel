---
'@weasel-js/hud': patch
---

A HUD menu's text row now takes typed text. Enter on a highlighted text row, or a press on it, starts an edit: characters are added at the end, Backspace takes the last one off, Enter writes the text without closing the menu, and Escape puts the value back. A press on another row, or the menu closing, keeps what was typed. The row draws its value in the foreground color with a caret while it is typed into, and the panel leaves room to type. There is no caret movement, selection or IME composition.
