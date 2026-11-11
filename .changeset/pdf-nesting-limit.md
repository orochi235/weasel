---
"@weasel-js/pdf": patch
---

Groups nested past 512 deep are left out of the PDF page and reported, as the SVG reader caps nesting, instead of failing the whole file.

<!-- entry: fix -->
