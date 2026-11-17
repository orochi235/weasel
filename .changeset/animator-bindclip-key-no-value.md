---
'@weasel-js/animator': patch
---

`bindClip` refuses a clip key with no `value`, naming it, rather than binding a track that throws when first sampled between keys.

<!-- entry: fix -->
