---
'@weasel-js/react': patch
---

A `useVisibleRaf` loop whose `dangerouslyRunWhenHidden` is turned off while the document is hidden
now suspends on its next frame and resumes when the document shows again. It used to drop that frame
without recording a suspension, so the return re-armed nothing and a continuous loop stopped for good.
