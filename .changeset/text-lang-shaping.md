---
'@weasel-js/text': patch
'@weasel-js/shape': patch
---

A run and a node's `TextStyle` take `lang`, a BCP 47 tag (`'sr'`, `'ur-PK'`), and a shaped run is shaped in that language, so a face's forms for it are drawn: Serbian Cyrillic italics, Urdu digits, a Sindhi meem. A run's own `lang` overrides the node's. `TextShaper.shape` and `@weasel-js/shape`'s `Shaper.shape` take it as an optional fourth argument, `language`, which `@weasel-js/shape` sets on the HarfBuzz buffer. Two layouts differing only in language are cached apart. This adds API.
