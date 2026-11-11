---
"@weasel-js/d3": patch
---

A transition's delay past 2³¹ − 1 ms, the longest one timer holds, is waited out, and an infinite delay never starts the item. Both used to start the item at once.
