---
'@weasel-js/editor': patch
---

The default keys of the file commands, the document clipboard, and Preferences declare binding ids, `<command id>.key`.

A binding override can now name them. `EDITOR_PREFERENCES_KEY` and `SNAPPING_KEY` are typed as the `KeySpec`s they are.

<!-- entry: fix -->
