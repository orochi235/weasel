---
'@weasel-js/ui': patch
---

The two rows of a pair set their labels on one line. In `<PropertyList pack="pairs">` and `<PropertyGroup pack="pairs">` a row beside a taller one, such as a color row beside a slider, was stretched to the pair's height and sank its label under the other's; each row now aligns on its first baseline, so a row is as tall as its own content.
