---
"@weasel-js/ui": patch
---

`legend: 'symbol'` now draws symbols on Windows and Linux too, where it used to fall back to text for almost every key. Control (and `mod`) is ⎈ and Alt is ⎇, from ISO/IEC 9995-7, Backspace is ⟵, and Esc, Enter, Tab, Space, and Delete take the symbols macOS already used (⎋ ↵ ⇥ ␣ ⌦). The `auto` and `text` legends are unchanged.
