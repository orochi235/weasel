---
'@weasel-js/text': patch
---

A line laid out without a bidi engine no longer builds two arrays for its order: every line of one length shares one frozen order. Nothing laid out changes.
