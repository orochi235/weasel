---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: a drag begun in the live preview is canceled when the editor unmounts. Its window key listener stayed behind and could call back into the editor that was gone.
