---
'@weasel-js/svg': patch
---

Importing SVG keeps a fill or stroke a `<use>` sets as its drawn shape's own, instead of marking the shape as taking the paint of the group around the `<use>`.

<!-- entry: fix data visual -->
