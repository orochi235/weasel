---
'@weasel-js/routing': patch
---

The last operation lets go once an adjustment leaves more than one history entry. It used to stay adjustable with no entry to undo, so the next change in the panel ran the action again on top of the previous result instead of in its place.
