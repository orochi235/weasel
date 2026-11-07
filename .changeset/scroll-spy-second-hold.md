---
'@weasel-js/ui': patch
---

`useScrollSpy`'s `scrollTo` holds the section it was sent to on every call, not only the first. A second call ran the first call's release after taking its own hold, which dropped that hold at once, so the rail flickered through the sections the scroll passed on its way.
