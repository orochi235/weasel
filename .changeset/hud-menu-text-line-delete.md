---
"@weasel-js/hud": patch
---

A HUD menu's text row now edits by the platform's keys: on macOS, Cmd+Backspace deletes to the start of the line
and Cmd+Delete (Fn+Cmd+Delete) to its end, with Option working by the word as before. On Windows and Linux, Ctrl
works by the word (Ctrl+Arrow, Ctrl+Backspace, Ctrl+Delete) where it used to jump to an end, and Ctrl+Alt (AltGr)
types its character instead of being swallowed.
