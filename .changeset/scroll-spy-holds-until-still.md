---
'@weasel-js/ui': patch
---

`useScrollSpy` holds the section it was sent to until the container stops scrolling. It gave up 700 ms after the scroll began, so a smooth scroll that ran longer, on a slow machine or over a long pane, let a rail mark the sections it was passing. The 700 ms now counts from the last `scroll` event, and `scrollend` still ends the hold at once where the browser sends it.
