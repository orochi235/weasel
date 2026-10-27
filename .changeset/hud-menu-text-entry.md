---
'@weasel-js/hud': patch
---

A HUD menu's text row now takes typed text. Enter on a highlighted text row, or a press on it, starts an edit: a character goes in at the caret, Left, Right, Home and End move it (Cmd or Ctrl with an arrow goes to an end), Shift with any of them selects, Cmd or Ctrl+A selects all, a character, Backspace or Delete replaces the selection or takes the character either side of the caret, Enter writes the text without closing the menu, and Escape puts the value back. A press on another row, or the menu closing, keeps what was typed. The row draws its value in the foreground color with its selection and caret while it is typed into, and the panel leaves room to type. There is no IME composition, and a press does not place the caret.
