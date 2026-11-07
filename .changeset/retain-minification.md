---
'@weasel-js/renderer': patch
---

`setImageMinification` draws retained groups again. Their surfaces were kept across the change, so an image inside one went on showing the old filtering until something else about the group changed.
