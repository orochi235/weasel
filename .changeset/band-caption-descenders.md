---
'@weasel-js/ui': patch
---

`BandEditor` cut the bottom off a band caption's descenders: "gypsy" drew with the tails of its g, y, and p missing. A caption is now clipped along the track only, so it still ends in an ellipsis in a narrow band and is drawn at full height.
