---
'@weasel-js/react': patch
'@weasel-js/forge': patch
---

`@weasel-js/react` exports `useNearViewport(ref, margin, initial?)`, which says whether an element lies within a CSS margin of the viewport, and keeps following it as it scrolls away and back. It goes by where the element is, so content an `overflow` ancestor clips away still counts as near. forge's story frames use it from here; forge now depends on `@weasel-js/react`.
