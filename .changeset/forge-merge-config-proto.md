---
"@weasel-js/forge": patch
---

An index page merges its config overrides into the story's defaults keeping a key named `__proto__` as an own key. It set the merged object's prototype instead, so the override was lost.
