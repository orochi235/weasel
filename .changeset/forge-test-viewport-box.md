---
'@weasel-js/forge': patch
---

A story test gives a story's `viewport` to the box the story renders in, as the workshop's stage does, instead of resizing the browser page. The resize was a round trip through Playwright that took 7 to 13 s on a loaded machine, so a story with a viewport, and the story after it, could time out. `RunStoryOptions` loses its `viewport` callback, and the tests forge generates no longer import `vitest/browser`.
