---
'@weasel-js/hud': patch
---

A HUD menu's text row puts the caret where the typed text is pressed, both when the press starts the edit and during it; a press over the row's label still starts the edit with the caret at the end. Alt+Left and Alt+Right move the caret by a word, and extend the selection by one with Shift held.
