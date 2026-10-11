---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/ui': patch
---

`mod` is matched and drawn from one platform read. `@weasel-js/gestures` exports `isApplePlatform()`; the gesture dispatcher uses it for the `isMac` it matches with, and ui's `detectPlatform` uses it to pick key legends. `formatShortcut` and `formatShortcutParts` now follow the platform, taking an optional `{ platform }`: off macOS a `mod` shortcut reads `Ctrl+Z`, not `⌘Z`. Behavior changes: on iPhone and iPad the dispatcher now matches `mod` on Command where it matched Ctrl, and `detectPlatform` reads an unrecognized browser as Linux where it read macOS. ui gains a dependency on `@weasel-js/gestures`.
