---
'@weasel-js/text': patch
---

Splitting text into grapheme clusters asks `Intl.Segmenter` only about the clusters that can span more than one code unit, so mostly-Latin text with a few marks, arrows or dashes allocates far less and runs faster. The clusters are unchanged.
