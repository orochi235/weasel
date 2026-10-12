---
'@weasel-js/prefs': patch
'@weasel-js/font': patch
'@weasel-js/renderer': patch
---

A subscriber that throws no longer stops the ones after it, and no longer throws into whatever caused the notify. This holds for a prefs store's `subscribe`, font's `subscribeGlyphReady`, and renderer's `subscribeImageReady`, which now share `@weasel-js/registry`'s emitter: the error goes to `console.error` and the rest of the subscribers run. Before, one throwing prefs subscriber made `store.set` throw, and one throwing image subscriber left the others unaware an image had loaded.

For the font and renderer signals, a subscriber added during a notify now waits for the next one; a prefs store already worked that way.
