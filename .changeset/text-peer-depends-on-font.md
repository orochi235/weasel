---
'@weasel-js/text': patch
---

`@weasel-js/text` now declares `@weasel-js/font` as a peer dependency rather
than a direct one, matching how `@weasel-js/d3`, `@weasel-js/hud` and
`@weasel-js/ui` already declare `@weasel-js/core`.

A direct dependency lets a consumer end up with two copies of the font
package, and font holds the atlas and glyph caches — two copies means two
caches, and a face registered against one is invisible to the other.

npm 7+ installs peers automatically, so most consumers need do nothing.
