---
'@weasel-js/font': patch
---

A `.dfont` (Datafork TrueType) face reaches the outline tier. `sfntFromCollection` reads the `sfnt` resources out of the file's resource map and selects one by PostScript name, as it does a `.ttc` member, where it used to throw and leave the face on the SDF tier.
