---
'@weasel-js/editor': patch
'@weasel-js/modes': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Default keys move off chords a browser or another tool takes first. Each change is breaking for anyone relying on the old key.

- `FILE_KEYS.new`, and so `useNewCommand`'s default, is Alt+N instead of Cmd/Ctrl+N, which every browser keeps for a new window.
- Free Transform in `DEFAULT_MODES` is entered on Mod+Alt+T instead of Meta+T, which is a browser's new tab. Mod+Shift+T is not used either: it reopens a closed tab. It is still committed with Enter and abandoned with Escape.
- `useEyedropperTool` has no default hotkey. It used to engage while Alt was held, which shadowed every other tool's Alt-click; pass `hotkey: 'alt'` to keep that.
- `MenuBar`'s access chord (Alt, with File's F, Edit's E and so on) opens a title only while focus is on one of the bar's titles; F10 still moves focus there from anywhere. Elsewhere the chord passes on to the app's own bindings and to the browser, whose menus Alt+F, E, V and H open off a Mac.
- `<TrialTransport keys>` answers Space, the arrows, Home and End, R and `<` / `>` only while focus is outside a field, a control and a canvas. Before, a key pressed on a focused canvas (a trial's own) also played, scrubbed or reversed the clock.
- `<SceneCanvas snap={{ enabled: false }}>` turns snapping off: every gesture runs as though `snap.suspend` (Ctrl) were held, so the pen and spiro place points where they are clicked with no modifier held. `@weasel-js/editor` exports `SNAPPING_KEY`, Mod+Shift+; on the key US layouts put ; on, for an app's snapping toggle.
