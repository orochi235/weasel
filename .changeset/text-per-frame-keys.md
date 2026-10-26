---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
---

Drawing a text command whose runs and options have not changed builds no strings and no style object. `cachedLayoutRuns` compares a runs array's last options field by field before building its variant key, `cachedPaintRuns` answers a runs array asked again at the same outline threshold without building its paint key, and `drawText` reads the four style fields it lays out with instead of resolving the whole style each frame.
