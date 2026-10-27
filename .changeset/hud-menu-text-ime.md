---
'@weasel-js/hud': patch
---

A HUD menu's text row takes input-method composition: while an edit runs, `attachHud` moves the canvas's DOM focus to a hidden `<input>` placed at the caret, draws the text being composed underlined in place of the selection, and enters it when the composition ends. The HUD keeps focus while the input holds it, and keys typed there reach the widget as the canvas's would; keys belonging to a composition reach neither. Text the platform enters without a key, as from a character picker, is entered too. Alt+Backspace and Alt+Delete now delete a word.

Adds API: `Widget.textInput`, typed `HudTextInput`, through which any widget can ask for the same hidden input.
