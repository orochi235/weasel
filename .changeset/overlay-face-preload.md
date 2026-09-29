---
"@weasel-js/font": patch
"@weasel-js/core": patch
---

The text edit overlay no longer opens in the fallback font and then reflows. `@weasel-js/font` builds the overlay's DOM face as soon as the outline file's bytes are in hand: at `registerFontOutlines` for an `ArrayBuffer` source, and when the canvas first reads a URL or thunk source, reusing those bytes instead of fetching again. Registering a URL or thunk still fetches nothing. New `cssFontFamilyLoading(family, variant)` returns the load still in flight for the face `cssFontFamily` names, or `null` when there is nothing to wait for. An edit whose face is still loading keeps the overlay hidden until the face lands or for at most `fontHold` ms (new option on `useTextEdit` and `useSceneTextEdit`; default `TEXT_EDIT_FONT_HOLD`, 100ms), then shows the fallback. `0` restores the old behavior. Additive.
