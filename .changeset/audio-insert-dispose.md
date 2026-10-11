---
'@weasel-js/audio': patch
---

An insert effect added and then removed while another slot's crossfade was still running, as `inserts.add(a); inserts.add(b); inserts.clear()` does in one task, never had its `dispose()` called. It is now disposed on removal. `inserts.settled()` also resolves when the engine is disposed mid-crossfade instead of staying pending.
