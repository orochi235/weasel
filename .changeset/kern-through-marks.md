---
'@weasel-js/text': patch
---

Kerning reads through a nonspacing combining mark: in `A`, U+0301, `B` the `B` is kerned against the `A`, as it is in `AB`. The mark used to take the pair's kerning away, so an accented letter written as two code points set the next letter wider than the same letter precomposed. Text holding such marks can measure narrower than before.
