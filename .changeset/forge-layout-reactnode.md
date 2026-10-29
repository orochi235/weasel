---
'@weasel-js/forge': patch
---

A story that names no layout is now `padded` in both story formats; native stories defaulted to `centered` and CSF stories to `padded`. A prop typed `ReactNode`, or any union of a string with an object, no longer gets a text control from the prop reader, which put an empty text row on many stories; a union of a string with other scalars still does.
