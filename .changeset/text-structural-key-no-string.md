---
'@weasel-js/text': patch
---

`cachedLayoutRuns` no longer builds a string of every run's text to look a fresh runs array up by its content. It hashes the runs and compares a matching entry field by field with the runs that filled it, so text whose content changes every frame, such as a HUD readout, leaves no key behind for the collector each frame. Layouts are shared exactly as before. The cache now holds the runs it compares against, so a run must not be mutated after it is laid out, as the identity key already required of its array.
