---
'@weasel-js/labkit': patch
---

`<Lab>`'s `instruments` may now change while it is mounted. An added instrument can open trials and its state serializes through its own hooks; an instrument replaced by a different object has its open trials' and saves' configs refilled from its new defaults before it renders. The store holds the list (`LabStoreState.instruments`, `setInstruments`), and a trial reads its instrument from the store alongside its record. Hoist or memoize the list: a new object each render counts as a replacement.
