---
'@weasel-js/font': patch
---

`enableLocalFontOutlines` filed a face whose style spells its weight as two words ("Demi Bold", "Ultra Light", "Extra Bold") under the second word's weight, so "Demi Bold" collided with "Bold" and no 600 face was registered. `parseFontStyle` now reads the two-word and hyphenated spellings as the one-word weight.
