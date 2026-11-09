---
'@weasel-js/editor': patch
'@weasel-js/modes': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Default keys move off chords a browser takes first. Each is a breaking change for anyone relying on the old key.

- `FILE_KEYS.new`, and so `useNewCommand`'s default, is Alt+N instead of Cmd/Ctrl+N, which every browser keeps for a new window.
- Free Transform in `DEFAULT_MODES` is entered on Mod+Alt+T instead of Meta+T, which is a browser's new tab. Mod+Shift+T, the other candidate, reopens a closed tab. It is still committed with Enter and abandoned with Escape.
- `useEyedropperTool` has no default hotkey. It used to engage while Alt was held, which shadowed every other tool's Alt-click; pass `hotkey: 'alt'` to keep that.
- `MenuBar`'s access chord (Alt, with File's F, Edit's E and so on) opens a title only while focus is on one of the bar's titles; F10 still moves focus there from anywhere. Elsewhere the chord passes on to the app's own bindings and to the browser, whose menus Alt+F, E, V and H open off a Mac.
