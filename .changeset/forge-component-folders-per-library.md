---
"@weasel-js/forge": patch
---

The components view keeps each library's widened labels in that library's own folders. A folder one library's labels opened (`ui` over `ui/Gallery`) took in another library's components widened to the same prefix (`ui/x`), under the first library's tag. Folders two libraries open at one path now list as rows of their own, each with its own key.
