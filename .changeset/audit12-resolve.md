---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fix route-conflict reports, a keymap hint's modifier names, a tuned variant's shortcut chip, mode keys beating the active tool's, and the tool cursor's painted mark.

- The route-conflict check no longer reports a held tool or an ungated hotkey action against a hotkey action gated by an `eligible` rule, which outranks them whenever its rule holds.
- `useContributions` now checks a keymap's own bindings, and entries held only on a key, for route conflicts; both went unchecked.
- A keymap hint names a pointer gesture's modifiers as the platform's keyboard prints them (`Cmd-click` on a Mac, `Ctrl-click` elsewhere) instead of `Mod-click` or `Meta-click`. `describeKeymap` takes an optional `{ platform }`.
- A tool's painted cursor is written again when only its mark changes.
- A variant's shortcut chip in a menu, palette or bar shows a key whose binding fires that variant through a tuning's params.
- Mode keys from `modeShortcuts` ride the ambient tier instead of the hotkey tier, so the active tool's own binding on the same key comes first: Enter finishes a slice cut (or a pen or spiro path) instead of entering Path Edit, and inside Crop instead of committing it. A tool that declines the key still lets the mode take it.
- The route-conflict check reports a hotkey-tier action (a tool shortcut, a keymap leader, `scope: 'hotkey'`) whose binding matches a tool's, which it outranks whenever that tool is active. `Conflict.shadows` marks such a report.
