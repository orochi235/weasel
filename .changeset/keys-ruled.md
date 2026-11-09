---
'@weasel-js/editor': patch
'@weasel-js/modes': patch
'@weasel-js/core': patch
---

Default keys move off chords a browser takes first. Each is a breaking change for anyone relying on the old key.

- `FILE_KEYS.new`, and so `useNewCommand`'s default, is Alt+N instead of Cmd/Ctrl+N, which every browser keeps for a new window.
- Free Transform in `DEFAULT_MODES` is entered on Mod+Alt+T instead of Meta+T, which is a browser's new tab. Mod+Shift+T, the other candidate, reopens a closed tab. It is still committed with Enter and abandoned with Escape.
- `useEyedropperTool` has no default hotkey. It used to engage while Alt was held, which shadowed every other tool's Alt-click; pass `hotkey: 'alt'` to keep that.
