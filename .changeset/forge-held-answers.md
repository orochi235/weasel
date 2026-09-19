---
'@weasel-js/forge': patch
---

The workshop no longer rebuilds a story's instrument when its frame answers for
a config no open trial is showing, such as a late answer for a value the trial
has already moved past. The answer is still kept, and a trial that returns to
that config reads it.
