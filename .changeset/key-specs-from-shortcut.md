---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

New `keySpecsFromShortcut(shortcut, { platform?, legend? })` turns a kit shortcut (`{ key, mod, shift, alt }`) into `KeySequence` keys, spelled for the platform the way `keySpecsFromMods` and `keySpecFromKey` spell them: `⌘ Z` on macOS, `Ctrl Z` on Windows. An optional shift renders as an optional key. It replaces `formatShortcutParts(s)?.map((label) => ({ label }))`, which always printed macOS glyphs and dropped an optional shift. The `ShortcutInput` type it takes is now exported, and labkit's `weasel-ui` passthrough carries the helper.
