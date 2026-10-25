---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A section its `enableIf` turns off now dims its title, as a group's does, and its switch leaf stays live. `applyPrefConditions` names every disabled section in `disabled`, and with `keepHidden` every hidden one in `hidden`, by `prefSectionPath(at, key)`: the path of what holds the section, then its key marked so no value path can be the same (`'#look'` at a section root, `'stroke.#edge'` inside an `object` leaf, `'#look.#more'` for a section nested in another). `SelectionPanel`'s sections, and the sections of an `object` leaf in `SelectionPanel`, `PrefsForm`, and labkit's `ControlPanel`, read it through the `disabledAt` they already ask about fields.
