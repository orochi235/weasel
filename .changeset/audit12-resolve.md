---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fix route-conflict reports, a keymap hint's modifier names, and the tool cursor's painted mark.

- The route-conflict check no longer reports a held tool or an ungated hotkey action against a hotkey action gated by an `eligible` rule, which outranks them whenever its rule holds.
- `useContributions` now checks a keymap's own bindings, and entries held only on a key, for route conflicts; both went unchecked.
- A keymap hint names a pointer gesture's modifiers as the platform's keyboard prints them (`Cmd-click` on a Mac, `Ctrl-click` elsewhere) instead of `Mod-click` or `Meta-click`. `describeKeymap` takes an optional `{ platform }`.
- A tool's painted cursor is written again when only its mark changes.
